// ============================================
// FIXTURES ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to fixture data from SportsMonks.
// Fixtures = matches/games between teams.
//
// OPTIONAL INCLUDES:
// Add ?include=odds,sidelined to any fixture endpoint to get:
//   - odds: Pre-match betting odds
//   - sidelined: Injured/suspended players
//
// Examples:
//   GET /fixtures/19134913?include=odds
//   GET /fixtures/date/2024-12-25?include=odds,sidelined
//   GET /fixtures/between/2024-01-01/2024-01-31?include=sidelined
// ============================================

import express from 'express';
import {
  getFixtureById,
  getFixturesByDate,
  getFixturesByDateRange,
  getTeamFixturesByDateRange,
  searchFixtures,
  getFixturePredictions,
  getStagesBySeason
} from '../services/sportsmonks.js';

// Import the types enrichment service
// This adds human-readable type names (e.g., "Goal", "Corners") to API data
// so the frontend doesn't need hardcoded type_id mappings
import { enrichFixtureWithTypes } from '../services/types.js';

// Import auth middleware - all routes require authentication
import authMiddleware from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// ============================================
// HELPER: Validate Date Format
// ============================================
// Checks if a string is a valid YYYY-MM-DD date

function isValidDate(dateString) {
  // Check format with regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  // Check if it's an actual valid date
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// ============================================
// HELPER: Calculate Days Between Dates
// ============================================
// Used to enforce the 100-day maximum for date ranges

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ============================================
// HELPER: Parse Include Options from Query
// ============================================
// Parses ?include=odds,sidelined into options object
//
// Example: ?include=odds,sidelined
// Returns: { includeOdds: true, includeSidelined: true }

function parseIncludeOptions(query) {
  const options = {
    includeOdds: false,
    includeSidelined: false
  };
  
  // Get the include parameter (e.g., "odds,sidelined")
  const includeParam = query.include;
  
  if (includeParam) {
    // Split by comma and check for each option
    const includes = includeParam.toLowerCase().split(',');
    
    if (includes.includes('odds')) {
      options.includeOdds = true;
    }
    if (includes.includes('sidelined')) {
      options.includeSidelined = true;
    }
  }
  
  return options;
}

// ============================================
// GET FIXTURES BY DATE
// GET /fixtures/date/:date
// Example: GET /fixtures/date/2024-12-25
// ============================================
// NOTE: This route must come BEFORE /:id to avoid conflicts

router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Parse optional includes from query string
    const options = parseIncludeOptions(req.query);
    
    // Validate date format
    if (!isValidDate(date)) {
      return res.status(400).json({
        error: 'Invalid date format',
        expected: 'YYYY-MM-DD',
        received: date
      });
    }
    
    // Call the SportsMonks service with options
    const result = await getFixturesByDate(date, options);
    
    // Return the fixtures
    res.json({
      message: `Found ${result.data?.length || 0} fixtures on ${date}`,
      date: date,
      includes: {
        odds: options.includeOdds,
        sidelined: options.includeSidelined
      },
      fixtures: result.data || []
    });
    
  } catch (error) {
    console.error('Fixtures by date error:', error);
    res.status(500).json({ 
      error: 'Failed to get fixtures',
      details: error.message 
    });
  }
});

// ============================================
// GET FIXTURES BY DATE RANGE (ALL FIXTURES)
// GET /fixtures/between/:startDate/:endDate
// Example: GET /fixtures/between/2024-01-01/2024-01-31
// ============================================
// NOTE: Maximum 100 days range (SportsMonks limit)

