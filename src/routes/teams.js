// ============================================
// TEAMS ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to team data from SportsMonks.
// They act as a proxy between our frontend and SportsMonks API.
// ============================================

import express from 'express';
import {
  searchTeams,
  getTeamById,
  getHeadToHead,
  getTeamWithStats,
  getTeamStatsBySeason,
  getTeamSquad,
  getTeamSquadBySeason,
  getTeamSquadWithStats,
  getTeamTransfers,
  getTeamSeasons,
  getTeamSchedule,
  getCoachById,
  searchCoaches,
  getSeasonById,
  getTeamFixturesWithStats
} from '../services/sportsmonks.js';
import cache from '../services/cache.js';

// Import auth middleware - all routes require authentication
import authMiddleware from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// ============================================
// HELPER: Parse Include Options from Query
// ============================================
// Parses ?include=odds,sidelined into options object

function parseIncludeOptions(query) {
  const options = {
    includeOdds: false,
    includeSidelined: false
  };
  
  const includeParam = query.include;
  
  if (includeParam) {
    const includes = includeParam.toLowerCase().split(',');
    if (includes.includes('odds')) options.includeOdds = true;
    if (includes.includes('sidelined')) options.includeSidelined = true;
  }
  
  return options;
}

// ============================================
// SEARCH TEAMS
// GET /teams/search/:query
// Example: GET /teams/search/Fulham
// ============================================

router.get('/search/:query', async (req, res) => {
  try {
    // 1. Get the search query from the URL parameter
    const searchQuery = req.params.query;
    
    // 2. Validate: query must be at least 2 characters
    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }
    
    // 3. Call the SportsMonks service
    const result = await searchTeams(searchQuery);
    
    // 4. Return the results
    // We pass through the SportsMonks response structure
    res.json({
      message: `Found ${result.data?.length || 0} teams matching "${searchQuery}"`,
      teams: result.data || []
    });
    
  } catch (error) {
    console.error('Team search error:', error);
    res.status(500).json({ 
      error: 'Failed to search teams',
      details: error.message 
    });
  }
});

// ============================================
// HEAD-TO-HEAD
// GET /teams/h2h/:team1Id/:team2Id
// Example: GET /teams/h2h/11/1?include=odds,sidelined
// ============================================
// OPTIONAL INCLUDES:
//   - odds: Pre-match betting odds for each fixture
//   - sidelined: Injured/suspended players

