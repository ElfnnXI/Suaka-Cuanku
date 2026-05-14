import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { enforceMutationSecurity, enforceRateLimit, getClientIp } from '@/lib/security';

const loanSchema = z.object({
  amount: z.number().min(100000, 'Minimum loan amount is Rp 100,000'),
  interest: z.number().min(0).max(100, 'Interest rate must be between 0-100'),
  duration: z.number().min(1, 'Duration must be at least 1 month'),
});

// Constants for loan limits
const BASE_LOAN_LIMIT = 30_000_000; // 30 juta
const MAX_LOAN_LIMIT = 45_000_000; // 45 juta
const LIMIT_INCREMENT = 5_000_000; // Naik 5 juta jika lancar
const GOOD_PAYMENT_THRESHOLD = 0.8; // 80% pembayaran tepat waktu = lancar

/**
 * Calculate the user's current loan limit based on payment history.
 * - Base limit: 30,000,000
 * - Max limit: 45,000,000
 * - If payment history is good (>=80% paid on time), increase by 5,000,000 per good cycle
 */
async function calculateLoanLimit(userId: string): Promise<number> {
  // Get all APPROVED loans with their payments
  const loans = await prisma.loan.findMany({
    where: { userId, status: 'APPROVED' },
    include: { payments: true },
  });

  if (loans.length === 0) {
    return BASE_LOAN_LIMIT;
  }

  // Calculate payment performance
  let totalPayments = 0;
  let onTimePayments = 0;
  let fullyPaidLoans = 0;

  for (const loan of loans) {
    const totalDebt = loan.amount + (loan.amount * loan.interest) / 100;
    const paidPayments = loan.payments.filter(p => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const paymentRatio = totalPaid / totalDebt;

    // Count as "good" if >= 80% paid
    if (paymentRatio >= GOOD_PAYMENT_THRESHOLD) {
      onTimePayments++;
    }

    // Count fully paid loans
    if (loan.status === 'PAID' || paymentRatio >= 1) {
      fullyPaidLoans++;
    }

    totalPayments++;
  }

  // Calculate performance ratio
  const performanceRatio = onTimePayments / totalPayments;

  // Calculate limit increase based on performance
  // Each good performance adds increment, up to max limit
  const increaseCount = Math.min(
    Math.floor(performanceRatio * 3), // Max 3 increments (30M -> 45M)
    fullyPaidLoans // Must have fully paid loans to increase
  );

  const newLimit = Math.min(
    BASE_LOAN_LIMIT + (increaseCount * LIMIT_INCREMENT),
    MAX_LOAN_LIMIT
  );

  return newLimit;
}

/**
 * Calculate the user's currently used loan amount (outstanding debt).
 */
async function calculateUsedLimit(userId: string): Promise<number> {
  const activeLoans = await prisma.loan.findMany({
    where: {
      userId,
      status: { in: ['APPROVED', 'PENDING'] },
    },
    include: { payments: true },
  });

  let usedAmount = 0;

  for (const loan of activeLoans) {
    // Only principal counts against limit, not interest
    const totalDebt = loan.amount + (loan.amount * loan.interest) / 100;
    const principalRatio = loan.amount / totalDebt;
    const paidPayments = loan.payments.filter(p => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const principalPaid = totalPaid * principalRatio;
    const remainingPrincipal = Math.max(0, loan.amount - principalPaid);
    usedAmount += remainingPrincipal;
  }

  return usedAmount;
}

export async function POST(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return securityError;
    }

    const rateLimited = await enforceRateLimit({
      key: `loan-apply:${getClientIp(request)}`,
      limit: 8,
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

    // Only USER role has loan limits
    if (user.role !== 'USER') {
      return NextResponse.json(
        { error: 'Hanya user biasa yang memiliki batasan pinjaman' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { amount, interest, duration } = loanSchema.parse(body);

    // Calculate user's current loan limit
    const calculatedLimit = await calculateLoanLimit(user.id);

    // Update user's loan limit in database
    await prisma.user.update({
      where: { id: user.id },
      data: { loanLimit: calculatedLimit },
    });

    // Calculate used limit
    const usedLimit = await calculateUsedLimit(user.id);

    // Check if user has exceeded their limit (pokok only, bunga tidak dihitung ke limit)
    const availableLimit = calculatedLimit - usedLimit;

    if (amount > availableLimit) {
      const totalInterest = (amount * interest) / 100;
      const totalDebt = amount + totalInterest;
      return NextResponse.json(
        {
          error: `Jumlah pinjaman melebihi batas limit. Limit Anda: Rp ${calculatedLimit.toLocaleString('id-ID')}, Terpakai: Rp ${usedLimit.toLocaleString('id-ID')}, Tersisa: Rp ${availableLimit.toLocaleString('id-ID')}.`,
          limit: calculatedLimit,
          used: usedLimit,
          available: availableLimit,
          requested: amount,
          totalInterest,
          totalDebt,
        },
        { status: 400 }
      );
    }

    // Check if user has any active unpaid loans
    const activeUnpaidLoans = await prisma.loan.findFirst({
      where: {
        userId: user.id,
        status: 'APPROVED',
      },
    });

    // If user has active loans, check if they're current on payments
    if (activeUnpaidLoans) {
      const loan = await prisma.loan.findUnique({
        where: { id: activeUnpaidLoans.id },
        include: { payments: true },
      });

      if (loan) {
        const totalDebt = loan.amount + (loan.amount * loan.interest) / 100;
        const paidPayments = loan.payments.filter(p => p.status === 'PAID');
        const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
        const paymentRatio = totalPaid / totalDebt;

        // If payment ratio is below 50%, block new loan
        if (paymentRatio < 0.5) {
          return NextResponse.json(
            {
              error: 'Anda harus membayar pinjaman yang aktif terlebih dahulu minimal 50% sebelum mengajukan pinjaman baru.',
            },
            { status: 400 }
          );
        }
      }
    }

    // Create loan application
    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        amount,
        interest,
        duration,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      message: 'Loan application submitted successfully',
      loan,
      limitInfo: {
        limit: calculatedLimit,
        used: usedLimit + amount,
        available: availableLimit - amount,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Loan application error:', error);
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

    // Get user's loans
    const loans = await prisma.loan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        payments: true,
      },
    });

    // Calculate limit info
    const calculatedLimit = await calculateLoanLimit(user.id);
    const usedLimit = await calculateUsedLimit(user.id);

    return NextResponse.json({
      loans,
      limitInfo: {
        limit: calculatedLimit,
        used: usedLimit,
        available: calculatedLimit - usedLimit,
      },
    });
  } catch (error) {
    console.error('Get loans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
