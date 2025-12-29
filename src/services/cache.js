// ============================================
// CACHE SERVICE
// ============================================
// Simple in-memory caching using node-cache.
// Used to reduce API calls to SportsMonks for data
// that doesn't change frequently (like corner averages).
//
// Cache Keys:
//   - corners:{teamId}:{seasonId}  → Team corner averages (12h TTL)
//   - season:{seasonId}            → Season dates (24h TTL)
// ============================================

import NodeCache from 'node-cache';

// ============================================
// CONFIGURATION
// ============================================

// Default TTL values (in seconds)
const TTL = {
  CORNERS: 12 * 60 * 60,    // 12 hours for corner averages
  SEASON: 24 * 60 * 60,     // 24 hours for season dates (rarely change)
  DEFAULT: 6 * 60 * 60      // 6 hours fallback
};

// Create cache instance
// - stdTTL: default time-to-live in seconds
// - checkperiod: how often to check for expired keys (in seconds)
// - useClones: false for better performance (we won't mutate cached objects)
const cache = new NodeCache({
  stdTTL: TTL.DEFAULT,
  checkperiod: 600,  // Check every 10 minutes
  useClones: false
});

// ============================================
// CACHE KEY BUILDERS
// ============================================
// Consistent key format: "type:id1:id2:..."

const keys = {
  // Key for team corner averages by season
  corners: (teamId, seasonId) => `corners:${teamId}:${seasonId}`,
  
  // Key for season data (dates, name, etc.)
  season: (seasonId) => `season:${seasonId}`
};

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Get a value from cache
 * @param {string} key - The cache key
 * @returns {any|undefined} - Cached value or undefined if not found/expired
 */
function get(key) {
  const value = cache.get(key);
  if (value !== undefined) {
    console.log(`[Cache] HIT: ${key}`);
  } else {
    console.log(`[Cache] MISS: ${key}`);
  }
  return value;
}

/**
 * Set a value in cache
 * @param {string} key - The cache key
 * @param {any} value - The value to cache
 * @param {number} ttl - Time-to-live in seconds (optional, uses default if not provided)
 * @returns {boolean} - True if successful
 */
function set(key, value, ttl) {
  const success = cache.set(key, value, ttl);
  if (success) {
    console.log(`[Cache] SET: ${key} (TTL: ${ttl || TTL.DEFAULT}s)`);
  }
  return success;
}

/**
 * Delete a specific key from cache
 * @param {string} key - The cache key to delete
 * @returns {number} - Number of deleted entries
 */
function del(key) {
  const count = cache.del(key);
  console.log(`[Cache] DEL: ${key} (deleted: ${count})`);
  return count;
}

/**
 * Clear all cached data
 * Use with caution - clears everything!
 */
function flush() {
  cache.flushAll();
  console.log('[Cache] FLUSH: All cache cleared');
}

/**
 * Get cache statistics
 * @returns {object} - Stats including hits, misses, keys count
 */
function stats() {
  return cache.getStats();
}

/**
 * List all current cache keys
 * @returns {string[]} - Array of all keys currently in cache
 */
function listKeys() {
  return cache.keys();
}

/**
 * Get remaining TTL for a key
 * @param {string} key - The cache key
 * @returns {number} - Remaining TTL in seconds, or -1 if not found
 */
function getTtl(key) {
  const ttl = cache.getTtl(key);
  if (ttl === undefined) return -1;
  // getTtl returns timestamp, convert to remaining seconds
  return Math.round((ttl - Date.now()) / 1000);
}

// ============================================
// HELPER: Get or Fetch Pattern
// ============================================
// Common pattern: check cache first, fetch if missing, then cache result

/**
 * Get from cache or fetch using provided function
 * @param {string} key - The cache key
 * @param {function} fetchFn - Async function to call if cache miss
 * @param {number} ttl - TTL for cached result (optional)
 * @returns {Promise<any>} - Cached or freshly fetched value
 * 
 * Example:
 *   const data = await getOrFetch(
 *     keys.corners(teamId, seasonId),
 *     () => fetchCornersFromAPI(teamId, seasonId),
 *     TTL.CORNERS
 *   );
 */
async function getOrFetch(key, fetchFn, ttl = TTL.DEFAULT) {
  // Try cache first
  const cached = get(key);
  if (cached !== undefined) {
    return cached;
  }
  
  // Cache miss - fetch fresh data
  const freshData = await fetchFn();
  
  // Cache the result
  set(key, freshData, ttl);
  
  return freshData;
}

// ============================================
// EXPORTS
// ============================================

export {
  // Key builders
  keys,
  
  // TTL constants
  TTL,
  
  // Basic operations
  get,
  set,
  del,
  flush,
  
  // Utilities
  stats,
  listKeys,
  getTtl,
  
  // Helper patterns
  getOrFetch
};

// Default export for convenience
export default {
  keys,
  TTL,
  get,
  set,
  del,
  flush,
  stats,
  listKeys,
  getTtl,
  getOrFetch
};
