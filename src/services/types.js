// ============================================
// SPORTSMONKS TYPES SERVICE
// ============================================
// This service provides fast lookup functions for SportsMonks types.
// Types are loaded from the database once and cached in memory for
// fast access throughout the application.
//
// Following SportsMonks best practice: instead of including .type
// in every API call, we store types locally and look them up by ID.
// ============================================

import prisma from '../db.js';

// ============================================
// IN-MEMORY CACHE
// ============================================
// Types are static reference data that rarely changes.
// We load them once into memory for fast O(1) lookups.

let typesById = null;        // Map: id -> type object
let typesByCode = null;      // Map: code -> type object
let typesByModelType = null; // Map: modelType -> array of types
let cacheLoadedAt = null;    // When the cache was last loaded

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Load all types from database into memory cache.
 * Call this on server startup or when cache needs refresh.
 *
 * @returns {Promise<number>} - Number of types loaded
 */
const loadTypesCache = async () => {
  console.log('[Types] Loading types cache from database...');

  // Fetch all types from database
  const types = await prisma.sportsMonksType.findMany({
    orderBy: { id: 'asc' }
  });

  // Build lookup maps
  typesById = new Map();
  typesByCode = new Map();
  typesByModelType = new Map();

  for (const type of types) {
    // Index by ID
    typesById.set(type.id, type);

    // Index by code
    typesByCode.set(type.code, type);

    // Group by modelType
    if (!typesByModelType.has(type.modelType)) {
      typesByModelType.set(type.modelType, []);
    }
    typesByModelType.get(type.modelType).push(type);
  }

  cacheLoadedAt = new Date();
  console.log(`[Types] Cache loaded: ${types.length} types at ${cacheLoadedAt.toISOString()}`);

  return types.length;
};

/**
 * Ensure the cache is loaded. Call this before any lookup.
 * Safe to call multiple times - only loads once.
 */
const ensureCacheLoaded = async () => {
  if (typesById === null) {
    await loadTypesCache();
  }
};

/**
 * Force reload the cache from database.
 * Use this after syncing new types from the API.
 *
 * @returns {Promise<number>} - Number of types loaded
 */
const refreshCache = async () => {
  typesById = null;
  typesByCode = null;
  typesByModelType = null;
  return loadTypesCache();
};

// ============================================
// LOOKUP FUNCTIONS
// ============================================

/**
 * Get a type by its SportsMonks ID.
 * This is the most common lookup - when API returns a type_id.
 *
 * @param {number} id - The SportsMonks type ID
 * @returns {Promise<object|null>} - The type object or null if not found
 *
 * @example
 * const type = await getTypeById(34);
 * // Returns: { id: 34, name: "Corners", code: "corners", modelType: "statistic", ... }
 */
const getTypeById = async (id) => {
  await ensureCacheLoaded();
  return typesById.get(id) || null;
};

/**
 * Get a type's name by ID. Convenience function for display.
 *
 * @param {number} id - The SportsMonks type ID
 * @returns {Promise<string>} - The type name or "Unknown" if not found
 *
 * @example
 * const name = await getTypeName(34);
 * // Returns: "Corners"
 */
const getTypeName = async (id) => {
  const type = await getTypeById(id);
  return type?.name || `Unknown (${id})`;
};

/**
 * Get a type by its code (e.g., "corners", "shots-on-target").
 *
 * @param {string} code - The type code
 * @returns {Promise<object|null>} - The type object or null if not found
 *
 * @example
 * const type = await getTypeByCode('corners');
 * // Returns: { id: 34, name: "Corners", code: "corners", ... }
 */
const getTypeByCode = async (code) => {
  await ensureCacheLoaded();
  return typesByCode.get(code) || null;
};

/**
 * Get all types for a given model type (category).
 *
 * @param {string} modelType - The model type (e.g., "statistic", "event", "injury_suspension")
 * @returns {Promise<object[]>} - Array of types in that category
 *
 * @example
 * const stats = await getTypesByModelType('statistic');
 * // Returns: [{ id: 34, name: "Corners", ... }, { id: 52, name: "Goals", ... }, ...]
 */
const getTypesByModelType = async (modelType) => {
  await ensureCacheLoaded();
  return typesByModelType.get(modelType) || [];
};

/**
 * Get multiple types by their IDs at once. Efficient for batch lookups.
 *
 * @param {number[]} ids - Array of type IDs
 * @returns {Promise<Map<number, object>>} - Map of id -> type object
 *
 * @example
 * const types = await getTypesByIds([34, 52, 79]);
 * // Returns: Map { 34 => {...}, 52 => {...}, 79 => {...} }
 */
const getTypesByIds = async (ids) => {
  await ensureCacheLoaded();
  const result = new Map();
  for (const id of ids) {
    const type = typesById.get(id);
    if (type) {
      result.set(id, type);
    }
  }
  return result;
};

