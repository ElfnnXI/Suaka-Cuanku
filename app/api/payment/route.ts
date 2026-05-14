import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { enforceMutationSecurity, enforceRateLimit, getClientIp } from '@/lib/security';

const paymentSchema = z.object({
  loanId: z.string().uuid('Invalid loan ID'),
  amount: z.number().min(1000, 'Minimum pembayaran adalah Rp 1,000'),
});

export async function POST(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const rateLimited = await enforceRateLimit({
      key: `payment:${getClientIp(request)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const authResult = await requireAuth(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const { loanId, amount } = paymentSchema.parse(body);

    // Verify loan belongs to user
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: user.id,
      },
      include: {
        payments: true,
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found' },
        { status: 404 }
      );
    }

    if (loan.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Pembayaran hanya dapat dilakukan untuk pinjaman yang disetujui' },
        { status: 400 }
      );
    }

    // Calculate total debt (principal + interest)
    const totalDebt = loan.amount + (loan.amount * loan.interest) / 100;

    // Get existing PAID payments only
    const paidPayments = loan.payments.filter(p => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingDebt = totalDebt - totalPaid;

    if (amount > remainingDebt) {
      return NextResponse.json(
        { error: `Jumlah pembayaran melebihi sisa hutang. Sisa hutang: Rp ${remainingDebt.toLocaleString('id-ID')}` },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Jumlah pembayaran harus lebih dari 0' },
        { status: 400 }
      );
    }

    // Create payment record with PENDING status (waiting for admin confirmation)
    const payment = await prisma.payment.create({
      data: {
        loanId,
        amount,
        status: 'PENDING',
      },
    });

    const newRemainingDebt = remainingDebt - amount;

    return NextResponse.json({
      message: 'Pembayaran berhasil diajukan. Menunggu konfirmasi admin.',
      payment,
      totalDebt,
      totalPaid,
      remainingDebt: newRemainingDebt > 0 ? newRemainingDebt : 0,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    // Get user's loans with payments
    const loans = await prisma.loan.findMany({
      where: { userId: user.id },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ loans });
  } catch (error) {
    console.error('Get loans with payments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
