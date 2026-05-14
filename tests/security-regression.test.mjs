import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await run('seed admin no longer hardcodes default credentials', async () => {
  const seed = await read('prisma/seed.ts');
  assert.match(seed, /SEED_ADMIN_EMAIL/);
  assert.match(seed, /SEED_ADMIN_PASSWORD/);
  assert.doesNotMatch(seed, /admin123/);
});

await run('login redirect hardening rejects protocol-relative targets', async () => {
  const loginPage = await read('app/login/page.tsx');
  const helpers = await read('lib/security-helpers.ts');
  assert.match(loginPage, /getSafeRedirectPath/);
  assert.match(helpers, /!redirectParam\.startsWith\('\/\/'\)/);
  assert.match(helpers, /!redirectParam\.includes\('\\\\'\)/);
});

await run('session versioning is wired into schema and auth verification', async () => {
  const schema = await read('prisma/schema.prisma');
  const auth = await read('lib/auth.ts');
  assert.match(schema, /sessionVersion\s+Int\s+@default\(0\)/);
  assert.match(auth, /sessionVersion: number/);
  assert.match(auth, /isSessionVersionCurrent\(payload\.sessionVersion, user\.sessionVersion\)/);
});

await run('rate limiting is backed by the centralized database table', async () => {
  const schema = await read('prisma/schema.prisma');
  const security = await read('lib/security.ts');
  assert.match(schema, /model RateLimitEntry/);
  assert.match(schema, /@@map\("rate_limit_entries"\)/);
  assert.match(security, /prisma\.rateLimitEntry\.findUnique/);
  assert.match(security, /prisma\.rateLimitEntry\.update/);
});

await run('sensitive admin and auditor endpoints use additional throttling', async () => {
  const resetPassword = await read('app/api/admin/reset-password/route.ts');
  const adminUsers = await read('app/api/admin/admin-users/route.ts');
  const auditorAccounts = await read('app/api/auditor-accounts/route.ts');
  const auditReport = await read('app/api/auditor/audit-report/route.ts');

  assert.match(resetPassword, /admin-reset-password:/);
  assert.match(adminUsers, /admin-manage-admins:create:/);
  assert.match(auditorAccounts, /admin-manage-auditors:create:/);
  assert.match(auditReport, /auditor-report:/);
});

await run('login rate limit uses stepped lock windows and concise feedback', async () => {
  const security = await read('lib/security.ts');
  const loginRoute = await read('app/api/auth/login/route.ts');
  assert.match(security, /state\.count > limit/);
  assert.match(security, /state\.resetAt\.getTime\(\) !== desiredResetAt\.getTime\(\)/);
  assert.match(loginRoute, /LOGIN_WAIT_SHORT_MS = 10 \* 60 \* 1000/);
  assert.match(loginRoute, /LOGIN_WAIT_LONG_MS = 30 \* 60 \* 1000/);
  assert.match(loginRoute, /LOGIN_ATTEMPT_LIMIT = 10/);
  assert.match(loginRoute, /LOGIN_ATTEMPT_ESCALATION_THRESHOLD = 15/);
  assert.match(loginRoute, /attemptCount > Math\.max\(limit, LOGIN_ATTEMPT_ESCALATION_THRESHOLD\)/);
  assert.doesNotMatch(loginRoute, /limit: 5/);
  assert.match(loginRoute, /Terlalu banyak percobaan\. Coba lagi/);
  assert.match(loginRoute, /Email atau password salah\. Percobaan/);
});

await run('password creation flows validate against common and breached passwords', async () => {
  const sharedPolicy = await read('lib/password-policy-shared.ts');
  const passwordSecurity = await read('lib/password-security.ts');
  const passwordPolicyClient = await read('lib/password-policy-client.ts');
  const passwordPolicyApi = await read('app/api/auth/password-policy/route.ts');
  const registerRoute = await read('app/api/auth/register/route.ts');
  const adminUsers = await read('app/api/admin/admin-users/route.ts');
  const auditorAccounts = await read('app/api/auditor-accounts/route.ts');

  assert.match(sharedPolicy, /WEAK_SUBSTRINGS/);
  assert.match(sharedPolicy, /hasSequentialRun/);
  assert.match(passwordSecurity, /api\.pwnedpasswords\.com\/range/);
  assert.match(passwordSecurity, /BREACHED_PASSWORD/);
  assert.doesNotMatch(passwordPolicyClient, /Pemeriksaan password gagal/);
  assert.match(passwordPolicyApi, /password-policy:/);
  assert.match(registerRoute, /validatePasswordSecurity/);
  assert.match(adminUsers, /validatePasswordSecurity/);
  assert.match(auditorAccounts, /validatePasswordSecurity/);
});

