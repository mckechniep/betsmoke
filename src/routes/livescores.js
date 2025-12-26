// ============================================
// LIVE SCORES ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to live match data from SportsMonks.
// Only returns matches from our subscribed leagues:
//   - Premier League (8)
//   - FA Cup (24)
//   - Carabao Cup (27)
// ============================================

import express from 'express';
import {
  getLivescores,
  getLivescoresInplay
} from '../services/sportsmonks.js';

// Create a router
const router = express.Router();

// ============================================
// GET ALL LIVE SCORES
// GET /livescores
// Example: GET /livescores
// ============================================
// Returns all matches that are live or about to start today.
// Includes: teams, current score, league info

router.get('/', async (req, res) => {
  try {
    // Call the SportsMonks service
    const result = await getLivescores();

    const fixtures = result.data || [];

    // Return the live scores
    res.json({
      message: `Found ${fixtures.length} live/upcoming fixtures`,
      count: fixtures.length,
      fixtures: fixtures
    });

  } catch (error) {
    console.error('Get live scores error:', error);
    res.status(500).json({
      error: 'Failed to get live scores',
      details: error.message
    });
  }
});

// ============================================
// GET IN-PLAY MATCHES ONLY
// GET /livescores/inplay
// Example: GET /livescores/inplay
// ============================================
// Returns only matches that are currently being played.
// Includes: teams, current score, league info, match events (goals, cards)

router.get('/inplay', async (req, res) => {
  try {
    // Call the SportsMonks service
    const result = await getLivescoresInplay();

    const fixtures = result.data || [];

    // Return the in-play fixtures
    res.json({
      message: `Found ${fixtures.length} matches currently in play`,
      count: fixtures.length,
      fixtures: fixtures
    });

  } catch (error) {
    console.error('Get in-play scores error:', error);
    res.status(500).json({
      error: 'Failed to get in-play scores',
      details: error.message
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
