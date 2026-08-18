import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';
import { createSqlitePrismaClient } from '../src/infrastructure/database/create-prisma-client';
import { hashPassword } from '../src/modules/auth/security/password';

config({ path: ['.env', '../../.env'], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the seed');
}
if (!adminPassword) {
  throw new Error('SEED_ADMIN_PASSWORD is required to run the seed');
}

const prisma: PrismaClient = createSqlitePrismaClient(databaseUrl);

async function main(): Promise<void> {
  const email = 'admin@autocall.local';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.info(`Seed administrator already exists: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      password: await hashPassword(adminPassword),
      name: 'AutoCall Super Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.info(`Seed administrator created: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
