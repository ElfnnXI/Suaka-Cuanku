import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieOptions } from '@/lib/security';
import { isSessionVersionCurrent } from '@/lib/security-helpers';

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required to run Suaka Cuanku securely.');
  }

  return JWT_SECRET;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionVersion: number;
}

export function getAccountStatusError(status: string) {
  if (status === 'BLOCKED') {
    return {
      error: 'Akun Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.',
      status: 403,
    };
  }

  if (status === 'SUSPENDED') {
    return {
      error: 'Akun Anda sedang ditangguhkan. Hubungi admin untuk informasi lebih lanjut.',
      status: 403,
    };
  }

  return null;
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: `${getSessionCookieOptions().maxAge}s` });
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded as JWTPayload;
  } catch (error: unknown) {
    // Log only the error type, not the secret or token details
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (process.env.NODE_ENV === 'development') {
      console.error('[VERIFY_TOKEN] Token verification failed:', message);
    }
    return null;
  }
}

export async function getUserFromRequest(request: NextRequest) {
  let token = request.cookies.get('token')?.value;

  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      sessionVersion: true,
      mfaTotpEnabled: true,
      mfaEnrolledAt: true,
      createdAt: true,
    },
  });

  if (!user || !isSessionVersionCurrent(payload.sessionVersion, user.sessionVersion)) {
    return null;
  }

  return user;
}

export async function getUserWithPasswordFromRequest(request: NextRequest) {
  let token = request.cookies.get('token')?.value;

  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || !isSessionVersionCurrent(payload.sessionVersion, user.sessionVersion)) {
    return null;
  }

  return user;
}

export async function requireAuth(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return Response.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const statusError = getAccountStatusError(user.status);
  if (statusError) {
    return Response.json(
      { error: statusError.error },
      { status: statusError.status }
    );
  }

  return { user };
}

export async function requireAdmin(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  if (user.role !== 'ADMIN') {
    return Response.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  return { user };
}

export async function requireAuditor(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  if (user.role !== 'AUDITOR') {
    return Response.json(
      { error: 'Auditor access required' },
      { status: 403 }
    );
  }

  return { user };
}

export async function logAuditorAction(auditorId: string, action: string, description: string, details?: string, ipAddress?: string, userAgent?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        auditorId,
        action,
        description,
        details: details || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to log auditor action:', error);
  }
}

export async function logSecurityEvent(actorId: string, action: string, description: string, details?: string, ipAddress?: string, userAgent?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        auditorId: actorId,
        action,
        description,
        details: details || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
