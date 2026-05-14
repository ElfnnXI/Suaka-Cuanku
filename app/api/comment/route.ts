import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { enforceRateLimit, getClientIp, validateOrigin } from '@/lib/security';

const commentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message terlalu panjang'),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Origin request tidak diizinkan' },
        { status: 403 }
      );
    }

    const rateLimited = await enforceRateLimit({
      key: `comment:${getClientIp(request)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await request.json();
    const { name, email, message } = commentSchema.parse(body);

    // Save comment to database
    const comment = await prisma.comment.create({
      data: { name, email, message },
    });

    return NextResponse.json(
      { message: 'Comment submitted successfully', comment },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Comment submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
