import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { validatePasswordLocally } from '../lib/password-policy-shared';

const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
const seedAdminName = process.env.SEED_ADMIN_NAME?.trim() || 'Super Admin';

function getSeedAdminConfig() {
  if (!seedAdminEmail || !seedAdminPassword) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required to bootstrap the admin account.'
    );
  }

  const passwordValidation = validatePasswordLocally(seedAdminPassword);
  if (!passwordValidation.valid) {
    throw new Error(`SEED_ADMIN_PASSWORD is invalid: ${passwordValidation.message}`);
  }

  return {
    email: seedAdminEmail,
    password: seedAdminPassword,
    name: seedAdminName,
  };
}

export async function clearApplicationData(prisma: PrismaClient) {
  const [
    rateLimitEntriesCount,
    commentsCount,
    paymentsCount,
    loansCount,
    auditLogsCount,
    authChallengesCount,
    backupCodesCount,
    passwordResetChallengesCount,
    sensitiveActionChallengesCount,
    usersCount,
  ] = await prisma.$transaction([
    prisma.rateLimitEntry.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.authChallenge.deleteMany(),
    prisma.userBackupCode.deleteMany(),
    prisma.passwordResetChallenge.deleteMany(),
    prisma.sensitiveActionChallenge.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  return {
    rateLimitEntries: rateLimitEntriesCount.count,
    comments: commentsCount.count,
    payments: paymentsCount.count,
    loans: loansCount.count,
    auditLogs: auditLogsCount.count,
    authChallenges: authChallengesCount.count,
    backupCodes: backupCodesCount.count,
    passwordResetChallenges: passwordResetChallengesCount.count,
    sensitiveActionChallenges: sensitiveActionChallengesCount.count,
    users: usersCount.count,
  };
}

export async function seedAdminAccount(prisma: PrismaClient) {
  const config = getSeedAdminConfig();
  const hashedPassword = await bcrypt.hash(config.password, 10);

  const admin = await prisma.user.upsert({
    where: { email: config.email },
    update: {
      name: config.name,
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      riskLevel: 'LOW',
      riskReason: null,
      loanLimit: 30000000,
      sessionVersion: 0,
      mfaTotpEnabled: false,
      mfaTotpSecret: null,
      mfaEnrolledAt: null,
    },
    create: {
      name: config.name,
      email: config.email,
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      riskLevel: 'LOW',
      loanLimit: 30000000,
    },
  });

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  };
}
