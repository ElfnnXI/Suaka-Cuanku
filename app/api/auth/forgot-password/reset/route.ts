import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';
import { logSecurityEvent } from '@/lib/auth';
import { validatePasswordSecurity } from '@/lib/password-security';

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return JWT_SECRET;
}

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Token reset wajib diisi'),
  newPassword: z.string().min(1, 'Password baru wajib diisi'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Password baru dan konfirmasi tidak cocok',
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

    const rateLimit = await consumeRateLimit({
      key: `forgot-password:reset:${getClientIp(request)}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        {
          error: `Terlalu banyak percobaan. Coba lagi ${rateLimit.retryAfterMinutes} menit.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': rateLimit.retryAfterSeconds.toString() },
        }
      ));
    }

    const body = await request.json();
    const { resetToken, newPassword } = resetPasswordSchema.parse(body);

    let tokenPayload: { userId: string; email: string; sessionVersion: number; purpose: string };
    try {
      tokenPayload = jwt.verify(resetToken, getJwtSecret()) as typeof tokenPayload;
    } catch {
      return withPrivateCache(NextResponse.json(
        { error: 'Token reset tidak valid atau sudah kedaluwarsa.' },
        { status: 400 }
      ));
    }

    if (tokenPayload.purpose !== 'password-reset') {
      return withPrivateCache(NextResponse.json(
        { error: 'Token reset tidak valid.' },
        { status: 400 }
      ));
    }

    const passwordValidation = await validatePasswordSecurity(newPassword);
    if (!passwordValidation.valid) {
      return withPrivateCache(NextResponse.json(
        { error: passwordValidation.message, passwordPolicyCode: passwordValidation.code },
        { status: 400 }
      ));
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
    });

    if (!user) {
      return withPrivateCache(NextResponse.json(
        { error: 'Token reset tidak valid.' },
        { status: 400 }
      ));
    }

    if (user.sessionVersion !== tokenPayload.sessionVersion) {
      return withPrivateCache(NextResponse.json(
        { error: 'Token reset sudah tidak berlaku. Silakan ulangi dari awal.' },
        { status: 400 }
      ));
    }

    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      return withPrivateCache(NextResponse.json(
        { error: 'Akun tidak dalam status aktif.' },
        { status: 403 }
      ));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    });

    await logSecurityEvent(
      user.id,
      'FORGOT_PASSWORD_RESET',
      `Password akun ${user.email} berhasil direset melalui pertanyaan keamanan`
    );

    return withPrivateCache(NextResponse.json({
      message: 'Password berhasil direset. Silakan login dengan password baru Anda.',
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Forgot password reset error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
