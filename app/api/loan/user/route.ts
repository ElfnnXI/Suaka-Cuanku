// DEPRECATED: Use /api/loan/apply instead
// This file is kept for backward compatibility but will be removed in future
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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
    });

    return NextResponse.json({ loans });
  } catch (error) {
    console.error('Get user loans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
