import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for runtime MFA flow tests.');
}

const db = new Client({
  connectionString: databaseUrl,
});
const baseUrl = 'http://localhost:3000';

const testRunId = Date.now();
const userName = `Runtime User ${testRunId}`;
const userEmail = `runtime.user.${testRunId}@example.test`;
const userPassword = 'UserFlow!2026$One';
const forgotPasswordReplacement = 'UserFlow!2026$Two';
const adminEmail = `runtime.admin.${testRunId}@example.test`;
const adminPassword = 'AdminFlow!2026$One';
const adminResetPassword = 'UserReset!2026$Three';

function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let buffer = 0;
  const bytes = [];

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

function generateTotp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const key = base32Decode(secret);

  for (let offset = -1; offset <= 1; offset += 1) {
    const counterBuffer = Buffer.alloc(8);
    const value = counter + offset;
    counterBuffer.writeUInt32BE(Math.floor(value / 0x100000000), 0);
    counterBuffer.writeUInt32BE(value % 0x100000000, 4);
    const digest = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const dynamicOffset = digest[digest.length - 1] & 0x0f;
    const code =
      ((digest[dynamicOffset] & 0x7f) << 24) |
      ((digest[dynamicOffset + 1] & 0xff) << 16) |
      ((digest[dynamicOffset + 2] & 0xff) << 8) |
      (digest[dynamicOffset + 3] & 0xff);

    if (offset === 0) {
      return (code % 10 ** 6).toString().padStart(6, '0');
    }
  }

  throw new Error('Failed to generate TOTP.');
}

async function getCsrfToken(page) {
  return page.evaluate(() => {
    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('csrf_token='));
    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
  });
}

