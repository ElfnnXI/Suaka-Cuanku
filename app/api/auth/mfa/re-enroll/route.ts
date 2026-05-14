import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, logSecurityEvent } from '@/lib/auth';
import { finalizeReEnrollAuthenticator, getReEnrollSetupData, verifySensitiveActionChallenge } from '@/lib/mfa';
import { consumeRateLimit, enforceMutationSecurity, getClientIp, withPrivateCache } from '@/lib/security';

const prepareReEnrollSchema = z.object({
  totpCode: z.string().min(1, 'Kode authenticator wajib diisi'),
});

const finalizeReEnrollSchema = z.object({
  newTotpCode: z.string().min(1, 'Kode authenticator baru wajib diisi'),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const rateLimit = await consumeRateLimit({
      key: `mfa-reenroll-setup:${authResult.user.id}:${getClientIp(request)}`,
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak permintaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const setup = await getReEnrollSetupData(authResult.user.id);
    return withPrivateCache(NextResponse.json(setup));
  } catch (error) {
    console.error('Get re-enroll MFA setup error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Setup re-enroll authenticator tidak tersedia.' },
      { status: 404 }
    ));
  }
}

export async function POST(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return withPrivateCache(securityError);
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const rateLimit = await consumeRateLimit({
      key: `mfa-reenroll-submit:${authResult.user.id}:${getClientIp(request)}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak percobaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const body = await request.json();

    if ('newTotpCode' in body) {
      const { newTotpCode } = finalizeReEnrollSchema.parse(body);
      const result = await finalizeReEnrollAuthenticator(authResult.user.id, newTotpCode);

      if ('error' in result) {
        return withPrivateCache(NextResponse.json(
          { error: result.error },
          { status: result.status }
        ));
      }

      await logSecurityEvent(authResult.user.id, 'REENROLL_TOTP', `User ${authResult.user.email} menyelesaikan re-enroll authenticator`);
      return withPrivateCache(NextResponse.json({
        message: 'Authenticator baru berhasil diaktifkan.',
      }));
    }

    const { totpCode } = prepareReEnrollSchema.parse(body);
    const verification = await verifySensitiveActionChallenge(
      authResult.user.id,
      'REENROLL_TOTP',
      totpCode,
      { consume: false }
    );

    if ('error' in verification) {
      return withPrivateCache(NextResponse.json(
        { error: verification.error },
        { status: verification.status }
      ));
    }

    const setup = await getReEnrollSetupData(authResult.user.id);
    await logSecurityEvent(authResult.user.id, 'REENROLL_TOTP_PREPARE', `User ${authResult.user.email} memulai re-enroll authenticator`);

    return withPrivateCache(NextResponse.json({
      message: 'Verifikasi berhasil. Lanjutkan scan authenticator baru.',
      ...setup,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Re-enroll MFA error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
