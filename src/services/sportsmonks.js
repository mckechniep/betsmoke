// ============================================
// SPORTSMONKS SERVICE
// ============================================
// This service handles all communication with the SportsMonks API.
// It provides clean functions for routes to call, abstracting away
// the API details (base URL, authentication, error handling).
// ============================================

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
// PUBLIC FUNCTIONS
// ============================================
// These are the functions that routes will call.
// Each function handles one specific API operation.

/**
 * Search for teams by name
 * @param {string} searchQuery - The team name to search for (e.g., "Fulham")
 * @returns {Promise<object>} - The API response with matching teams
 * 
 * Example: searchTeams("Fulham") 
 * Returns: { data: [{ id: 52, name: "Fulham FC", ... }] }
 */
async function searchTeams(searchQuery) {
  // The endpoint for team search
  // API: GET /teams/search/{search_query}
  const endpoint = `/teams/search/${encodeURIComponent(searchQuery)}`;
  
  // Make the request with some useful includes
  // - country: Which country the team is from
  // - venue: The team's home stadium
  return makeRequest(endpoint, ['country', 'venue']);
}

/**
 * Get a single team by ID with detailed information
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - The team details
 * 
 * Example: getTeamById(52)
 * Returns: { data: { id: 52, name: "Fulham FC", statistics: [...], ... } }
 */
async function getTeamById(teamId) {
  // The endpoint for getting a single team
  // API: GET /teams/{team_id}
  const endpoint = `/teams/${teamId}`;
  
  // Include useful related data
  // - country: Team's country
  // - venue: Home stadium
  // - activeSeasons: Current seasons they're playing in
  return makeRequest(endpoint, ['country', 'venue', 'activeSeasons']);
}

/**
 * Get head-to-head fixtures between two teams
 * @param {number|string} team1Id - First team's SportsMonks ID
 * @param {number|string} team2Id - Second team's SportsMonks ID
 * @returns {Promise<object>} - All historical fixtures between these teams
 * 
 * Example: getHeadToHead(11, 1) // Fulham vs Man City
 * Returns: { data: [{ id: 12345, name: "Fulham vs Manchester City", ... }] }
 */
/**
 * Get head-to-head fixtures between two teams
 * @param {number|string} team1Id - First team's SportsMonks ID
 * @param {number|string} team2Id - Second team's SportsMonks ID
 * @param {object} options - Optional includes
 * @param {boolean} options.includeOdds - Include pre-match odds for each fixture
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @returns {Promise<object>} - All historical fixtures between these teams
 * 
 * Example: getHeadToHead(11, 1, { includeOdds: true }) // Fulham vs Man City with odds
 * Returns: { data: [{ id: 12345, name: "Fulham vs Manchester City", odds: [...], ... }] }
 */
