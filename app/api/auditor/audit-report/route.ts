import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuditor, logAuditorAction } from '@/lib/auth';
import { enforceRateLimit, getClientIp } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuditor(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;
    const rateLimited = await enforceRateLimit({
      key: `auditor-report:${user.id}:${getClientIp(request)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    // Get comprehensive audit data
    const [
      totalUsers,
      totalAdmins,
      totalAuditors,
      allLoans,
      allPayments,
      auditLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'AUDITOR' } }),
      prisma.loan.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.findMany({
        include: {
          loan: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        include: {
          auditor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate risk distribution
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { riskLevel: true },
    });

    const riskDistribution = {
      LOW: users.filter(u => u.riskLevel === 'LOW').length,
      MEDIUM: users.filter(u => u.riskLevel === 'MEDIUM').length,
      HIGH: users.filter(u => u.riskLevel === 'HIGH').length,
    };

    // Calculate loan status distribution
    const loanStatusDistribution = {
      PENDING: allLoans.filter(l => l.status === 'PENDING').length,
      APPROVED: allLoans.filter(l => l.status === 'APPROVED').length,
      REJECTED: allLoans.filter(l => l.status === 'REJECTED').length,
      PAID: allLoans.filter(l => l.status === 'PAID').length,
    };

    // Calculate payment status distribution
    const paymentStatusDistribution = {
      PENDING: allPayments.filter(p => p.status === 'PENDING').length,
      PAID: allPayments.filter(p => p.status === 'PAID').length,
      REJECTED: allPayments.filter(p => p.status === 'REJECTED').length,
    };

    // Calculate financial summary
    const totalLoanAmount = allLoans
      .filter(l => l.status === 'APPROVED')
      .reduce((sum, loan) => sum + loan.amount, 0);

    const totalDebt = allLoans
      .filter(l => l.status === 'APPROVED' || l.status === 'PAID')
      .reduce((sum, loan) => {
        const loanTotal = loan.amount + (loan.amount * loan.interest) / 100;
        return sum + loanTotal;
      }, 0);

    const totalPaid = allPayments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: { id: user.id, name: user.name, email: user.email },
      userStats: {
        totalUsers,
        totalAdmins,
        totalAuditors,
        riskDistribution,
      },
      loanStats: {
        totalLoans: allLoans.length,
        totalLoanAmount,
        statusDistribution: loanStatusDistribution,
      },
      paymentStats: {
        totalPayments: allPayments.length,
        totalDebt,
        totalPaid,
        remainingDebt: totalDebt - totalPaid,
        statusDistribution: paymentStatusDistribution,
      },
      auditTrail: {
        totalAuditLogs: auditLogs.length,
        recentActivity: auditLogs.slice(0, 50),
      },
    };

    // Log report generation
    await logAuditorAction(
      user.id,
      'GENERATE_REPORT',
      'Auditor generated comprehensive audit report',
      JSON.stringify({
        totalUsers,
        totalLoans: allLoans.length,
        totalPayments: allPayments.length,
      })
    );

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Generate audit report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
