// ============================================
// CACHE SERVICE
// ============================================
// In-memory caching using node-cache to reduce SportsMonks API calls.
// Provides TTL tiers based on data volatility, key builders for
// all cacheable entities, and a getOrFetch helper pattern.
//
// Cache Keys use colon-delimited format: "type:id1:id2"
// ============================================

import NodeCache from 'node-cache';

// ============================================
// TTL TIERS (in seconds)
// ============================================
// Organized by data volatility - static data cached longer, live data shorter

const TTL = {
  // Reference data that almost never changes
  REFERENCE: 7 * 24 * 60 * 60,      // 7 days - bookmakers, markets, historical squads

  // League/team/player data - changes infrequently
  LEAGUE: 24 * 60 * 60,             // 24 hours - leagues, teams, players, coaches, seasons

  // Data that changes occasionally (roster moves, stats accumulation)
  SEMI_STATIC: 6 * 60 * 60,         // 6 hours - team stats, current squads, transfers, prediction accuracy

  // Standings change after each matchday
  STANDINGS: 2 * 60 * 60,           // 2 hours - standings, top scorers

  // Fixture lists change less frequently than individual fixtures
  FIXTURE_LIST: 30 * 60,            // 30 minutes - fixtures by date, schedules, search results

  // Individual fixture detail (lineups, events update during match)
  FIXTURE_DETAIL: 15 * 60,          // 15 minutes - single fixture detail

  // Predictions available before match, don't change much
  PREDICTIONS: 30 * 60,             // 30 minutes - fixture predictions

  // H2H is historical data, changes slowly
  H2H: 30 * 60,                     // 30 minutes - head-to-head

  // Odds shift frequently as bookmakers adjust lines
  ODDS: 10 * 60,                    // 10 minutes - all odds endpoints

  // Live data needs very short TTLs
  LIVESCORES: 30,                   // 30 seconds - live scores
  LIVESCORES_INPLAY: 15,            // 15 seconds - in-play scores

  // Fallback
  DEFAULT: 6 * 60 * 60              // 6 hours
};

// ============================================
// CREATE CACHE INSTANCE
// ============================================

const cache = new NodeCache({
  stdTTL: TTL.DEFAULT,
  checkperiod: 120,   // Check for expired keys every 2 minutes
  useClones: false     // Better performance - we won't mutate cached objects
});

// ============================================
// CACHE KEY BUILDERS
// ============================================
// Consistent key format: "type:id1:id2:..."
// Every cacheable entity has a dedicated key builder

