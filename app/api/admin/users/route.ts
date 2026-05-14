import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { analyzeUserRisk } from '@/lib/risk-analysis';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof Response) return authResult;

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

    // Analyze risk for each user and update if needed
    const usersWithRisk = await Promise.all(
      users.map(async (user) => {
        const riskAnalysis = await analyzeUserRisk(user.id);
        
        // Update user risk level if different from stored
        if (user.riskLevel !== riskAnalysis.riskLevel || user.riskReason !== riskAnalysis.riskReason) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              riskLevel: riskAnalysis.riskLevel,
              riskReason: riskAnalysis.riskReason,
            },
          });
        }

        return {
          ...user,
          riskLevel: riskAnalysis.riskLevel,
          riskReason: riskAnalysis.riskReason,
          riskStats: riskAnalysis.stats,
        };
      })
    );

    return NextResponse.json({ users: usersWithRisk });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
