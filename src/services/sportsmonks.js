// ============================================
// SPORTSMONKS SERVICE
// ============================================
// This service handles all communication with the SportsMonks API.
// It provides clean functions for routes to call, abstracting away
// the API details (base URL, authentication, error handling).
//
// All public functions are wrapped with cache.getOrFetch() so
// repeated calls serve from memory instead of hitting the API.
//
// Every function accepts { skipCache } option. When true (authenticated
// users), the cache is bypassed and fresh data is fetched from the API.
// The fresh result is still cached so anonymous users benefit.
// ============================================

import cache from './cache.js';

// ============================================
// CONFIGURATION
// ============================================

// Base URL for SportsMonks Football API requests
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// Base URL for SportsMonks Odds API requests (bookmakers, markets)
const ODDS_BASE_URL = 'https://api.sportmonks.com/v3/odds';

// Get the API key from environment variables
const API_KEY = process.env.SPORTSMONKS_API_KEY;

// ============================================
// HELPER FUNCTION: Make API Requests
// ============================================
// This private helper handles the actual HTTP requests to SportsMonks.
// It automatically adds the API token and handles errors.

async function makeRequest(endpoint, includes = [], useOddsBaseUrl = false) {
  // Build the full URL
  // Use ODDS_BASE_URL for bookmakers/markets, BASE_URL for everything else
  const baseUrl = useOddsBaseUrl ? ODDS_BASE_URL : BASE_URL;
  let url = `${baseUrl}${endpoint}`;

  // Add the API token as a query parameter
  // Check if URL already has query params (contains ?)
  const separator = url.includes('?') ? '&' : '?';
  url += `${separator}api_token=${API_KEY}`;

  // Add includes if provided (e.g., statistics, players, etc.)
  // Includes enrich the response with related data
  if (includes.length > 0) {
    url += `&include=${includes.join(';')}`;
  }

  console.log(`[SportsMonks] Requesting: ${endpoint}`); // Log for debugging

  try {
    // Make the HTTP request using fetch (built into Node 18+)
    const response = await fetch(url);

    // Parse the JSON response
    const data = await response.json();

    // Check if SportsMonks returned an error
    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }

    // Return the data
    return data;

  } catch (error) {
    // Log the error and re-throw for the route to handle
    console.error(`[SportsMonks] Error: ${error.message}`);
    throw error;
  }
}

// ============================================
// HELPER FUNCTION: Make Paginated API Requests
// ============================================
// Fetches ALL pages of results from SportsMonks API.
// Use this for endpoints that may return many results (fixtures by date range).
// SportsMonks returns max 50 results per page.

async function makeRequestPaginated(endpoint, includes = [], useOddsBaseUrl = false) {
  const baseUrl = useOddsBaseUrl ? ODDS_BASE_URL : BASE_URL;
  let allData = [];
  let currentPage = 1;
  let hasMore = true;

  console.log(`[SportsMonks] Requesting (paginated): ${endpoint}`);

  while (hasMore) {
    // Build URL with pagination params
    let url = `${baseUrl}${endpoint}`;
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}api_token=${API_KEY}&per_page=50&page=${currentPage}`;

    if (includes.length > 0) {
      url += `&include=${includes.join(';')}`;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status}`);
      }

      // Add this page's data to our collection
      if (data.data && Array.isArray(data.data)) {
        allData = allData.concat(data.data);
      }

      // Check if there are more pages
      hasMore = data.pagination?.has_more === true;
      currentPage++;

      // Log progress for large requests
      if (hasMore) {
        console.log(`[SportsMonks] Fetched page ${currentPage - 1}, ${allData.length} items so far...`);
      }

    } catch (error) {
      console.error(`[SportsMonks] Error on page ${currentPage}: ${error.message}`);
      throw error;
    }
  }

  console.log(`[SportsMonks] Completed: ${allData.length} total items from ${currentPage - 1} page(s)`);

  // Return in the same format as makeRequest
  return { data: allData };
}

// ============================================
// TEAM FUNCTIONS
// ============================================

/**
 * Search for teams by name
 * @param {string} searchQuery - The team name to search for (e.g., "Fulham")
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - The API response with matching teams
 */
