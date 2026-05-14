import { validatePasswordLocally, type PasswordPolicyResult } from '@/lib/password-policy-shared';

const HIBP_RANGE_API_URL = process.env.HIBP_RANGE_API_URL ?? 'https://api.pwnedpasswords.com/range';
const PASSWORD_BREACH_CHECK_MODE =
  process.env.PASSWORD_BREACH_CHECK_MODE ??
  (process.env.NODE_ENV === 'production' ? 'strict' : 'best-effort');

async function sha1Hex(value: string) {
  const { createHash } = await import('node:crypto');
  return createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
}

async function isBreachedPassword(password: string) {
  const digest = await sha1Hex(password);
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${HIBP_RANGE_API_URL}/${prefix}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Add-Padding': 'true',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HIBP responded with status ${response.status}`);
    }

    const body = await response.text();
    return body
      .split('\n')
      .some((line) => line.split(':')[0]?.trim().toUpperCase() === suffix);
  } finally {
    clearTimeout(timeout);
  }
}

export async function validatePasswordSecurity(password: string): Promise<PasswordPolicyResult> {
  const localResult = validatePasswordLocally(password);
  if (!localResult.valid) {
    return localResult;
  }

  try {
    const breached = await isBreachedPassword(password);
    if (breached) {
      return {
        valid: false,
        code: 'BREACHED_PASSWORD',
        message: 'Password masih belum cukup aman. Gunakan password yang benar-benar baru dan unik.',
      };
    }
  } catch {
    if (PASSWORD_BREACH_CHECK_MODE === 'strict') {
      return {
        valid: false,
        code: 'CHECK_UNAVAILABLE',
        message: 'Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.',
      };
    }
  }

  return {
    valid: true,
    code: 'VALID',
    message: 'Password aman untuk digunakan.',
  };
}

export type { PasswordPolicyResult };
