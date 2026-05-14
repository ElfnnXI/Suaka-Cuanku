import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { withPrivateCache } from '@/lib/security';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'AUDITOR';
  const limit = isAdmin ? 50 : 30;

  const where = isAdmin ? {} : { auditorId: user.id };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      description: true,
      details: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      auditor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return withPrivateCache(NextResponse.json({ activities: logs }));
}
