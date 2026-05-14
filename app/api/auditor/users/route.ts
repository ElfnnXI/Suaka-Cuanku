import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuditor, logAuditorAction } from '@/lib/auth';
import { analyzeUserRisk } from '@/lib/risk-analysis';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuditor(request);
    if (authResult instanceof Response) return authResult;

    const { user } = authResult;

    // Get all users (READ-ONLY) - auditors can view but not modify
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        riskLevel: true,
        riskReason: true,
        createdAt: true,
        _count: { select: { loans: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Analyze risk for each user (read-only analysis)
    const usersWithRisk = await Promise.all(
      users.map(async (user) => {
        const riskAnalysis = await analyzeUserRisk(user.id);

        return {
          ...user,
          riskLevel: riskAnalysis.riskLevel,
          riskReason: riskAnalysis.riskReason,
          riskStats: riskAnalysis.stats,
        };
      })
    );

    // Log auditor action
    await logAuditorAction(
      user.id,
      'VIEW_USERS',
      'Auditor viewed all users',
      `Total users viewed: ${usersWithRisk.length}`
    );

    return NextResponse.json({ users: usersWithRisk });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
