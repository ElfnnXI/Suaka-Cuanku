import { prisma } from '@/lib/prisma';

const statements = [
  `
  ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS user_password_bcrypt_chk;
  `,
  `
  ALTER TABLE "User"
  ADD CONSTRAINT user_password_bcrypt_chk
  CHECK (password ~ '^\\$2[aby]\\$[0-9]{2}\\$.+');
  `,
  `
  ALTER TABLE "security_questions"
  DROP CONSTRAINT IF EXISTS security_questions_answer_bcrypt_chk;
  `,
  `
  ALTER TABLE "security_questions"
  ADD CONSTRAINT security_questions_answer_bcrypt_chk
  CHECK (answer ~ '^\\$2[aby]\\$[0-9]{2}\\$.+');
  `,
  `
  ALTER TABLE "admin_backup_settings"
  DROP CONSTRAINT IF EXISTS admin_backup_settings_interval_days_chk;
  `,
  `
  ALTER TABLE "admin_backup_settings"
  ADD CONSTRAINT admin_backup_settings_interval_days_chk
  CHECK ("intervalDays" IS NULL OR "intervalDays" IN (1, 3, 7));
  `,
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log('PostgreSQL hardening constraints applied.');
}

main()
  .catch((error) => {
    console.error('Failed to apply PostgreSQL hardening constraints:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
