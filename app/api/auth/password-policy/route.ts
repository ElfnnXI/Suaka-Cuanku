import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit, getClientIp, validateOrigin, withPrivateCache } from '@/lib/security';
import { validatePasswordSecurity } from '@/lib/password-security';
import { z } from 'zod';

const passwordPolicySchema = z.object({
  password: z.string().min(1, 'Password wajib diisi'),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return withPrivateCache(NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      ));
    }

    const rateLimit = await consumeRateLimit({
      key: `password-policy:${getClientIp(request)}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimit && rateLimit.count > rateLimit.limit) {
      return withPrivateCache(NextResponse.json(
        {
          error: `Terlalu banyak cek password. Coba lagi ${rateLimit.retryAfterMinutes} menit.`,
          retryAfterMinutes: rateLimit.retryAfterMinutes,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfterSeconds.toString(),
          },
        }
      ));
    }

    const body = await request.json();
    const { password } = passwordPolicySchema.parse(body);
    const result = await validatePasswordSecurity(password);

    return withPrivateCache(NextResponse.json(result, {
      status: result.valid ? 200 : 400,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Password policy error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
