import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, logSecurityEvent } from '@/lib/auth';
import { enforceMutationSecurity, enforceRateLimit, getClientIp, withPrivateCache } from '@/lib/security';
import { securityQuestionsSchema, SECURITY_QUESTIONS, hashAnswer } from '@/lib/security-questions';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const { user } = authResult;
    const questions = await prisma.securityQuestion.findMany({
      where: { userId: user.id },
      select: { question: true, createdAt: true },
    });

    return withPrivateCache(NextResponse.json({
      questions: questions.map((q) => ({
        key: q.question,
        label: SECURITY_QUESTIONS.find((sq) => sq.key === q.question)?.label ?? q.question,
        createdAt: q.createdAt,
      })),
    }));
  } catch (error) {
    console.error('Get security questions error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}

export async function PUT(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const { user } = authResult;
    const rateLimited = await enforceRateLimit({
      key: `security-questions:${user.id}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (rateLimited) {
      return withPrivateCache(rateLimited);
    }

    const body = await request.json();
    const items = securityQuestionsSchema.parse(body);

    const hashedItems = await Promise.all(
      items.map(async (item) => ({
        userId: user.id,
        question: item.question,
        answer: await hashAnswer(item.answer),
      }))
    );

    await prisma.$transaction([
      prisma.securityQuestion.deleteMany({ where: { userId: user.id } }),
      prisma.securityQuestion.createMany({ data: hashedItems }),
    ]);

    await logSecurityEvent(
      user.id,
      'UPDATE_SECURITY_QUESTIONS',
      `User ${user.email} memperbarui pertanyaan keamanan`,
      undefined,
      getClientIp(request),
      request.headers.get('user-agent') || undefined
    );

    return withPrivateCache(NextResponse.json({
      message: 'Pertanyaan keamanan berhasil disimpan',
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return withPrivateCache(NextResponse.json(
        { error: (error as unknown as { issues: Array<{ message: string }> }).issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Update security questions error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
