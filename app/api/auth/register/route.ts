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
import { generateToken } from '@/lib/auth';
import { applyCsrfCookie, clearAuthCookies, createCsrfToken, getSessionCookieOptions } from '@/lib/security';
import { securityQuestionsSchema, hashAnswer } from '@/lib/security-questions';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password wajib diisi'),
  securityQuestions: securityQuestionsSchema.optional(),
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
    const { name, email, password, securityQuestions } = registerSchema.parse(body);
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

    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });

    const response = NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    if (securityQuestions && securityQuestions.length === 5) {
      const hashedItems = await Promise.all(
        securityQuestions.map(async (item) => ({
          userId: user.id,
          question: item.question,
          answer: await hashAnswer(item.answer),
        }))
      );
      await prisma.securityQuestion.createMany({ data: hashedItems });
    }

    clearAuthCookies(response);
    response.cookies.set('token', token, getSessionCookieOptions());
    applyCsrfCookie(response, createCsrfToken());
    await logSecurityEvent(user.id, 'REGISTER_SUCCESS', `User ${user.email} berhasil registrasi`, undefined, ipAddress, request.headers.get('user-agent') || undefined);

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