async function searchTeams(searchQuery, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamSearch(searchQuery),
    () => makeRequest(`/teams/search/${encodeURIComponent(searchQuery)}`, ['country', 'venue']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get a single team by ID with detailed information
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - The team details
 */
async function getTeamById(teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.team(teamId),
    () => makeRequest(`/teams/${teamId}`, ['country', 'venue', 'activeSeasons']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get head-to-head fixtures between two teams
 * @param {number|string} team1Id - First team's SportsMonks ID
 * @param {number|string} team2Id - Second team's SportsMonks ID
 * @param {object} options - Optional includes and cache control
 * @param {boolean} options.includeOdds - Include pre-match odds for each fixture
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @param {boolean} options.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All historical fixtures between these teams
 */
async function getHeadToHead(team1Id, team2Id, options = {}) {
  // Build cache key with option flags to avoid serving incomplete data
  let cacheKey = `h2h:${team1Id}:${team2Id}`;
  if (options.includeOdds) cacheKey += ':odds';
  if (options.includeSidelined) cacheKey += ':sidelined';

  return cache.getOrFetch(
    cacheKey,
    () => {
      const includes = ['participants', 'scores', 'venue', 'league', 'season'];
      if (options.includeOdds) includes.push('odds');
      if (options.includeSidelined) {
        includes.push('sidelined.player', 'sidelined.sideline', 'sidelined.type');
      }
      return makeRequest(`/fixtures/head-to-head/${team1Id}/${team2Id}`, includes);
    },
    cache.TTL.H2H,
    { skipCache: options.skipCache }
  );
}

// ============================================
// FIXTURE FUNCTIONS
// ============================================

/**
 * Get a single fixture by ID with full details
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {object} options - Optional includes and cache control
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @param {boolean} options.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - The fixture details with scores, lineups, stats, etc.
 */
async function getFixtureById(fixtureId, options = {}) {
  // Build cache key with option flags
  let cacheKey = cache.keys.fixture(fixtureId);
  if (options.includeOdds) cacheKey += ':odds';
  if (options.includeSidelined) cacheKey += ':sidelined';

  return cache.getOrFetch(
    cacheKey,
    () => {
      const includes = [
        'participants', 'scores', 'statistics', 'lineups', 'events',
        'venue', 'league', 'season', 'state', 'metadata', 'weatherReport'
      ];
      if (options.includeOdds) {
        includes.push('odds.bookmaker', 'odds.market');
      }
      if (options.includeSidelined) {
        includes.push('sidelined.player', 'sidelined.sideline', 'sidelined.type');
      }
      return makeRequest(`/fixtures/${fixtureId}`, includes);
    },
    cache.TTL.FIXTURE_DETAIL,
    { skipCache: options.skipCache }
  );
}

/**
 * Get all fixtures on a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {object} options - Optional includes and cache control
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @param {boolean} options.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All fixtures on that date
 */
async function getFixturesByDate(date, options = {}) {
  let cacheKey = cache.keys.fixturesByDate(date);
  if (options.includeOdds) cacheKey += ':odds';
  if (options.includeSidelined) cacheKey += ':sidelined';

  return cache.getOrFetch(
    cacheKey,
    () => {
      const includes = [
        'participants', 'scores', 'venue', 'league', 'season',
        'state', 'metadata', 'weatherReport'
      ];
      if (options.includeOdds) includes.push('odds');
      if (options.includeSidelined) {
        includes.push('sidelined.player', 'sidelined.sideline', 'sidelined.type');
      }
      return makeRequest(`/fixtures/date/${date}`, includes);
    },
    cache.TTL.FIXTURE_LIST,
    { skipCache: options.skipCache }
  );
}

/**
 * Get fixtures within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {object} options - Optional includes and cache control
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @param {boolean} options.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All fixtures in the date range
 */
async function getFixturesByDateRange(startDate, endDate, options = {}) {
  let cacheKey = cache.keys.fixturesByDateRange(startDate, endDate);
  if (options.includeOdds) cacheKey += ':odds';
  if (options.includeSidelined) cacheKey += ':sidelined';

  return cache.getOrFetch(
    cacheKey,
    () => {
      const includes = [
        'participants', 'scores', 'venue', 'league', 'season',
        'state', 'metadata', 'weatherReport'
      ];
      if (options.includeOdds) includes.push('odds');
      if (options.includeSidelined) {
        includes.push('sidelined.player', 'sidelined.sideline', 'sidelined.type');
      }
      return makeRequestPaginated(`/fixtures/between/${startDate}/${endDate}`, includes);
    },
    cache.TTL.FIXTURE_LIST,
    { skipCache: options.skipCache }
  );
}

/**
 * Get a specific team's fixtures within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} options - Optional includes and cache control
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @param {boolean} options.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - The team's fixtures in the date range
 */
async function getTeamFixturesByDateRange(startDate, endDate, teamId, options = {}) {
  let cacheKey = cache.keys.teamFixturesByDateRange(startDate, endDate, teamId);
  if (options.includeOdds) cacheKey += ':odds';
  if (options.includeSidelined) cacheKey += ':sidelined';

  return cache.getOrFetch(
    cacheKey,
    () => {
      const includes = [
        'participants', 'scores', 'venue', 'league', 'season',
        'state', 'metadata', 'weatherReport'
      ];
      if (options.includeOdds) includes.push('odds');
      if (options.includeSidelined) {
        includes.push('sidelined.player', 'sidelined.sideline', 'sidelined.type');
      }
      return makeRequestPaginated(`/fixtures/between/${startDate}/${endDate}/${teamId}`, includes);
    },
    cache.TTL.FIXTURE_LIST,
    { skipCache: options.skipCache }
  );
}

/**
 * Search for fixtures by team name
 * @param {string} searchQuery - The team name to search for
 * @param {object} options - Optional includes and cache control
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @param {boolean} options.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All fixtures matching the search query
 */
async function searchFixtures(searchQuery, options = {}) {
  let cacheKey = cache.keys.fixtureSearch(searchQuery);
  if (options.includeOdds) cacheKey += ':odds';
  if (options.includeSidelined) cacheKey += ':sidelined';

  return cache.getOrFetch(
    cacheKey,
    () => {
      const includes = [
        'participants', 'scores', 'venue', 'league', 'season',
        'state', 'metadata', 'weatherReport'
      ];
      if (options.includeOdds) includes.push('odds');
      if (options.includeSidelined) {
        includes.push('sidelined.player', 'sidelined.sideline', 'sidelined.type');
      }
      return makeRequest(`/fixtures/search/${encodeURIComponent(searchQuery)}`, includes);
    },
    cache.TTL.FIXTURE_LIST,
    { skipCache: options.skipCache }
  );
}

// ============================================
// PLAYER FUNCTIONS
// ============================================

/**
 * Search for players by name
 * @param {string} searchQuery - The player name to search for
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All players matching the search query
 */
async function searchPlayers(searchQuery, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.playerSearch(searchQuery),
    () => makeRequest(`/players/search/${encodeURIComponent(searchQuery)}`, ['teams', 'position', 'nationality']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get a single player by ID with detailed information
 * @param {number|string} playerId - The SportsMonks player ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - The player details with stats, team, etc.
 */
async function getPlayerById(playerId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.player(playerId),
    () => makeRequest(`/players/${playerId}`, ['teams', 'position', 'nationality', 'statistics']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

// ============================================
// ODDS FUNCTIONS
// ============================================

/**
 * Get all pre-match odds for a fixture
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All odds from all bookmakers/markets
 */
async function getOddsByFixture(fixtureId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.oddsByFixture(fixtureId),
    () => makeRequest(`/odds/pre-match/fixtures/${fixtureId}`),
    cache.TTL.ODDS,
    { skipCache }
  );
}

/**
 * Get pre-match odds for a fixture filtered by bookmaker
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {number|string} bookmakerId - The bookmaker ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Odds from the specified bookmaker only
 */
async function getOddsByFixtureAndBookmaker(fixtureId, bookmakerId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.oddsByFixtureAndBookmaker(fixtureId, bookmakerId),
    () => makeRequest(`/odds/pre-match/fixtures/${fixtureId}/bookmakers/${bookmakerId}`),
    cache.TTL.ODDS,
    { skipCache }
  );
}

/**
 * Get pre-match odds for a fixture filtered by market
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {number|string} marketId - The market ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Odds for the specified market only
 */
async function getOddsByFixtureAndMarket(fixtureId, marketId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.oddsByFixtureAndMarket(fixtureId, marketId),
    () => makeRequest(`/odds/pre-match/fixtures/${fixtureId}/markets/${marketId}`),
    cache.TTL.ODDS,
    { skipCache }
  );
}

// ============================================
// BOOKMAKER FUNCTIONS
// ============================================

/**
 * Get all available bookmakers
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - List of all bookmakers
 */
async function getAllBookmakers({ skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.allBookmakers(),
    () => makeRequest('/bookmakers', [], true),
    cache.TTL.REFERENCE,
    { skipCache }
  );
}

/**
 * Get a single bookmaker by ID
 * @param {number|string} bookmakerId - The bookmaker ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Bookmaker details
 */
async function getBookmakerById(bookmakerId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.bookmaker(bookmakerId),
    () => makeRequest(`/bookmakers/${bookmakerId}`, [], true),
    cache.TTL.REFERENCE,
    { skipCache }
  );
}

// ============================================
// MARKET FUNCTIONS
// ============================================

/**
 * Get all available betting markets
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - List of all markets
 */
async function getAllMarkets({ skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.allMarkets(),
    () => makeRequest('/markets', [], true),
    cache.TTL.REFERENCE,
    { skipCache }
  );
}

/**
 * Get a single market by ID
 * @param {number|string} marketId - The market ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Market details
 */
async function getMarketById(marketId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.market(marketId),
    () => makeRequest(`/markets/${marketId}`, [], true),
    cache.TTL.REFERENCE,
    { skipCache }
  );
}

/**
 * Search for markets by name
 * @param {string} searchQuery - The market name to search for
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Matching markets
 */
async function searchMarkets(searchQuery, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.marketSearch(searchQuery),
    () => makeRequest(`/markets/search/${encodeURIComponent(searchQuery)}`, [], true),
    cache.TTL.REFERENCE,
    { skipCache }
  );
}

// ============================================
// TEAM STATISTICS FUNCTIONS
// ============================================

/**
 * Get a team with full season statistics
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Team details with statistics
 */
async function getTeamWithStats(teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamWithStats(teamId),
    () => makeRequest(`/teams/${teamId}`, ['statistics.details', 'coaches', 'venue', 'activeSeasons', 'sidelined']),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

/**
 * Get team statistics filtered by a specific season
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Team details with statistics for that season only
 */
async function getTeamStatsBySeason(teamId, seasonId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamStatsBySeason(teamId, seasonId),
    () => makeRequest(`/teams/${teamId}?filters=teamStatisticSeasons:${seasonId}`, ['statistics.details']),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

/**
 * Get the current squad (roster) for a team
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Current squad with player details
 */
async function getTeamSquad(teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamSquad(teamId),
    () => makeRequest(`/squads/teams/${teamId}`, ['player']),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

/**
 * Get historical squad for a team in a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Squad for that season with player details
 */
async function getTeamSquadBySeason(seasonId, teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamSquadBySeason(seasonId, teamId),
    () => makeRequest(`/squads/seasons/${seasonId}/teams/${teamId}`, ['player', 'details']),
    cache.TTL.REFERENCE,
    { skipCache }
  );
}

/**
 * Get all transfers for a team
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Transfer history
 */
async function getTeamTransfers(teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamTransfers(teamId),
    () => makeRequest(`/transfers/teams/${teamId}`, ['player', 'fromTeam', 'toTeam']),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

/**
 * Get all seasons a team has participated in
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - List of seasons
 */
async function getTeamSeasons(teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamSeasons(teamId),
    () => makeRequest(`/seasons/teams/${teamId}`, ['league']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get the full schedule for a team
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Complete season schedule
 */
async function getTeamSchedule(teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamSchedule(teamId),
    () => makeRequest(`/schedules/teams/${teamId}`, ['participants', 'venue', 'league']),
    cache.TTL.FIXTURE_LIST,
    { skipCache }
  );
}

// ============================================
// COACH FUNCTIONS
// ============================================

/**
 * Get coach details by ID
 * @param {number|string} coachId - The SportsMonks coach ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Coach details
 */
async function getCoachById(coachId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.coach(coachId),
    () => makeRequest(`/coaches/${coachId}`, ['teams', 'nationality']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Search for coaches by name
 * @param {string} searchQuery - The coach name to search for
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Matching coaches
 */
async function searchCoaches(searchQuery, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.coachSearch(searchQuery),
    () => makeRequest(`/coaches/search/${encodeURIComponent(searchQuery)}`, ['teams', 'nationality']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

// ============================================
// STANDINGS FUNCTIONS
// ============================================

/**
 * Get league standings for a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - League table with team positions, points, form, etc.
 */
async function getStandingsBySeason(seasonId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.standingsBySeason(seasonId),
    () => makeRequest(`/standings/seasons/${seasonId}`, ['participant', 'form', 'details']),
    cache.TTL.STANDINGS,
    { skipCache }
  );
}

// ============================================
// LIVE SCORES FUNCTIONS
// ============================================

/**
 * Get all live matches (currently in play or about to start)
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All live fixtures with scores
 */
async function getLivescores({ skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.livescores(),
    () => makeRequest('/livescores', ['participants', 'scores', 'league', 'state']),
    cache.TTL.LIVESCORES,
    { skipCache }
  );
}

/**
 * Get only matches currently in play
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Fixtures that are actively being played
 */
async function getLivescoresInplay({ skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.livescoresInplay(),
    () => makeRequest('/livescores/inplay', ['participants', 'scores', 'league', 'state', 'events']),
    cache.TTL.LIVESCORES_INPLAY,
    { skipCache }
  );
}

// ============================================
// LEAGUES FUNCTIONS
// ============================================

/**
 * Get all leagues (filtered by our subscription)
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All available leagues
 */
async function getAllLeagues({ skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.allLeagues(),
    () => makeRequest('/leagues', ['country', 'currentSeason']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get a specific league by ID
 * @param {number|string} leagueId - The SportsMonks league ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - League details
 */
async function getLeagueById(leagueId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.league(leagueId),
    () => makeRequest(`/leagues/${leagueId}`, ['country', 'currentSeason', 'seasons']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Search leagues by name
 * @param {string} searchQuery - Search term
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Matching leagues
 */
async function searchLeagues(searchQuery, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.leagueSearch(searchQuery),
    () => makeRequest(`/leagues/search/${encodeURIComponent(searchQuery)}`, ['country']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

// ============================================
// SEASONS FUNCTIONS
// ============================================

/**
 * Get all seasons (from our subscribed leagues)
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All available seasons
 */
async function getAllSeasons({ skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.allSeasons(),
    () => makeRequest('/seasons', ['league']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get a specific season by ID
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Season details with league info
 */
async function getSeasonById(seasonId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.season(seasonId),
    () => makeRequest(`/seasons/${seasonId}`, ['league', 'stages']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

/**
 * Get seasons for a specific league
 * @param {number|string} leagueId - The SportsMonks league ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - All seasons for this league
 */
async function getSeasonsByLeague(leagueId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.seasonsByLeague(leagueId),
    () => makeRequest(`/leagues/${leagueId}`, ['seasons']),
    cache.TTL.LEAGUE,
    { skipCache }
  );
}

// ============================================
// TOP SCORERS FUNCTIONS
// ============================================

/**
 * Get top scorers for a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Top scorers with player and team info
 */
async function getTopScorersBySeason(seasonId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.topScorersBySeason(seasonId),
    () => makeRequest(`/topscorers/seasons/${seasonId}`, ['player', 'participant']),
    cache.TTL.STANDINGS,
    { skipCache }
  );
}

// ============================================
// TEAM TOP SCORERS/ASSISTS FUNCTIONS
// ============================================

/**
 * Get a team's squad with player statistics for a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Squad with player statistics
 */
async function getTeamSquadWithStats(seasonId, teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamSquadWithStats(seasonId, teamId),
    () => makeRequest(
      `/squads/seasons/${seasonId}/teams/${teamId}?filters=playerStatisticSeasons:${seasonId}`,
      ['player', 'player.statistics.details']
    ),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

// ============================================
// PREDICTIONS FUNCTIONS
// ============================================

/**
 * Get AI predictions for a specific fixture
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Predictions with probability percentages
 */
async function getFixturePredictions(fixtureId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.fixturePredictions(fixtureId),
    () => makeRequest(`/fixtures/${fixtureId}`, ['predictions']),
    cache.TTL.PREDICTIONS,
    { skipCache }
  );
}

/**
 * Get the performance/accuracy of SportsMonks prediction model for a league
 * @param {number|string} leagueId - The SportsMonks league ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Prediction model performance stats
 */
async function getPredictabilityByLeague(leagueId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.predictabilityByLeague(leagueId),
    () => makeRequest(`/predictions/predictability/leagues/${leagueId}`),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

// ============================================
// STAGES / SCHEDULE FUNCTIONS (Cup Competitions)
// ============================================

/**
 * Get all stages for a season with their fixtures
 * Ideal for cup competitions (FA Cup, Carabao Cup) to show fixtures by stage/round
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Stages with fixtures for the season
 */
async function getStagesBySeason(seasonId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.stagesBySeason(seasonId),
    () => makeRequest(`/stages/seasons/${seasonId}`, [
      'fixtures.participants', 'fixtures.scores', 'fixtures.venue', 'fixtures.state'
    ]),
    cache.TTL.FIXTURE_LIST,
    { skipCache }
  );
}

// ============================================
// TEAM FIXTURES WITH STATISTICS
// ============================================

/**
 * Get a team's fixtures within a date range WITH match statistics
 * Used for calculating corner averages, shots, etc. from historical data
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} opts - Options
 * @param {boolean} opts.skipCache - Bypass cache (for authenticated users)
 * @returns {Promise<object>} - Fixtures with full statistics
 */
async function getTeamFixturesWithStats(startDate, endDate, teamId, { skipCache } = {}) {
  return cache.getOrFetch(
    cache.keys.teamFixturesWithStats(startDate, endDate, teamId),
    () => makeRequestPaginated(
      `/fixtures/between/${startDate}/${endDate}/${teamId}`,
      ['statistics', 'participants', 'state', 'scores']
    ),
    cache.TTL.SEMI_STATIC,
    { skipCache }
  );
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

export {
  // Team functions
  searchTeams,
  getTeamById,
  getHeadToHead,

  // Fixture functions
  getFixtureById,
  getFixturesByDate,
  getFixturesByDateRange,
  getTeamFixturesByDateRange,
  searchFixtures,

  // Player functions
  searchPlayers,
  getPlayerById,

  // Odds functions
  getOddsByFixture,
  getOddsByFixtureAndBookmaker,
  getOddsByFixtureAndMarket,

  // Bookmaker functions
  getAllBookmakers,
  getBookmakerById,

  // Market functions
  getAllMarkets,
  getMarketById,
  searchMarkets,

  // Team Statistics functions
  getTeamWithStats,
  getTeamStatsBySeason,
  getTeamSquad,
  getTeamSquadBySeason,
  getTeamTransfers,
  getTeamSeasons,
  getTeamSchedule,

  // Coach functions
  getCoachById,
  searchCoaches,

  // Standings functions
  getStandingsBySeason,

  // Live scores functions
  getLivescores,
  getLivescoresInplay,

  // Leagues functions
  getAllLeagues,
  getLeagueById,
  searchLeagues,

  // Seasons functions
  getAllSeasons,
  getSeasonById,
  getSeasonsByLeague,

  // Top scorers functions
  getTopScorersBySeason,

  // Team top scorers/assists functions
  getTeamSquadWithStats,

  // Predictions functions
  getFixturePredictions,
  getPredictabilityByLeague,

  // Stages / Schedule functions (for cup competitions)
  getStagesBySeason,

  // Team fixtures with statistics (for corner calculations)
  getTeamFixturesWithStats
};
