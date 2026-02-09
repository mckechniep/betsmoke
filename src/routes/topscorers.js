// ============================================
// TOP SCORERS ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to top scorer leaderboards from SportsMonks.
// Returns player rankings by goals scored for a given season.
// ============================================

import express from 'express';
import { getTopScorersBySeason } from '../services/sportsmonks.js';

// Import optional auth middleware - sets req.user if token present, but allows anonymous access
// Authenticated users get fresh data (skipCache), anonymous users get cached data
import { optionalAuthMiddleware } from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply optional auth to all routes - allows both authenticated and anonymous access
router.use(optionalAuthMiddleware);

// ============================================
// GET TOP SCORERS BY SEASON
// GET /topscorers/seasons/:seasonId
// Example: GET /topscorers/seasons/23614
// ============================================
// Returns the top scorer leaderboard for a specific season.
// Includes: player name, team, goals scored
//
// Known season IDs:
//   - 23614: Premier League 2024/25
//   - Use /seasons/leagues/:leagueId to find season IDs

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
    const result = await getTopScorersBySeason(seasonId, { skipCache: !!req.user });

    const scorers = result.data || [];

    // Return the top scorers
    res.json({
      message: `Found ${scorers.length} top scorers for season ${seasonId}`,
      seasonId: parseInt(seasonId),
      count: scorers.length,
      topscorers: scorers
    });

  } catch (error) {
    console.error('Get top scorers error:', error);
    res.status(500).json({
      error: 'Failed to get top scorers',
      details: error.message
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