const keys = {
  // --- Teams ---
  teamSearch: (query) => `teamSearch:${query.toLowerCase()}`,
  team: (teamId) => `team:${teamId}`,
  teamWithStats: (teamId) => `teamStats:${teamId}`,
  teamStatsBySeason: (teamId, seasonId) => `teamStatsSeason:${teamId}:${seasonId}`,
  teamSquad: (teamId) => `teamSquad:${teamId}`,
  teamSquadBySeason: (seasonId, teamId) => `teamSquadSeason:${seasonId}:${teamId}`,
  teamSquadWithStats: (seasonId, teamId) => `teamSquadStats:${seasonId}:${teamId}`,
  teamTransfers: (teamId) => `teamTransfers:${teamId}`,
  teamSeasons: (teamId) => `teamSeasons:${teamId}`,
  teamSchedule: (teamId) => `teamSchedule:${teamId}`,

  // --- Fixtures ---
  fixture: (fixtureId) => `fixture:${fixtureId}`,
  fixturesByDate: (date) => `fixturesByDate:${date}`,
  fixturesByDateRange: (start, end) => `fixturesRange:${start}:${end}`,
  teamFixturesByDateRange: (start, end, teamId) => `teamFixturesRange:${start}:${end}:${teamId}`,
  teamFixturesWithStats: (start, end, teamId) => `teamFixturesStats:${start}:${end}:${teamId}`,
  fixtureSearch: (query) => `fixtureSearch:${query.toLowerCase()}`,

  // --- Players ---
  playerSearch: (query) => `playerSearch:${query.toLowerCase()}`,
  player: (playerId) => `player:${playerId}`,

  // --- Odds ---
  oddsByFixture: (fixtureId) => `odds:${fixtureId}`,
  oddsByFixtureAndBookmaker: (fixtureId, bookmakerId) => `odds:${fixtureId}:bk:${bookmakerId}`,
  oddsByFixtureAndMarket: (fixtureId, marketId) => `odds:${fixtureId}:mk:${marketId}`,

  // --- Bookmakers ---
  allBookmakers: () => 'bookmakers:all',
  bookmaker: (bookmakerId) => `bookmaker:${bookmakerId}`,

  // --- Markets ---
  allMarkets: () => 'markets:all',
  market: (marketId) => `market:${marketId}`,
  marketSearch: (query) => `marketSearch:${query.toLowerCase()}`,

  // --- Coaches ---
  coach: (coachId) => `coach:${coachId}`,
  coachSearch: (query) => `coachSearch:${query.toLowerCase()}`,

  // --- Standings ---
  standingsBySeason: (seasonId) => `standings:${seasonId}`,

  // --- Live Scores ---
  livescores: () => 'livescores',
  livescoresInplay: () => 'livescoresInplay',

  // --- Leagues ---
  allLeagues: () => 'leagues:all',
  league: (leagueId) => `league:${leagueId}`,
  leagueSearch: (query) => `leagueSearch:${query.toLowerCase()}`,

  // --- Seasons ---
  allSeasons: () => 'seasons:all',
  season: (seasonId) => `season:${seasonId}`,
  seasonsByLeague: (leagueId) => `seasonsByLeague:${leagueId}`,

  // --- Top Scorers ---
  topScorersBySeason: (seasonId) => `topScorers:${seasonId}`,

  // --- Predictions ---
  fixturePredictions: (fixtureId) => `predictions:${fixtureId}`,
  predictabilityByLeague: (leagueId) => `predictability:${leagueId}`,

  // --- Stages ---
  stagesBySeason: (seasonId) => `stages:${seasonId}`,

  // --- Legacy (kept for backwards compatibility) ---
  corners: (teamId, seasonId) => `corners:${teamId}:${seasonId}`
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

/**
 * Flush all cache keys matching a prefix
 * Useful for targeted clearing (e.g., flush all odds for a fixture)
 *
 * @param {string} prefix - The key prefix to match (e.g., "odds:", "team:19")
 * @returns {number} - Number of deleted entries
 */
function flushByPrefix(prefix) {
  const allKeys = cache.keys();
  const matchingKeys = allKeys.filter(key => key.startsWith(prefix));

  if (matchingKeys.length === 0) {
    console.log(`[Cache] FLUSH PREFIX: "${prefix}" - no matching keys`);
    return 0;
  }

  const count = cache.del(matchingKeys);
  console.log(`[Cache] FLUSH PREFIX: "${prefix}" - deleted ${count} keys`);
  return count;
}

/**
 * Get detailed cache stats grouped by key category
 * @returns {object} - Stats with hit rate and key counts by category
 */
function detailedStats() {
  const baseStats = cache.getStats();
  const allKeys = cache.keys();

  // Group keys by their prefix (everything before the first colon)
  const keysByCategory = {};
  for (const key of allKeys) {
    const category = key.split(':')[0];
    if (!keysByCategory[category]) {
      keysByCategory[category] = 0;
    }
    keysByCategory[category]++;
  }

  // Calculate hit rate
  const totalRequests = baseStats.hits + baseStats.misses;
  const hitRate = totalRequests > 0
    ? Math.round((baseStats.hits / totalRequests) * 10000) / 100
    : 0;

  return {
    hits: baseStats.hits,
    misses: baseStats.misses,
    totalRequests,
    hitRate: `${hitRate}%`,
    totalKeys: allKeys.length,
    keysByCategory
  };
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
 * @param {object} options - Additional options
 * @param {boolean} options.skipCache - If true, always fetch fresh (for authenticated users)
 * @returns {Promise<any>} - Cached or freshly fetched value
 */
async function getOrFetch(key, fetchFn, ttl = TTL.DEFAULT, options = {}) {
  // Authenticated users bypass cache entirely - always get fresh data
  if (options.skipCache) {
    console.log(`[Cache] SKIP: ${key} (authenticated user)`);
    const freshData = await fetchFn();
    // Still cache the result so anonymous users benefit
    set(key, freshData, ttl);
    return freshData;
  }

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
  flushByPrefix,
  detailedStats,

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
  flushByPrefix,
  detailedStats,
  getOrFetch
};
