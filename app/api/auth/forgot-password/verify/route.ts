import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';
import { logSecurityEvent } from '@/lib/auth';
import { verifyAnswer, QUESTION_KEYS } from '@/lib/security-questions';

const JWT_SECRET = process.env.JWT_SECRET;
const RESET_TOKEN_EXPIRY_SECONDS = 5 * 60;

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return JWT_SECRET;
}

const verifyAnswersSchema = z.object({
  email: z.string().email('Email tidak valid'),
  answers: z.array(z.object({
    question: z.string().min(1),
    answer: z.string().min(1, 'Jawaban wajib diisi'),
  })).length(5),
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
    const { email, answers } = verifyAnswersSchema.parse(body);

    const ipAddress = getClientIp(request);
    const rateLimit = await consumeRateLimit({
      key: `forgot-password:verify:${email.toLowerCase()}:${ipAddress}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        {
          error: `Terlalu banyak percobaan verifikasi. Coba lagi ${rateLimit.retryAfterMinutes} menit.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': rateLimit.retryAfterSeconds.toString() },
        }
      ));
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return withPrivateCache(NextResponse.json(
        { error: 'Verifikasi gagal. Jawaban tidak sesuai.' },
        { status: 400 }
      ));
    }

    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      return withPrivateCache(NextResponse.json(
        { error: 'Verifikasi gagal. Jawaban tidak sesuai.' },
        { status: 400 }
      ));
    }

    const storedQuestions = await prisma.securityQuestion.findMany({
      where: { userId: user.id },
    });

    if (storedQuestions.length !== 5) {
      return withPrivateCache(NextResponse.json(
        { error: 'Verifikasi gagal. Jawaban tidak sesuai.' },
        { status: 400 }
      ));
    }

    for (const answer of answers) {
      if (!QUESTION_KEYS.includes(answer.question as typeof QUESTION_KEYS[number])) {
        return withPrivateCache(NextResponse.json(
          { error: 'Verifikasi gagal. Jawaban tidak sesuai.' },
          { status: 400 }
        ));
      }

      const stored = storedQuestions.find((sq) => sq.question === answer.question);
      if (!stored) {
        return withPrivateCache(NextResponse.json(
          { error: 'Verifikasi gagal. Jawaban tidak sesuai.' },
          { status: 400 }
        ));
      }

      const isValid = await verifyAnswer(answer.answer, stored.answer);
      if (!isValid) {
        return withPrivateCache(NextResponse.json(
          { error: 'Verifikasi gagal. Jawaban tidak sesuai.' },
          { status: 400 }
        ));
      }
    }

    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        sessionVersion: user.sessionVersion,
        purpose: 'password-reset',
      },
      getJwtSecret(),
      { expiresIn: RESET_TOKEN_EXPIRY_SECONDS }
    );

    await logSecurityEvent(
      user.id,
      'FORGOT_PASSWORD_QUESTIONS_VERIFIED',
      `User ${user.email} berhasil verifikasi pertanyaan keamanan`,
      undefined,
      ipAddress,
      request.headers.get('user-agent') || undefined
    );

    return withPrivateCache(NextResponse.json({
      verified: true,
      resetToken,
      email: user.email,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Forgot password verify error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
