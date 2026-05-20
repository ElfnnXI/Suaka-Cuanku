import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, getUserWithPasswordFromRequest, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { enforceMutationSecurity, getSessionCookieOptions, withPrivateCache } from '@/lib/security';
import { validatePasswordSecurity } from '@/lib/password-security';
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(1, 'Password baru wajib diisi'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Password baru dan konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const user = await getUserWithPasswordFromRequest(request);

    if (!user) {
      return withPrivateCache(NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ));
    }

    // Check if user is blocked or suspended
    if (user.status === 'BLOCKED') {
      return withPrivateCache(NextResponse.json(
        { error: 'Akun Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' },
        { status: 403 }
      ));
    }

    if (user.status === 'SUSPENDED') {
      return withPrivateCache(NextResponse.json(
        { error: 'Akun Anda sedang ditangguhkan. Hubungi admin untuk informasi lebih lanjut.' },
        { status: 403 }
      ));
    }

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);
    const passwordValidation = await validatePasswordSecurity(newPassword);

    if (!passwordValidation.valid) {
      return withPrivateCache(NextResponse.json(
        { error: passwordValidation.message, passwordPolicyCode: passwordValidation.code },
        { status: 400 }
      ));
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return withPrivateCache(NextResponse.json(
        { error: 'Password saat ini tidak benar' },
        { status: 400 }
      ));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    });
    await logSecurityEvent(user.id, 'CHANGE_PASSWORD', `Password akun ${user.email} berhasil diubah`);

    const token = await generateToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      sessionVersion: updatedUser.sessionVersion,
    });

    const roleLabel = user.role === 'USER' ? 'User' : 
                      user.role === 'AUDITOR' ? 'Auditor' : 'Admin';

    const response = NextResponse.json({
      message: `Password ${roleLabel} berhasil diubah`,
    });
    response.cookies.set('token', token, getSessionCookieOptions());

    return withPrivateCache(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Change password error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
