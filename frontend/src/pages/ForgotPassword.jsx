// ============================================
// FORGOT PASSWORD PAGE
// ============================================
// Allows users to request a password reset.
// Two recovery options:
// 1. Email-based: Sends a reset link to their email
// 2. Security question: If they have one set up
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // -----------------------------------------
  // STATE
  // -----------------------------------------
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Security question flow
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [resetToken, setResetToken] = useState('');

  // -----------------------------------------
  // HANDLERS
  // -----------------------------------------

  // Request password reset email
  const handleEmailReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess('If an account with that email exists, a password reset link has been sent. Check your inbox!');
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // Try to get security question
  const handleTrySecurityQuestion = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authApi.getSecurityQuestion(email);
      setSecurityQuestion(response.securityQuestion);
      setShowSecurityQuestion(true);
    } catch (err) {
      setError(err.message || 'No security question found for this account');
    } finally {
      setLoading(false);
    }
  };

  // Verify security answer
  const handleVerifySecurityAnswer = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.verifySecurityAnswer(email, securityAnswer);
      setResetToken(response.resetToken);
      // Navigate to reset password page with the token
      navigate(`/reset-password?token=${response.resetToken}`);
    } catch (err) {
      setError(err.message || 'Incorrect answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------
  // RENDER
  // -----------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-700 py-12 px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-gray-100 mb-2">
          Forgot Password
        </h1>
        <p className="text-center text-gray-400 mb-6">
          {showSecurityQuestion 
            ? 'Answer your security question to reset your password.'
            : 'Enter your email to receive a password reset link.'}
        </p>

        {error && (
          <div className="bg-red-900/30 text-red-400 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/30 text-green-400 p-3 rounded-md mb-4 text-sm">
            {success}
          </div>
        )}

        {/* ============================================ */}
        {/* EMAIL RESET FORM */}
        {/* ============================================ */}
        {!showSecurityQuestion && !success && (
          <form onSubmit={handleEmailReset} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-gray-900 py-2 px-4 rounded-md hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            {/* Alternative: Security Question */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-400 mb-2">
                Can't access your email?
              </p>
              <button
                type="button"
                onClick={handleTrySecurityQuestion}
                disabled={loading}
                className="text-amber-500 hover:underline text-sm"
              >
                Try Security Question Instead
              </button>
            </div>
          </form>
        )}

        {/* ============================================ */}
        {/* SECURITY QUESTION FORM */}
        {/* ============================================ */}
        {showSecurityQuestion && !resetToken && (
          <form onSubmit={handleVerifySecurityAnswer} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Security Question
              </label>
              <p className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300">
                {securityQuestion}
              </p>
            </div>

            <div>
              <label htmlFor="securityAnswer" className="block text-sm font-medium text-gray-300 mb-1">
                Your Answer
              </label>
              <input
                type="text"
                id="securityAnswer"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                placeholder="Enter your answer"
              />
              <p className="text-xs text-gray-400 mt-1">
                Answer is case-insensitive
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-gray-900 py-2 px-4 rounded-md hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify Answer'}
            </button>

            {/* Back to email option */}
            <button
              type="button"
              onClick={() => {
                setShowSecurityQuestion(false);
                setSecurityAnswer('');
                setError('');
              }}
              className="w-full text-gray-400 hover:text-gray-200 text-sm"
            >
              ← Back to email reset
            </button>
          </form>
        )}

        {/* ============================================ */}
        {/* BACK TO LOGIN */}
        {/* ============================================ */}
        <p className="mt-6 text-center text-sm text-gray-400">
          Remember your password?{' '}
          <Link to="/login" className="text-amber-500 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
