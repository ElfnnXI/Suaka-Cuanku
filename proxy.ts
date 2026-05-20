import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;

type JwtPayload = {
  exp?: number;
  role?: string;
};

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = normalized + padding;
  const binary = atob(base64);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyJwt(token: string): Promise<JwtPayload | null> {
  if (!JWT_SECRET) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader)));
    if (header.alg !== 'HS256') {
      return null;
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as JwtPayload;
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicPagePaths = ['/', '/login', '/register', '/forgot-password'];

  if (publicPagePaths.includes(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  if (pathname === '/api/comment' && request.method === 'POST') {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;

  const redirectToLogin = () => {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  };

  const redirectToRole = (role: string) => {
    if (role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/overview', request.url));
    }

    if (role === 'AUDITOR') {
      return NextResponse.redirect(new URL('/auditor/overview', request.url));
    }

    return NextResponse.redirect(new URL('/dashboard/overview', request.url));
  };

  if (
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/auditor/') ||
    pathname.startsWith('/settings/')
  ) {
    if (!token) {
      return redirectToLogin();
    }

    const payload = await verifyJwt(token);
    if (!payload?.role) {
      return redirectToLogin();
    }

    if (pathname.startsWith('/dashboard/') && payload.role !== 'USER') {
      return redirectToRole(payload.role);
    }

    if (pathname.startsWith('/admin/') && payload.role !== 'ADMIN') {
      return redirectToRole(payload.role);
    }

    if (pathname.startsWith('/auditor/') && payload.role !== 'AUDITOR') {
      return redirectToRole(payload.role);
    }
  }

  const protectedApiPaths = ['/api/loan/', '/api/admin/', '/api/auditor/', '/api/payment/'];
  const isProtectedApi = protectedApiPaths.some((path) => pathname.startsWith(path));

  if (isProtectedApi && !token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/auditor/:path*',
    '/settings/:path*',
    '/api/loan/:path*',
    '/api/admin/:path*',
    '/api/auditor/:path*',
    '/api/payment/:path*',
  ],
};
