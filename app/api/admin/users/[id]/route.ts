import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import { enforceMutationSecurity } from '@/lib/security';

const updateUserSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  riskReason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const authResult = await requireAdmin(request);
    if (authResult instanceof Response) return authResult;

    const { user: actor } = authResult;
    const { id } = await params;
    const body = await request.json();
    const { status, riskLevel, riskReason } = updateUserSchema.parse(body);

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(status && { sessionVersion: { increment: 1 } }),
        ...(riskLevel && { riskLevel }),
        ...(riskReason !== undefined && { riskReason }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        riskLevel: true,
        riskReason: true,
        createdAt: true,
      },
    });
    await logSecurityEvent(actor.id, 'UPDATE_USER', `Admin ${actor.email} memperbarui akun ${user.email}`);

    return NextResponse.json({ message: 'User updated successfully', user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const authResult = await requireAdmin(request);
    if (authResult instanceof Response) return authResult;

    const { id } = await params;

    // Prevent admin from deleting themselves
    const admin = authResult.user;
    if (admin.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Delete related records first to avoid foreign key constraint errors
    await prisma.$transaction(async (tx) => {
      // Delete payments associated with user's loans
      const userLoans = await tx.loan.findMany({ where: { userId: id }, select: { id: true } });
      if (userLoans.length > 0) {
        await tx.payment.deleteMany({
          where: { loanId: { in: userLoans.map((loan) => loan.id) } },
        });
      }

      // Delete user's loans
      await tx.loan.deleteMany({ where: { userId: id } });

      // Delete audit logs created by this user (if they were an auditor)
      await tx.auditLog.deleteMany({ where: { auditorId: id } });
    });

    // Delete the user
    const deletedUser = await prisma.user.delete({ where: { id } });
    await logSecurityEvent(admin.id, 'DELETE_USER', `Admin ${admin.email} menghapus akun ${deletedUser.email}`);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
