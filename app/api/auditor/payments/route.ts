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

    // Get all payments (not just pending) with loan and user info (READ-ONLY)
    const payments = await prisma.payment.findMany({
      include: {
        loan: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    // Log auditor action
    await logAuditorAction(
      user.id,
      'VIEW_PAYMENTS',
      'Auditor viewed all payments',
      `Total payments viewed: ${payments.length}`
    );

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Get payments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