async function getHeadToHead(team1Id, team2Id, options = {}) {
  // The endpoint for head-to-head fixtures
  // API: GET /fixtures/head-to-head/{team1_id}/{team2_id}
  const endpoint = `/fixtures/head-to-head/${team1Id}/${team2Id}`;
  
  // Base includes
  const includes = [
    'participants',
    'scores',
    'venue',
    'league',
    'season'
  ];
  
  // Optional includes
  if (options.includeOdds) {
    includes.push('odds');
  }
  if (options.includeSidelined) {
    // Include full sidelined data with player info, sideline details, and type
    includes.push('sidelined.player');
    includes.push('sidelined.sideline');
    includes.push('sidelined.type');
  }

  return makeRequest(endpoint, includes);
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
// We export each function individually so routes can import only what they need.
// Example: import { searchTeams } from '../services/sportsmonks.js'

// ============================================
// FIXTURE FUNCTIONS
// ============================================

/**
 * Get a single fixture by ID with full details
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @returns {Promise<object>} - The fixture details with scores, lineups, stats, etc.
 * 
 * Example: getFixtureById(18535517)
 * Returns: { data: { id: 18535517, name: "Celtic vs Rangers", scores: [...], ... } }
 */
/**
 * Get a single fixture by ID with full details
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {object} options - Optional includes
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @returns {Promise<object>} - The fixture details with scores, lineups, stats, etc.
 * 
 * Example: getFixtureById(18535517, { includeOdds: true })
 * Returns: { data: { id: 18535517, name: "Celtic vs Rangers", scores: [...], odds: [...], ... } }
 */
async function getFixtureById(fixtureId, options = {}) {
  // API: GET /fixtures/{fixture_id}
  const endpoint = `/fixtures/${fixtureId}`;
  
  // Base includes - always included
  // - participants: Teams playing
  // - scores: Match scores
  // - statistics: Team match stats (use types service to look up type names)
  // - lineups: Starting XI and bench
  // - events: Goals, cards, subs
  // - venue: Stadium info
  // - league: League info
  // - season: Season info
  // - state: Match state (scheduled, live, finished)
  // - metadata: Formations, kit colors, attendance, etc.
  // - weatherReport: Weather conditions (separate from metadata)
  // NOTE: We no longer include .type - types are stored locally per SportsMonks best practice
  const includes = [
    'participants',
    'scores',
    'statistics',  // Type names looked up from local database
    'lineups',
    'events',
    'venue',
    'league',
    'season',
    'state',
    'metadata',      // Formations, kit colors, attendance, etc.
    'weatherReport'  // Weather conditions (available ~24-48hrs before kickoff)
  ];
  
  // Optional includes - added if requested
  if (options.includeOdds) {
    // Include odds WITH bookmaker AND market names embedded in each odd object
    // This way we don't need separate API calls to get bookmaker/market names
    // - odds.bookmaker: Gives us bookmaker name (e.g., "Betfair", "Unibet")
    // - odds.market: Gives us market name (e.g., "Fulltime Result", "Over/Under")
    includes.push('odds.bookmaker');
    includes.push('odds.market');
  }
  if (options.includeSidelined) {
    // Include player info, sideline details, and type info
    // - sidelined.player: Player name, image, position
    // - sidelined.sideline: Start/end dates, games missed, category
    // - sidelined.type: Specific injury/suspension type (e.g., "Red Card Suspension", "Hamstring Injury")
    includes.push('sidelined.player');
    includes.push('sidelined.sideline');
    includes.push('sidelined.type');
  }
  
  return makeRequest(endpoint, includes);
}

/**
 * Get all fixtures on a specific date
 * @param {string} date - Date in YYYY-MM-DD format (e.g., "2024-12-25")
 * @returns {Promise<object>} - All fixtures on that date
 * 
 * Example: getFixturesByDate("2024-12-25")
 * Returns: { data: [{ id: 12345, name: "Team A vs Team B", ... }, ...] }
 */
/**
 * Get all fixtures on a specific date
 * @param {string} date - Date in YYYY-MM-DD format (e.g., "2024-12-25")
 * @param {object} options - Optional includes
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @returns {Promise<object>} - All fixtures on that date
 * 
 * Example: getFixturesByDate("2024-12-25", { includeOdds: true })
 */
async function getFixturesByDate(date, options = {}) {
  // API: GET /fixtures/date/{YYYY-MM-DD}
  const endpoint = `/fixtures/date/${date}`;
  
  // Base includes
  // - participants: Team names and logos
  // - scores: Match scores (including penalties if applicable)
  // - venue: Stadium info
  // - league: League name
  // - season: Season info
  // - state: Match state (scheduled, live, finished, AET, FT_PEN, etc.)
  // - metadata: Formations, kit colors, attendance, etc.
  // - weatherReport: Weather conditions (available ~24-48hrs before kickoff)
  const includes = [
    'participants',
    'scores',
    'venue',
    'league',
    'season',
    'state',
    'metadata',      // Formations, kit colors, attendance, etc.
    'weatherReport'  // Weather conditions
  ];
  
  // Optional includes
  if (options.includeOdds) {
    includes.push('odds');
  }
  if (options.includeSidelined) {
    // Include full sidelined data with player info, sideline details, and type
    includes.push('sidelined.player');
    includes.push('sidelined.sideline');
    includes.push('sidelined.type');
  }

  return makeRequest(endpoint, includes);
}

/**
 * Get fixtures within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<object>} - All fixtures in the date range
 * 
 * NOTE: Maximum date range is 100 days (SportsMonks limit)
 * 
 * Example: getFixturesByDateRange("2024-01-01", "2024-01-31")
 * Returns: { data: [{ id: 12345, name: "Team A vs Team B", ... }, ...] }
 */
/**
 * Get fixtures within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {object} options - Optional includes
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @returns {Promise<object>} - All fixtures in the date range
 * 
 * NOTE: Maximum date range is 100 days (SportsMonks limit)
 */
async function getFixturesByDateRange(startDate, endDate, options = {}) {
  // API: GET /fixtures/between/{start_date}/{end_date}
  const endpoint = `/fixtures/between/${startDate}/${endDate}`;

  // Base includes
  // - participants: Team names and logos
  // - scores: Match scores
  // - venue: Stadium info
  // - league: League name
  // - season: Season info
  // - state: Match state (scheduled, live, finished, etc.)
  // - metadata: Formations, kit colors, attendance, etc.
  // - weatherReport: Weather conditions (available ~24-48hrs before kickoff)
  const includes = [
    'participants',
    'scores',
    'venue',
    'league',
    'season',
    'state',
    'metadata',      // Formations, kit colors, attendance, etc.
    'weatherReport'  // Weather conditions
  ];

  // Optional includes
  if (options.includeOdds) {
    includes.push('odds');
  }
  if (options.includeSidelined) {
    // Include full sidelined data with player info, sideline details, and type
    includes.push('sidelined.player');
    includes.push('sidelined.sideline');
    includes.push('sidelined.type');
  }

  // Use paginated request to fetch ALL fixtures across multiple pages
  return makeRequestPaginated(endpoint, includes);
}

/**
 * Get a specific team's fixtures within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - The team's fixtures in the date range
 * 
 * NOTE: Maximum date range is 100 days (SportsMonks limit)
 * 
 * Example: getTeamFixturesByDateRange("2024-01-01", "2024-01-31", 11) // Fulham
 * Returns: { data: [{ id: 12345, name: "Fulham vs Arsenal", ... }, ...] }
 */
/**
 * Get a specific team's fixtures within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {object} options - Optional includes
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @returns {Promise<object>} - The team's fixtures in the date range
 * 
 * NOTE: Maximum date range is 100 days (SportsMonks limit)
 */
async function getTeamFixturesByDateRange(startDate, endDate, teamId, options = {}) {
  // API: GET /fixtures/between/{start_date}/{end_date}/{team_id}
  const endpoint = `/fixtures/between/${startDate}/${endDate}/${teamId}`;

  // Base includes
  // NOTE: 'state' is required for calculating recent form (W/D/L)
  // The frontend filters by state.state === 'FT' for finished matches
  const includes = [
    'participants',
    'scores',
    'venue',
    'league',
    'season',
    'state',
    'metadata',      // Formations, kit colors, attendance, etc.
    'weatherReport'  // Weather conditions
  ];

  // Optional includes
  if (options.includeOdds) {
    includes.push('odds');
  }
  if (options.includeSidelined) {
    // Include full sidelined data with player info, sideline details, and type
    includes.push('sidelined.player');
    includes.push('sidelined.sideline');
    includes.push('sidelined.type');
  }

  // Use paginated request for large date ranges (e.g., full seasons)
  return makeRequestPaginated(endpoint, includes);
}

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
// We export each function individually so routes can import only what they need.
// Example: import { searchTeams } from '../services/sportsmonks.js'

/**
 * Search for fixtures by team name
 * @param {string} searchQuery - The team name to search for (e.g., "Rangers")
 * @returns {Promise<object>} - All fixtures matching the search query
 * 
 * Example: searchFixtures("Rangers")
 * Returns: { data: [{ id: 12345, name: "Rangers vs Celtic", ... }, ...] }
 */
/**
 * Search for fixtures by team name
 * @param {string} searchQuery - The team name to search for (e.g., "Rangers")
 * @param {object} options - Optional includes
 * @param {boolean} options.includeOdds - Include pre-match odds
 * @param {boolean} options.includeSidelined - Include injured/suspended players
 * @returns {Promise<object>} - All fixtures matching the search query
 */
async function searchFixtures(searchQuery, options = {}) {
  // API: GET /fixtures/search/{search_query}
  const endpoint = `/fixtures/search/${encodeURIComponent(searchQuery)}`;
  
  // Base includes
  const includes = [
    'participants',
    'scores',
    'venue',
    'league',
    'season',
    'state',
    'metadata',      // Formations, kit colors, attendance, etc.
    'weatherReport'  // Weather conditions
  ];
  
  // Optional includes
  if (options.includeOdds) {
    includes.push('odds');
  }
  if (options.includeSidelined) {
    // Include full sidelined data with player info, sideline details, and type
    includes.push('sidelined.player');
    includes.push('sidelined.sideline');
    includes.push('sidelined.type');
  }

  return makeRequest(endpoint, includes);
}

// ============================================
// PLAYER FUNCTIONS
// ============================================

/**
 * Search for players by name
 * @param {string} searchQuery - The player name to search for (e.g., "Salah")
 * @returns {Promise<object>} - All players matching the search query
 * 
 * Example: searchPlayers("Salah")
 * Returns: { data: [{ id: 12345, name: "Mohamed Salah", ... }, ...] }
 */
async function searchPlayers(searchQuery) {
  // API: GET /players/search/{search_query}
  const endpoint = `/players/search/${encodeURIComponent(searchQuery)}`;
  
  // Include useful related data
  // - teams: Current and past teams the player has played for
  // - position: Player's position (e.g., Forward, Midfielder)
  // - nationality: Player's country
  return makeRequest(endpoint, ['teams', 'position', 'nationality']);
}

/**
 * Get a single player by ID with detailed information
 * @param {number|string} playerId - The SportsMonks player ID
 * @returns {Promise<object>} - The player details with stats, team, etc.
 * 
 * Example: getPlayerById(12345)
 * Returns: { data: { id: 12345, name: "Mohamed Salah", statistics: [...], ... } }
 */
async function getPlayerById(playerId) {
  // API: GET /players/{player_id}
  const endpoint = `/players/${playerId}`;
  
  // Include detailed player data
  // - teams: Current and past teams
  // - position: Playing position
  // - nationality: Country
  // - statistics: Season statistics (goals, assists, etc.)
  return makeRequest(endpoint, [
    'teams',
    'position',
    'nationality',
    'statistics'
  ]);
}

// ============================================
// ODDS FUNCTIONS
// ============================================

/**
 * Get all pre-match odds for a fixture
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @returns {Promise<object>} - All odds from all bookmakers/markets for this fixture
 * 
 * Example: getOddsByFixture(18535517)
 * Returns: { data: [{ id: 123, market_id: 1, bookmaker_id: 2, value: "1.95", ... }, ...] }
 */
async function getOddsByFixture(fixtureId) {
  // API: GET /odds/pre-match/fixtures/{fixture_id}
  const endpoint = `/odds/pre-match/fixtures/${fixtureId}`;
  return makeRequest(endpoint);
}

/**
 * Get pre-match odds for a fixture filtered by bookmaker
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {number|string} bookmakerId - The bookmaker ID (e.g., 2 = bet365)
 * @returns {Promise<object>} - Odds from the specified bookmaker only
 * 
 * Example: getOddsByFixtureAndBookmaker(18535517, 2) // bet365 odds
 */
async function getOddsByFixtureAndBookmaker(fixtureId, bookmakerId) {
  // API: GET /odds/pre-match/fixtures/{fixture_id}/bookmakers/{bookmaker_id}
  const endpoint = `/odds/pre-match/fixtures/${fixtureId}/bookmakers/${bookmakerId}`;
  return makeRequest(endpoint);
}

/**
 * Get pre-match odds for a fixture filtered by market
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @param {number|string} marketId - The market ID (e.g., 1 = Fulltime Result, 14 = BTTS)
 * @returns {Promise<object>} - Odds for the specified market only
 * 
 * Common market IDs:
 * - 1: Fulltime Result (1X2)
 * - 14: Both Teams To Score (BTTS)
 * - 18: Home Team Exact Goals
 * - 19: Away Team Exact Goals
 * - 44: Odd/Even
 * 
 * Example: getOddsByFixtureAndMarket(18535517, 1) // Fulltime Result odds
 */
async function getOddsByFixtureAndMarket(fixtureId, marketId) {
  // API: GET /odds/pre-match/fixtures/{fixture_id}/markets/{market_id}
  const endpoint = `/odds/pre-match/fixtures/${fixtureId}/markets/${marketId}`;
  return makeRequest(endpoint);
}

// ============================================
// BOOKMAKER FUNCTIONS
// ============================================

/**
 * Get all available bookmakers
 * @returns {Promise<object>} - List of all bookmakers (bet365, Betfair, etc.)
 * 
 * Example: getAllBookmakers()
 * Returns: { data: [{ id: 2, name: "bet365", ... }, ...] }
 */
async function getAllBookmakers() {
  // API: GET /bookmakers (uses ODDS base URL)
  const endpoint = `/bookmakers`;
  return makeRequest(endpoint, [], true); // true = use ODDS_BASE_URL
}

/**
 * Get a single bookmaker by ID
 * @param {number|string} bookmakerId - The bookmaker ID
 * @returns {Promise<object>} - Bookmaker details
 * 
 * Example: getBookmakerById(2) // bet365
 */
async function getBookmakerById(bookmakerId) {
  // API: GET /bookmakers/{id} (uses ODDS base URL)
  const endpoint = `/bookmakers/${bookmakerId}`;
  return makeRequest(endpoint, [], true);
}

// ============================================
// MARKET FUNCTIONS
// ============================================

/**
 * Get all available betting markets
 * @returns {Promise<object>} - List of all markets (Fulltime Result, BTTS, etc.)
 * 
 * Example: getAllMarkets()
 * Returns: { data: [{ id: 1, name: "Fulltime Result", ... }, ...] }
 */
async function getAllMarkets() {
  // API: GET /markets (uses ODDS base URL)
  const endpoint = `/markets`;
  return makeRequest(endpoint, [], true);
}

/**
 * Get a single market by ID
 * @param {number|string} marketId - The market ID
 * @returns {Promise<object>} - Market details
 * 
 * Example: getMarketById(1) // Fulltime Result
 */
async function getMarketById(marketId) {
  // API: GET /markets/{id} (uses ODDS base URL)
  const endpoint = `/markets/${marketId}`;
  return makeRequest(endpoint, [], true);
}

/**
 * Search for markets by name
 * @param {string} searchQuery - The market name to search for
 * @returns {Promise<object>} - Matching markets
 * 
 * Example: searchMarkets("goals")
 * Returns: { data: [{ id: 18, name: "Home Team Exact Goals", ... }, ...] }
 */
async function searchMarkets(searchQuery) {
  // API: GET /markets/search/{query} (uses ODDS base URL)
  const endpoint = `/markets/search/${encodeURIComponent(searchQuery)}`;
  return makeRequest(endpoint, [], true);
}

// ============================================
// TEAM STATISTICS FUNCTIONS
// ============================================

/**
 * Get a team with full season statistics
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Team details with statistics
 * 
 * Statistics include: wins, losses, draws, goals, clean sheets,
 * cards, corners, possession, scoring minutes, and much more.
 * 
 * Example: getTeamWithStats(62) // Rangers
 */
async function getTeamWithStats(teamId) {
  // API: GET /teams/{team_id}
  const endpoint = `/teams/${teamId}`;
  
  // Include comprehensive statistics
  // Valid includes for teams: sport, country, venue, coaches, rivals, players,
  // latest, upcoming, seasons, activeSeasons, sidelined, sidelinedHistory,
  // statistics, trophies, socials, rankings
  //
  // - statistics.details: Detailed season stats (goals, wins, etc.)
  // - coaches: Current head coach(es)
  // - venue: Home stadium
  // - activeSeasons: Current seasons the team is in
  // - sidelined: Injured/suspended players
  return makeRequest(endpoint, [
    'statistics.details',
    'coaches',
    'venue',
    'activeSeasons',
    'sidelined'
  ]);
}

/**
 * Get team statistics filtered by a specific season
 * @param {number|string} teamId - The SportsMonks team ID
 * @param {number|string} seasonId - The SportsMonks season ID to filter by
 * @returns {Promise<object>} - Team details with statistics for that season only
 * 
 * This is useful for viewing historical statistics or comparing seasons.
 * 
 * Example: getTeamStatsBySeason(62, 19735) // Rangers 2022/2023 stats
 */
async function getTeamStatsBySeason(teamId, seasonId) {
  // API: GET /teams/{team_id}?filters=teamStatisticSeasons:{season_id}
  // The filter ensures we only get stats for the specified season
  const endpoint = `/teams/${teamId}?filters=teamStatisticSeasons:${seasonId}`;
  
  // Include statistics with details
  // - statistics.details: The actual stat values
  // NOTE: Type names (e.g., "Scoring Minutes") are looked up from local database
  return makeRequest(endpoint, [
    'statistics.details'
  ]);
}

/**
 * Get the current squad (roster) for a team
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Current squad with player details
 * 
 * Example: getTeamSquad(62) // Rangers current squad
 */
async function getTeamSquad(teamId) {
  // API: GET /squads/teams/{team_id}
  const endpoint = `/squads/teams/${teamId}`;
  
  // Include player details
  return makeRequest(endpoint, ['player']);
}

/**
 * Get historical squad for a team in a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Squad for that season with player details
 * 
 * Example: getTeamSquadBySeason(19735, 62) // Rangers 2022/2023 squad
 */
async function getTeamSquadBySeason(seasonId, teamId) {
  // API: GET /squads/seasons/{season_id}/teams/{team_id}
  const endpoint = `/squads/seasons/${seasonId}/teams/${teamId}`;
  
  // Include player details and performance stats
  return makeRequest(endpoint, ['player', 'details']);
}

/**
 * Get all transfers for a team (incoming and outgoing)
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Transfer history
 * 
 * Example: getTeamTransfers(62) // Rangers transfers
 */
async function getTeamTransfers(teamId) {
  // API: GET /transfers/teams/{team_id}
  const endpoint = `/transfers/teams/${teamId}`;
  
  // Include player and team details
  return makeRequest(endpoint, ['player', 'fromTeam', 'toTeam']);
}

/**
 * Get all seasons a team has participated in
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - List of seasons
 * 
 * Useful for finding season IDs for historical data
 * 
 * Example: getTeamSeasons(62) // All Rangers seasons
 */
async function getTeamSeasons(teamId) {
  // API: GET /seasons/teams/{team_id}
  const endpoint = `/seasons/teams/${teamId}`;
  
  // Include league info for context
  return makeRequest(endpoint, ['league']);
}

/**
 * Get the full schedule for a team (all fixtures in active seasons)
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Complete season schedule
 * 
 * Example: getTeamSchedule(62) // Rangers full schedule
 */
async function getTeamSchedule(teamId) {
  // API: GET /schedules/teams/{team_id}
  const endpoint = `/schedules/teams/${teamId}`;
  
  // Include useful fixture details
  return makeRequest(endpoint, ['participants', 'venue', 'league']);
}

// ============================================
// COACH FUNCTIONS
// ============================================

/**
 * Get coach details by ID
 * @param {number|string} coachId - The SportsMonks coach ID
 * @returns {Promise<object>} - Coach details
 * 
 * Example: getCoachById(23237) // Giovanni van Bronckhorst
 */
async function getCoachById(coachId) {
  // API: GET /coaches/{coach_id}
  const endpoint = `/coaches/${coachId}`;
  
  // Include team and career info
  return makeRequest(endpoint, ['teams', 'nationality']);
}

/**
 * Search for coaches by name
 * @param {string} searchQuery - The coach name to search for
 * @returns {Promise<object>} - Matching coaches
 * 
 * Example: searchCoaches("Guardiola")
 */
async function searchCoaches(searchQuery) {
  // API: GET /coaches/search/{query}
  const endpoint = `/coaches/search/${encodeURIComponent(searchQuery)}`;
  
  return makeRequest(endpoint, ['teams', 'nationality']);
}

// ============================================
// STANDINGS FUNCTIONS
// ============================================

/**
 * Get league standings for a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @returns {Promise<object>} - League table with team positions, points, form, etc.
 *
 * Example: getStandingsBySeason(23614) // Premier League 2024/25
 * Returns: { data: [{ participant: { name: "Arsenal" }, position: 1, points: 50, ... }] }
 */
async function getStandingsBySeason(seasonId) {
  // API: GET /standings/seasons/{season_id}
  const endpoint = `/standings/seasons/${seasonId}`;

  // Include participant (team) details, form history, and detailed stats
  // - participant: Team name, logo, etc.
  // - form: Recent match results (W/D/L)
  // - details: Stats like GF (133), GA (134), GD (179), P (129), W (130), D (131), L (132)
  return makeRequest(endpoint, ['participant', 'form', 'details']);
}

// ============================================
// LIVE SCORES FUNCTIONS
// ============================================

/**
 * Get all live matches (currently in play or about to start)
 * @returns {Promise<object>} - All live fixtures with scores
 *
 * Note: Only returns matches from our subscribed leagues (PL, FA Cup, Carabao)
 */
async function getLivescores() {
  // API: GET /livescores
  const endpoint = '/livescores';

  // Include participants (teams), scores, league info, and STATE
  // State is critical - it tells us if match is in 1H, 2H, HT, ET, FT, etc.
  return makeRequest(endpoint, ['participants', 'scores', 'league', 'state']);
}

/**
 * Get only matches currently in play
 * @returns {Promise<object>} - Fixtures that are actively being played right now
 */
async function getLivescoresInplay() {
  // API: GET /livescores/inplay
  const endpoint = '/livescores/inplay';

  // Include participants (teams), scores, league, state, and events (goals, cards)
  // State is critical - it tells us the match period (1H, 2H, HT, ET, etc.)
  return makeRequest(endpoint, ['participants', 'scores', 'league', 'state', 'events']);
}

// ============================================
// LEAGUES FUNCTIONS
// ============================================

/**
 * Get all leagues (filtered by our subscription)
 * @returns {Promise<object>} - All available leagues
 *
 * Note: Our subscription covers:
 *   - Premier League (8)
 *   - FA Cup (24)
 *   - Carabao Cup (27)
 */
async function getAllLeagues() {
  // API: GET /leagues
  const endpoint = '/leagues';

  // Include country and current season info
  return makeRequest(endpoint, ['country', 'currentSeason']);
}

/**
 * Get a specific league by ID
 * @param {number|string} leagueId - The SportsMonks league ID
 * @returns {Promise<object>} - League details
 *
 * Example: getLeagueById(8) // Premier League
 */
async function getLeagueById(leagueId) {
  // API: GET /leagues/{id}
  const endpoint = `/leagues/${leagueId}`;

  // Include country, current season, and seasons list
  return makeRequest(endpoint, ['country', 'currentSeason', 'seasons']);
}

/**
 * Search leagues by name
 * @param {string} searchQuery - Search term (e.g., "Premier", "Cup")
 * @returns {Promise<object>} - Matching leagues
 *
 * Example: searchLeagues("Premier")
 */
async function searchLeagues(searchQuery) {
  // API: GET /leagues/search/{query}
  const endpoint = `/leagues/search/${encodeURIComponent(searchQuery)}`;

  return makeRequest(endpoint, ['country']);
}

// ============================================
// SEASONS FUNCTIONS
// ============================================

/**
 * Get all seasons (from our subscribed leagues)
 * @returns {Promise<object>} - All available seasons
 */
async function getAllSeasons() {
  // API: GET /seasons
  const endpoint = '/seasons';

  // Include league info
  return makeRequest(endpoint, ['league']);
}

/**
 * Get a specific season by ID
 * @param {number|string} seasonId - The SportsMonks season ID
 * @returns {Promise<object>} - Season details with league info
 *
 * Example: getSeasonById(23614) // Premier League 2024/25
 */
async function getSeasonById(seasonId) {
  // API: GET /seasons/{id}
  const endpoint = `/seasons/${seasonId}`;

  // Include league and stages
  return makeRequest(endpoint, ['league', 'stages']);
}

/**
 * Get seasons for a specific league
 * @param {number|string} leagueId - The SportsMonks league ID
 * @returns {Promise<object>} - All seasons for this league
 *
 * Example: getSeasonsByLeague(8) // All Premier League seasons
 */
async function getSeasonsByLeague(leagueId) {
  // API: GET /seasons/leagues/{league_id}
  // Note: We filter client-side from all seasons if this endpoint doesn't exist
  const endpoint = `/leagues/${leagueId}`;

  // Include seasons in the league response
  return makeRequest(endpoint, ['seasons']);
}

// ============================================
// TOP SCORERS FUNCTIONS
// ============================================

/**
 * Get top scorers for a specific season
 * @param {number|string} seasonId - The SportsMonks season ID
 * @returns {Promise<object>} - Top scorers with player and team info
 *
 * Example: getTopScorersBySeason(23614) // Premier League 2024/25 top scorers
 */
async function getTopScorersBySeason(seasonId) {
  // API: GET /topscorers/seasons/{season_id}
  const endpoint = `/topscorers/seasons/${seasonId}`;

  // Include player details and team info
  return makeRequest(endpoint, ['player', 'participant']);
}

// ============================================
// TEAM TOP SCORERS/ASSISTS FUNCTIONS
// ============================================

/**
 * Get a team's squad with player statistics for a specific season
 * This endpoint returns all players with their season stats (goals, assists, etc.)
 * 
 * @param {number|string} seasonId - The SportsMonks season ID
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Squad with player statistics
 * 
 * The response includes player.statistics.details which contains:
 * - type_id 52: GOALS (total goals scored)
 * - type_id 79: ASSISTS (total assists)
 * - type_id 321: APPEARANCES (lineups/starts)
 * - type_id 119: MINUTES_PLAYED
 * 
 * Example: getTeamSquadWithStats(23614, 1) // Man City 2024/25 season
 */
async function getTeamSquadWithStats(seasonId, teamId) {
  // API: GET /squads/seasons/{season_id}/teams/{team_id}
  // This gets the squad for a specific season with player stats
  const endpoint = `/squads/seasons/${seasonId}/teams/${teamId}?filters=playerStatisticSeasons:${seasonId}`;
  
  // Include player details with their statistics
  // - player: Basic player info (name, image, position)
  // - player.statistics.details: Season stats (goals, assists, etc.)
  return makeRequest(endpoint, [
    'player',
    'player.statistics.details'
  ]);
}

// ============================================
// PREDICTIONS FUNCTIONS
// ============================================

/**
 * Get AI predictions for a specific fixture
 * @param {number|string} fixtureId - The SportsMonks fixture ID
 * @returns {Promise<object>} - Predictions with probability percentages
 * 
 * Predictions include:
 * - Fulltime Result (home/draw/away %)
 * - BTTS (Both Teams To Score)
 * - Over/Under 1.5, 2.5, 3.5, 4.5 goals
 * - First Half Winner
 * - Correct Score probabilities
 * - Team to Score First
 * - Double Chance
 * - Home/Away specific Over/Under
 * - Corners Over/Under (4-11 corners)
 * - Half Time / Full Time combos
 * 
 * Example: getFixturePredictions(19427635)
 */
async function getFixturePredictions(fixtureId) {
  // API: GET /fixtures/{fixture_id}
  const endpoint = `/fixtures/${fixtureId}`;

  // Include predictions
  // NOTE: Type info (name, code, etc.) is looked up from local database
  return makeRequest(endpoint, ['predictions']);
}

/**
 * Get the performance/accuracy of SportsMonks prediction model for a league
 * @param {number|string} leagueId - The SportsMonks league ID
 * @returns {Promise<object>} - Prediction model performance stats
 * 
 * Returns accuracy metrics for various prediction markets:
 * - Fulltime Result (1X2)
 * - Over/Under goals
 * - Both Teams To Score
 * - Correct Score
 * - And more...
 * 
 * League IDs:
 *   - 8: Premier League
 *   - 24: FA Cup
 *   - 27: Carabao Cup
 * 
 * Example: getPredictabilityByLeague(8) // Premier League prediction performance
 */
async function getPredictabilityByLeague(leagueId) {
  // API: GET /predictions/predictability/leagues/{league_id}
  // Note: This uses the FOOTBALL base URL, not odds
  const endpoint = `/predictions/predictability/leagues/${leagueId}`;
  
  // No includes needed for this endpoint
  return makeRequest(endpoint);
}

// ============================================
// STAGES / SCHEDULE FUNCTIONS (Cup Competitions)
// ============================================

/**
 * Get all stages for a season with their fixtures
 * This is ideal for cup competitions (FA Cup, Carabao Cup) to show fixtures by stage/round
 * 
 * @param {number|string} seasonId - The SportsMonks season ID
 * @returns {Promise<object>} - Stages with fixtures for the season
 * 
 * The response includes:
 * - data: Array of stages (e.g., "First Round", "Quarter-Finals", "Final")
 *   - Each stage has: id, name, sort_order, finished, is_current, starting_at, ending_at
 *   - fixtures[]: Array of matches in that stage
 * 
 * For cup competitions like FA Cup (24) and Carabao Cup (27):
 * - Each stage represents a round of the cup (First Round, Second Round, etc.)
 * - Fixtures include team names, scores, and match status
 * 
 * Example: getStagesBySeason(23768) // FA Cup 2024/25
 */
async function getStagesBySeason(seasonId) {
  // API: GET /stages/seasons/{season_id}
  // This is the correct endpoint for cup competitions
  // Stages represent rounds like "1st Round", "Quarter-Finals", "Final"
  const endpoint = `/stages/seasons/${seasonId}`;
  
  // Include fixtures with useful data:
  // - fixtures: The matches in each stage
  // - fixtures.participants: Team names and logos
  // - fixtures.scores: Match results
  // - fixtures.venue: Stadium info
  // - fixtures.state: Match state (scheduled, finished, etc.)
  return makeRequest(endpoint, [
    'fixtures.participants',
    'fixtures.scores',
    'fixtures.venue',
    'fixtures.state'
  ]);
}

// ============================================
// TEAM FIXTURES WITH STATISTICS
// ============================================

/**
 * Get a team's fixtures within a date range WITH match statistics
 * Used for calculating corner averages, shots, etc. from historical data
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format  
 * @param {number|string} teamId - The SportsMonks team ID
 * @returns {Promise<object>} - Fixtures with full statistics
 * 
 * Statistics include type_id 34 (corners) with:
 * - participant_id: which team
 * - location: "home" or "away" (team's location in THIS match)
 * - data: { value: 6 } (corner count)
 * 
 * Example: getTeamFixturesWithStats("2024-08-16", "2024-12-28", 1)
 */
async function getTeamFixturesWithStats(startDate, endDate, teamId) {
  // API: GET /fixtures/between/{start_date}/{end_date}/{team_id}
  const endpoint = `/fixtures/between/${startDate}/${endDate}/${teamId}`;

  // Include statistics and state for filtering finished matches
  // - statistics: Match stats including corners (type_id 34)
  // - participants: Team info to determine home/away
  // - state: To filter only finished matches (FT)
  // - scores: Final scores
  //
  // NOTE: Use makeRequestPaginated to fetch ALL fixtures across multiple pages
  // SportsMonks returns max 25 results per page by default
  return makeRequestPaginated(endpoint, [
    'statistics',
    'participants',
    'state',
    'scores'
  ]);
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
