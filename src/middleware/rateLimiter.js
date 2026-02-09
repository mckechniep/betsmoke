// ============================================
// RATE LIMITER MIDDLEWARE
// ============================================
// Protects the API from abuse using express-rate-limit.
// Five tiers based on endpoint sensitivity:
//   - globalLimiter: Baseline for all routes
//   - authLimiter: Tight limit on login/register (brute force prevention)
//   - dataLimiter: Moderate limit on SportsMonks data routes
//   - livescoresLimiter: Generous limit for frequently-polled live data
//   - adminLimiter: Tight limit on admin operations
//
// Returns standard RateLimit-* headers and 429 JSON on limit exceeded.
// ============================================

import rateLimit from 'express-rate-limit';

// ============================================
// LIMITER FACTORY
// ============================================
// Helper to create limiters with consistent error response format

const createLimiter = (windowMs, max, name) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return RateLimit-* headers
    legacyHeaders: false,    // Disable X-RateLimit-* headers
    message: {
      error: `Rate limit exceeded. You can make ${max} requests per ${Math.round(windowMs / 60000)} minute(s). Please try again later.`
    },
    handler: (req, res, next, options) => {
      console.log(`[RateLimit] ${name}: Limit exceeded for ${req.ip} on ${req.originalUrl}`);
      res.status(429).json(options.message);
    }
  });
};

// ============================================
// LIMITER TIERS
// ============================================

// Global baseline - applies to ALL routes
// 300 requests per 15 minutes
const globalLimiter = createLimiter(
  15 * 60 * 1000,   // 15 minutes
  300,               // 300 requests
  'global'
);

// Auth limiter - tight limit on login/register to prevent brute force
// 15 requests per 15 minutes
const authLimiter = createLimiter(
  15 * 60 * 1000,   // 15 minutes
  15,                // 15 requests
  'auth'
);

// Data limiter - moderate limit on SportsMonks proxy routes
// 200 requests per 15 minutes
const dataLimiter = createLimiter(
  15 * 60 * 1000,   // 15 minutes
  200,               // 200 requests
  'data'
);

// Livescores limiter - generous limit since users poll frequently
// 30 requests per 1 minute
const livescoresLimiter = createLimiter(
  1 * 60 * 1000,    // 1 minute
  30,                // 30 requests
  'livescores'
);

// ============================================
// EXPORTS
// ============================================

export {
  globalLimiter,
  authLimiter,
  dataLimiter,
  livescoresLimiter
};
