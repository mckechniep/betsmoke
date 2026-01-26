// ============================================
// LEAGUES ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to league/competition data from SportsMonks.
// Our subscription covers:
//   - Premier League (8)
//   - FA Cup (24)
//   - Carabao Cup (27)
// ============================================

import express from 'express';
import {
  getAllLeagues,
  getLeagueById,
  searchLeagues
} from '../services/sportsmonks.js';

// Import auth middleware - all routes require authentication
import authMiddleware from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// ============================================
// GET ALL LEAGUES
// GET /leagues
// Example: GET /leagues
// ============================================
// Returns all leagues available in our subscription.
// Includes: country info, current season

router.get('/', async (req, res) => {
  try {
    // Call the SportsMonks service
    const result = await getAllLeagues();

    const leagues = result.data || [];

    // Return the leagues
    res.json({
      message: `Found ${leagues.length} leagues`,
      count: leagues.length,
      leagues: leagues
    });

  } catch (error) {
    console.error('Get all leagues error:', error);
    res.status(500).json({
      error: 'Failed to get leagues',
      details: error.message
    });
  }
});

// ============================================
// SEARCH LEAGUES
// GET /leagues/search/:query
// Example: GET /leagues/search/Premier
// ============================================
// Search for leagues by name.
// Note: This must come BEFORE /:id route

router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    // Validate: query must be at least 2 characters
    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    // Call the SportsMonks service
    const result = await searchLeagues(query);

    const leagues = result.data || [];

    // Return the leagues
    res.json({
      message: `Found ${leagues.length} leagues matching "${query}"`,
      query: query,
      count: leagues.length,
      leagues: leagues
    });

  } catch (error) {
    console.error('Search leagues error:', error);
    res.status(500).json({
      error: 'Failed to search leagues',
      details: error.message
    });
  }
});

// ============================================
// GET LEAGUE BY ID
// GET /leagues/:id
// Example: GET /leagues/8
// ============================================
// Get details for a specific league.
// Includes: country, current season, all seasons
//
// Known IDs:
//   - 8: Premier League
//   - 24: FA Cup
//   - 27: Carabao Cup

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate: id must be a number
    if (isNaN(id)) {
      return res.status(400).json({
        error: 'League ID must be a number'
      });
    }

    // Call the SportsMonks service
    const result = await getLeagueById(id);

    // Check if league was found
    if (!result.data) {
      return res.status(404).json({
        error: `League with ID ${id} not found`
      });
    }

    // Return the league
    res.json({
      league: result.data
    });

  } catch (error) {
    console.error('Get league by ID error:', error);
    res.status(500).json({
      error: 'Failed to get league',
      details: error.message
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
