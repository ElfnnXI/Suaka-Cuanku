type PasswordPolicyResult = {
  valid: boolean;
  message: string;
  code:
    | 'VALID'
    | 'TOO_SHORT'
    | 'MISSING_LETTER'
    | 'MISSING_NUMBER'
    | 'MISSING_SYMBOL'
    | 'COMMON_PASSWORD'
    | 'BREACHED_PASSWORD'
    | 'CHECK_UNAVAILABLE';
};

const COMMON_BREACHED_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '123123123',
  '12341234',
  '12344321',
  'qwerty',
  'qwertyuiop',
  'qwerty123',
  'qwerty123!',
  'qweasd123',
  'password',
  'password1',
  'password12',
  'password123',
  'password123!',
  'password1!',
  'password2024!',
  'password2025!',
  'password2026!',
  'admin',
  'admin123',
  'admin123!',
  'admin2024!',
  'admin2025!',
  'admin2026!',
  'welcome',
  'welcome123',
  'welcome123!',
  'letmein',
  'letmein123',
  'letmein123!',
  'football',
  'monkey',
  'dragon',
  'master',
  'shadow',
  'superman',
  'batman',
  'iloveyou',
  'trustno1',
  'abc123',
  'secret',
  'passw0rd',
  'passw0rd!',
  'sunshine',
  'princess',
  'administrator',
  'login',
  'root',
  'toor',
  'guest',
  'default',
  'changeme',
  'changeme123!',
  'test123',
  'testing123!',
  'demo123',
  'asdfgh',
  'asdfghjkl',
  'zxcvbnm123!',
  'zaq12wsx',
  'zaq12wsx!',
  '111111',
  '11111111',
  '22222222',
  '99999999',
  '000000',
  '00000000',
  '987654321',
  '1q2w3e4r',
  '1q2w3e4r5t',
  '1q2w3e4r5t!',
  '654321',
  'hunter2',
  'bismillah123!',
  'indonesia123!',
  'sayang123!',
  'rahasia123!',
]);

const WEAK_SUBSTRINGS = [
  'password',
  'qwerty',
  'admin',
  'welcome',
  'letmein',
  'changeme',
  '12345',
  '123456',
  '654321',
  'qwertyui',
  'asdfgh',
  'zxcvbn',
];

function normalizePassword(password: string) {
  return password.trim().toLowerCase();
}

function hasSequentialRun(password: string) {
  const lower = password.toLowerCase();
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    '0123456789',
    '9876543210',
    'qwertyuiop',
    'poiuytrewq',
    'asdfghjkl',
    'lkjhgfdsa',
    'zxcvbnm',
    'mnbvcxz',
  ];

  return sequences.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      if (lower.includes(sequence.slice(index, index + 4))) {
        return true;
      }
    }

    return false;
  });
}

function hasRepeatedPattern(password: string) {
  const lower = password.toLowerCase();

  return /(.)\1{3,}/.test(lower) || /^(.{1,4})\1{2,}$/.test(lower);
}

function getCompositionResult(password: string): PasswordPolicyResult {
  if (password.length < 10) {
    return {
      valid: false,
      code: 'TOO_SHORT',
      message: 'Password minimal 10 karakter.',
    };
  }

  if (!/[A-Za-z]/.test(password)) {
    return {
      valid: false,
      code: 'MISSING_LETTER',
      message: 'Password wajib mengandung huruf.',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      code: 'MISSING_NUMBER',
      message: 'Password wajib mengandung angka.',
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      code: 'MISSING_SYMBOL',
      message: 'Password wajib mengandung simbol.',
    };
  }

  return {
    valid: true,
    code: 'VALID',
    message: 'Password memenuhi format dasar.',
  };
}

export function validatePasswordLocally(password: string): PasswordPolicyResult {
  const compositionResult = getCompositionResult(password);
  if (!compositionResult.valid) {
    return compositionResult;
  }

  const normalizedPassword = normalizePassword(password);
  if (COMMON_BREACHED_PASSWORDS.has(normalizedPassword)) {
    return {
      valid: false,
      code: 'COMMON_PASSWORD',
      message: 'Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.',
    };
  }

  if (WEAK_SUBSTRINGS.some((item) => normalizedPassword.includes(item))) {
    return {
      valid: false,
      code: 'COMMON_PASSWORD',
      message: 'Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.',
    };
  }

  if (hasSequentialRun(normalizedPassword) || hasRepeatedPattern(normalizedPassword)) {
    return {
      valid: false,
      code: 'COMMON_PASSWORD',
      message: 'Password masih belum cukup aman. Tambahkan kombinasi yang lebih acak dan unik.',
    };
  }

  return {
    valid: true,
    code: 'VALID',
    message: 'Password layak dipakai.',
  };
}

export type { PasswordPolicyResult };
