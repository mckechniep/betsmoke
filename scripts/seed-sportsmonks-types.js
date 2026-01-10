// ============================================
// SEED SPORTSMONKS TYPES
// ============================================
// This script fetches all types from the SportsMonks API and seeds
// them into the local database.
//
// Run with: node scripts/seed-sportsmonks-types.js
//
// Types are used throughout the SportsMonks API to identify events,
// statistics, injuries, positions, predictions, etc.
// ============================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Create the PostgreSQL adapter (required for Prisma 7)
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// SportsMonks API configuration
const API_KEY = process.env.SPORTSMONKS_API_KEY;
const TYPES_URL = 'https://api.sportmonks.com/v3/core/types';

// ============================================
// FETCH TYPES FROM SPORTSMONKS API
// ============================================

const fetchTypesFromAPI = async () => {
  console.log('Fetching types from SportsMonks API...');

  let allTypes = [];
  let page = 1;
  let hasMore = true;

  // Handle pagination - fetch all pages
  while (hasMore) {
    const url = `${TYPES_URL}?api_token=${API_KEY}&page=${page}&per_page=100`;
    console.log(`  Fetching page ${page}...`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      allTypes = allTypes.concat(data.data);

      // Check if there are more pages
      if (data.pagination && data.pagination.has_more) {
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allTypes.length} types from API.`);
  return allTypes;
};

// ============================================
// TRANSFORM API RESPONSE TO OUR SCHEMA
// ============================================

const transformType = (apiType) => {
  return {
    id: apiType.id,
    parentId: apiType.parent_id || null,
    name: apiType.name || '',
    code: apiType.code || '',
    developerName: apiType.developer_name || '',
    modelType: apiType.model_type || '',
    group: apiType.group || null,
    statGroup: apiType.stat_group || null
  };
};

// ============================================
// SEED TYPES INTO DATABASE
// ============================================

const seedTypes = async () => {
  // Fetch types from API
  const apiTypes = await fetchTypesFromAPI();

  // Transform to our schema format
  const types = apiTypes.map(transformType);
  console.log(`Transformed ${types.length} types.`);

  // Collect all IDs to check which parents exist
  const allIds = new Set(types.map(t => t.id));

  // Separate types into those without parents and those with parents
  const typesWithoutParent = types.filter(t => !t.parentId);
  const typesWithParent = types.filter(t => t.parentId);

  console.log(`Types without parent: ${typesWithoutParent.length}`);
  console.log(`Types with parent: ${typesWithParent.length}`);

  // Clear existing types (fresh seed)
  console.log('Clearing existing types...');
  await prisma.sportsMonksType.deleteMany({});

  // Insert types without parents first
  console.log('Inserting types without parents...');
  for (const type of typesWithoutParent) {
    await prisma.sportsMonksType.create({
      data: {
        id: type.id,
        parentId: null,
        name: type.name,
        code: type.code,
        developerName: type.developerName,
        modelType: type.modelType,
        group: type.group,
        statGroup: type.statGroup
      }
    });
  }

  // Insert types with parents (parent should now exist)
  console.log('Inserting types with parents...');
  for (const type of typesWithParent) {
    // Only set parentId if the parent actually exists in our data
    const parentExists = allIds.has(type.parentId);

    await prisma.sportsMonksType.create({
      data: {
        id: type.id,
        parentId: parentExists ? type.parentId : null,
        name: type.name,
        code: type.code,
        developerName: type.developerName,
        modelType: type.modelType,
        group: type.group,
        statGroup: type.statGroup
      }
    });
  }

  // Verify the count
  const count = await prisma.sportsMonksType.count();
  console.log(`\nSeeding complete! ${count} types inserted.`);

  // Show breakdown by modelType
  const breakdown = await prisma.sportsMonksType.groupBy({
    by: ['modelType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  console.log('\nTypes by category:');
  breakdown.forEach(item => {
    console.log(`  ${item.modelType}: ${item._count.id}`);
  });
};

// ============================================
// MAIN
// ============================================

seedTypes()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error seeding types:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
