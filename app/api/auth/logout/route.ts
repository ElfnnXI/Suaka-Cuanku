import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, withPrivateCache, getClientIp } from '@/lib/security';
import { getUserFromRequest, logSecurityEvent } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  if (user) {
    await logSecurityEvent(
      user.id,
      'LOGOUT',
      `User ${user.email} logged out`,
      undefined,
      ipAddress,
      userAgent
    );
  }

  const response = NextResponse.json({
    message: 'Logged out successfully',
  });

  clearAuthCookies(response);

  return withPrivateCache(response);
}
