// ============================================
// PLAYERS ROUTES (SportsMonks Integration)
// ============================================
// These routes provide access to player data from SportsMonks.
// ============================================

import express from 'express';
import { searchPlayers, getPlayerById } from '../services/sportsmonks.js';

// Import auth middleware - all routes require authentication
import authMiddleware from '../middleware/auth.js';

// Create a router
const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// ============================================
// SEARCH PLAYERS BY NAME
// GET /players/search/:query
// Example: GET /players/search/Salah
// ============================================
// Searches for players by name - useful for finding player IDs

router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    
    // Validate: query must be at least 2 characters
    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }
    
    // Call the SportsMonks service
    const result = await searchPlayers(searchQuery);
    
    // Return the players
    res.json({
      message: `Found ${result.data?.length || 0} players matching "${searchQuery}"`,
      query: searchQuery,
      players: result.data || []
    });
    
  } catch (error) {
    console.error('Player search error:', error);
    res.status(500).json({ 
      error: 'Failed to search players',
      details: error.message 
    });
  }
});

// ============================================
// GET SINGLE PLAYER BY ID
// GET /players/:id
// Example: GET /players/12345
// ============================================
// Returns detailed player info including stats
// NOTE: This route MUST come AFTER /search to avoid conflicts

router.get('/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    
    // Validate: ID must be a number
    if (isNaN(playerId)) {
      return res.status(400).json({
        error: 'Player ID must be a number'
      });
    }
    
    // Call the SportsMonks service
    const result = await getPlayerById(playerId);
    
    // Check if player was found
    if (!result.data) {
      return res.status(404).json({
        error: `Player with ID ${playerId} not found`
      });
    }
    
    // Return the player
    res.json({
      player: result.data
    });
    
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ 
      error: 'Failed to get player',
      details: error.message 
    });
  }
});

// ============================================
// EXPORT THE ROUTER
// ============================================

export default router;
