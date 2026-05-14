import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { beginPasswordResetChallenge, attachPendingPasswordReset } from '@/lib/mfa';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';

const forgotPasswordSchema = z.object({
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

    const rateLimit = await consumeRateLimit({
      key: `forgot-password:${getClientIp(request)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak permintaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);
    const challenge = await beginPasswordResetChallenge(email.toLowerCase());

    const response = NextResponse.json({
      message: 'Jika email terdaftar, Anda bisa lanjut ke verifikasi authenticator untuk reset password.',
      requiresMfa: Boolean(challenge),
    });

    if (challenge) {
      attachPendingPasswordReset(response, challenge.challenge.id);
    }

    return withPrivateCache(response);
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
