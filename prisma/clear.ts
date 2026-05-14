import { PrismaClient } from '@prisma/client';
import { clearApplicationData } from './bootstrap';

const prisma = new PrismaClient();

async function main() {
  console.log('Membersihkan seluruh data aplikasi dari database...\n');

  const cleared = await clearApplicationData(prisma);

  console.log(`Deleted ${cleared.rateLimitEntries} rate limit entries`);
  console.log(`Deleted ${cleared.comments} comments`);
  console.log(`Deleted ${cleared.payments} payments`);
  console.log(`Deleted ${cleared.loans} loans`);
  console.log(`Deleted ${cleared.auditLogs} audit logs`);
  console.log(`Deleted ${cleared.authChallenges} auth challenges`);
  console.log(`Deleted ${cleared.backupCodes} backup codes`);
  console.log(`Deleted ${cleared.passwordResetChallenges} password reset challenges`);
  console.log(`Deleted ${cleared.sensitiveActionChallenges} sensitive action challenges`);
  console.log(`Deleted ${cleared.users} users`);

  console.log('\nSemua data aplikasi berhasil dibersihkan.');
  console.log('Schema, tabel, dan relasi tetap utuh.');
  console.log('Jalankan "npm run db:seed" untuk membuat admin bootstrap.');
  console.log('Jalankan "npm run db:reset" untuk bersihkan data lalu buat ulang admin bootstrap.\n');
}

main()
  .catch((error) => {
    console.error('Error saat membersihkan data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
