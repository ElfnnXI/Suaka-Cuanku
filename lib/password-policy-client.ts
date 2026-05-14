import { apiFetch } from '@/lib/client-api';
import { validatePasswordLocally, type PasswordPolicyResult } from '@/lib/password-policy-shared';

export function getLocalPasswordFeedback(password: string): PasswordPolicyResult {
  if (!password) {
    return {
      valid: false,
      code: 'TOO_SHORT',
      message: 'Password wajib diisi.',
    };
  }

  return validatePasswordLocally(password);
}

export async function checkPasswordPolicy(password: string): Promise<PasswordPolicyResult> {
  const localResult = getLocalPasswordFeedback(password);
  if (!localResult.valid) {
    return localResult;
  }

  const response = await apiFetch('/api/auth/password-policy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      valid: false,
      code: data.passwordPolicyCode ?? 'CHECK_UNAVAILABLE',
      message: data.error ?? 'Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.',
    };
  }

  return data;
}