/**
 * Get cache status for monitoring/debugging.
 *
 * @returns {Promise<object>} - Cache statistics
 */
const getCacheStatus = async () => {
  await ensureCacheLoaded();
  return {
    loaded: typesById !== null,
    loadedAt: cacheLoadedAt,
    totalTypes: typesById?.size || 0,
    modelTypes: typesByModelType ? Array.from(typesByModelType.keys()) : []
  };
};

// ============================================
// API SYNC FUNCTIONS
// ============================================
// These functions sync types from the SportsMonks API to our database.

const TYPES_API_URL = 'https://api.sportmonks.com/v3/core/types';

/**
 * Fetch all types from SportsMonks API (handles pagination).
 *
 * @returns {Promise<object[]>} - Array of raw type objects from API
 */
const fetchTypesFromAPI = async () => {
  const apiKey = process.env.SPORTSMONKS_API_KEY;

  if (!apiKey) {
    throw new Error('SPORTSMONKS_API_KEY not configured');
  }

  let allTypes = [];
  let page = 1;
  let hasMore = true;

  console.log('[Types] Fetching types from SportsMonks API...');

  while (hasMore) {
    const url = `${TYPES_API_URL}?api_token=${apiKey}&page=${page}&per_page=100`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      allTypes = allTypes.concat(data.data);

      if (data.pagination && data.pagination.has_more) {
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`[Types] Fetched ${allTypes.length} types from API.`);
  return allTypes;
};

/**
 * Sync types from SportsMonks API to local database.
 * Upserts all types (inserts new, updates existing).
 * Then refreshes the in-memory cache.
 *
 * @returns {Promise<object>} - Sync result with counts
 */
const syncTypesFromAPI = async () => {
  const startTime = Date.now();

  // Fetch from API
  const apiTypes = await fetchTypesFromAPI();

  // Collect all IDs for parent validation
  const allIds = new Set(apiTypes.map(t => t.id));

  let inserted = 0;
  let updated = 0;

  // Upsert each type
  for (const apiType of apiTypes) {
    const parentExists = apiType.parent_id ? allIds.has(apiType.parent_id) : true;

    const typeData = {
      name: apiType.name || '',
      code: apiType.code || '',
      developerName: apiType.developer_name || '',
      modelType: apiType.model_type || '',
      group: apiType.group || null,
      statGroup: apiType.stat_group || null,
      parentId: parentExists ? (apiType.parent_id || null) : null,
      lastSyncedAt: new Date()
    };

    // Check if type exists
    const existing = await prisma.sportsMonksType.findUnique({
      where: { id: apiType.id }
    });

    if (existing) {
      await prisma.sportsMonksType.update({
        where: { id: apiType.id },
        data: typeData
      });
      updated++;
    } else {
      await prisma.sportsMonksType.create({
        data: {
          id: apiType.id,
          ...typeData
        }
      });
      inserted++;
    }
  }

  // Refresh the in-memory cache
  await refreshCache();

  const duration = Date.now() - startTime;

  console.log(`[Types] Sync complete: ${inserted} inserted, ${updated} updated in ${duration}ms`);

  return {
    totalFromAPI: apiTypes.length,
    inserted,
    updated,
    durationMs: duration,
    syncedAt: new Date().toISOString()
  };
};

// ============================================
// ENRICHMENT HELPERS
// ============================================
// These functions help enrich API responses with type information.

/**
 * Enrich a statistic object with type name.
 * Mutates the object in place for efficiency.
 *
 * @param {object} stat - A statistic object with type_id
 * @returns {Promise<object>} - The same object with typeName added
 *
 * @example
 * const stat = { type_id: 34, data: { value: 6 } };
 * await enrichStatWithType(stat);
 * // stat is now: { type_id: 34, data: { value: 6 }, typeName: "Corners" }
 */
const enrichStatWithType = async (stat) => {
  if (stat?.type_id) {
    stat.typeName = await getTypeName(stat.type_id);
  }
  return stat;
};

/**
 * Enrich an array of statistics with type names.
 *
 * @param {object[]} stats - Array of statistic objects
 * @returns {Promise<object[]>} - The same array with typeName added to each
 */
const enrichStatsWithTypes = async (stats) => {
  if (!Array.isArray(stats)) return stats;

  await ensureCacheLoaded();

  for (const stat of stats) {
    if (stat?.type_id) {
      stat.typeName = typesById.get(stat.type_id)?.name || `Unknown (${stat.type_id})`;
    }
  }

  return stats;
};

// ============================================
// EXPORTS
// ============================================

export {
  // Cache management
  loadTypesCache,
  refreshCache,
  getCacheStatus,

  // API sync
  syncTypesFromAPI,

  // Single lookups
  getTypeById,
  getTypeName,
  getTypeByCode,

  // Batch lookups
  getTypesByModelType,
  getTypesByIds,

  // Enrichment helpers
  enrichStatWithType,
  enrichStatsWithTypes
};
