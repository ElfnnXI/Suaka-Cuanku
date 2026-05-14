import { NextResponse } from 'next/server';
import { generateCaptcha } from '@/lib/captcha';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { dataUrl, token } = generateCaptcha();
    return NextResponse.json({ dataUrl, token });
  } catch (error) {
    console.error('Captcha generation error:', error);
    return NextResponse.json(
      { error: 'Gagal generate captcha.' },
      { status: 500 }
    );
  }
}
