import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyCsrfCookie, clearAuthCookies, createCsrfToken, getSessionCookieOptions } from '@/lib/security';
import { generateToken, getAccountStatusError } from '@/lib/auth';

const MFA_COOKIE_NAME = 'pending_mfa';
const PASSWORD_RESET_COOKIE_NAME = 'pending_password_reset';
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MFA_TOTP_DIGITS = 6;
const MFA_TOTP_PERIOD_SECONDS = 30;
const MFA_ISSUER = process.env.MFA_ISSUER ?? 'Suaka Cuanku';
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 10;
const SENSITIVE_ACTION_TTL_MS = 10 * 60 * 1000;

function getMfaEncryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (configured) {
    const normalized = configured.trim();
    const key =
      normalized.length === 64
        ? Buffer.from(normalized, 'hex')
        : Buffer.from(normalized, 'base64');

    if (key.length === 32) {
      return key;
    }
  }

  if (process.env.NODE_ENV !== 'production' && process.env.JWT_SECRET) {
    return crypto.createHash('sha256').update(process.env.JWT_SECRET, 'utf8').digest();
  }

  throw new Error('MFA_ENCRYPTION_KEY is required to store authenticator secrets securely.');
}

function base32Encode(buffer: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      continue;
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function encryptValue(value: string) {
  const key = getMfaEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptValue(value: string) {
  const [ivBase64, tagBase64, encryptedBase64] = value.split('.');
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error('Encrypted MFA value is malformed.');
  }

  const key = getMfaEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function generateBackupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';

  for (let index = 0; index < BACKUP_CODE_LENGTH; index += 1) {
    output += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  return `${output.slice(0, 5)}-${output.slice(5)}`;
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function generateHotp(secret: string, counter: number) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
  const digest = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (code % 10 ** MFA_TOTP_DIGITS).toString().padStart(MFA_TOTP_DIGITS, '0');
}

function verifyTotpCode(secret: string, code: string) {
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 1000 / MFA_TOTP_PERIOD_SECONDS);
  for (let offset = -1; offset <= 1; offset += 1) {
    if (generateHotp(secret, currentCounter + offset) === normalizedCode) {
      return true;
    }
  }

  return false;
}

function buildOtpAuthUrl(email: string, secret: string) {
  const label = encodeURIComponent(`${MFA_ISSUER}:${email}`);
  const issuer = encodeURIComponent(MFA_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=${MFA_TOTP_DIGITS}&period=${MFA_TOTP_PERIOD_SECONDS}`;
}

function getPendingMfaCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_SECURE !== 'false',
    sameSite: 'lax' as const,
    maxAge: Math.ceil(MFA_CHALLENGE_TTL_MS / 1000),
    path: '/',
  };
}

function setPendingMfaCookie(response: NextResponse, challengeId: string) {
  response.cookies.set(MFA_COOKIE_NAME, challengeId, getPendingMfaCookieOptions());
}

export function clearPendingMfaCookie(response: NextResponse) {
  response.cookies.set(MFA_COOKIE_NAME, '', {
    ...getPendingMfaCookieOptions(),
    maxAge: 0,
  });
}

function getPendingPasswordResetCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_SECURE !== 'false',
    sameSite: 'lax' as const,
    maxAge: Math.ceil(MFA_CHALLENGE_TTL_MS / 1000),
    path: '/',
  };
}

export function clearPendingPasswordResetCookie(response: NextResponse) {
  response.cookies.set(PASSWORD_RESET_COOKIE_NAME, '', {
    ...getPendingPasswordResetCookieOptions(),
    maxAge: 0,
  });
}

function setPendingPasswordResetCookie(response: NextResponse, challengeId: string) {
  response.cookies.set(PASSWORD_RESET_COOKIE_NAME, challengeId, getPendingPasswordResetCookieOptions());
}

export async function getPendingMfaChallenge(request: NextRequest) {
  const challengeId = request.cookies.get(MFA_COOKIE_NAME)?.value;
  if (!challengeId) {
    return null;
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
    include: {
      user: true,
    },
  });

  if (!challenge) {
    return null;
  }

  if (challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return challenge;
}

export async function getPendingPasswordResetChallenge(request: NextRequest) {
  const challengeId = request.cookies.get(PASSWORD_RESET_COOKIE_NAME)?.value;
  if (!challengeId) {
    return null;
  }

  const challenge = await prisma.passwordResetChallenge.findUnique({
    where: { id: challengeId },
    include: {
      user: true,
    },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return challenge;
}

export async function beginMfaChallenge(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found for MFA challenge.');
  }

  const statusError = getAccountStatusError(user.status);
  if (statusError) {
    throw new Error(statusError.error);
  }

  await prisma.authChallenge.deleteMany({
    where: {
      userId: user.id,
    },
  });

  const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
  const pendingTotpSecret = user.mfaTotpEnabled && user.mfaTotpSecret
    ? null
    : encryptValue(generateTotpSecret());

  const challenge = await prisma.authChallenge.create({
    data: {
      userId: user.id,
      pendingTotpSecret,
      expiresAt,
    },
  });

  return {
    challenge,
    user,
    setupRequired: !user.mfaTotpEnabled || !user.mfaTotpSecret,
  };
}

export async function replaceBackupCodes(userId: string) {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCode());

  await prisma.$transaction([
    prisma.userBackupCode.deleteMany({
      where: { userId },
    }),
    prisma.userBackupCode.createMany({
      data: codes.map((code) => ({
        userId,
        codeHash: hashValue(code),
      })),
    }),
  ]);

  return codes;
}

export async function consumeBackupCode(userId: string, backupCode: string) {
  const normalizedCode = backupCode.trim().toUpperCase();
  const codeHash = hashValue(normalizedCode);
  const record = await prisma.userBackupCode.findFirst({
    where: {
      userId,
      codeHash,
      consumedAt: null,
    },
  });

  if (!record) {
    return false;
  }

  await prisma.userBackupCode.update({
    where: { id: record.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return true;
}

export async function getBackupCodeStatus(userId: string) {
  const availableCount = await prisma.userBackupCode.count({
    where: {
      userId,
      consumedAt: null,
    },
  });

  return {
    total: BACKUP_CODE_COUNT,
    available: availableCount,
  };
}

export async function beginPasswordResetChallenge(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const statusError = getAccountStatusError(user.status);
  if (statusError) {
    return null;
  }

  await prisma.passwordResetChallenge.deleteMany({
    where: { userId: user.id },
  });

  const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
  const pendingTotpSecret = user.mfaTotpEnabled && user.mfaTotpSecret
    ? null
    : encryptValue(generateTotpSecret());

  const challenge = await prisma.passwordResetChallenge.create({
    data: {
      userId: user.id,
      pendingTotpSecret,
      expiresAt,
    },
  });

  return {
    challenge,
    user,
    setupRequired: !user.mfaTotpEnabled || !user.mfaTotpSecret,
  };
}

export async function getPasswordResetSetupData(challengeId: string) {
  const challenge = await prisma.passwordResetChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    throw new Error('Password reset challenge is not available.');
  }

  if (challenge.user.mfaTotpEnabled && challenge.user.mfaTotpSecret) {
    return {
      setupRequired: false,
    };
  }

  if (!challenge.pendingTotpSecret) {
    throw new Error('Authenticator setup secret is missing.');
  }

  const secret = decryptValue(challenge.pendingTotpSecret);
  const otpAuthUrl = buildOtpAuthUrl(challenge.user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    margin: 1,
    width: 240,
  });

  return {
    setupRequired: true,
    manualEntryKey: secret,
    otpAuthUrl,
    qrCodeDataUrl,
  };
}

export async function verifyPasswordResetMfa(
  challengeId: string,
  totpCode: string
) {
  const challenge = await prisma.passwordResetChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    return {
      error: 'Sesi reset password sudah kedaluwarsa. Ulangi dari awal.',
      status: 401,
    };
  }

  const secret = challenge.user.mfaTotpEnabled && challenge.user.mfaTotpSecret
    ? decryptValue(challenge.user.mfaTotpSecret)
    : challenge.pendingTotpSecret
      ? decryptValue(challenge.pendingTotpSecret)
      : null;

  if (!secret || !verifyTotpCode(secret, totpCode)) {
    return {
      error: 'Kode authenticator tidak valid.',
      status: 400,
    };
  }

  if (!challenge.user.mfaTotpEnabled || !challenge.user.mfaTotpSecret) {
    await prisma.user.update({
      where: { id: challenge.user.id },
      data: {
        mfaTotpEnabled: true,
        mfaTotpSecret: encryptValue(secret),
        mfaEnrolledAt: new Date(),
      },
    });
  }

  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return { userId: challenge.user.id, email: challenge.user.email };
}

export async function beginSensitiveActionChallenge(
  userId: string,
  action: string,
  options: { targetEmail?: string; pendingTotpSecret?: string } = {}
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.mfaTotpEnabled || !user.mfaTotpSecret) {
    throw new Error('MFA authenticator belum aktif.');
  }

  await prisma.sensitiveActionChallenge.deleteMany({
    where: {
      userId,
      action,
    },
  });

  const expiresAt = new Date(Date.now() + SENSITIVE_ACTION_TTL_MS);
  const challenge = await prisma.sensitiveActionChallenge.create({
    data: {
      userId,
      action,
      targetEmail: options.targetEmail,
      pendingTotpSecret: options.pendingTotpSecret ? encryptValue(options.pendingTotpSecret) : null,
      expiresAt,
    },
  });
  return challenge;
}

export async function verifySensitiveActionChallenge(
  userId: string,
  action: string,
  totpCode: string,
  options: { consume?: boolean } = {}
) {
  const challenge = await prisma.sensitiveActionChallenge.findFirst({
    where: {
      userId,
      action,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: true,
    },
  });

  const challengeUser = challenge?.user ?? await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mfaTotpSecret: true,
      mfaTotpEnabled: true,
    },
  });

  if (!challengeUser?.mfaTotpEnabled || !challengeUser.mfaTotpSecret) {
    return {
      error: 'MFA authenticator belum aktif.',
      status: 400,
    };
  }

  if (!verifyTotpCode(decryptValue(challengeUser.mfaTotpSecret), totpCode)) {
    return {
      error: 'Kode authenticator tidak valid.',
      status: 400,
    };
  }

  if (challenge && options.consume !== false) {
    await prisma.sensitiveActionChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  return {
    ok: true,
    challenge,
  };
}

export async function consumeSensitiveActionChallenge(challengeId: string) {
  await prisma.sensitiveActionChallenge.update({
    where: { id: challengeId },
    data: {
      consumedAt: new Date(),
    },
  });
}

export async function getSensitiveActionChallenge(userId: string, action: string) {
  return prisma.sensitiveActionChallenge.findFirst({
    where: {
      userId,
      action,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getReEnrollSetupData(userId: string) {
  const challenge = await getSensitiveActionChallenge(userId, 'REENROLL_TOTP');
  if (!challenge || !challenge.pendingTotpSecret) {
    throw new Error('Re-enroll challenge is not available.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  const secret = decryptValue(challenge.pendingTotpSecret);
  const otpAuthUrl = buildOtpAuthUrl(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    margin: 1,
    width: 240,
  });

  return {
    manualEntryKey: secret,
    qrCodeDataUrl,
    otpAuthUrl,
    expiresAt: challenge.expiresAt,
  };
}

export async function finalizeReEnrollAuthenticator(userId: string, totpCode: string) {
  const challenge = await getSensitiveActionChallenge(userId, 'REENROLL_TOTP');
  if (!challenge || !challenge.pendingTotpSecret) {
    return {
      error: 'Sesi re-enroll authenticator tidak tersedia atau sudah kedaluwarsa.',
      status: 401,
    };
  }

  const secret = decryptValue(challenge.pendingTotpSecret);
  if (!verifyTotpCode(secret, totpCode)) {
    return {
      error: 'Kode authenticator baru tidak valid.',
      status: 400,
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        mfaTotpEnabled: true,
        mfaTotpSecret: encryptValue(secret),
        mfaEnrolledAt: new Date(),
      },
    }),
    prisma.sensitiveActionChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: new Date(),
      },
    }),
  ]);

  return { ok: true };
}

export async function getMfaSetupData(challengeId: string) {
  const challenge = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    throw new Error('MFA challenge is not available.');
  }

  if (challenge.user.mfaTotpEnabled && challenge.user.mfaTotpSecret) {
    return {
      setupRequired: false,
    };
  }

  if (!challenge.pendingTotpSecret) {
    throw new Error('Authenticator setup secret is missing.');
  }

  const secret = decryptValue(challenge.pendingTotpSecret);
  const otpAuthUrl = buildOtpAuthUrl(challenge.user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    margin: 1,
    width: 240,
  });

  return {
    setupRequired: true,
    manualEntryKey: secret,
    otpAuthUrl,
    qrCodeDataUrl,
  };
}

export async function completeMfaChallenge(
  challengeId: string,
  totpCode: string
) {
  const challenge = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
    return {
      error: 'Sesi verifikasi MFA sudah kedaluwarsa. Silakan login ulang.',
      status: 401,
    };
  }

  const secret = challenge.user.mfaTotpEnabled && challenge.user.mfaTotpSecret
    ? decryptValue(challenge.user.mfaTotpSecret)
    : challenge.pendingTotpSecret
      ? decryptValue(challenge.pendingTotpSecret)
      : null;

  if (!secret || !verifyTotpCode(secret, totpCode)) {
    return {
      error: 'Kode authenticator tidak valid.',
      status: 400,
    };
  }

  const userUpdateData =
    challenge.user.mfaTotpEnabled && challenge.user.mfaTotpSecret
      ? {}
      : {
          mfaTotpEnabled: true,
          mfaTotpSecret: encryptValue(secret),
          mfaEnrolledAt: new Date(),
        };

  const user = await prisma.user.update({
    where: { id: challenge.user.id },
    data: userUpdateData,
  });

  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
    },
  });

  const token = await generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  const response = NextResponse.json({
    message: 'MFA verified',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mfaTotpEnabled: user.mfaTotpEnabled,
      mfaEnrolledAt: user.mfaEnrolledAt,
    },
  });

  clearAuthCookies(response);
  clearPendingMfaCookie(response);
  response.cookies.set('token', token, getSessionCookieOptions());
  applyCsrfCookie(response, createCsrfToken());

  return { response };
}

export function attachPendingMfa(response: NextResponse, challengeId: string) {
  clearAuthCookies(response);
  clearPendingMfaCookie(response);
  setPendingMfaCookie(response, challengeId);
}

export function attachPendingPasswordReset(response: NextResponse, challengeId: string) {
  clearPendingPasswordResetCookie(response);
  setPendingPasswordResetCookie(response, challengeId);
}
