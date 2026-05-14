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

    // Get all audit logs (auditors can view audit trail)
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        auditor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Log auditor action
    await logAuditorAction(
      user.id,
      'VIEW_AUDIT_LOGS',
      'Auditor viewed audit logs',
      `Total audit logs viewed: ${auditLogs.length}`
    );

    return NextResponse.json({ auditLogs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
