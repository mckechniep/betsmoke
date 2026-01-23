// ============================================
// AUTH CONTEXT
// ============================================
// Manages authentication state across the app.
// Includes user preferences (odds format, timezone).
// Stores token in localStorage for persistence.
// ============================================

import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

// Create the context
const AuthContext = createContext(null);

// ============================================
// HELPER: Get browser timezone
// ============================================
const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York'; // Fallback
  }
};

// ============================================
// AUTH PROVIDER
// ============================================

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for existing token in localStorage
  // and validate it's still valid on the backend
  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('betsmoke_token');
      const storedUser = localStorage.getItem('betsmoke_user');

      // No stored credentials - just finish loading
      if (!storedToken || !storedUser) {
        setLoading(false);
        return;
      }

      // We have stored credentials - validate them with the backend
      try {
        // Call /auth/me to verify token is still valid
        const response = await authApi.getMe(storedToken);
        
        // Token is valid - set auth state
        setToken(storedToken);
        setUser(response.user);
        
        // Update stored user in case it changed
        localStorage.setItem('betsmoke_user', JSON.stringify(response.user));
      } catch (error) {
        // Token is invalid or expired - clear stored credentials
        console.warn('Stored token is invalid or expired, clearing auth state');
        localStorage.removeItem('betsmoke_token');
        localStorage.removeItem('betsmoke_user');
        // Don't set token/user - they'll remain null
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, []);

  // ============================================
  // REGISTER
  // ============================================
  // Accepts optional preferences and security question
  const register = async (email, password, options = {}) => {
    const { oddsFormat, timezone, dateFormat, temperatureUnit, securityQuestion, securityAnswer } = options;

    const response = await authApi.register({
      email,
      password,
      oddsFormat,
      timezone: timezone || getBrowserTimezone(), // Auto-detect if not provided
      dateFormat,
      temperatureUnit,
      securityQuestion,
      securityAnswer
    });

    return response;
  };

  // ============================================
  // LOGIN
  // ============================================
  const login = async (email, password) => {
    const response = await authApi.login(email, password);

    // Store token and user (including preferences)
    localStorage.setItem('betsmoke_token', response.token);
    localStorage.setItem('betsmoke_user', JSON.stringify(response.user));

    setToken(response.token);
    setUser(response.user);

    return response;
  };

  // ============================================
  // LOGOUT
  // ============================================
  const logout = () => {
    localStorage.removeItem('betsmoke_token');
    localStorage.removeItem('betsmoke_user');
    setToken(null);
    setUser(null);
  };

  // ============================================
  // REFRESH USER DATA
  // ============================================
  // Call after updating preferences/email to sync state
  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const response = await authApi.getMe(token);
      localStorage.setItem('betsmoke_user', JSON.stringify(response.user));
      setUser(response.user);
      return response.user;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If token is invalid, log out
      if (error.message.includes('401') || error.message.includes('token')) {
        logout();
      }
      throw error;
    }
  };

  // ============================================
  // UPDATE PREFERENCES
  // ============================================
  const updatePreferences = async (preferences) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await authApi.updatePreferences(preferences, token);
    
    // Update local state
    localStorage.setItem('betsmoke_user', JSON.stringify(response.user));
    setUser(response.user);
    
    return response;
  };

  // ============================================
  // CHANGE EMAIL
  // ============================================
  const changeEmail = async (newEmail, password) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await authApi.changeEmail(newEmail, password, token);
    
    // Update local state
    localStorage.setItem('betsmoke_user', JSON.stringify(response.user));
    setUser(response.user);
    
    return response;
  };

  // ============================================
  // CHANGE PASSWORD
  // ============================================
  const changePassword = async (currentPassword, newPassword) => {
    if (!token) throw new Error('Not authenticated');
    
    return await authApi.changePassword(currentPassword, newPassword, token);
  };

  // ============================================
  // UPDATE SECURITY QUESTION
  // ============================================
  const updateSecurityQuestion = async (securityQuestion, securityAnswer, password) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await authApi.updateSecurityQuestion(
      securityQuestion, 
      securityAnswer, 
      password, 
      token
    );
    
    // Update local state
    localStorage.setItem('betsmoke_user', JSON.stringify(response.user));
    setUser(response.user);
    
    return response;
  };

  // Check if user is authenticated
  const isAuthenticated = !!token;

  // Context value
  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    // Auth actions
    register,
    login,
    logout,
    refreshUser,
    // Account management
    updatePreferences,
    changeEmail,
    changePassword,
    updateSecurityQuestion,
    // Utility
    getBrowserTimezone,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// CUSTOM HOOK
// ============================================

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