await run('login and registration now require authenticator MFA', async () => {
  const schema = await read('prisma/schema.prisma');
  const loginRoute = await read('app/api/auth/login/route.ts');
  const registerRoute = await read('app/api/auth/register/route.ts');
  const mfaHelper = await read('lib/mfa.ts');
  const mfaChallengeRoute = await read('app/api/auth/mfa/challenge/route.ts');
  const mfaVerifyRoute = await read('app/api/auth/mfa/verify/route.ts');

  assert.match(schema, /mfaTotpEnabled\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /model AuthChallenge/);
  assert.match(loginRoute, /requiresMfa: true/);
  assert.match(registerRoute, /requiresMfa: true/);
  assert.match(mfaHelper, /otpauth:\/\/totp/);
  assert.match(mfaChallengeRoute, /manualEntryKey/);
  assert.match(mfaVerifyRoute, /completeMfaChallenge/);
  assert.doesNotMatch(mfaVerifyRoute, /emailCode/);
});

await run('account recovery and sensitive actions require MFA step-up', async () => {
  const schema = await read('prisma/schema.prisma');
  const mfaHelper = await read('lib/mfa.ts');
  const forgotStart = await read('app/api/auth/forgot-password/start/route.ts');
  const forgotComplete = await read('app/api/auth/forgot-password/complete/route.ts');
  const backupCodesRoute = await read('app/api/auth/mfa/backup-codes/route.ts');
  const reEnrollRoute = await read('app/api/auth/mfa/re-enroll/route.ts');
  const sensitiveActionStart = await read('app/api/auth/mfa/sensitive-action/start/route.ts');
  const updateProfile = await read('app/api/auth/update-profile/route.ts');
  const changePassword = await read('app/api/auth/change-password/route.ts');
  const adminResetPassword = await read('app/api/admin/reset-password/route.ts');

  assert.match(schema, /model UserBackupCode/);
  assert.match(schema, /model PasswordResetChallenge/);
  assert.match(schema, /model SensitiveActionChallenge/);
  assert.match(mfaHelper, /replaceBackupCodes/);
  assert.match(mfaHelper, /beginPasswordResetChallenge/);
  assert.match(mfaHelper, /beginSensitiveActionChallenge/);
  assert.match(forgotStart, /attachPendingPasswordReset/);
  assert.match(forgotComplete, /verifyPasswordResetMfa/);
  assert.match(backupCodesRoute, /REGENERATE_BACKUP_CODES/);
  assert.match(backupCodesRoute, /mfa-backup-codes-status:/);
  assert.match(backupCodesRoute, /mfa-backup-codes-regenerate:/);
  assert.match(reEnrollRoute, /finalizeReEnrollAuthenticator/);
  assert.match(reEnrollRoute, /mfa-reenroll-setup:/);
  assert.match(reEnrollRoute, /mfa-reenroll-submit:/);
  assert.match(sensitiveActionStart, /UPDATE_PROFILE/);
  assert.match(changePassword, /verifySensitiveActionChallenge\(user\.id, 'CHANGE_PASSWORD'/);
  assert.match(updateProfile, /verifySensitiveActionChallenge\(user\.id, 'UPDATE_PROFILE'/);
  assert.match(adminResetPassword, /verifySensitiveActionChallenge\(admin\.id, 'ADMIN_RESET_PASSWORD'/);
  assert.doesNotMatch(forgotComplete, /emailCode/);
  assert.doesNotMatch(changePassword, /emailCode/);
  assert.doesNotMatch(updateProfile, /emailCode/);
  assert.doesNotMatch(adminResetPassword, /emailCode/);
});
