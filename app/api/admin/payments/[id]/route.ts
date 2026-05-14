import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, logSecurityEvent } from '@/lib/auth';
import { z } from 'zod';
import { enforceMutationSecurity } from '@/lib/security';

const confirmPaymentSchema = z.object({
  status: z.enum(['PAID', 'REJECTED']),
});

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
    const url = new URL(request.url);
    const paymentId = url.pathname.split('/').pop();

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = confirmPaymentSchema.parse(body);

    // Get payment and loan info
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        loan: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Payment sudah diproses sebelumnya' },
        { status: 400 }
      );
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
    await logSecurityEvent(actor.id, 'UPDATE_PAYMENT_STATUS', `Admin ${actor.email} mengubah status pembayaran ${paymentId} menjadi ${status}`);

    // If approved, check if loan is fully paid
    if (status === 'PAID') {
      // Calculate total debt
      const totalDebt = payment.loan.amount + (payment.loan.amount * payment.loan.interest) / 100;
      
      // Get all PAID payments
      const allPaidPayments = await prisma.payment.findMany({
        where: { 
          loanId: payment.loanId, 
          status: 'PAID' 
        },
      });

      const totalPaid = allPaidPayments.reduce((sum, p) => sum + p.amount, 0);

      // If fully paid, update loan status
      if (totalPaid >= totalDebt) {
        await prisma.loan.update({
          where: { id: payment.loanId },
          data: { status: 'PAID' },
        });

        return NextResponse.json({
          message: 'Pembayaran berhasil dikonfirmasi. Pinjaman sudah lunas!',
          isFullyPaid: true,
          totalPaid,
          totalDebt,
        });
      }

      return NextResponse.json({
        message: 'Pembayaran berhasil dikonfirmasi',
        isFullyPaid: false,
        totalPaid,
        totalDebt,
        remainingDebt: totalDebt - totalPaid,
      });
    }

    return NextResponse.json({
      message: 'Pembayaran ditolak',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Payment confirmation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
