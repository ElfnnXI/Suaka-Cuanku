import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';
import { SECURITY_QUESTIONS } from '@/lib/security-questions';

const forgotPasswordStartSchema = z.object({
  email: z.string().email('Email tidak valid'),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return withPrivateCache(NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      ));
    }

    const body = await request.json();
    const { email } = forgotPasswordStartSchema.parse(body);
    const normalizedEmail = email.toLowerCase();

    const rateLimit = await consumeRateLimit({
      key: `forgot-password:${normalizedEmail}:${getClientIp(request)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak permintaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        securityQuestions: {
          select: { question: true },
        },
      },
    });

    if (user && user.securityQuestions.length === 5) {
      return withPrivateCache(NextResponse.json({
        hasQuestions: true,
        email: normalizedEmail,
        questions: SECURITY_QUESTIONS.map((q) => ({
          key: q.key,
          label: q.label,
          type: q.type,
          placeholder: q.placeholder,
        })),
      }));
    }

    return withPrivateCache(NextResponse.json({
      hasQuestions: false,
      message: 'Silakan hubungi admin untuk reset password akun Anda.',
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Forgot password start error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
