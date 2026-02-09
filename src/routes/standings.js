// ============================================
// STANDINGS ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to league table data from SportsMonks.
// Shows team positions, points, wins, draws, losses, goal difference, form.
// ============================================

import express from 'express';
import { getStandingsBySeason } from '../services/sportsmonks.js';

// Import optional auth middleware - sets req.user if token present, but allows anonymous access
// Authenticated users get fresh data (skipCache), anonymous users get cached data
import { optionalAuthMiddleware } from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply optional auth to all routes - allows both authenticated and anonymous access
router.use(optionalAuthMiddleware);

// ============================================
// GET STANDINGS BY SEASON
// GET /standings/seasons/:seasonId
// Example: GET /standings/seasons/23614
// ============================================
// Returns the full league table for a specific season.
// Includes: team name, position, points, wins, draws, losses, form (W/D/L history)
//
// Known season IDs:
//   - 23614: Premier League 2024/25
//   - Use /teams/:id/seasons to find season IDs for a team

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
    const result = await getStandingsBySeason(seasonId, { skipCache: !!req.user });

    // Return the standings
    // Note: Some older seasons (e.g., 2005/2006) may not have standings data in SportsMonks
    res.json({
      message: `Standings for season ${seasonId}`,
      seasonId: parseInt(seasonId),
      standings: result.data || []
    });

  } catch (error) {
    console.error('Get standings by season error:', error);
    res.status(500).json({
      error: 'Failed to get standings',
      details: error.message
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
