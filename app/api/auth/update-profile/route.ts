import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSecurityEvent, requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { enforceMutationSecurity, withPrivateCache } from '@/lib/security';
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
});

export async function PATCH(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const { user } = authResult;

    const body = await request.json();
    const { name, email } = updateProfileSchema.parse(body);

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== user.id) {
      return withPrivateCache(NextResponse.json(
        { error: 'Email sudah digunakan oleh pengguna lain' },
        { status: 400 }
      ));
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    await logSecurityEvent(user.id, 'UPDATE_PROFILE', `Profil ${user.email} diperbarui`);

    return withPrivateCache(NextResponse.json({
      message: 'Profil berhasil diperbarui',
      user: updatedUser,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Update profile error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
