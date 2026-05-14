import { PrismaClient } from '@prisma/client';
import { seedAdminAccount } from './bootstrap';

const prisma = new PrismaClient();

async function main() {
  const admin = await seedAdminAccount(prisma);

  console.log('Database seeded successfully.');
  console.log(`Admin name: ${admin.name}`);
  console.log(`Admin email: ${admin.email}`);
  console.log('Admin password was loaded from SEED_ADMIN_PASSWORD.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
