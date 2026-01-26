// ============================================
// RESET PASSWORD PAGE
// ============================================
// Allows users to set a new password using a reset token.
// The token comes from either:
// - The email reset link (?token=xxx in URL)
// - Successful security question verification
// ============================================

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // -----------------------------------------
  // STATE
  // -----------------------------------------
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // -----------------------------------------
  // GET TOKEN FROM URL
  // -----------------------------------------
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError('No reset token provided. Please request a new password reset link.');
    }
  }, [searchParams]);

  // -----------------------------------------
  // HANDLER
  // -----------------------------------------
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------
  // RENDER: SUCCESS
  // -----------------------------------------
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-700 py-12 px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            Password Reset Successful!
          </h1>
          <p className="text-gray-400 mb-6">
            Your password has been updated. You can now log in with your new password.
          </p>
          <Link
            to="/login"
            className="inline-block bg-amber-500 text-gray-900 py-2 px-6 rounded-md hover:bg-amber-600"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // -----------------------------------------
  // RENDER: FORM
  // -----------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-700 py-12 px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-gray-100 mb-2">
          Reset Your Password
        </h1>
        <p className="text-center text-gray-400 mb-6">
          Enter your new password below.
        </p>

        {error && (
          <div className="bg-red-900/30 text-red-400 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        {/* No token error - show link to request new one */}
        {!token ? (
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-amber-500 hover:underline"
            >
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                placeholder="Confirm your new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-gray-900 py-2 px-4 rounded-md hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          <Link to="/login" className="text-amber-500 hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
