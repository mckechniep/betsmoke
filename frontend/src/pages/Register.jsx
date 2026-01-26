// ============================================
// REGISTER PAGE
// ============================================
// User registration with optional preferences:
// - Odds format (American/Decimal/Fractional)
// - Timezone (auto-detected from browser)
// - Security question (for backup account recovery)
// ============================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ============================================
// SECURITY QUESTION OPTIONS
// ============================================
const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was your childhood nickname?",
  "What is the name of your favorite sports team?",
  "What was the make of your first car?",
  "What is your favorite movie?",
];

// ============================================
// REGISTER COMPONENT
// ============================================

const Register = () => {
  const { register, login, getBrowserTimezone } = useAuth();
  const navigate = useNavigate();

  // -----------------------------------------
  // FORM STATE
  // -----------------------------------------
  
  // Required fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Optional preferences
  const [showPreferences, setShowPreferences] = useState(false);
  const [oddsFormat, setOddsFormat] = useState('AMERICAN');
  const [timezone, setTimezone] = useState('');
  const [dateFormat, setDateFormat] = useState('US');
  const [temperatureUnit, setTemperatureUnit] = useState('FAHRENHEIT');
  const [timezoneOptions, setTimezoneOptions] = useState([]);
  
  // Optional security question
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // -----------------------------------------
  // INITIALIZE TIMEZONE OPTIONS
  // -----------------------------------------
  useEffect(() => {
    // Get browser's timezone as default
    const browserTz = getBrowserTimezone();
    setTimezone(browserTz);
    
    // Get list of supported timezones
    try {
      const tzList = Intl.supportedValuesOf('timeZone');
      setTimezoneOptions(tzList);
    } catch {
      // Fallback for older browsers
      setTimezoneOptions([
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
      ]);
    }
  }, [getBrowserTimezone]);

  // -----------------------------------------
  // FORM SUBMISSION
  // -----------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate security question has answer if question is selected
    if (showSecurityQuestion && securityQuestion && !securityAnswer.trim()) {
      setError('Please provide an answer for your security question');
      return;
    }

    setLoading(true);

    try {
      // Build options object
      const options = {
        oddsFormat,
        timezone,
        dateFormat,
        temperatureUnit,
      };

      // Add security question if provided
      if (showSecurityQuestion && securityQuestion && securityAnswer) {
        options.securityQuestion = securityQuestion;
        options.securityAnswer = securityAnswer;
      }

      // Step 1: Register the user
      await register(email, password, options);
      
      // Step 2: Automatically log them in
      await login(email, password);
      
      // Step 3: Navigate to home
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
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
        <h1 className="text-2xl font-bold text-center text-gray-100 mb-6">
          Create Account
        </h1>

        {error && (
          <div className="bg-red-900/30 text-red-400 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ============================================ */}
          {/* REQUIRED FIELDS */}
          {/* ============================================ */}
          
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
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

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
              placeholder="At least 6 characters"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
              placeholder="Confirm your password"
            />
          </div>

          {/* ============================================ */}
          {/* OPTIONAL: PREFERENCES */}
          {/* ============================================ */}
          
          <div className="border-t pt-4 mt-4">
            <button
              type="button"
              onClick={() => setShowPreferences(!showPreferences)}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-300 hover:text-gray-100"
            >
              <span>⚙️ Display Preferences (Optional)</span>
              <span className="text-gray-400">{showPreferences ? '▲' : '▼'}</span>
            </button>

            {showPreferences && (
              <div className="mt-4 space-y-4 pl-2 border-l-2 border-gray-700">
                {/* Odds Format */}
                <div>
                  <label htmlFor="oddsFormat" className="block text-sm font-medium text-gray-300 mb-1">
                    Odds Format
                  </label>
                  <select
                    id="oddsFormat"
                    value={oddsFormat}
                    onChange={(e) => setOddsFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                  >
                    <option value="AMERICAN">American (+150, -110)</option>
                    <option value="DECIMAL">Decimal (2.50, 1.91)</option>
                    <option value="FRACTIONAL">Fractional (3/2, 10/11)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    How betting odds are displayed throughout the app
                  </p>
                </div>

                {/* Timezone */}
                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-300 mb-1">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                  >
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Match times will be shown in this timezone (detected: {getBrowserTimezone()})
                  </p>
                </div>

                {/* Date Format */}
                <div>
                  <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-300 mb-1">
                    Date Format
                  </label>
                  <select
                    id="dateFormat"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                  >
                    <option value="US">US (January 25, 2026)</option>
                    <option value="EU">European (25 January 2026)</option>
                  </select>
                </div>

                {/* Temperature Unit */}
                <div>
                  <label htmlFor="temperatureUnit" className="block text-sm font-medium text-gray-300 mb-1">
                    Temperature Unit
                  </label>
                  <select
                    id="temperatureUnit"
                    value={temperatureUnit}
                    onChange={(e) => setTemperatureUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                  >
                    <option value="FAHRENHEIT">Fahrenheit (°F)</option>
                    <option value="CELSIUS">Celsius (°C)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* OPTIONAL: SECURITY QUESTION */}
          {/* ============================================ */}
          
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowSecurityQuestion(!showSecurityQuestion)}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-300 hover:text-gray-100"
            >
              <span>🔐 Security Question (Optional)</span>
              <span className="text-gray-400">{showSecurityQuestion ? '▲' : '▼'}</span>
            </button>

            {showSecurityQuestion && (
              <div className="mt-4 space-y-4 pl-2 border-l-2 border-gray-700">
                <p className="text-xs text-gray-400">
                  Set a security question for backup account recovery if you can't access your email.
                </p>

                {/* Security Question */}
                <div>
                  <label htmlFor="securityQuestion" className="block text-sm font-medium text-gray-300 mb-1">
                    Security Question
                  </label>
                  <select
                    id="securityQuestion"
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                  >
                    <option value="">Select a question...</option>
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                {/* Security Answer */}
                {securityQuestion && (
                  <div>
                    <label htmlFor="securityAnswer" className="block text-sm font-medium text-gray-300 mb-1">
                      Your Answer
                    </label>
                    <input
                      type="text"
                      id="securityAnswer"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-700 text-gray-100"
                      placeholder="Your answer (case-insensitive)"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Remember this answer! It will be used to recover your account.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* SUBMIT BUTTON */}
          {/* ============================================ */}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 text-gray-900 py-2 px-4 rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-500 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
