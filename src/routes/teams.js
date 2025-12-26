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
  searchCoaches
} from '../services/sportsmonks.js';

// Create a router
const router = express.Router();

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
