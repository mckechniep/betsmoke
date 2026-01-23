// ============================================
// AUTH ROUTES
// ============================================
// Handles user authentication and account management:
// - Registration & Login
// - User profile & preferences
// - Password & email changes
// - Account recovery (email + security question)
// ============================================

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';

const router = express.Router();

// ============================================
// CONSTANTS
// ============================================

const SALT_ROUNDS = 10;                    // bcrypt salt rounds
const RESET_TOKEN_EXPIRY_HOURS = 1;        // Password reset token valid for 1 hour
const VALID_ODDS_FORMATS = ['AMERICAN', 'DECIMAL', 'FRACTIONAL'];
const VALID_DATE_FORMATS = ['US', 'EU'];
const VALID_TEMPERATURE_UNITS = ['FAHRENHEIT', 'CELSIUS'];

// ============================================
// HELPER: Generate a secure random token
// ============================================
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ============================================
// HELPER: Hash a reset token (for secure storage)
// ============================================
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// ============================================
// HELPER: Sanitize user object (remove sensitive data)
// ============================================
const sanitizeUser = (user) => {
  return {
    id: user.id,
    email: user.email,
    oddsFormat: user.oddsFormat,
    timezone: user.timezone,
    dateFormat: user.dateFormat,
    temperatureUnit: user.temperatureUnit,
    hasSecurityQuestion: !!user.securityQuestion,
    isAdmin: user.isAdmin || false,
    createdAt: user.createdAt
  };
};

// ============================================
// REGISTER - Create a new user account
// POST /auth/register
// ============================================
// Body: {
//   email: string (required),
//   password: string (required),
//   oddsFormat: 'AMERICAN' | 'DECIMAL' | 'FRACTIONAL' (optional),
//   timezone: string (optional, IANA timezone),
//   securityQuestion: string (optional),
//   securityAnswer: string (optional, required if question provided)
// }
// ============================================

router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      oddsFormat,
      timezone,
      dateFormat,
      temperatureUnit,
      securityQuestion,
      securityAnswer
    } = req.body;

    // -----------------------------------------
    // VALIDATION
    // -----------------------------------------

    // Required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // Odds format validation (if provided)
    if (oddsFormat && !VALID_ODDS_FORMATS.includes(oddsFormat)) {
      return res.status(400).json({
        error: `Invalid odds format. Must be one of: ${VALID_ODDS_FORMATS.join(', ')}`
      });
    }

    // Date format validation (if provided)
    if (dateFormat && !VALID_DATE_FORMATS.includes(dateFormat)) {
      return res.status(400).json({
        error: `Invalid date format. Must be one of: ${VALID_DATE_FORMATS.join(', ')}`
      });
    }

    // Temperature unit validation (if provided)
    if (temperatureUnit && !VALID_TEMPERATURE_UNITS.includes(temperatureUnit)) {
      return res.status(400).json({
        error: `Invalid temperature unit. Must be one of: ${VALID_TEMPERATURE_UNITS.join(', ')}`
      });
    }

    // Security question requires an answer
    if (securityQuestion && !securityAnswer) {
      return res.status(400).json({
        error: 'Security answer is required when providing a security question'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Email already registered'
      });
    }

    // -----------------------------------------
    // CREATE USER
    // -----------------------------------------

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Hash security answer if provided
    let hashedSecurityAnswer = null;
    if (securityAnswer) {
      // Normalize answer: lowercase, trim whitespace
      const normalizedAnswer = securityAnswer.toLowerCase().trim();
      hashedSecurityAnswer = await bcrypt.hash(normalizedAnswer, SALT_ROUNDS);
    }

    // Build user data object
    const userData = {
      email,
      password: hashedPassword
    };

    // Add optional fields if provided
    if (oddsFormat) userData.oddsFormat = oddsFormat;
    if (timezone) userData.timezone = timezone;
    if (dateFormat) userData.dateFormat = dateFormat;
    if (temperatureUnit) userData.temperatureUnit = temperatureUnit;
    if (securityQuestion) userData.securityQuestion = securityQuestion;
    if (hashedSecurityAnswer) userData.securityAnswer = hashedSecurityAnswer;

    // Create the user
    const user = await prisma.user.create({ data: userData });

    // -----------------------------------------
    // RESPONSE
    // -----------------------------------------

    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// LOGIN - Authenticate and get a token
// POST /auth/login
// ============================================
// Body: { email, password }
// Returns: { token, user (with preferences) }
// ============================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and user info (including preferences)
    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// GET CURRENT USER (Protected)
// GET /auth/me
// ============================================
// Returns the currently authenticated user's profile
// ============================================

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(user) });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// UPDATE PREFERENCES (Protected)
// PATCH /auth/preferences
// ============================================
// Body: { oddsFormat?, timezone?, dateFormat?, temperatureUnit? }
// ============================================

