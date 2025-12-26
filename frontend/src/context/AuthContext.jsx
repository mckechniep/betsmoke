// ============================================
// AUTH CONTEXT
// ============================================
// Manages authentication state across the app.
// Stores token in localStorage for persistence.
// ============================================

import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

// Create the context
const AuthContext = createContext(null);

// ============================================
// AUTH PROVIDER
// ============================================

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for existing token in localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('betsmoke_token');
    const storedUser = localStorage.getItem('betsmoke_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  // Login function
  const login = async (email, password) => {
    const response = await authApi.login(email, password);

    // Store token and user
    localStorage.setItem('betsmoke_token', response.token);
    localStorage.setItem('betsmoke_user', JSON.stringify(response.user));

    setToken(response.token);
    setUser(response.user);

    return response;
  };

  // Register function
  const register = async (email, password) => {
    const response = await authApi.register(email, password);
    return response;
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('betsmoke_token');
    localStorage.removeItem('betsmoke_user');
    setToken(null);
    setUser(null);
  };

  // Check if user is authenticated
  const isAuthenticated = !!token;

  // Context value
  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
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
