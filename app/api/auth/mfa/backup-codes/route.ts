import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, logSecurityEvent } from '@/lib/auth';
import { consumeSensitiveActionChallenge, getBackupCodeStatus, replaceBackupCodes, verifySensitiveActionChallenge } from '@/lib/mfa';
import { consumeRateLimit, enforceMutationSecurity, getClientIp, withPrivateCache } from '@/lib/security';

const regenerateBackupCodesSchema = z.object({
  totpCode: z.string().min(1, 'Kode authenticator wajib diisi'),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const rateLimit = await consumeRateLimit({
      key: `mfa-backup-codes-status:${authResult.user.id}:${getClientIp(request)}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak permintaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const status = await getBackupCodeStatus(authResult.user.id);
    return withPrivateCache(NextResponse.json(status));
  } catch (error) {
    console.error('Get backup code status error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
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
      key: `mfa-backup-codes-regenerate:${authResult.user.id}:${getClientIp(request)}`,
      limit: 6,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak permintaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const body = await request.json();
    const { totpCode } = regenerateBackupCodesSchema.parse(body);
    const verification = await verifySensitiveActionChallenge(
      authResult.user.id,
      'REGENERATE_BACKUP_CODES',
      totpCode,
      { consume: false }
    );

    if ('error' in verification) {
      return withPrivateCache(NextResponse.json(
        { error: verification.error },
        { status: verification.status }
      ));
    }

    const codes = await replaceBackupCodes(authResult.user.id);
    if (verification.challenge) {
      await consumeSensitiveActionChallenge(verification.challenge.id);
    }
    await logSecurityEvent(authResult.user.id, 'REGENERATE_BACKUP_CODES', `User ${authResult.user.email} membuat ulang backup codes MFA`);

    return withPrivateCache(NextResponse.json({
      message: 'Backup codes baru berhasil dibuat.',
      codes,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Regenerate backup codes error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