router.get('/between/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    
    // Parse optional includes from query string
    const options = parseIncludeOptions(req.query);
    
    // Validate both dates
    if (!isValidDate(startDate)) {
      return res.status(400).json({
        error: 'Invalid start date format',
        expected: 'YYYY-MM-DD',
        received: startDate
      });
    }
    
    if (!isValidDate(endDate)) {
      return res.status(400).json({
        error: 'Invalid end date format',
        expected: 'YYYY-MM-DD',
        received: endDate
      });
    }
    
    // Check that start date is before end date
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: 'Start date must be before end date',
        startDate,
        endDate
      });
    }
    
    // Check the 100-day limit
    const days = daysBetween(startDate, endDate);
    if (days > 100) {
      return res.status(400).json({
        error: 'Date range too large',
        maxDays: 100,
        requestedDays: days,
        tip: 'Break your request into smaller chunks'
      });
    }
    
    // Call the SportsMonks service with options
    const result = await getFixturesByDateRange(startDate, endDate, options);
    
    // Return the fixtures
    res.json({
      message: `Found ${result.data?.length || 0} fixtures between ${startDate} and ${endDate}`,
      dateRange: { startDate, endDate, days },
      includes: {
        odds: options.includeOdds,
        sidelined: options.includeSidelined
      },
      fixtures: result.data || []
    });
    
  } catch (error) {
    console.error('Fixtures by date range error:', error);
    res.status(500).json({ 
      error: 'Failed to get fixtures',
      details: error.message 
    });
  }
});

// ============================================
// GET TEAM FIXTURES BY DATE RANGE
// GET /fixtures/between/:startDate/:endDate/team/:teamId
// Example: GET /fixtures/between/2024-01-01/2024-01-31/team/11
// ============================================
// Returns only fixtures for a specific team within the date range

router.get('/between/:startDate/:endDate/team/:teamId', async (req, res) => {
  try {
    const { startDate, endDate, teamId } = req.params;
    
    // Parse optional includes from query string
    const options = parseIncludeOptions(req.query);
    
    // Validate both dates
    if (!isValidDate(startDate)) {
      return res.status(400).json({
        error: 'Invalid start date format',
        expected: 'YYYY-MM-DD',
        received: startDate
      });
    }
    
    if (!isValidDate(endDate)) {
      return res.status(400).json({
        error: 'Invalid end date format',
        expected: 'YYYY-MM-DD',
        received: endDate
      });
    }
    
    // Validate team ID
    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Team ID must be a number',
        received: teamId
      });
    }
    
    // Check that start date is before end date
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: 'Start date must be before end date',
        startDate,
        endDate
      });
    }
    
    // NOTE: No 100-day limit for team-specific queries
    // Team fixtures return fewer results, so larger date ranges are OK
    // This allows searching entire seasons for a single team
    const days = daysBetween(startDate, endDate);
    
    // Call the SportsMonks service with options
    const result = await getTeamFixturesByDateRange(startDate, endDate, teamId, options);
    
    // Return the fixtures
    res.json({
      message: `Found ${result.data?.length || 0} fixtures for team ${teamId} between ${startDate} and ${endDate}`,
      teamId: parseInt(teamId),
      dateRange: { startDate, endDate, days },
      includes: {
        odds: options.includeOdds,
        sidelined: options.includeSidelined
      },
      fixtures: result.data || []
    });
    
  } catch (error) {
    console.error('Team fixtures by date range error:', error);
    res.status(500).json({ 
      error: 'Failed to get fixtures',
      details: error.message 
    });
  }
});

// ============================================
// SEARCH FIXTURES BY TEAM NAME
// GET /fixtures/search/:query
// Example: GET /fixtures/search/Rangers
// ============================================
// Searches fixtures by team name - useful when you know the teams but not fixture ID

router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    
    // Parse optional includes from query string
    const options = parseIncludeOptions(req.query);
    
    // Validate: query must be at least 2 characters
    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }
    
    // Call the SportsMonks service with options
    const result = await searchFixtures(searchQuery, options);
    
    // Return the fixtures
    res.json({
      message: `Found ${result.data?.length || 0} fixtures matching "${searchQuery}"`,
      query: searchQuery,
      includes: {
        odds: options.includeOdds,
        sidelined: options.includeSidelined
      },
      fixtures: result.data || []
    });
    
  } catch (error) {
    console.error('Fixture search error:', error);
    res.status(500).json({ 
      error: 'Failed to search fixtures',
      details: error.message 
    });
  }
});