router.patch('/preferences', authMiddleware, async (req, res) => {
  try {
    const { oddsFormat, timezone, dateFormat, temperatureUnit } = req.body;
    const updateData = {};

    // Validate and add odds format
    if (oddsFormat !== undefined) {
      if (!VALID_ODDS_FORMATS.includes(oddsFormat)) {
        return res.status(400).json({
          error: `Invalid odds format. Must be one of: ${VALID_ODDS_FORMATS.join(', ')}`
        });
      }
      updateData.oddsFormat = oddsFormat;
    }

    // Add timezone (we trust the frontend to send valid IANA timezones)
    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // Validate and add date format
    if (dateFormat !== undefined) {
      if (!VALID_DATE_FORMATS.includes(dateFormat)) {
        return res.status(400).json({
          error: `Invalid date format. Must be one of: ${VALID_DATE_FORMATS.join(', ')}`
        });
      }
      updateData.dateFormat = dateFormat;
    }

    // Validate and add temperature unit
    if (temperatureUnit !== undefined) {
      if (!VALID_TEMPERATURE_UNITS.includes(temperatureUnit)) {
        return res.status(400).json({
          error: `Invalid temperature unit. Must be one of: ${VALID_TEMPERATURE_UNITS.join(', ')}`
        });
      }
      updateData.temperatureUnit = temperatureUnit;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No preferences provided to update'
      });
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData
    });

    res.json({
      message: 'Preferences updated successfully',
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CHANGE EMAIL (Protected)
// PATCH /auth/email
// ============================================
// Body: { newEmail, password }
// Requires current password for security
// ============================================

router.patch('/email', authMiddleware, async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    // Validation
    if (!newEmail || !password) {
      return res.status(400).json({
        error: 'New email and current password are required'
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check if new email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Update email
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { email: newEmail }
    });

    res.json({
      message: 'Email updated successfully',
      user: sanitizeUser(updatedUser)
    });

  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CHANGE PASSWORD (Protected)
// PATCH /auth/password
// ============================================
// Body: { currentPassword, newPassword }
// ============================================

router.patch('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters'
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// SET/UPDATE SECURITY QUESTION (Protected)
// PATCH /auth/security-question
// ============================================
// Body: { securityQuestion, securityAnswer, password }
// Set to null/empty to remove security question
// ============================================

router.patch('/security-question', authMiddleware, async (req, res) => {
  try {
    const { securityQuestion, securityAnswer, password } = req.body;

    // Password required for this operation
    if (!password) {
      return res.status(400).json({
        error: 'Password is required to change security question'
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Prepare update data
    let updateData = {};

    if (!securityQuestion || !securityAnswer) {
      // Remove security question
      updateData = {
        securityQuestion: null,
        securityAnswer: null
      };
    } else {
      // Set/update security question
      const normalizedAnswer = securityAnswer.toLowerCase().trim();
      const hashedAnswer = await bcrypt.hash(normalizedAnswer, SALT_ROUNDS);
      
      updateData = {
        securityQuestion,
        securityAnswer: hashedAnswer
      };
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData
    });

    res.json({
      message: securityQuestion 
        ? 'Security question updated successfully' 
        : 'Security question removed',
      user: sanitizeUser(updatedUser)
    });

  } catch (error) {
    console.error('Update security question error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// FORGOT PASSWORD - Request reset email
// POST /auth/forgot-password
// ============================================
// Body: { email }
// Sends a password reset email if the account exists
// ============================================

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user (but don't reveal if account exists)
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Always return success message (to prevent email enumeration)
    const successMessage = 'If an account with that email exists, a password reset link has been sent.';

    if (!user) {
      // Don't reveal that account doesn't exist
      return res.json({ message: successMessage });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any existing reset tokens for this user
    await prisma.passwordReset.updateMany({
      where: { 
        userId: user.id,
        used: false
      },
      data: { used: true }
    });

    // Create new reset token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt
      }
    });

    // Send reset email
    const emailResult = await sendPasswordResetEmail(
      user.email,
      null, // We don't store names currently
      resetToken // Send the unhashed token in the email
    );

    if (!emailResult.success && !emailResult.devMode) {
      console.error('Failed to send reset email:', emailResult.error);
      // Still return success to prevent enumeration
    }

    res.json({ message: successMessage });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// RESET PASSWORD - Use token to set new password
// POST /auth/reset-password
// ============================================
// Body: { token, newPassword }
// ============================================

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Token and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = hashToken(token);

    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!resetRecord) {
      return res.status(400).json({
        error: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword }
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true }
      })
    ]);

    res.json({ message: 'Password reset successfully. You can now log in.' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// GET SECURITY QUESTION - For account recovery
// POST /auth/get-security-question
// ============================================
// Body: { email }
// Returns the security question if one is set
// ============================================

router.post('/get-security-question', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { securityQuestion: true }
    });

    if (!user || !user.securityQuestion) {
      return res.status(404).json({
        error: 'No security question found for this account'
      });
    }

    res.json({ securityQuestion: user.securityQuestion });

  } catch (error) {
    console.error('Get security question error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// VERIFY SECURITY QUESTION - Alternative recovery
// POST /auth/verify-security-answer
// ============================================
// Body: { email, securityAnswer }
// If correct, returns a reset token
// ============================================

router.post('/verify-security-answer', async (req, res) => {
  try {
    const { email, securityAnswer } = req.body;

    if (!email || !securityAnswer) {
      return res.status(400).json({
        error: 'Email and security answer are required'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.securityAnswer) {
      return res.status(400).json({
        error: 'Invalid email or security answer'
      });
    }

    // Normalize and verify answer
    const normalizedAnswer = securityAnswer.toLowerCase().trim();
    const answerMatch = await bcrypt.compare(normalizedAnswer, user.securityAnswer);

    if (!answerMatch) {
      return res.status(400).json({
        error: 'Invalid email or security answer'
      });
    }

    // Generate reset token (same as email flow)
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate existing tokens
    await prisma.passwordReset.updateMany({
      where: { 
        userId: user.id,
        used: false
      },
      data: { used: true }
    });

    // Create new reset token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt
      }
    });

    // Return the token directly (since they proved identity via security question)
    res.json({
      message: 'Security answer verified',
      resetToken
    });

  } catch (error) {
    console.error('Verify security answer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the router
export default router;
