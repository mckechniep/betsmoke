// ============================================
// AUTH ROUTES
// ============================================
// Handles user registration and login
// ============================================

import express from 'express'; // imports Express so we can create a router for auth endpoints
import bcrypt from 'bcrypt'; // imports bcrypt for hashing passwords
import jwt from 'jsonwebtoken'; // imports jwt for creating and verifying JSON Web Tokens
import prisma from '../db.js'; // imports the Prisma client to access database operations

// Create a router (a mini Express app for just these routes)
const router = express.Router();

// ROUTES

// ============================================
// REGISTER - Create a new user account
// POST /auth/register
// Body: { email, password }
// ============================================

router.post('/register', async (req, res) => {
    try {
        // 1. Get email and password from the request body
        const { email, password } = req.body;

        // 2. Validate input (basic checks)
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }
    
        // 3. Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Email aready registered'
            });
        }

        // 4. Hash the password (never store plain text passwords)
        const saltRounds = 10; // number of salt rounds for bcrypt, higher = more secure but slower
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 5. Create the user in the database
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword
            }
        });

        // 6. Return a success message (don't send password back)
        res.status(201).json({
            message: 'User registered successfully',
            user: { 
                id: user.id, 
                email: user.email 
            }
        });
    
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// LOGIN - Authenticate and get a token
// POST /auth/login
// Body: { email, password }
// ============================================

router.post('/login', async (req, res) => {
  try {
    // 1. Get email and password from request body
    const { email, password } = req.body;

    // 2. Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // 3. Find the user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // 4. Compare the password with the stored hash
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // 5. Create a JWT token
    const token = jwt.sign(
      { userId: user.id },           // Payload: data stored in the token
      process.env.JWT_SECRET,        // Secret key to sign the token
      { expiresIn: '7d' }            // Token expires in 7 days
    );

    // 6. Return the token
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the router
export default router;