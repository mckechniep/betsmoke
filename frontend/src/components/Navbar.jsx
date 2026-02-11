// ============================================
// NAVBAR COMPONENT
// ============================================
// Responsive navbar with mobile hamburger menu

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';
import AppIcon from './AppIcon';

const Navbar = () => {
  const { isAuthenticated, user, logout, token } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // STATE
  // ============================================
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState(null);
  const [flushPrefix, setFlushPrefix] = useState('');

  // Refs for detecting clicks outside dropdowns
  const dropdownRef = useRef(null);
  const adminDropdownRef = useRef(null);

  // ============================================
  // CLICK OUTSIDE HANDLER
  // ============================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (isAdminDropdownOpen && adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
        setIsAdminDropdownOpen(false);
      }
    };

    if (isDropdownOpen || isAdminDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isAdminDropdownOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [navigate]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleAdminDropdown = () => {
    setIsAdminDropdownOpen(!isAdminDropdownOpen);
    setSyncMessage(null);
    setCacheStats(null);
    setCacheMessage(null);
    setFlushPrefix('');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleSyncTypes = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await adminApi.syncTypes(token);
      setSyncMessage({
        type: 'success',
        text: `Synced ${result.result.totalFromAPI} types (${result.result.inserted} new, ${result.result.updated} updated)`
      });
    } catch (error) {
      setSyncMessage({
        type: 'error',
        text: error.message || 'Failed to sync types'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ============================================
  // CACHE MANAGEMENT HANDLERS
  // ============================================
  const handleViewCacheStats = async () => {
    setIsLoadingCache(true);
    setCacheMessage(null);

    try {
      const result = await adminApi.getCacheStats(token);
      setCacheStats(result.data);
    } catch (error) {
      setCacheMessage({ type: 'error', text: error.message || 'Failed to load cache stats' });
    } finally {
      setIsLoadingCache(false);
    }
  };

  const handleFlushCache = async () => {
    setIsLoadingCache(true);
    setCacheMessage(null);

    try {
      await adminApi.flushCache(token);
      setCacheMessage({ type: 'success', text: 'Cache flushed successfully' });
      setCacheStats(null);
    } catch (error) {
      setCacheMessage({ type: 'error', text: error.message || 'Failed to flush cache' });
    } finally {
      setIsLoadingCache(false);
    }
  };

  const handleFlushByPrefix = async () => {
    if (!flushPrefix.trim()) return;
    setIsLoadingCache(true);
    setCacheMessage(null);

    try {
      const result = await adminApi.flushCacheByPrefix(flushPrefix.trim(), token);
      setCacheMessage({ type: 'success', text: result.message || `Flushed keys with prefix "${flushPrefix.trim()}"` });
      setFlushPrefix('');
    } catch (error) {
      setCacheMessage({ type: 'error', text: error.message || 'Failed to flush by prefix' });
    } finally {
      setIsLoadingCache(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <nav className="bg-gray-950 text-white border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold">
            <span className="text-amber-500">Bet</span><span className="text-white">Smoke</span>
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/fixtures" className="hover:text-amber-400 transition-colors">
              Fixtures
            </Link>
            <Link to="/teams" className="hover:text-amber-400 transition-colors">
              Teams
            </Link>
            <Link to="/competitions" className="hover:text-amber-400 transition-colors">
              Competitions
            </Link>
            {isAuthenticated && (
              <Link to="/notes" className="hover:text-amber-400 transition-colors">
                Notes
              </Link>
            )}

            {/* "More" Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleDropdown}
                className={`flex items-center space-x-1 transition-colors ${
                  isDropdownOpen ? 'text-amber-400' : 'hover:text-amber-400'
                }`}
              >
                <span>More</span>
                <AppIcon
                  name={isDropdownOpen ? 'close' : 'chevron-down'}
                  size="xs"
                  className="text-current"
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50">
                  <Link
                    to="/model-performance"
                    className="block px-4 py-2 text-sm hover:bg-gray-700 hover:text-amber-400 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Model Performance
                  </Link>
                  <Link
                    to="/model-architecture"
                    className="block px-4 py-2 text-sm hover:bg-gray-700 hover:text-amber-400 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Model Architecture
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Auth Section - Hidden on mobile */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/settings"
                  className="text-sm text-gray-400 hover:text-amber-400 transition-colors"
                  title="Account Settings"
                >
                  <AppIcon name="settings" size="sm" className="inline mr-1 text-gray-400" />
                  {user?.email}
                </Link>

                {/* Admin Dropdown */}
                {user?.isAdmin && (
                  <div className="relative" ref={adminDropdownRef}>
                    <button
                      onClick={toggleAdminDropdown}
                      className={`text-sm px-3 py-1.5 rounded transition-colors ${
                        isAdminDropdownOpen
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-700 hover:bg-amber-600 text-white'
                      }`}
                    >
                      Admin
                    </button>

                    {isAdminDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 rounded-md shadow-lg py-2 z-50">
                        {/* Types Section */}
                        <div className="px-4 py-2 border-b border-gray-700">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">Types</span>
                        </div>

                        <button
                          onClick={handleSyncTypes}
                          disabled={isSyncing}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          {isSyncing ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Syncing Types...
                            </span>
                          ) : (
                            'Sync SportsMonks Types'
                          )}
                        </button>

                        {syncMessage && (
                          <div className={`mx-4 mt-2 p-2 rounded text-xs ${
                            syncMessage.type === 'success'
                              ? 'bg-green-900 text-green-200'
                              : 'bg-red-900 text-red-200'
                          }`}>
                            {syncMessage.text}
                          </div>
                        )}

                        {/* Cache Section */}
                        <div className="px-4 py-2 mt-1 border-t border-b border-gray-700">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">Cache</span>
                        </div>

                        {/* View Stats */}
                        <button
                          onClick={handleViewCacheStats}
                          disabled={isLoadingCache}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          {isLoadingCache && !cacheStats ? 'Loading...' : 'View Cache Stats'}
                        </button>

                        {/* Cache Stats Display */}
                        {cacheStats && (
                          <div className="mx-4 mt-1 p-2 bg-gray-900 rounded text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Keys:</span>
                              <span className="text-white">{cacheStats.totalKeys}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Hits:</span>
                              <span className="text-green-400">{cacheStats.hits}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Misses:</span>
                              <span className="text-red-400">{cacheStats.misses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Hit Rate:</span>
                              <span className="text-amber-400">{cacheStats.hitRate}</span>
                            </div>
                            {cacheStats.categories && Object.keys(cacheStats.categories).length > 0 && (
                              <div className="pt-1 border-t border-gray-700">
                                <span className="text-gray-500">By Category:</span>
                                {Object.entries(cacheStats.categories).map(([cat, count]) => (
                                  <div key={cat} className="flex justify-between pl-2">
                                    <span className="text-gray-400">{cat}</span>
                                    <span className="text-white">{count}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Flush All */}
                        <button
                          onClick={handleFlushCache}
                          disabled={isLoadingCache}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          Flush Entire Cache
                        </button>

                        {/* Flush by Prefix */}
                        <div className="px-4 py-2 flex items-center space-x-2">
                          <input
                            type="text"
                            value={flushPrefix}
                            onChange={(e) => setFlushPrefix(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFlushByPrefix()}
                            placeholder="Prefix (e.g. fixtures)"
                            className="flex-1 bg-gray-900 text-white text-xs px-2 py-1.5 rounded border border-gray-600 focus:border-amber-500 focus:outline-none"
                          />
                          <button
                            onClick={handleFlushByPrefix}
                            disabled={isLoadingCache || !flushPrefix.trim()}
                            className="text-xs px-2 py-1.5 bg-red-800 text-red-200 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            Flush
                          </button>
                        </div>

                        {/* Cache Message */}
                        {cacheMessage && (
                          <div className={`mx-4 mt-1 p-2 rounded text-xs ${
                            cacheMessage.type === 'success'
                              ? 'bg-green-900 text-green-200'
                              : 'bg-red-900 text-red-200'
                          }`}>
                            {cacheMessage.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className="text-sm bg-gray-700 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm hover:text-amber-400 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-amber-500 text-gray-900 px-3 py-1.5 rounded hover:bg-amber-400 transition-colors font-semibold"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button - Visible only on mobile */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            <AppIcon
              name={isMobileMenuOpen ? 'close' : 'menu'}
              size="lg"
              className="text-white"
            />
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* MOBILE MENU - Slides down when open */}
      {/* ============================================ */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-900 border-t border-gray-700">
          <div className="px-4 py-4 space-y-3">
            {/* User Info (authenticated only) */}
            {isAuthenticated && (
              <div className="pb-3 border-b border-gray-700">
                <Link
                  to="/settings"
                  onClick={closeMobileMenu}
                  className="flex items-center text-sm text-gray-400 hover:text-amber-400"
                >
                  <AppIcon name="settings" size="sm" className="mr-2 text-gray-400" />
                  {user?.email}
                </Link>
              </div>
            )}

            {/* Main Navigation Links - Always visible */}
            <Link
              to="/fixtures"
              onClick={closeMobileMenu}
              className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
            >
              <AppIcon name="calendar" size="md" className="mr-3 text-gray-400" />
              Fixtures
            </Link>
            <Link
              to="/teams"
              onClick={closeMobileMenu}
              className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
            >
              <AppIcon name="team" size="md" className="mr-3 text-gray-400" />
              Teams
            </Link>
            <Link
              to="/competitions"
              onClick={closeMobileMenu}
              className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
            >
              <AppIcon name="trophy" size="md" className="mr-3 text-gray-400" />
              Competitions
            </Link>
            {isAuthenticated && (
              <Link
                to="/notes"
                onClick={closeMobileMenu}
                className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
              >
                <AppIcon name="notes" size="md" className="mr-3 text-gray-400" />
                Notes
              </Link>
            )}

            {/* More Section - Always visible */}
            <div className="border-t border-gray-700 pt-3">
              <span className="text-xs text-gray-500 uppercase tracking-wide">More</span>
            </div>

            <Link
              to="/model-performance"
              onClick={closeMobileMenu}
              className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
            >
              <AppIcon name="stats" size="md" className="mr-3 text-gray-400" />
              Model Performance
            </Link>
            <Link
              to="/model-architecture"
              onClick={closeMobileMenu}
              className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
            >
              <AppIcon name="brain" size="md" className="mr-3 text-gray-400" />
              Model Architecture
            </Link>

            {/* Admin Section (admin only) */}
            {isAuthenticated && user?.isAdmin && (
              <>
                <div className="border-t border-gray-700 pt-3">
                  <span className="text-xs text-amber-500 uppercase tracking-wide">Admin</span>
                </div>

                {/* Sync Types */}
                <button
                  onClick={handleSyncTypes}
                  disabled={isSyncing}
                  className="flex items-center w-full py-2 text-white hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  <AppIcon name="sync" size="md" className={`mr-3 text-gray-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync SportsMonks Types'}
                </button>
                {syncMessage && (
                  <div className={`p-2 rounded text-xs ${
                    syncMessage.type === 'success'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-red-900 text-red-200'
                  }`}>
                    {syncMessage.text}
                  </div>
                )}

                {/* Cache Management */}
                <div className="mt-2 mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Cache</span>
                </div>

                {/* View Stats */}
                <button
                  onClick={handleViewCacheStats}
                  disabled={isLoadingCache}
                  className="flex items-center w-full py-2 text-white hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  <AppIcon name="stats" size="md" className="mr-3 text-gray-400" />
                  {isLoadingCache && !cacheStats ? 'Loading...' : 'View Cache Stats'}
                </button>

                {/* Cache Stats Display */}
                {cacheStats && (
                  <div className="p-3 bg-gray-800 rounded text-xs space-y-1 mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Keys:</span>
                      <span className="text-white">{cacheStats.totalKeys}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Hits:</span>
                      <span className="text-green-400">{cacheStats.hits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Misses:</span>
                      <span className="text-red-400">{cacheStats.misses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Hit Rate:</span>
                      <span className="text-amber-400">{cacheStats.hitRate}</span>
                    </div>
                    {cacheStats.categories && Object.keys(cacheStats.categories).length > 0 && (
                      <div className="pt-1 border-t border-gray-700">
                        <span className="text-gray-500">By Category:</span>
                        {Object.entries(cacheStats.categories).map(([cat, count]) => (
                          <div key={cat} className="flex justify-between pl-2">
                            <span className="text-gray-400">{cat}</span>
                            <span className="text-white">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Flush All */}
                <button
                  onClick={handleFlushCache}
                  disabled={isLoadingCache}
                  className="flex items-center w-full py-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <AppIcon name="close" size="md" className="mr-3 text-red-400" />
                  Flush Entire Cache
                </button>

                {/* Flush by Prefix */}
                <div className="flex items-center space-x-2 py-2">
                  <input
                    type="text"
                    value={flushPrefix}
                    onChange={(e) => setFlushPrefix(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFlushByPrefix()}
                    placeholder="Prefix (e.g. fixtures)"
                    className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    onClick={handleFlushByPrefix}
                    disabled={isLoadingCache || !flushPrefix.trim()}
                    className="text-sm px-3 py-2 bg-red-800 text-red-200 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Flush
                  </button>
                </div>

                {/* Cache Message */}
                {cacheMessage && (
                  <div className={`p-2 rounded text-xs ${
                    cacheMessage.type === 'success'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-red-900 text-red-200'
                  }`}>
                    {cacheMessage.text}
                  </div>
                )}
              </>
            )}

            {/* Auth Section */}
            <div className="border-t border-gray-700 pt-3">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full py-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  <AppIcon name="arrow-right" size="md" className="mr-3 text-red-400" />
                  Logout
                </button>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className="block py-3 text-center text-white hover:text-amber-400 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={closeMobileMenu}
                    className="block py-3 text-center bg-amber-500 text-gray-900 rounded-md font-semibold hover:bg-amber-400 transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
