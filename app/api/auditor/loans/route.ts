import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuditor, logAuditorAction } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuditor(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    // Get all loans with user information (READ-ONLY)
    const loans = await prisma.loan.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    // Log auditor action
    await logAuditorAction(
      user.id,
      'VIEW_LOANS',
      'Auditor viewed all loans',
      `Total loans viewed: ${loans.length}`
    );

    return NextResponse.json({ loans });
  } catch (error) {
    console.error('Get all loans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
