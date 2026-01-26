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
          {isAuthenticated && (
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
              <Link to="/notes" className="hover:text-amber-400 transition-colors">
                Notes
              </Link>

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
          )}

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
                      <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 rounded-md shadow-lg py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-700">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">Admin Actions</span>
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
            {isAuthenticated ? (
              <>
                {/* User Info */}
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

                {/* Main Navigation Links */}
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
                <Link
                  to="/notes"
                  onClick={closeMobileMenu}
                  className="flex items-center py-2 text-white hover:text-amber-400 transition-colors"
                >
                  <AppIcon name="notes" size="md" className="mr-3 text-gray-400" />
                  Notes
                </Link>

                {/* Divider */}
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

                {/* Admin Section */}
                {user?.isAdmin && (
                  <>
                    <div className="border-t border-gray-700 pt-3">
                      <span className="text-xs text-amber-500 uppercase tracking-wide">Admin</span>
                    </div>
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
                  </>
                )}

                {/* Logout Button */}
                <div className="border-t border-gray-700 pt-3">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full py-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <AppIcon name="arrow-right" size="md" className="mr-3 text-red-400" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Non-authenticated mobile menu */}
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
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
