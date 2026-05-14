import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const CAPTCHA_TTL_SECONDS = 300;
const CAPTCHA_LENGTH = 4;
const CAPTCHA_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function getCaptchaSecret(): string {
  return process.env.JWT_SECRET || 'captcha-fallback-secret';
}

function rng(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

function pick<T>(arr: T[]): T {
  return arr[rng(0, arr.length - 1)];
}

function generateCode(length: number): string {
  const chars = CAPTCHA_CHARS.split('');
  return Array.from({ length }, () => pick(chars)).join('');
}

function renderSvgCaptcha(code: string): string {
  const w = 180;
  const h = 56;
  const gap = w / (code.length + 1);

  const parts: string[] = [
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${w}" height="${h}" fill="hsl(${rng(215,225)},${rng(18,26)}%,${rng(9,13)}%)" rx="8"/>`,
  ];

  // Noise dots (lean: 20 instead of 40)
  for (let i = 0; i < 20; i++) {
    parts.push(`<circle cx="${rng(4,w-4)}" cy="${rng(4,h-4)}" r="${(Math.random()*1.4+0.3).toFixed(1)}" fill="rgba(255,255,255,${(Math.random()*0.2+0.04).toFixed(2)})"/>`);
  }

  // Curved noise lines (lean: 2 instead of 4)
  for (let i = 0; i < 2; i++) {
    const y = rng(10, h - 10);
    parts.push(`<path d="M${rng(0,30)} ${y} Q${w/2} ${y+rng(-8,8)} ${rng(w-30,w)} ${y}" fill="none" stroke="rgba(255,255,255,${(Math.random()*0.12+0.04).toFixed(2)})" stroke-width="1.5"/>`);
  }

  // Characters
  const fonts = ['Geist Mono,monospace', 'Courier New,monospace', 'Arial,sans-serif'];
  for (let i = 0; i < code.length; i++) {
    const x = gap * (i + 0.7) + rng(-3, 3);
    const y = h * 0.62 + rng(-5, 5);
    const rot = rng(-22, 22);
    const size = rng(27, 34);
    const color = `hsl(${rng(185,200)},${rng(65,95)}%,${rng(58,72)}%)`;

    parts.push(
      `<text x="${x}" y="${y}" transform="rotate(${rot},${gap*(i+0.7)},${h*0.62})" font-family="${pick(fonts)}" font-size="${size}" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central">${code[i]}</text>`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

function svgToDataUrl(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export function generateCaptcha(): { svg: string; dataUrl: string; token: string } {
  const code = generateCode(CAPTCHA_LENGTH);
  const svg = renderSvgCaptcha(code);
  const dataUrl = svgToDataUrl(svg);

  const token = jwt.sign(
    { answer: code },
    getCaptchaSecret(),
    { expiresIn: CAPTCHA_TTL_SECONDS }
  );

  return { svg, dataUrl, token };
}

export function verifyCaptcha(token: string, userAnswer: string): { valid: boolean; error?: string } {
  if (!token || !userAnswer) {
    return { valid: false, error: 'Captcha tidak lengkap.' };
  }

  try {
    const payload = jwt.verify(token, getCaptchaSecret()) as { answer: string };
    if (payload.answer.toLowerCase() !== userAnswer.trim().toLowerCase()) {
      return { valid: false, error: 'Kode captcha tidak cocok.' };
    }
    return { valid: true };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Captcha sudah kedaluwarsa. Klik refresh untuk dapat kode baru.' };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Captcha tidak valid.' };
    }
    return { valid: false, error: 'Verifikasi captcha gagal.' };
  }
}
