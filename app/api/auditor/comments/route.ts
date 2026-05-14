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

    // Get all comments (READ-ONLY)
    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Log auditor action
    await logAuditorAction(
      user.id,
      'VIEW_COMMENTS',
      'Auditor viewed all comments',
      `Total comments viewed: ${comments.length}`
    );

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
