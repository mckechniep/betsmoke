// ============================================
// ACCOUNT SETTINGS PAGE
// ============================================
// Allows users to manage their account:
// - Display preferences (odds format, timezone)
// - Change email address
// - Change password
// - Manage security question
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
// ACCOUNT SETTINGS COMPONENT
// ============================================

const AccountSettings = () => {
  const { 
    user, 
    isAuthenticated, 
    updatePreferences, 
    changeEmail, 
    changePassword, 
    updateSecurityQuestion,
    getBrowserTimezone 
  } = useAuth();
  
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // -----------------------------------------
  // PREFERENCES STATE
  // -----------------------------------------
  const [oddsFormat, setOddsFormat] = useState(user?.oddsFormat || 'AMERICAN');
  const [timezone, setTimezone] = useState(user?.timezone || 'America/New_York');
  const [dateFormat, setDateFormat] = useState(user?.dateFormat || 'US');
  const [temperatureUnit, setTemperatureUnit] = useState(user?.temperatureUnit || 'FAHRENHEIT');
  const [timezoneOptions, setTimezoneOptions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSuccess, setPreferencesSuccess] = useState('');
  const [preferencesError, setPreferencesError] = useState('');

  // -----------------------------------------
  // EMAIL STATE
  // -----------------------------------------
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // -----------------------------------------
  // PASSWORD STATE
  // -----------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // -----------------------------------------
  // SECURITY QUESTION STATE
  // -----------------------------------------
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');

  // -----------------------------------------
  // INITIALIZE TIMEZONE OPTIONS
  // -----------------------------------------
  useEffect(() => {
    try {
      const tzList = Intl.supportedValuesOf('timeZone');
      setTimezoneOptions(tzList);
    } catch {
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
  }, []);

  // -----------------------------------------
  // UPDATE LOCAL STATE WHEN USER CHANGES
  // -----------------------------------------
  useEffect(() => {
    if (user) {
      setOddsFormat(user.oddsFormat || 'AMERICAN');
      setTimezone(user.timezone || 'America/New_York');
      setDateFormat(user.dateFormat || 'US');
      setTemperatureUnit(user.temperatureUnit || 'FAHRENHEIT');
    }
  }, [user]);

  // -----------------------------------------
  // HANDLERS
  // -----------------------------------------

  // Save Preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setPreferencesError('');
    setPreferencesSuccess('');
    setPreferencesLoading(true);

    try {
      await updatePreferences({ oddsFormat, timezone, dateFormat, temperatureUnit });
      setPreferencesSuccess('Preferences saved successfully!');
    } catch (err) {
      setPreferencesError(err.message || 'Failed to save preferences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  // Change Email
  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);

    try {
      await changeEmail(newEmail, emailPassword);
      setEmailSuccess('Email updated successfully!');
      setNewEmail('');
      setEmailPassword('');
    } catch (err) {
      setEmailError(err.message || 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Update Security Question
  const handleUpdateSecurityQuestion = async (e) => {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess('');

    if (securityQuestion && !securityAnswer.trim()) {
      setSecurityError('Please provide an answer for your security question');
      return;
    }

    setSecurityLoading(true);

    try {
      await updateSecurityQuestion(
        securityQuestion || null,
        securityAnswer || null,
        securityPassword
      );
      setSecuritySuccess(
        securityQuestion 
          ? 'Security question updated successfully!' 
          : 'Security question removed'
      );
      setSecurityAnswer('');
      setSecurityPassword('');
    } catch (err) {
      setSecurityError(err.message || 'Failed to update security question');
    } finally {
      setSecurityLoading(false);
    }
  };

  // -----------------------------------------
  // RENDER
  // -----------------------------------------
  if (!user) {
    return (
      <div className="text-center py-12 text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Account Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage your account preferences and security settings.
        </p>
      </div>

      {/* ============================================ */}
      {/* DISPLAY PREFERENCES */}
      {/* ============================================ */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          ⚙️ Display Preferences
        </h2>

        <form onSubmit={handleSavePreferences} className="space-y-4">
          {/* Odds Format */}
          <div>
            <label htmlFor="oddsFormat" className="block text-sm font-medium text-gray-300 mb-1">
              Odds Format
            </label>
            <select
              id="oddsFormat"
              value={oddsFormat}
              onChange={(e) => setOddsFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="AMERICAN">American (+150, -110)</option>
              <option value="DECIMAL">Decimal (2.50, 1.91)</option>
              <option value="FRACTIONAL">Fractional (3/2, 10/11)</option>
            </select>
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
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Your browser timezone: {getBrowserTimezone()}
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
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="US">US (MM/DD/YYYY - January 25, 2026)</option>
              <option value="EU">European (DD/MM/YYYY - 25 January 2026)</option>
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
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="FAHRENHEIT">Fahrenheit (°F)</option>
              <option value="CELSIUS">Celsius (°C)</option>
            </select>
          </div>

          {/* Messages */}
          {preferencesError && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
              {preferencesError}
            </div>
          )}
          {preferencesSuccess && (
            <div className="bg-green-900/30 text-green-400 p-3 rounded-md text-sm">
              {preferencesSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={preferencesLoading}
            className="bg-amber-500 text-gray-900 px-4 py-2 rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            {preferencesLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>

      {/* ============================================ */}
      {/* CHANGE EMAIL */}
      {/* ============================================ */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          ✉️ Change Email
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Current email: <strong>{user.email}</strong>
        </p>

        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div>
            <label htmlFor="newEmail" className="block text-sm font-medium text-gray-300 mb-1">
              New Email Address
            </label>
            <input
              type="email"
              id="newEmail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="newemail@example.com"
            />
          </div>

          <div>
            <label htmlFor="emailPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              id="emailPassword"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter your current password"
            />
          </div>

          {emailError && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
              {emailError}
            </div>
          )}
          {emailSuccess && (
            <div className="bg-green-900/30 text-green-400 p-3 rounded-md text-sm">
              {emailSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={emailLoading}
            className="bg-amber-500 text-gray-900 px-4 py-2 rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            {emailLoading ? 'Updating...' : 'Update Email'}
          </button>
        </form>
      </div>

      {/* ============================================ */}
      {/* CHANGE PASSWORD */}
      {/* ============================================ */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          🔑 Change Password
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

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
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmNewPassword"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {passwordError && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="bg-green-900/30 text-green-400 p-3 rounded-md text-sm">
              {passwordSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className="bg-amber-500 text-gray-900 px-4 py-2 rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ============================================ */}
      {/* SECURITY QUESTION */}
      {/* ============================================ */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          🔐 Security Question
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {user.hasSecurityQuestion 
            ? 'You have a security question set. You can update or remove it below.'
            : 'Set a backup security question in case you lose access to your email.'}
        </p>

        <form onSubmit={handleUpdateSecurityQuestion} className="space-y-4">
          <div>
            <label htmlFor="securityQuestion" className="block text-sm font-medium text-gray-300 mb-1">
              Security Question
            </label>
            <select
              id="securityQuestion"
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">
                {user.hasSecurityQuestion ? '(Remove security question)' : 'Select a question...'}
              </option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

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
                className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Your answer (case-insensitive)"
              />
            </div>
          )}

          <div>
            <label htmlFor="securityPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              id="securityPassword"
              value={securityPassword}
              onChange={(e) => setSecurityPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Required to change security question"
            />
          </div>

          {securityError && (
            <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
              {securityError}
            </div>
          )}
          {securitySuccess && (
            <div className="bg-green-900/30 text-green-400 p-3 rounded-md text-sm">
              {securitySuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={securityLoading}
            className="bg-amber-500 text-gray-900 px-4 py-2 rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            {securityLoading ? 'Saving...' : 'Save Security Question'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountSettings;
