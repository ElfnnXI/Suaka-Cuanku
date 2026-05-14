import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import { enforceMutationSecurity } from '@/lib/security';

const updateLoanSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PAID']),
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
    
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user: actor } = authResult;
    const { id } = await params;
    const body = await request.json();
    const { status } = updateLoanSchema.parse(body);

    // Update loan status
    const loan = await prisma.loan.update({
      where: { id },
      data: { status },
    });
    await logSecurityEvent(actor.id, 'UPDATE_LOAN_STATUS', `Admin ${actor.email} mengubah status pinjaman ${loan.id} menjadi ${loan.status}`);

    return NextResponse.json({
      message: `Loan ${status.toLowerCase()} successfully`,
      loan,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Update loan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
