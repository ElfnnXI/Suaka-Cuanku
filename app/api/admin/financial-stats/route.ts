import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    // Get all loans
    const allLoans = await prisma.loan.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: true,
      },
    });

    // Calculate financial stats
    const totalUsers = await prisma.user.count({
      where: { role: 'USER' },
    });

    const totalLoanAmount = allLoans
      .filter(l => l.status === 'APPROVED')
      .reduce((sum, loan) => sum + loan.amount, 0);

    // Calculate total debt (principal + interest)
    const totalDebt = allLoans
      .filter(l => l.status === 'APPROVED' || l.status === 'PAID')
      .reduce((sum, loan) => {
        const loanTotal = loan.amount + (loan.amount * loan.interest) / 100;
        return sum + loanTotal;
      }, 0);

    // Calculate total paid
    const allPayments = await prisma.payment.findMany({
      where: { status: 'PAID' },
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate remaining debt
    const remainingDebt = totalDebt - totalPaid;

    // Count pending payments
    const pendingPaymentsCount = await prisma.payment.count({
      where: { status: 'PENDING' },
    });

    // Loan status breakdown
    const pendingLoans = allLoans.filter(l => l.status === 'PENDING').length;
    const approvedLoans = allLoans.filter(l => l.status === 'APPROVED').length;
    const paidLoans = allLoans.filter(l => l.status === 'PAID').length;
    const rejectedLoans = allLoans.filter(l => l.status === 'REJECTED').length;

    return NextResponse.json({
      stats: {
        totalUsers,
        totalLoans: allLoans.length,
        totalLoanAmount,
        totalDebt,
        totalPaid,
        remainingDebt,
        pendingLoans,
        approvedLoans,
        paidLoans,
        rejectedLoans,
        pendingPayments: pendingPaymentsCount,
      },
    });
  } catch (error) {
    console.error('Get financial stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
