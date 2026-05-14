import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { enforceMutationSecurity, enforceRateLimit, getClientIp } from '@/lib/security';
import { validatePasswordSecurity } from '@/lib/password-security';

const createAuditorSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

const updateAuditorSchema = z.object({
  id: z.string().uuid('ID tidak valid'),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']),
});

const deleteAuditorSchema = z.object({
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
      key: `admin-manage-auditors:create:${actor.id}:${getClientIp(request)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { name, email, password } = createAuditorSchema.parse(body);
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

    // Create auditor user
    const auditor = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'AUDITOR',
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
    await logSecurityEvent(actor.id, 'CREATE_AUDITOR', `Admin ${actor.email} membuat akun auditor ${auditor.email}`);

    return NextResponse.json({
      message: 'Auditor berhasil ditambahkan',
      auditor,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Create auditor error:', error);
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

    // Get all auditors
    const auditors = await prisma.user.findMany({
      where: {
        role: 'AUDITOR',
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

    return NextResponse.json({ auditors });
  } catch (error) {
    console.error('Get auditors error:', error);
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
      key: `admin-manage-auditors:update:${actor.id}:${getClientIp(request)}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { id, status } = updateAuditorSchema.parse(body);

    // Update auditor status
    const updatedAuditor = await prisma.user.update({
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
    await logSecurityEvent(actor.id, 'UPDATE_AUDITOR_STATUS', `Admin ${actor.email} mengubah status auditor ${updatedAuditor.email} menjadi ${updatedAuditor.status}`);

    return NextResponse.json({
      message: 'Status auditor berhasil diperbarui',
      auditor: updatedAuditor,
    });
  } catch (error) {
    console.error('Update auditor error:', error);
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
      key: `admin-manage-auditors:delete:${admin.id}:${getClientIp(request)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { id } = deleteAuditorSchema.parse(body);

    // Prevent self-deletion
    if (id === admin.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    // Check if user exists and is an auditor
    const auditor = await prisma.user.findUnique({
      where: { id },
    });

    if (!auditor) {
      return NextResponse.json(
        { error: 'Auditor tidak ditemukan' },
        { status: 404 }
      );
    }

    if (auditor.role !== 'AUDITOR') {
      return NextResponse.json(
        { error: 'Hanya dapat menghapus akun auditor' },
        { status: 400 }
      );
    }

    // Delete related audit logs first to avoid foreign key constraint errors
    await prisma.auditLog.deleteMany({ where: { auditorId: id } });

    // Delete the auditor
    await prisma.user.delete({
      where: { id },
    });
    await logSecurityEvent(admin.id, 'DELETE_AUDITOR', `Admin ${admin.email} menghapus akun auditor ${auditor.email}`);

    return NextResponse.json({
      message: 'Auditor berhasil dihapus',
    });
  } catch (error) {
    console.error('Delete auditor error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
