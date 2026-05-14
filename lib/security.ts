import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const SESSION_COOKIE_NAME = 'token';
const CSRF_COOKIE_NAME = 'csrf_token';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === 'true';
const DEFAULT_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
let hasLoggedRateLimitStoreError = false;

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs?: number;
  getWindowMs?: (attemptCount: number, limit: number) => number;
};

export type RateLimitState = {
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  retryAfterMinutes: number;
  resetAt: Date;
};

function isRateLimitStoreUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P6001';
  }

  return false;
}

function logRateLimitStoreError(error: unknown) {
  if (hasLoggedRateLimitStoreError) {
    return;
  }

  hasLoggedRateLimitStoreError = true;
  console.warn(
    'Rate limit store unavailable. Request throttling is temporarily disabled.',
    error
  );
}

function toRateLimitState(
  entry: { count: number; resetAt: Date },
  limit: number,
  now: Date
): RateLimitState {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000)
  );

  return {
    count: entry.count,
    limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds,
    retryAfterMinutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)),
    resetAt: entry.resetAt,
  };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_SECURE !== 'false',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  };
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_SECURE !== 'false',
    sameSite: 'strict' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  };
}

export function getClientIp(request: NextRequest) {
  if (TRUST_PROXY_HEADERS) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }

    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) {
      return realIp;
    }
  }

  return 'unknown';
}

export function createCsrfToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function applyCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
}

export async function ensureCsrfCookie(response?: NextResponse) {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (existingToken) {
    if (response) {
      response.cookies.set(CSRF_COOKIE_NAME, existingToken, getCsrfCookieOptions());
    }
    return existingToken;
  }

  const csrfToken = createCsrfToken();
  if (response) {
    applyCsrfCookie(response, csrfToken);
  }

  return csrfToken;
}

export function getAllowedOrigins(request: NextRequest) {
  return new Set([request.nextUrl.origin, ...DEFAULT_ALLOWED_ORIGINS]);
}

export function validateOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }

  return getAllowedOrigins(request).has(origin);
}

export function validateCsrf(request: NextRequest) {
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = request.headers.get('x-csrf-token');

  if (!csrfCookie || !csrfHeader) {
    return false;
  }

  return csrfCookie === csrfHeader;
}

export function enforceMutationSecurity(
  request: NextRequest,
  options: { requireCsrf?: boolean } = {}
) {
  if (!validateOrigin(request)) {
    return NextResponse.json(
      { error: 'Origin request tidak diizinkan' },
      { status: 403 }
    );
  }

  if (options.requireCsrf && !validateCsrf(request)) {
    return NextResponse.json(
      { error: 'CSRF token tidak valid' },
      { status: 403 }
    );
  }

  return null;
}

export async function consumeRateLimit({
  key,
  limit,
  windowMs,
  getWindowMs,
}: RateLimitOptions): Promise<RateLimitState | null> {
  try {
    const now = new Date();
    const baseWindowMs = getWindowMs?.(1, limit) ?? windowMs;
    if (!baseWindowMs) {
      throw new Error('Rate limit window is required.');
    }
    const nextResetAt = new Date(now.getTime() + baseWindowMs);

    let entry = await prisma.rateLimitEntry.findUnique({
      where: { key },
      select: {
        count: true,
        resetAt: true,
      },
    });

    if (!entry) {
      entry = await prisma.rateLimitEntry.create({
        data: {
          key,
          count: 1,
          resetAt: nextResetAt,
        },
        select: {
          count: true,
          resetAt: true,
        },
      });
    } else if (entry.resetAt.getTime() <= now.getTime()) {
      entry = await prisma.rateLimitEntry.update({
        where: { key },
        data: {
          count: 1,
          resetAt: nextResetAt,
        },
        select: {
          count: true,
          resetAt: true,
        },
      });
    } else {
      entry = await prisma.rateLimitEntry.update({
        where: { key },
        data: {
          count: {
            increment: 1,
          },
        },
        select: {
          count: true,
          resetAt: true,
        },
      });
    }

    const state = toRateLimitState(entry, limit, now);

    if (getWindowMs) {
      const escalatedWindowMs = getWindowMs(state.count, limit);
      const desiredResetAt = new Date(now.getTime() + escalatedWindowMs);
      const shouldNormalizeWindow =
        state.count > limit &&
        state.resetAt.getTime() !== desiredResetAt.getTime();

      if (shouldNormalizeWindow) {
        const updatedEntry = await prisma.rateLimitEntry.update({
          where: { key },
          data: {
            resetAt: desiredResetAt,
          },
          select: {
            count: true,
            resetAt: true,
          },
        });

        return toRateLimitState(
          {
            count: updatedEntry.count,
            resetAt: updatedEntry.resetAt,
          },
          limit,
          now
        );
      }
    }

    return state;
  } catch (error) {
    if (isRateLimitStoreUnavailableError(error)) {
      logRateLimitStoreError(error);
      return null;
    }

    throw error;
  }
}

export async function enforceRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const state = await consumeRateLimit({ key, limit, windowMs });

  if (!state) {
    return null;
  }

  if (state.count > limit) {
    return NextResponse.json(
      {
        error: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
        attemptsUsed: state.count,
        attemptsRemaining: state.remaining,
        attemptsLimit: state.limit,
        retryAfterSeconds: state.retryAfterSeconds,
        retryAfterMinutes: state.retryAfterMinutes,
      },
      {
        status: 429,
        headers: {
          'Retry-After': state.retryAfterSeconds.toString(),
        },
      }
    );
  }

  return null;
}

export function withPrivateCache<T extends Response>(response: T) {
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    ...getCsrfCookieOptions(),
    maxAge: 0,
  });
}
