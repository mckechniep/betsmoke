// ============================================
// ODDS ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to betting odds data from SportsMonks.
// Includes: pre-match odds, bookmakers, and markets.
// 
// NOTE: This is for RESEARCH purposes only.
// BetSmoke does NOT place bets or integrate with sportsbooks.
// ============================================

import express from 'express';
import {
  getOddsByFixture,
  getOddsByFixtureAndBookmaker,
  getOddsByFixtureAndMarket,
  getAllBookmakers,
  getBookmakerById,
  getAllMarkets,
  getMarketById,
  searchMarkets
} from '../services/sportsmonks.js';

// Import auth middleware - all routes require authentication
import authMiddleware from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// ============================================
// PRE-MATCH ODDS ROUTES
// ============================================

/**
 * GET /odds/fixtures/:fixtureId
 * Get all pre-match odds for a fixture
 * 
 * Example: GET /odds/fixtures/18535517
 * Returns odds from all bookmakers for all markets
 */
router.get('/fixtures/:fixtureId', async (req, res) => {
  try {
    const { fixtureId } = req.params;
    
    // Validate: ID must be a number
    if (isNaN(fixtureId)) {
      return res.status(400).json({
        error: 'Fixture ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getOddsByFixture(fixtureId);
    
    // Return the odds
    res.json({
      message: `Found ${result.data?.length || 0} odds for fixture ${fixtureId}`,
      fixtureId: parseInt(fixtureId),
      odds: result.data || []
    });
    
  } catch (error) {
    console.error('Get odds by fixture error:', error);
    res.status(500).json({ 
      error: 'Failed to get odds',
      details: error.message 
    });
  }
});

/**
 * GET /odds/fixtures/:fixtureId/bookmakers/:bookmakerId
 * Get odds for a fixture filtered by bookmaker
 * 
 * Example: GET /odds/fixtures/18535517/bookmakers/2
 * Returns only bet365 (id: 2) odds for the fixture
 */
router.get('/fixtures/:fixtureId/bookmakers/:bookmakerId', async (req, res) => {
  try {
    const { fixtureId, bookmakerId } = req.params;
    
    // Validate IDs
    if (isNaN(fixtureId)) {
      return res.status(400).json({
        error: 'Fixture ID must be a number'
      });
    }
    
    if (isNaN(bookmakerId)) {
      return res.status(400).json({
        error: 'Bookmaker ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getOddsByFixtureAndBookmaker(fixtureId, bookmakerId);
    
    // Return the odds
    res.json({
      message: `Found ${result.data?.length || 0} odds for fixture ${fixtureId} from bookmaker ${bookmakerId}`,
      fixtureId: parseInt(fixtureId),
      bookmakerId: parseInt(bookmakerId),
      odds: result.data || []
    });
    
  } catch (error) {
    console.error('Get odds by fixture and bookmaker error:', error);
    res.status(500).json({ 
      error: 'Failed to get odds',
      details: error.message 
    });
  }
});

/**
 * GET /odds/fixtures/:fixtureId/markets/:marketId
 * Get odds for a fixture filtered by market
 * 
 * Common market IDs:
 * - 1: Fulltime Result (1X2)
 * - 14: Both Teams To Score (BTTS)
 * - 18: Home Team Exact Goals
 * - 19: Away Team Exact Goals
 * - 44: Odd/Even
 * 
 * Example: GET /odds/fixtures/18535517/markets/1
 * Returns only Fulltime Result (1X2) odds
 */
router.get('/fixtures/:fixtureId/markets/:marketId', async (req, res) => {
  try {
    const { fixtureId, marketId } = req.params;
    
    // Validate IDs
    if (isNaN(fixtureId)) {
      return res.status(400).json({
        error: 'Fixture ID must be a number'
      });
    }
    
    if (isNaN(marketId)) {
      return res.status(400).json({
        error: 'Market ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getOddsByFixtureAndMarket(fixtureId, marketId);
    
    // Return the odds
    res.json({
      message: `Found ${result.data?.length || 0} odds for fixture ${fixtureId} in market ${marketId}`,
      fixtureId: parseInt(fixtureId),
      marketId: parseInt(marketId),
      odds: result.data || []
    });
    
  } catch (error) {
    console.error('Get odds by fixture and market error:', error);
    res.status(500).json({ 
      error: 'Failed to get odds',
      details: error.message 
    });
  }
});

// ============================================
// BOOKMAKER ROUTES
// ============================================

/**
 * GET /odds/bookmakers
 * Get all available bookmakers
 * 
 * Example: GET /odds/bookmakers
 * Returns list of all bookmakers (bet365, Betfair, etc.)
 */
router.get('/bookmakers', async (req, res) => {
  try {
    // Call the SportsMonks service
    const result = await getAllBookmakers();
    
    // Return the bookmakers
    res.json({
      message: `Found ${result.data?.length || 0} bookmakers`,
      bookmakers: result.data || []
    });
    
  } catch (error) {
    console.error('Get all bookmakers error:', error);
    res.status(500).json({ 
      error: 'Failed to get bookmakers',
      details: error.message 
    });
  }
});

/**
 * GET /odds/bookmakers/:id
 * Get a single bookmaker by ID
 * 
 * Example: GET /odds/bookmakers/2
 * Returns bet365 details
 */
router.get('/bookmakers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Bookmaker ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getBookmakerById(id);
    
    // Check if bookmaker was found
    if (!result.data) {
      return res.status(404).json({
        error: `Bookmaker with ID ${id} not found`
      });
    }
    
    // Return the bookmaker
    res.json({
      bookmaker: result.data
    });
    
  } catch (error) {
    console.error('Get bookmaker by ID error:', error);
    res.status(500).json({ 
      error: 'Failed to get bookmaker',
      details: error.message 
    });
  }
});

// ============================================
// MARKET ROUTES
// ============================================

/**
 * GET /odds/markets
 * Get all available betting markets
 * 
 * Example: GET /odds/markets
 * Returns list of all markets (Fulltime Result, BTTS, Over/Under, etc.)
 */
router.get('/markets', async (req, res) => {
  try {
    // Call the SportsMonks service
    const result = await getAllMarkets();
    
    // Return the markets
    res.json({
      message: `Found ${result.data?.length || 0} markets`,
      markets: result.data || []
    });
    
  } catch (error) {
    console.error('Get all markets error:', error);
    res.status(500).json({ 
      error: 'Failed to get markets',
      details: error.message 
    });
  }
});

/**
 * GET /odds/markets/search/:query
 * Search for markets by name
 * 
 * Example: GET /odds/markets/search/goals
 * Returns markets with "goals" in the name
 */
router.get('/markets/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    // Validate query
    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }
    
    // Call the SportsMonks service
    const result = await searchMarkets(query);
    
    // Return the markets
    res.json({
      message: `Found ${result.data?.length || 0} markets matching "${query}"`,
      query: query,
      markets: result.data || []
    });
    
  } catch (error) {
    console.error('Search markets error:', error);
    res.status(500).json({ 
      error: 'Failed to search markets',
      details: error.message 
    });
  }
});

/**
 * GET /odds/markets/:id
 * Get a single market by ID
 * 
 * Example: GET /odds/markets/1
 * Returns Fulltime Result market details
 */
router.get('/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (isNaN(id)) {
      return res.status(400).json({
        error: 'Market ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getMarketById(id);
    
    // Check if market was found
    if (!result.data) {
      return res.status(404).json({
        error: `Market with ID ${id} not found`
      });
    }
    
    // Return the market
    res.json({
      market: result.data
    });
    
  } catch (error) {
    console.error('Get market by ID error:', error);
    res.status(500).json({ 
      error: 'Failed to get market',
      details: error.message 
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
