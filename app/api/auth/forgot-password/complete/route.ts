import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { verifyPasswordResetMfa, getPendingPasswordResetChallenge, clearPendingPasswordResetCookie } from '@/lib/mfa';
import { validatePasswordSecurity } from '@/lib/password-security';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';
import { prisma } from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';

const resetPasswordSchema = z.object({
  totpCode: z.string().min(1, 'Kode authenticator wajib diisi'),
  newPassword: z.string().min(1, 'Password baru wajib diisi'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Password baru dan konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return withPrivateCache(NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      ));
    }

    const pendingChallenge = await getPendingPasswordResetChallenge(request);
    if (!pendingChallenge) {
      return withPrivateCache(NextResponse.json(
        { error: 'Sesi reset password tidak ditemukan atau sudah kedaluwarsa.' },
        { status: 401 }
      ));
    }

    const rateLimit = await consumeRateLimit({
      key: `forgot-password-complete:${pendingChallenge.user.id}:${getClientIp(request)}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        { error: `Terlalu banyak percobaan reset password. Coba lagi ${rateLimit.retryAfterMinutes} menit.` },
        { status: 429 }
      ));
    }

    const body = await request.json();
    const { totpCode, newPassword } = resetPasswordSchema.parse(body);
    const passwordValidation = await validatePasswordSecurity(newPassword);

    if (!passwordValidation.valid) {
      return withPrivateCache(NextResponse.json(
        { error: passwordValidation.message, passwordPolicyCode: passwordValidation.code },
        { status: 400 }
      ));
    }

    const mfaResult = await verifyPasswordResetMfa(pendingChallenge.id, totpCode);
    if ('error' in mfaResult) {
      return withPrivateCache(NextResponse.json(
        { error: mfaResult.error },
        { status: mfaResult.status }
      ));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: mfaResult.userId },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    });

    await logSecurityEvent(mfaResult.userId, 'FORGOT_PASSWORD_RESET', `Password akun ${mfaResult.email} berhasil direset secara mandiri`);

    const response = NextResponse.json({
      message: 'Password berhasil direset. Silakan login dengan password baru Anda.',
    });
    clearPendingPasswordResetCookie(response);
    return withPrivateCache(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Forgot password complete error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