router.get('/h2h/:team1Id/:team2Id', async (req, res) => {
  try {
    const { team1Id, team2Id } = req.params;
    
    // Parse optional includes
    const options = parseIncludeOptions(req.query);
    
    // Validate: both must be numbers
    if (isNaN(team1Id) || isNaN(team2Id)) {
      return res.status(400).json({
        error: 'Both team IDs must be numbers'
      });
    }
    
    // Validate: teams must be different
    if (team1Id === team2Id) {
      return res.status(400).json({
        error: 'Cannot get head-to-head for the same team'
      });
    }
    
    // Call the SportsMonks service with options
    const result = await getHeadToHead(team1Id, team2Id, options);
    
    // 5. Process the fixtures to create a summary
    const fixtures = result.data || [];
    
    // Calculate basic stats from the fixtures
    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;
    
    fixtures.forEach(fixture => {
      // scores array contains score objects with description like "CURRENT"
      const scores = fixture.scores || [];
      const currentScore = scores.find(s => s.description === 'CURRENT');
      
      if (currentScore) {
        const homeGoals = currentScore.score?.participant === 'home' ? currentScore.score?.goals : 0;
        const awayGoals = currentScore.score?.participant === 'away' ? currentScore.score?.goals : 0;
        
        // Determine winner based on participants array
        const participants = fixture.participants || [];
        const homeTeam = participants.find(p => p.meta?.location === 'home');
        const awayTeam = participants.find(p => p.meta?.location === 'away');
        
        // Get actual scores from the scores array
        const homeScore = scores.find(s => s.description === 'CURRENT' && s.score?.participant === 'home');
        const awayScore = scores.find(s => s.description === 'CURRENT' && s.score?.participant === 'away');
        
        const hGoals = homeScore?.score?.goals || 0;
        const aGoals = awayScore?.score?.goals || 0;
        
        if (hGoals > aGoals) {
          // Home team won
          if (homeTeam && homeTeam.id === parseInt(team1Id)) {
            team1Wins++;
          } else {
            team2Wins++;
          }
        } else if (aGoals > hGoals) {
          // Away team won
          if (awayTeam && awayTeam.id === parseInt(team1Id)) {
            team1Wins++;
          } else {
            team2Wins++;
          }
        } else {
          draws++;
        }
      }
    });
    
    // 6. Return the results with summary
    res.json({
      message: `Found ${fixtures.length} head-to-head fixtures`,
      includes: {
        odds: options.includeOdds,
        sidelined: options.includeSidelined
      },
      summary: {
        totalMatches: fixtures.length,
        team1Wins,
        team2Wins,
        draws
      },
      fixtures: fixtures
    });
    
  } catch (error) {
    console.error('Head-to-head error:', error);
    res.status(500).json({ 
      error: 'Failed to get head-to-head data',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM STATS BY SEASON
// GET /teams/:id/stats/seasons/:seasonId
// Example: GET /teams/62/stats/seasons/19735
// ============================================
// Returns team statistics filtered by a specific season
// Useful for viewing historical stats or comparing seasons

router.get('/:id/stats/seasons/:seasonId', async (req, res) => {
  try {
    const { id: teamId, seasonId } = req.params;
    
    // Validate IDs
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    if (isNaN(seasonId)) {
      return res.status(400).json({
        error: 'Season ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamStatsBySeason(teamId, seasonId);
    
    // Check if team was found
    if (!result.data) {
      return res.status(404).json({
        error: `Team with ID ${teamId} not found`
      });
    }
    
    // Return the team with statistics for that season
    res.json({
      teamId: parseInt(teamId),
      seasonId: parseInt(seasonId),
      team: result.data
    });
    
  } catch (error) {
    console.error('Get team stats by season error:', error);
    res.status(500).json({ 
      error: 'Failed to get team statistics for season',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM WITH FULL STATISTICS
// GET /teams/:id/stats
// Example: GET /teams/62/stats
// ============================================
// Returns team with comprehensive season statistics

router.get('/:id/stats', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamWithStats(teamId);
    
    // Check if team was found
    if (!result.data) {
      return res.status(404).json({
        error: `Team with ID ${teamId} not found`
      });
    }
    
    // Return the team with statistics
    res.json({
      team: result.data
    });
    
  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get team statistics',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM SQUAD (CURRENT ROSTER)
// GET /teams/:id/squad
// Example: GET /teams/62/squad
// ============================================
// Returns current players in the team

router.get('/:id/squad', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamSquad(teamId);
    
    // Return the squad
    res.json({
      message: `Found ${result.data?.length || 0} players in squad`,
      teamId: parseInt(teamId),
      squad: result.data || []
    });
    
  } catch (error) {
    console.error('Get team squad error:', error);
    res.status(500).json({ 
      error: 'Failed to get team squad',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM SQUAD BY SEASON (HISTORICAL)
// GET /teams/:id/squad/seasons/:seasonId
// Example: GET /teams/62/squad/seasons/19735
// ============================================
// Returns historical squad for a specific season

router.get('/:id/squad/seasons/:seasonId', async (req, res) => {
  try {
    const { id: teamId, seasonId } = req.params;
    
    // Validate IDs
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    if (isNaN(seasonId)) {
      return res.status(400).json({
        error: 'Season ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamSquadBySeason(seasonId, teamId);
    
    // Return the squad
    res.json({
      message: `Found ${result.data?.length || 0} players in squad for season ${seasonId}`,
      teamId: parseInt(teamId),
      seasonId: parseInt(seasonId),
      squad: result.data || []
    });
    
  } catch (error) {
    console.error('Get team squad by season error:', error);
    res.status(500).json({ 
      error: 'Failed to get team squad for season',
      details: error.message 
    });
  }
});

// ============================================
// GET FULL SQUAD WITH STATISTICS FOR SEASON
// GET /teams/:id/fullsquad/seasons/:seasonId
// Example: GET /teams/62/fullsquad/seasons/23614
// ============================================
// Returns ALL players in the squad with their full statistics
// for the specified season. Used for the team roster table.
//
// Statistics Type IDs:
// - 52: Goals
// - 79: Assists
// - 83: Red Cards
// - 84: Yellow Cards
// - 85: Yellow-Red Cards
// - 88: Goals Conceded (GK)
// - 119: Minutes Played
// - 194: Clean Sheets (GK)
// - 214: Team Wins
// - 215: Team Draws
// - 216: Team Losses
// - 321: Appearances
// - 322: Lineups
// - 324: Own Goals

router.get('/:id/fullsquad/seasons/:seasonId', async (req, res) => {
  try {
    const { id: teamId, seasonId } = req.params;
    
    // Validate IDs
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    if (isNaN(seasonId)) {
      return res.status(400).json({
        error: 'Season ID must be a number'
      });
    }
    
    // Fetch squad with player statistics
    const result = await getTeamSquadWithStats(seasonId, teamId);
    const squadMembers = result.data || [];
    
    // Type IDs for all stats we want to extract
    const STAT_TYPE_IDS = {
      GOALS: 52,
      ASSISTS: 79,
      RED_CARDS: 83,
      YELLOW_CARDS: 84,
      YELLOW_RED_CARDS: 85,
      GOALS_CONCEDED: 88,
      MINUTES_PLAYED: 119,
      CLEAN_SHEETS: 194,
      TEAM_WINS: 214,
      TEAM_DRAWS: 215,
      TEAM_LOSSES: 216,
      APPEARANCES: 321,
      LINEUPS: 322,
      OWN_GOALS: 324
    };
    
    // Process each player to extract all stats
    const playersWithStats = squadMembers.map(member => {
      const player = member.player || {};
      const statistics = player.statistics || [];
      
      // Initialize all stats to 0
      const stats = {
        goals: 0,
        assists: 0,
        redCards: 0,
        yellowCards: 0,
        yellowRedCards: 0,
        goalsConceded: 0,
        minutesPlayed: 0,
        cleanSheets: 0,
        teamWins: 0,
        teamDraws: 0,
        teamLosses: 0,
        appearances: 0,
        lineups: 0,
        ownGoals: 0
      };
      
      // Extract stats from the statistics array
      // Each statGroup has a details array with type_id and value
      statistics.forEach(statGroup => {
        const details = statGroup.details || [];
        details.forEach(detail => {
          // Helper to safely extract value (could be number or object with total)
          const getValue = (val) => {
            if (typeof val === 'number') return val;
            if (val && typeof val === 'object') return val.total || val.count || 0;
            return 0;
          };
          
          switch (detail.type_id) {
            case STAT_TYPE_IDS.GOALS:
              stats.goals = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.ASSISTS:
              stats.assists = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.RED_CARDS:
              stats.redCards = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.YELLOW_CARDS:
              stats.yellowCards = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.YELLOW_RED_CARDS:
              stats.yellowRedCards = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.GOALS_CONCEDED:
              stats.goalsConceded = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.MINUTES_PLAYED:
              stats.minutesPlayed = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.CLEAN_SHEETS:
              stats.cleanSheets = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.TEAM_WINS:
              stats.teamWins = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.TEAM_DRAWS:
              stats.teamDraws = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.TEAM_LOSSES:
              stats.teamLosses = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.APPEARANCES:
              stats.appearances = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.LINEUPS:
              stats.lineups = getValue(detail.value);
              break;
            case STAT_TYPE_IDS.OWN_GOALS:
              stats.ownGoals = getValue(detail.value);
              break;
          }
        });
      });
      
      // Return player object with all their stats
      return {
        playerId: player.id,
        name: player.display_name || player.common_name || player.name || 'Unknown',
        firstName: player.firstname,
        lastName: player.lastname,
        image: player.image_path,
        positionId: member.position_id || player.position_id,
        jerseyNumber: member.jersey_number,
        dateOfBirth: player.date_of_birth,
        nationality: player.nationality?.name,
        height: player.height,
        weight: player.weight,
        ...stats
      };
    });
    
    // Sort players by position, then by appearances/goals
    // Position order: GK (1), DEF (2), MID (3), FWD (4)
    playersWithStats.sort((a, b) => {
      // First sort by position
      if (a.positionId !== b.positionId) {
        return (a.positionId || 999) - (b.positionId || 999);
      }
      // Then by appearances (descending)
      if (b.appearances !== a.appearances) {
        return b.appearances - a.appearances;
      }
      // Then by goals (descending)
      return b.goals - a.goals;
    });
    
    // Return the processed data
    res.json({
      teamId: parseInt(teamId),
      seasonId: parseInt(seasonId),
      totalPlayers: playersWithStats.length,
      players: playersWithStats
    });
    
  } catch (error) {
    console.error('Get team full squad error:', error);
    res.status(500).json({ 
      error: 'Failed to get team squad with statistics',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM TOP SCORERS & ASSISTS FOR SEASON
// GET /teams/:id/topstats/seasons/:seasonId
// Example: GET /teams/62/topstats/seasons/23614
// ============================================
// Returns top 5 scorers and top 5 assist providers
// for a team in a specific season.
// Used on fixture detail pages for upcoming matches.

router.get('/:id/topstats/seasons/:seasonId', async (req, res) => {
  try {
    const { id: teamId, seasonId } = req.params;
    
    // Validate IDs
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    if (isNaN(seasonId)) {
      return res.status(400).json({
        error: 'Season ID must be a number'
      });
    }
    
    // Fetch squad with player statistics
    const result = await getTeamSquadWithStats(seasonId, teamId);
    const squadMembers = result.data || [];
    
    // Type IDs for the stats we want:
    // 52 = GOALS (total goals scored)
    // 79 = ASSISTS (total assists)
    // 321 = APPEARANCES (lineups/starts)
    const GOALS_TYPE_ID = 52;
    const ASSISTS_TYPE_ID = 79;
    const APPEARANCES_TYPE_ID = 321;
    
    // Process each player to extract goals, assists, appearances
    const playersWithStats = squadMembers.map(member => {
      const player = member.player || {};
      const statistics = player.statistics || [];
      
      // Find the statistics.details array
      // Each stat has a type_id that tells us what kind of stat it is
      let goals = 0;
      let assists = 0;
      let appearances = 0;
      
      statistics.forEach(statGroup => {
        const details = statGroup.details || [];
        details.forEach(detail => {
          if (detail.type_id === GOALS_TYPE_ID) {
            // Goals stat - extract total from value object
            goals = detail.value?.total || detail.value || 0;
          }
          if (detail.type_id === ASSISTS_TYPE_ID) {
            assists = detail.value?.total || detail.value || 0;
          }
          if (detail.type_id === APPEARANCES_TYPE_ID) {
            appearances = detail.value?.total || detail.value || 0;
          }
        });
      });
      
      return {
        playerId: player.id,
        name: player.display_name || player.common_name || player.name || 'Unknown',
        image: player.image_path,
        position: member.position_id, // We'll use this if needed
        jerseyNumber: member.jersey_number,
        goals,
        assists,
        appearances
      };
    });
    
    // Sort and get top 5 scorers (must have at least 1 goal)
    const topScorers = [...playersWithStats]
      .filter(p => p.goals > 0)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);
    
    // Sort and get top 5 assist providers (must have at least 1 assist)
    const topAssists = [...playersWithStats]
      .filter(p => p.assists > 0)
      .sort((a, b) => b.assists - a.assists)
      .slice(0, 5);
    
    // Return the processed data
    res.json({
      teamId: parseInt(teamId),
      seasonId: parseInt(seasonId),
      totalPlayers: squadMembers.length,
      topScorers,
      topAssists
    });
    
  } catch (error) {
    console.error('Get team top stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get team top scorers and assists',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM TRANSFERS
// GET /teams/:id/transfers
// Example: GET /teams/62/transfers
// ============================================
// Returns all transfers (incoming and outgoing)

router.get('/:id/transfers', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamTransfers(teamId);
    
    // Return the transfers
    res.json({
      message: `Found ${result.data?.length || 0} transfers`,
      teamId: parseInt(teamId),
      transfers: result.data || []
    });
    
  } catch (error) {
    console.error('Get team transfers error:', error);
    res.status(500).json({ 
      error: 'Failed to get team transfers',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM SEASONS
// GET /teams/:id/seasons
// Example: GET /teams/62/seasons
// ============================================
// Returns all seasons the team has participated in
// Useful for finding season IDs for historical data

router.get('/:id/seasons', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamSeasons(teamId);
    
    // Return the seasons
    res.json({
      message: `Found ${result.data?.length || 0} seasons`,
      teamId: parseInt(teamId),
      seasons: result.data || []
    });
    
  } catch (error) {
    console.error('Get team seasons error:', error);
    res.status(500).json({ 
      error: 'Failed to get team seasons',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM SCHEDULE
// GET /teams/:id/schedule
// Example: GET /teams/62/schedule
// ============================================
// Returns full schedule for active seasons

router.get('/:id/schedule', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getTeamSchedule(teamId);
    
    // Return the schedule
    res.json({
      message: `Found ${result.data?.length || 0} scheduled fixtures`,
      teamId: parseInt(teamId),
      schedule: result.data || []
    });
    
  } catch (error) {
    console.error('Get team schedule error:', error);
    res.status(500).json({ 
      error: 'Failed to get team schedule',
      details: error.message 
    });
  }
});

// ============================================
// COACH ROUTES
// ============================================

/**
 * GET /teams/coaches/search/:query
 * Search for coaches by name
 * Example: GET /teams/coaches/search/Guardiola
 */
router.get('/coaches/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    
    // Validate: query must be at least 2 characters
    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }
    
    // Call the SportsMonks service
    const result = await searchCoaches(searchQuery);
    
    // Return the coaches
    res.json({
      message: `Found ${result.data?.length || 0} coaches matching "${searchQuery}"`,
      query: searchQuery,
      coaches: result.data || []
    });
    
  } catch (error) {
    console.error('Coach search error:', error);
    res.status(500).json({ 
      error: 'Failed to search coaches',
      details: error.message 
    });
  }
});

/**
 * GET /teams/coaches/:id
 * Get coach details by ID
 * Example: GET /teams/coaches/23237
 */
router.get('/coaches/:id', async (req, res) => {
  try {
    const coachId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(coachId)) {
      return res.status(400).json({
        error: 'Coach ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getCoachById(coachId);
    
    // Check if coach was found
    if (!result.data) {
      return res.status(404).json({
        error: `Coach with ID ${coachId} not found`
      });
    }
    
    // Return the coach
    res.json({
      coach: result.data
    });
    
  } catch (error) {
    console.error('Get coach error:', error);
    res.status(500).json({ 
      error: 'Failed to get coach',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM CORNER AVERAGES BY SEASON
// GET /teams/:id/corners/seasons/:seasonId
// Example: GET /teams/1/corners/seasons/23614
// ============================================
// Calculates home and away corner averages from historical fixtures.
// Uses caching (12h TTL) to reduce API calls.
//
// Response:
// {
//   teamId: 1,
//   teamName: "West Ham",
//   seasonId: 23614,
//   corners: {
//     home: { total: 95, games: 19, average: 5.0 },
//     away: { total: 57, games: 17, average: 3.4 },
//     overall: { total: 152, games: 36, average: 4.2 }
//   },
//   cachedAt: "2024-12-28T15:30:00Z"
// }

router.get('/:id/corners/seasons/:seasonId', async (req, res) => {
  try {
    const { id: teamId, seasonId } = req.params;
    
    // Validate IDs
    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Team ID must be a number' });
    }
    if (isNaN(seasonId)) {
      return res.status(400).json({ error: 'Season ID must be a number' });
    }
    
    // ============================================
    // CHECK CACHE FIRST
    // ============================================
    const cacheKey = cache.keys.corners(teamId, seasonId);
    const cached = cache.get(cacheKey);
    
    if (cached) {
      // Return cached data with cache info
      return res.json({
        ...cached,
        fromCache: true
      });
    }
    
    // ============================================
    // FETCH SEASON DATES
    // ============================================
    // We need the season start date to fetch fixtures
    // Cache season data separately (24h TTL) since it rarely changes
    const seasonCacheKey = cache.keys.season(seasonId);
    let seasonData = cache.get(seasonCacheKey);
    
    if (!seasonData) {
      console.log(`[Corners] Fetching season ${seasonId} dates...`);
      const seasonResult = await getSeasonById(seasonId);
      
      if (!seasonResult.data) {
        return res.status(404).json({ error: `Season ${seasonId} not found` });
      }
      
      seasonData = {
        id: seasonResult.data.id,
        name: seasonResult.data.name,
        startDate: seasonResult.data.starting_at,
        endDate: seasonResult.data.ending_at,
        leagueName: seasonResult.data.league?.name
      };
      
      // Cache season data for 24 hours
      cache.set(seasonCacheKey, seasonData, cache.TTL.SEASON);
    }
    
    // ============================================
    // FETCH TEAM FIXTURES WITH STATISTICS
    // ============================================
    // Get fixtures from season start to today
    const today = new Date().toISOString().split('T')[0];
    const startDate = seasonData.startDate;
    
    console.log(`[Corners] Fetching fixtures for team ${teamId} from ${startDate} to ${today}...`);
    const fixturesResult = await getTeamFixturesWithStats(startDate, today, teamId);
    const allFixtures = fixturesResult.data || [];
    
    // ============================================
    // FILTER TO THIS SEASON ONLY
    // ============================================
    // The fixtures endpoint returns ALL matches (including cups),
    // so we must filter to only include fixtures from the specified season.
    // This ensures Premier League stats don't include FA Cup / Carabao Cup games.
    const fixtures = allFixtures.filter(f => f.season_id === parseInt(seasonId));

    console.log(`[Corners] Found ${allFixtures.length} total fixtures, ${fixtures.length} in season ${seasonId}`);
    
    // ============================================
    // CALCULATE CORNER AVERAGES
    // ============================================
    // Filter to finished matches only and calculate averages
    
    const CORNERS_TYPE_ID = 34;
    
    let homeCorners = 0;
    let homeGames = 0;
    let awayCorners = 0;
    let awayGames = 0;

    // Process each fixture
    for (const fixture of fixtures) {
      // Only count finished matches
      if (fixture.state?.state !== 'FT') continue;

      // Find this team's location in this match (home or away)
      const teamParticipant = fixture.participants?.find(
        p => p.id === parseInt(teamId)
      );

      if (!teamParticipant) continue;

      const teamLocation = teamParticipant.meta?.location; // 'home' or 'away'

      // Find corners stat for this team in this match
      // Statistics are per-team, identified by participant_id
      const cornersStat = fixture.statistics?.find(
        s => s.type_id === CORNERS_TYPE_ID && s.participant_id === parseInt(teamId)
      );

      // Extract corner count
      // Data structure: { value: 6 } or sometimes just a number
      let corners = 0;
      if (cornersStat?.data) {
        corners = typeof cornersStat.data === 'number'
          ? cornersStat.data
          : cornersStat.data.value ?? 0;
      }

      // Add to appropriate totals
      if (teamLocation === 'home') {
        homeCorners += corners;
        homeGames++;
      } else if (teamLocation === 'away') {
        awayCorners += corners;
        awayGames++;
      } else {
        // Track fixtures with unexpected location
        skippedFixtures.push({
          fixtureId: fixture.id,
          teamLocation,
          state: fixture.state?.state,
          participantMeta: teamParticipant?.meta
        });
      }
    }
    
    // Calculate averages
    const homeAvg = homeGames > 0 ? parseFloat((homeCorners / homeGames).toFixed(2)) : 0;
    const awayAvg = awayGames > 0 ? parseFloat((awayCorners / awayGames).toFixed(2)) : 0;
    const overallGames = homeGames + awayGames;
    const overallCorners = homeCorners + awayCorners;
    const overallAvg = overallGames > 0 ? parseFloat((overallCorners / overallGames).toFixed(2)) : 0;
    
    // ============================================
    // BUILD RESPONSE
    // ============================================
    const response = {
      teamId: parseInt(teamId),
      seasonId: parseInt(seasonId),
      seasonName: seasonData.name,
      leagueName: seasonData.leagueName,
      corners: {
        home: {
          total: homeCorners,
          games: homeGames,
          average: homeAvg
        },
        away: {
          total: awayCorners,
          games: awayGames,
          average: awayAvg
        },
        overall: {
          total: overallCorners,
          games: overallGames,
          average: overallAvg
        }
      },
            cachedAt: new Date().toISOString()
    };
    
    // ============================================
    // CACHE AND RETURN
    // ============================================
    cache.set(cacheKey, response, cache.TTL.CORNERS);
    
    res.json({
      ...response,
      fromCache: false
    });
    
  } catch (error) {
    console.error('Get team corner averages error:', error);
    res.status(500).json({ 
      error: 'Failed to get team corner averages',
      details: error.message 
    });
  }
});

// ============================================
// CLEAR CORNERS CACHE (Development)
// DELETE /teams/:id/corners/seasons/:seasonId/cache
// Example: DELETE /teams/1/corners/seasons/23614/cache
// ============================================
// Clears cached corner data for a specific team/season.
// Useful when data is stale or after fixing calculation bugs.

router.delete('/:id/corners/seasons/:seasonId/cache', async (req, res) => {
  try {
    const { id: teamId, seasonId } = req.params;
    
    // Build the cache key
    const cacheKey = cache.keys.corners(teamId, seasonId);
    
    // Delete from cache
    const deleted = cache.del(cacheKey);
    
    res.json({
      message: deleted > 0 
        ? `Cache cleared for team ${teamId}, season ${seasonId}` 
        : `No cached data found for team ${teamId}, season ${seasonId}`,
      cacheKey,
      deleted: deleted > 0
    });
    
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// ============================================
// GET TEAM BY ID
// GET /teams/:id
// Example: GET /teams/52
// ============================================
// NOTE: This must come AFTER more specific routes like /search and /h2h

router.get('/:id', async (req, res) => {
  try {
    // 1. Get the team ID from the URL parameter
    const teamId = req.params.id;
    
    // 2. Validate: ID must be a number
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number'
      });
    }
    
    // 3. Call the SportsMonks service
    const result = await getTeamById(teamId);
    
    // 4. Check if team was found
    if (!result.data) {
      return res.status(404).json({
        error: `Team with ID ${teamId} not found`
      });
    }
    
    // 5. Return the team data
    res.json({
      team: result.data
    });
    
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ 
      error: 'Failed to get team',
      details: error.message 
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
