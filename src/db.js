// ============================================
// DATABASE CLIENT
// ============================================
// This file creates a single Prisma client instance
// that we import wherever we need database access.
// ============================================
// Prisma 7 requires a "driver adapter" to connect
// to the database. We use @prisma/adapter-pg for PostgreSQL.
// ============================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

// Get the database URL from environment variables
const connectionString = process.env.DATABASE_URL;

// Create the PostgreSQL adapter
const adapter = new PrismaPg({ connectionString });

// Create the Prisma client using the adapter
const prisma = new PrismaClient({ adapter });

// Export it for use in other files
export default prisma;