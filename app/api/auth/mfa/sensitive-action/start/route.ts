import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, logSecurityEvent } from '@/lib/auth';
import { beginSensitiveActionChallenge, generateTotpSecret } from '@/lib/mfa';
import { consumeRateLimit, enforceMutationSecurity, getClientIp, withPrivateCache } from '@/lib/security';

const startSensitiveActionSchema = z.object({
  action: z.enum([
    'UPDATE_PROFILE',
    'CHANGE_PASSWORD',
    'REGENERATE_BACKUP_CODES',
    'REENROLL_TOTP',
    'ADMIN_RESET_PASSWORD',
  ]),
});

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
      key: `mfa-sensitive-start:${authResult.user.id}:${getClientIp(request)}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak permintaan MFA. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const body = await request.json();
    const { action } = startSensitiveActionSchema.parse(body);
    const challenge = await beginSensitiveActionChallenge(
      authResult.user.id,
      action,
      action === 'REENROLL_TOTP'
        ? { pendingTotpSecret: generateTotpSecret() }
        : {}
    );

    await logSecurityEvent(authResult.user.id, 'MFA_STEP_UP_START', `User ${authResult.user.email} memulai verifikasi MFA untuk aksi ${action}`);

    return withPrivateCache(NextResponse.json({
      message: 'Verifikasi authenticator untuk aksi sensitif siap digunakan.',
      action,
      expiresAt: challenge.expiresAt,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Start sensitive action MFA error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
