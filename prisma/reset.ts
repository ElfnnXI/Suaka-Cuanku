import { PrismaClient } from '@prisma/client';
import { clearApplicationData, seedAdminAccount } from './bootstrap';

const prisma = new PrismaClient();

async function main() {
  console.log('Reset data aplikasi dimulai...\n');

  const cleared = await clearApplicationData(prisma);
  const admin = await seedAdminAccount(prisma);

  console.log(`Deleted ${cleared.rateLimitEntries} rate limit entries`);
  console.log(`Deleted ${cleared.comments} comments`);
  console.log(`Deleted ${cleared.payments} payments`);
  console.log(`Deleted ${cleared.loans} loans`);
  console.log(`Deleted ${cleared.auditLogs} audit logs`);
  console.log(`Deleted ${cleared.users} users`);
  console.log('\nAdmin bootstrap created.');
  console.log(`Admin name: ${admin.name}`);
  console.log(`Admin email: ${admin.email}`);
  console.log('Admin password was loaded from SEED_ADMIN_PASSWORD.\n');
}

main()
  .catch((error) => {
    console.error('Error saat reset data aplikasi:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
