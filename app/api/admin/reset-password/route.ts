import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { enforceMutationSecurity, enforceRateLimit, getClientIp, withPrivateCache } from '@/lib/security';
import { validatePasswordSecurity } from '@/lib/password-security';
const resetPasswordSchema = z.object({
  userId: z.string().uuid('ID user tidak valid'),
  newPassword: z.string().min(1, 'Password baru wajib diisi'),
});

export async function POST(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const authResult = await requireAdmin(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user: admin } = authResult;
    const rateLimited = await enforceRateLimit({
      key: `admin-reset-password:${admin.id}:${getClientIp(request)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return withPrivateCache(rateLimited);
    }

    const body = await request.json();
    const { userId, newPassword } = resetPasswordSchema.parse(body);
    const passwordValidation = await validatePasswordSecurity(newPassword);

    if (!passwordValidation.valid) {
      return withPrivateCache(NextResponse.json(
        { error: passwordValidation.message, passwordPolicyCode: passwordValidation.code },
        { status: 400 }
      ));
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return withPrivateCache(NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      ));
    }

    // Prevent admin from resetting their own password via this endpoint
    // (they should use the self-service endpoint instead)
    if (targetUser.id === admin.id) {
      return withPrivateCache(NextResponse.json(
        { error: 'Gunakan fitur "Ubah Password" di profil untuk mengubah password sendiri' },
        { status: 400 }
      ));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    });

    await logSecurityEvent(
      admin.id,
      'RESET_PASSWORD',
      `Admin ${admin.email} mereset password ${targetUser.role.toLowerCase()} ${targetUser.email}`,
      `Target userId=${targetUser.id}`
    );

    const roleLabel = targetUser.role === 'USER' ? 'User' : 
                      targetUser.role === 'AUDITOR' ? 'Auditor' : 'Admin';

    return withPrivateCache(NextResponse.json({
      message: `Password ${roleLabel} ${targetUser.name} berhasil direset`,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Reset password error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
