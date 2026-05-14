import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { enforceMutationSecurity, enforceRateLimit, getClientIp } from '@/lib/security';
import { validatePasswordSecurity } from '@/lib/password-security';

const createAdminSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

const updateAdminSchema = z.object({
  id: z.string().uuid('ID tidak valid'),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']),
});

const deleteAdminSchema = z.object({
  id: z.string().uuid('ID tidak valid'),
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

    const { user: actor } = authResult;
    const rateLimited = await enforceRateLimit({
      key: `admin-manage-admins:create:${actor.id}:${getClientIp(request)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { name, email, password } = createAdminSchema.parse(body);
    const passwordValidation = await validatePasswordSecurity(password);

    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message, passwordPolicyCode: passwordValidation.code },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
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
    await logSecurityEvent(actor.id, 'CREATE_ADMIN', `Admin ${actor.email} membuat akun admin ${admin.email}`);

    return NextResponse.json({
      message: 'Admin berhasil ditambahkan',
      admin,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Create admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    // Get all admins
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('Get admins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const authResult = await requireAdmin(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user: actor } = authResult;
    const rateLimited = await enforceRateLimit({
      key: `admin-manage-admins:update:${actor.id}:${getClientIp(request)}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { id, status } = updateAdminSchema.parse(body);

    // Update admin status
    const updatedAdmin = await prisma.user.update({
      where: { id },
      data: {
        status,
        sessionVersion: { increment: 1 },
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
    await logSecurityEvent(actor.id, 'UPDATE_ADMIN_STATUS', `Admin ${actor.email} mengubah status admin ${updatedAdmin.email} menjadi ${updatedAdmin.status}`);

    return NextResponse.json({
      message: 'Status admin berhasil diperbarui',
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
      key: `admin-manage-admins:delete:${admin.id}:${getClientIp(request)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { id } = deleteAdminSchema.parse(body);

    // Prevent self-deletion
    if (id === admin.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    // Check if user exists and is an admin
    const targetAdmin = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }

    if (targetAdmin.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Hanya dapat menghapus akun admin' },
        { status: 400 }
      );
    }

    // Delete the admin
    await prisma.user.delete({
      where: { id },
    });
    await logSecurityEvent(admin.id, 'DELETE_ADMIN', `Admin ${admin.email} menghapus akun admin ${targetAdmin.email}`);

    return NextResponse.json({
      message: 'Admin berhasil dihapus',
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
