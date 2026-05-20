import { NextRequest, NextResponse } from 'next/server';
import { startAutomaticBackupScheduler } from '@/lib/automatic-backup';
import { requireAuth } from '@/lib/auth';
import { ensureCsrfCookie, withPrivateCache } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    startAutomaticBackupScheduler();
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return withPrivateCache(authResult);
    }

    const { sessionVersion, ...safeUser } = authResult.user;
    void sessionVersion;
    const response = NextResponse.json({ user: safeUser });
    const csrfToken = await ensureCsrfCookie(response);
    response.headers.set('x-csrf-token', csrfToken);
    return withPrivateCache(response);
  } catch (error) {
    console.error('Get user error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