async function postJson(page, route, body) {
  const csrfToken = await getCsrfToken(page);
  return page.evaluate(async ({ route, body, csrfToken }) => {
    const response = await fetch(route, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  }, { route, body, csrfToken });
}

async function patchJson(page, route, body) {
  const csrfToken = await getCsrfToken(page);
  return page.evaluate(async ({ route, body, csrfToken }) => {
    const response = await fetch(route, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  }, { route, body, csrfToken });
}

async function logout(page) {
  await postJson(page, '/api/auth/logout', {});
}

async function prepareAdminAccount() {
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const adminId = crypto.randomUUID();

  await db.query(
    `
      INSERT INTO "User" ("id", "name", "email", "password", "role", "status", "sessionVersion", "mfaTotpEnabled", "mfaTotpSecret", "mfaEnrolledAt", "riskLevel", "loanLimit", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', 0, false, NULL, NULL, 'LOW', 30000000, NOW(), NOW())
      ON CONFLICT ("email")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "password" = EXCLUDED."password",
        "role" = 'ADMIN',
        "status" = 'ACTIVE',
        "sessionVersion" = 0,
        "mfaTotpEnabled" = false,
        "mfaTotpSecret" = NULL,
        "mfaEnrolledAt" = NULL,
        "updatedAt" = NOW()
    `,
    [adminId, 'Runtime Admin', adminEmail, hashedPassword]
  );
}

async function findUserIdByEmail(email) {
  const result = await db.query(
    'SELECT "id" FROM "User" WHERE "email" = $1 LIMIT 1',
    [email]
  );
  return result.rows[0]?.id ?? null;
}

async function registerUser(page) {
  await page.goto(`${baseUrl}/register`);
  await page.getByPlaceholder('Fulan Asik').fill(userName);
  await page.getByPlaceholder('nama@email.com').fill(userEmail);
  await page.getByPlaceholder('Minimal 10 karakter. Hindari password umum atau yang pernah bocor.').fill(userPassword);
  await page.getByPlaceholder('Ulangi password Anda').fill(userPassword);
  await page.getByRole('button', { name: 'Daftar' }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((element) => element.textContent?.trim() === 'Daftar');
    return Boolean(button && !button.hasAttribute('disabled'));
  });
  await page.getByRole('button', { name: 'Daftar' }).click();
  await page.waitForURL(`${baseUrl}/mfa`);
}

async function completeMfaSetup(page) {
  const currentUrl = page.url();
  if (!currentUrl.endsWith('/mfa')) {
    throw new Error(`Expected /mfa page, received ${currentUrl}`);
  }

  const manualEntryKey = await page.locator('div.break-all').first().textContent();
  assert.ok(manualEntryKey, 'Manual entry key should be visible when MFA setup is required.');
  const totpCode = generateTotp(manualEntryKey.trim());

  await page.getByPlaceholder('6 digit dari authenticator').fill(totpCode);
  await page.getByRole('button', { name: 'Verifikasi dan Masuk' }).click();

  return manualEntryKey.trim();
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/login`);
  await page.getByPlaceholder('nama@email.com').fill(email);
  await page.getByPlaceholder('Minimal 10 karakter dengan huruf, angka, dan simbol.').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(`${baseUrl}/mfa`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

let userTotpSecret = '';
let adminTotpSecret = '';

try {
  await db.connect();
  await prepareAdminAccount();

  await registerUser(page);
  userTotpSecret = await completeMfaSetup(page);
  await page.waitForURL(/\/dashboard\/overview$/);

  await page.goto(`${baseUrl}/settings/account`);
  await page.waitForLoadState('networkidle');

  const backupBypass = await postJson(page, '/api/auth/mfa/backup-codes', {
    totpCode: generateTotp(userTotpSecret),
  });
  assert.equal(backupBypass.status, 401, 'Backup code regeneration must require a fresh MFA step-up challenge.');

  const backupStart = await postJson(page, '/api/auth/mfa/sensitive-action/start', {
    action: 'REGENERATE_BACKUP_CODES',
  });
  assert.equal(backupStart.status, 200, 'Backup code step-up start should succeed.');
  const backupComplete = await postJson(page, '/api/auth/mfa/backup-codes', {
    totpCode: generateTotp(userTotpSecret),
  });
  assert.equal(backupComplete.status, 200, 'Backup code regeneration should succeed after step-up.');

  const reEnrollBypass = await postJson(page, '/api/auth/mfa/re-enroll', {
    totpCode: generateTotp(userTotpSecret),
  });
  assert.equal(reEnrollBypass.status, 401, 'Re-enroll must require a fresh MFA step-up challenge.');

  const reEnrollStart = await postJson(page, '/api/auth/mfa/sensitive-action/start', {
    action: 'REENROLL_TOTP',
  });
  assert.equal(reEnrollStart.status, 200, 'Re-enroll step-up start should succeed.');
  const reEnrollPrepare = await postJson(page, '/api/auth/mfa/re-enroll', {
    totpCode: generateTotp(userTotpSecret),
  });
  assert.equal(reEnrollPrepare.status, 200, 'Re-enroll prepare should succeed after step-up.');
  const updatedSecret = reEnrollPrepare.data.manualEntryKey;
  assert.ok(updatedSecret, 'New authenticator secret should be shown after step-up verification.');
  userTotpSecret = updatedSecret.trim();
  const reEnrollFinalize = await postJson(page, '/api/auth/mfa/re-enroll', {
    newTotpCode: generateTotp(userTotpSecret),
  });
  assert.equal(reEnrollFinalize.status, 200, 'Re-enroll finalize should activate the new authenticator.');

  const profileBypass = await patchJson(page, '/api/auth/update-profile', {
    name: userName,
    email: userEmail,
    totpCode: generateTotp(userTotpSecret),
  });
  assert.equal(profileBypass.status, 401, 'Profile update must require a fresh MFA step-up challenge.');

  await logout(page);

  await page.goto(`${baseUrl}/forgot-password`);
  await page.getByPlaceholder('nama@email.com').fill(userEmail);
  await page.getByRole('button', { name: 'Lanjutkan Reset Password' }).click();
  await page.getByText(/lanjut ke verifikasi authenticator/i).waitFor();
  await page.getByPlaceholder('6 digit dari authenticator').fill(generateTotp(userTotpSecret));
  await page.getByPlaceholder('Minimal 10 karakter. Hindari password umum atau yang pernah bocor.').fill(forgotPasswordReplacement);
  await page.getByPlaceholder('Ulangi password baru').fill(forgotPasswordReplacement);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await page.getByText('Password berhasil direset.').waitFor();

  await login(page, userEmail, forgotPasswordReplacement);
  await page.getByPlaceholder('6 digit dari authenticator').fill(generateTotp(userTotpSecret));
  await page.getByRole('button', { name: 'Verifikasi dan Masuk' }).click();
  await page.waitForURL(/\/dashboard\/overview$/);
  await logout(page);

  await login(page, adminEmail, adminPassword);
  adminTotpSecret = await page.locator('div.break-all').first().textContent();
  assert.ok(adminTotpSecret, 'Admin MFA setup secret should be visible on first login.');
  await page.getByPlaceholder('6 digit dari authenticator').fill(generateTotp(adminTotpSecret.trim()));
  await page.getByRole('button', { name: 'Verifikasi dan Masuk' }).click();
  adminTotpSecret = adminTotpSecret.trim();
  await page.waitForURL(/\/admin\/overview$/);

  const targetUserId = await findUserIdByEmail(userEmail);
  assert.ok(targetUserId, 'Runtime user ID should exist before admin reset test.');

  const adminBypass = await postJson(page, '/api/admin/reset-password', {
    userId: targetUserId,
    newPassword: adminResetPassword,
    totpCode: generateTotp(adminTotpSecret),
  });
  assert.equal(adminBypass.status, 401, 'Admin reset-password must require a fresh MFA step-up challenge.');

  const adminStepUp = await postJson(page, '/api/auth/mfa/sensitive-action/start', {
    action: 'ADMIN_RESET_PASSWORD',
  });
  assert.equal(adminStepUp.status, 200, 'Admin reset-password step-up start should succeed.');
  const adminResetResult = await postJson(page, '/api/admin/reset-password', {
    userId: targetUserId,
    newPassword: adminResetPassword,
    totpCode: generateTotp(adminTotpSecret),
  });
  assert.equal(adminResetResult.status, 200, 'Admin password reset should succeed after step-up.');
  await expectUserCanLoginAfterAdminReset();
} finally {
  await page.close();
  await context.close();
  await browser.close();
  await db.end();
}

async function expectUserCanLoginAfterAdminReset() {
  await logout(page);
  await login(page, userEmail, adminResetPassword);
  await page.getByPlaceholder('6 digit dari authenticator').fill(generateTotp(userTotpSecret));
  await page.getByRole('button', { name: 'Verifikasi dan Masuk' }).click();
  await page.waitForURL(/\/dashboard\/overview$/);
}

console.log(`PASS register -> MFA setup -> account MFA actions -> forgot password -> admin reset (${userEmail})`);
