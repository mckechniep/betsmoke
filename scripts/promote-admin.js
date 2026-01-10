// ============================================
// PROMOTE USER TO ADMIN
// ============================================
// This script promotes a user to admin status.
//
// Usage:
//   node scripts/promote-admin.js <email>
//
// Example:
//   node scripts/promote-admin.js myemail@example.com
// ============================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Create the PostgreSQL adapter (required for Prisma 7)
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const promoteUser = async () => {
  // Get email from command line arguments
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node scripts/promote-admin.js <email>');
    console.error('Example: node scripts/promote-admin.js myemail@example.com');
    process.exit(1);
  }

  console.log(`Looking up user: ${email}`);

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isAdmin: true }
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (user.isAdmin) {
    console.log(`User ${email} is already an admin.`);
    process.exit(0);
  }

  // Promote to admin
  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true }
  });

  console.log(`Successfully promoted ${email} to admin.`);
};

promoteUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