// ============================================
// GET STAGES WITH FIXTURES FOR A SEASON
// GET /fixtures/seasons/:seasonId
// Example: GET /fixtures/seasons/23768 (FA Cup 2024/25)
// ============================================
// Returns all stages for a season with their fixtures
// Ideal for cup competitions (FA Cup, Carabao Cup)
// Each stage contains its fixtures with teams, scores, and venues

router.get('/seasons/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    // Validate: seasonId must be a number
    if (isNaN(seasonId)) {
      return res.status(400).json({
        error: 'Season ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    // This uses /stages/seasons/{seasonId} with fixtures include
    const result = await getStagesBySeason(seasonId);
    
    // The response.data is an array of stages
    // Each stage has: id, name, sort_order, finished, is_current, starting_at, ending_at, fixtures[]
    const stages = result.data || [];
    
    // Count total fixtures across all stages
    const totalFixtures = stages.reduce((total, stage) => {
      return total + (stage.fixtures?.length || 0);
    }, 0);
    
    // Return the stages with fixtures
    // NOTE: Frontend expects "rounds" key for backward compatibility
    res.json({
      seasonId: parseInt(seasonId),
      totalStages: stages.length,
      totalFixtures: totalFixtures,
      stages: stages
    });
    
  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({ 
      error: 'Failed to get stages',
      details: error.message 
    });
  }
});

// ============================================
// GET PREDICTIONS FOR A FIXTURE
// GET /fixtures/:id/predictions
// Example: GET /fixtures/19427635/predictions
// ============================================
// Returns AI-generated predictions for betting research
// Includes: Match result, BTTS, Over/Under, Corners, Correct Score, etc.

router.get('/:id/predictions', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(fixtureId)) {
      return res.status(400).json({
        error: 'Fixture ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getFixturePredictions(fixtureId);
    
    // Check if fixture was found
    if (!result.data) {
      return res.status(404).json({
        error: `Fixture with ID ${fixtureId} not found`
      });
    }
    
    // Extract predictions from the response
    const predictions = result.data.predictions || [];
    
    // Return the predictions
    res.json({
      fixtureId: parseInt(fixtureId),
      fixtureName: result.data.name,
      startingAt: result.data.starting_at,
      predictionsCount: predictions.length,
      predictions: predictions
    });
    
  } catch (error) {
    console.error('Get predictions error:', error);
    res.status(500).json({ 
      error: 'Failed to get predictions',
      details: error.message 
    });
  }
});

// ============================================
// GET SINGLE FIXTURE BY ID
// GET /fixtures/:id
// Example: GET /fixtures/18535517
// ============================================
// NOTE: This route MUST come LAST to avoid catching other routes

router.get('/:id', async (req, res) => {
  try {
    const fixtureId = req.params.id;
    
    // Parse optional includes from query string
    const options = parseIncludeOptions(req.query);
    
    // Validate: ID must be a number
    if (isNaN(fixtureId)) {
      return res.status(400).json({
        error: 'Fixture ID must be a number'
      });
    }
    
    // Call the SportsMonks service with options
    const result = await getFixtureById(fixtureId, options);
    
    // Check if fixture was found
    if (!result.data) {
      return res.status(404).json({
        error: `Fixture with ID ${fixtureId} not found`
      });
    }
    
    // ============================================
    // ENRICH WITH TYPE NAMES
    // ============================================
    // Add human-readable type names to:
    // - statistics (e.g., type_id: 34 → typeName: "Corners")
    // - events (e.g., type_id: 14 → typeName: "Goal")
    // - sidelined (e.g., type_id: 535 → typeName: "Hamstring Injury")
    // This uses our local database cache instead of extra API calls.
    await enrichFixtureWithTypes(result.data);
    
    // Return the fixture
    res.json({
      includes: {
        odds: options.includeOdds,
        sidelined: options.includeSidelined
      },
      fixture: result.data
    });
    
  } catch (error) {
    console.error('Get fixture error:', error);
    res.status(500).json({ 
      error: 'Failed to get fixture',
      details: error.message 
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
