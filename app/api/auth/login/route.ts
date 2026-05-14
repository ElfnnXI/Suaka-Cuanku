import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccountStatusError, logSecurityEvent } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  consumeRateLimit,
  getClientIp,
  validateOrigin,
  withPrivateCache,
} from '@/lib/security';
import { attachPendingMfa, beginMfaChallenge } from '@/lib/mfa';
import { verifyCaptcha } from '@/lib/captcha';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const LOGIN_WAIT_SHORT_MS = 10 * 60 * 1000;
const LOGIN_WAIT_LONG_MS = 30 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_ESCALATION_THRESHOLD = 15;

function getLoginWindowMs(attemptCount: number, limit: number) {
  if (attemptCount > Math.max(limit, LOGIN_ATTEMPT_ESCALATION_THRESHOLD)) {
    return LOGIN_WAIT_LONG_MS;
  }

  return LOGIN_WAIT_SHORT_MS;
}

function getBlockedLoginMessage(attemptsUsed: number, attemptsLimit: number, retryAfterMinutes: number) {
  return `Terlalu banyak percobaan. Coba lagi ${retryAfterMinutes} menit. Percobaan ${attemptsUsed}/${attemptsLimit}.`;
}

function getInvalidLoginMessage(attemptsUsed: number, attemptsRemaining: number, attemptsLimit: number) {
  return `Email atau password salah. Percobaan ${attemptsUsed}/${attemptsLimit}. Sisa ${attemptsRemaining} kali.`;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      );
    }

    const captchaToken = request.headers.get('x-captcha-token');
    const captchaAnswer = request.headers.get('x-captcha-answer');
    if (!captchaToken || !captchaAnswer) {
      return withPrivateCache(NextResponse.json(
        { error: 'Verifikasi captcha diperlukan.' },
        { status: 400 }
      ));
    }

    const captchaResult = verifyCaptcha(captchaToken, captchaAnswer);
    if (!captchaResult.valid) {
      return withPrivateCache(NextResponse.json(
        { error: captchaResult.error || 'Verifikasi captcha gagal.' },
        { status: 400 }
      ));
    }

    const ipAddress = getClientIp(request);
    const ipRateLimit = await consumeRateLimit({
      key: `login:ip:${ipAddress}`,
      limit: LOGIN_ATTEMPT_LIMIT,
      getWindowMs: getLoginWindowMs,
    });

    if (ipRateLimit && ipRateLimit.count > ipRateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        {
          error: getBlockedLoginMessage(
            ipRateLimit.count,
            ipRateLimit.limit,
            ipRateLimit.retryAfterMinutes
          ),
          attemptsUsed: ipRateLimit.count,
          attemptsRemaining: ipRateLimit.remaining,
          attemptsLimit: ipRateLimit.limit,
          retryAfterSeconds: ipRateLimit.retryAfterSeconds,
          retryAfterMinutes: ipRateLimit.retryAfterMinutes,
        },
        {
          status: 429,
          headers: {
            'Retry-After': ipRateLimit.retryAfterSeconds.toString(),
          },
        }
      ));
    }

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const accountRateLimit = await consumeRateLimit({
      key: `login:account:${email.toLowerCase()}:${ipAddress}`,
      limit: LOGIN_ATTEMPT_LIMIT,
      getWindowMs: getLoginWindowMs,
    });

    if (accountRateLimit && accountRateLimit.count > accountRateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        {
          error: getBlockedLoginMessage(
            accountRateLimit.count,
            accountRateLimit.limit,
            accountRateLimit.retryAfterMinutes
          ),
          attemptsUsed: accountRateLimit.count,
          attemptsRemaining: accountRateLimit.remaining,
          attemptsLimit: accountRateLimit.limit,
          retryAfterSeconds: accountRateLimit.retryAfterSeconds,
          retryAfterMinutes: accountRateLimit.retryAfterMinutes,
        },
        {
          status: 429,
          headers: {
            'Retry-After': accountRateLimit.retryAfterSeconds.toString(),
          },
        }
      ));
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return withPrivateCache(NextResponse.json(
        {
          error: getInvalidLoginMessage(
            accountRateLimit?.count ?? 1,
            accountRateLimit?.remaining ?? 0,
            accountRateLimit?.limit ?? LOGIN_ATTEMPT_LIMIT
          ),
          attemptsUsed: accountRateLimit?.count ?? 1,
          attemptsRemaining: accountRateLimit?.remaining ?? 0,
          attemptsLimit: accountRateLimit?.limit ?? LOGIN_ATTEMPT_LIMIT,
        },
        { status: 401 }
      ));
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return withPrivateCache(NextResponse.json(
        {
          error: getInvalidLoginMessage(
            accountRateLimit?.count ?? 1,
            accountRateLimit?.remaining ?? 0,
            accountRateLimit?.limit ?? LOGIN_ATTEMPT_LIMIT
          ),
          attemptsUsed: accountRateLimit?.count ?? 1,
          attemptsRemaining: accountRateLimit?.remaining ?? 0,
          attemptsLimit: accountRateLimit?.limit ?? LOGIN_ATTEMPT_LIMIT,
        },
        { status: 401 }
      ));
    }

    const statusError = getAccountStatusError(user.status);
    if (statusError) {
      return withPrivateCache(NextResponse.json(
        { error: statusError.error },
        { status: statusError.status }
      ));
    }

    const mfaChallenge = await beginMfaChallenge(user.id);
    const response = NextResponse.json({
      message: 'Password verified',
      requiresMfa: true,
      mfa: {
        setupRequired: mfaChallenge.setupRequired,
        totpEnrolled: !mfaChallenge.setupRequired,
      },
    });
    attachPendingMfa(response, mfaChallenge.challenge.id);
    await logSecurityEvent(user.id, 'LOGIN_PASSWORD_VERIFIED', `Password login ${user.email} valid, menunggu MFA`, undefined, ipAddress, request.headers.get('user-agent') || undefined);

    return withPrivateCache(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Login error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
