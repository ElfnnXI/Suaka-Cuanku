import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { completeMfaChallenge, getPendingMfaChallenge } from '@/lib/mfa';
import { logSecurityEvent } from '@/lib/auth';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';

const verifyMfaSchema = z.object({
  totpCode: z.string().min(1, 'Kode authenticator wajib diisi'),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return withPrivateCache(NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      ));
    }

    const challenge = await getPendingMfaChallenge(request);
    if (!challenge) {
      return withPrivateCache(NextResponse.json(
        { error: 'Sesi MFA tidak ditemukan atau sudah kedaluwarsa.' },
        { status: 401 }
      ));
    }

    const rateLimit = await consumeRateLimit({
      key: `mfa-verify:${challenge.user.id}:${getClientIp(request)}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak percobaan MFA. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const body = await request.json();
    const { totpCode } = verifyMfaSchema.parse(body);
    const result = await completeMfaChallenge(challenge.id, totpCode);

    if ('error' in result) {
      return withPrivateCache(NextResponse.json(
        { error: result.error },
        { status: result.status }
      ));
    }

    await logSecurityEvent(challenge.user.id, 'LOGIN_SUCCESS', `User ${challenge.user.email} berhasil login dengan MFA`);
    return withPrivateCache(result.response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Verify MFA error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
