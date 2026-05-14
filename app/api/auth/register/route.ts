import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  enforceRateLimit,
  getClientIp,
  validateOrigin,
  withPrivateCache,
} from '@/lib/security';
import { validatePasswordSecurity } from '@/lib/password-security';
import { attachPendingMfa, beginMfaChallenge } from '@/lib/mfa';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      );
    }

    const ipAddress = getClientIp(request);
    const rateLimited = await enforceRateLimit({
      key: `register:${ipAddress}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);
    const passwordValidation = await validatePasswordSecurity(password);

    if (!passwordValidation.valid) {
      return withPrivateCache(NextResponse.json(
        { error: passwordValidation.message, passwordPolicyCode: passwordValidation.code },
        { status: 400 }
      ));
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return withPrivateCache(NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      ));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER',
      },
    });

    const mfaChallenge = await beginMfaChallenge(user.id);
    const response = NextResponse.json({
      message: 'User registered successfully',
      requiresMfa: true,
      mfa: {
        setupRequired: mfaChallenge.setupRequired,
        totpEnrolled: !mfaChallenge.setupRequired,
      },
    });
    attachPendingMfa(response, mfaChallenge.challenge.id);
    await logSecurityEvent(user.id, 'REGISTER_SUCCESS', `User ${user.email} berhasil registrasi dan menunggu MFA awal`, undefined, ipAddress, request.headers.get('user-agent') || undefined);

    return withPrivateCache(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Registration error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
