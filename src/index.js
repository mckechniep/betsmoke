// ============================================
// IMPORTS (ES6 syntax)
// ============================================

import express from 'express';     // Web framework
import cors from 'cors';           // Allows frontend to talk to backend
import dotenv from 'dotenv';       // Loads .env variables
import prisma from './db.js';     // Database client

import authRoutes from './routes/auth.js';  // Authentication routes
import notesRoutes from './routes/notes.js';  // Notes CRUD routes
import teamsRoutes from './routes/teams.js';  // SportsMonks team data
import fixturesRoutes from './routes/fixtures.js';  // SportsMonks fixture data
import playersRoutes from './routes/players.js';  // SportsMonks player data
import oddsRoutes from './routes/odds.js';  // SportsMonks odds data
import standingsRoutes from './routes/standings.js';  // SportsMonks standings data
import livescoresRoutes from './routes/livescores.js';  // SportsMonks live scores
import leaguesRoutes from './routes/leagues.js';  // SportsMonks leagues data
import seasonsRoutes from './routes/seasons.js';  // SportsMonks seasons data
import topscorersRoutes from './routes/topscorers.js';  // SportsMonks top scorers
import predictionsRoutes from './routes/predictions.js';  // SportsMonks predictions
import authMiddleware, { adminMiddleware } from './middleware/auth.js';  // Protects routes
import { loadTypesCache, getCacheStatus, syncTypesFromAPI } from './services/types.js';  // Types cache

// ============================================
// CONFIGURATION
// ============================================

// Load environment variables from .env file
dotenv.config();

// Create the Express app
const app = express();

// Define the port (use .env value or default to 3001)
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Parse JSON request bodies (so we can read req.body)
app.use(express.json());

// Enable CORS (so React frontend can call this API)
app.use(cors());

// ============================================
// ROUTES
// ============================================

// Health check route - confirms the server is running
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'BetSmoke API is running',
    timestamp: new Date().toISOString()
  });
});

// Database check route - confirms we can reach Postgres
app.get('/db-health', async (req, res) => {
  try {
    // Try to count users (will be 0, but proves connection works)
    const userCount = await prisma.user.count();
    res.json({ 
      status: 'ok', 
      message: 'Database connected',
      userCount: userCount
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Authentication routes (public - no middleware needed)
app.use('/auth', authRoutes);

// Notes routes (protected - all routes require valid token)
// By putting authMiddleware here, ALL /notes/* routes are protected
app.use('/notes', authMiddleware, notesRoutes);

// Teams routes (public - SportsMonks data proxy)
// These don't require auth since they're just fetching public football data
app.use('/teams', teamsRoutes);

// Fixtures routes (public - SportsMonks data proxy)
// Access match data: by ID, by date, by date range, by team+date range
app.use('/fixtures', fixturesRoutes);

// Players routes (public - SportsMonks data proxy)
// Search players, get player details
app.use('/players', playersRoutes);

// Odds routes (public - SportsMonks data proxy)
// Pre-match odds, bookmakers, betting markets
app.use('/odds', oddsRoutes);

// Standings routes (public - SportsMonks data proxy)
// League tables by season or league, live standings
app.use('/standings', standingsRoutes);

// Live scores routes (public - SportsMonks data proxy)
// Real-time match scores for our subscribed leagues
app.use('/livescores', livescoresRoutes);

// Leagues routes (public - SportsMonks data proxy)
// List and search competitions
app.use('/leagues', leaguesRoutes);

// Seasons routes (public - SportsMonks data proxy)
// Navigate historical data by season
app.use('/seasons', seasonsRoutes);

// Top scorers routes (public - SportsMonks data proxy)
// Player leaderboards by season
app.use('/topscorers', topscorersRoutes);

// Predictions routes (public - SportsMonks data proxy)
// AI prediction model performance/accuracy by league
app.use('/predictions', predictionsRoutes);

// ============================================
// PROTECTED TEST ROUTE
// ============================================
// This route requires a valid JWT token to access.
// We use authMiddleware as the second argument.
// If the token is valid, req.user will contain { userId: '...' }

app.get('/me', authMiddleware, async (req, res) => {
  try {
    // req.user.userId was set by the authMiddleware
    const userId = req.user.userId;

    // Fetch the user from the database (without the password!)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true
        // Note: we do NOT select password
      }
    });

    // If user not found (shouldn't happen if token is valid)
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the user info
    res.json({
      message: 'Token is valid! Here is your profile:',
      user: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// TYPES CACHE STATUS ROUTE
// ============================================
// Check the status of the SportsMonks types cache

app.get('/types/status', async (req, res) => {
  try {
    const status = await getCacheStatus();
    res.json({
      status: 'ok',
      cache: status
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get cache status',
      error: error.message
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================
// These routes require both authentication AND admin privileges.
// Use: authMiddleware (verify JWT) -> adminMiddleware (verify isAdmin)

// POST /admin/types/sync - Sync types from SportsMonks API
// Fetches latest types and updates our local database
app.post('/admin/types/sync', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    console.log('[Admin] Types sync requested');

    const result = await syncTypesFromAPI();

    res.json({
      status: 'ok',
      message: 'Types synced successfully',
      result
    });
  } catch (error) {
    console.error('[Admin] Types sync failed:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync types',
      error: error.message
    });
  }
});

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
  try {
    // Pre-load the SportsMonks types cache
    // This ensures fast type lookups from the first request
    console.log('Loading SportsMonks types cache...');
    await loadTypesCache();

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`BetSmoke API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Types cache: http://localhost:${PORT}/types/status`);
      console.log(`Teams search: http://localhost:${PORT}/teams/search/{query}`);
      console.log(`Fixtures by date: http://localhost:${PORT}/fixtures/date/{YYYY-MM-DD}`);
      console.log(`Standings: http://localhost:${PORT}/standings/seasons/{seasonId}`);
      console.log(`Live scores: http://localhost:${PORT}/livescores`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();