// ============================================
// AUTH MIDDLEWARE
// ============================================
// This middleware protects routes by verifying JWT tokens.
// If the token is valid, it adds the userId to the request.
// If not, it rejects the request with a 401 error.
// ============================================

import jwt from 'jsonwebtoken';

// ============================================
// THE MIDDLEWARE FUNCTION
// ============================================
// Express middleware functions receive 3 parameters:
//   - req: the incoming request object
//   - res: the response object (to send errors)
//   - next: a function to call the next middleware/route
// ============================================

const authMiddleware = (req, res, next) => {
  
  // -----------------------------------------
  // STEP 1: Get the Authorization header
  // -----------------------------------------
  // Headers are accessed via req.headers
  // We use lowercase 'authorization' (Express normalizes header names)
  
  const authHeader = req.headers.authorization;

  // -----------------------------------------
  // STEP 2: Check if the header exists
  // -----------------------------------------
  // If there's no Authorization header, the user didn't send a token
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Access denied. No token provided.'
    });
  }

  // -----------------------------------------
  // STEP 3: Extract the token from the header
  // -----------------------------------------
  // The header format is: "Bearer <token>"
  // We split by space and take the second part (index 1)
  
  const parts = authHeader.split(' ');
  
  // Validate the format: should be exactly 2 parts, first part should be "Bearer"
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'Access denied. Invalid token format. Use: Bearer <token>'
    });
  }

  const token = parts[1]; // This is the actual JWT token

  // -----------------------------------------
  // STEP 4: Verify the token
  // -----------------------------------------
  // jwt.verify() checks:
  //   - Is the token properly signed with our secret?
  //   - Has the token expired?
  // If either fails, it throws an error
  
  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // -----------------------------------------
    // STEP 5: Attach user info to the request
    // -----------------------------------------
    // The decoded token contains { userId: '...' } (what we put in during login)
    // We attach this to req.user so route handlers can access it
    
    req.user = {
      userId: decoded.userId
    };

    // -----------------------------------------
    // STEP 6: Call next() to continue
    // -----------------------------------------
    // This passes control to the next middleware or route handler
    
    next();

  } catch (error) {
    // Token verification failed (invalid signature or expired)
    console.error('Token verification failed:', error.message);
    
    return res.status(401).json({
      error: 'Access denied. Invalid or expired token.'
    });
  }
};

// ============================================
// EXPORT THE MIDDLEWARE
// ============================================
// We export as default so it can be imported as:
// import authMiddleware from './middleware/auth.js'

export default authMiddleware;
