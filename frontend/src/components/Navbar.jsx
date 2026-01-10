// ============================================
// NAVBAR COMPONENT
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';

const Navbar = () => {
  const { isAuthenticated, user, logout, token } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // "MORE" DROPDOWN STATE
  // ============================================
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Ref for detecting clicks outside the dropdown
  const dropdownRef = useRef(null);

  // ============================================
  // ADMIN DROPDOWN STATE
  // ============================================
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Ref for admin dropdown
  const adminDropdownRef = useRef(null);

  // ============================================
  // CLICK OUTSIDE HANDLER
  // ============================================
  // Close dropdowns when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (isAdminDropdownOpen && adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
        setIsAdminDropdownOpen(false);
      }
    };

    // Add listener when any dropdown is open
    if (isDropdownOpen || isAdminDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isAdminDropdownOpen]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Toggle dropdown open/closed
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Toggle admin dropdown
  const toggleAdminDropdown = () => {
    setIsAdminDropdownOpen(!isAdminDropdownOpen);
    setSyncMessage(null); // Clear any previous message
  };

  // Handle sync types
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

  return (
    <nav className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold text-blue-400">
            BetSmoke
          </Link>

          {/* Main Navigation */}
          <div className="flex items-center space-x-6">
            <Link to="/fixtures" className="hover:text-blue-400 transition-colors">
              Fixtures
            </Link>
            <Link to="/teams" className="hover:text-blue-400 transition-colors">
              Teams
            </Link>
            <Link to="/competitions" className="hover:text-blue-400 transition-colors">
              Competitions
            </Link>

            {isAuthenticated && (
              <Link to="/notes" className="hover:text-blue-400 transition-colors">
                Notes
              </Link>
            )}

            {/* ============================================ */}
            {/* "MORE" DROPDOWN */}
            {/* ============================================ */}
            <div className="relative" ref={dropdownRef}>
              {/* Dropdown Trigger Button */}
              <button
                onClick={toggleDropdown}
                className={`flex items-center space-x-1 transition-colors ${
                  isDropdownOpen ? 'text-blue-400' : 'hover:text-blue-400'
                }`}
              >
                <span>More</span>
                {/* X icon when open, chevron when closed */}
                {isDropdownOpen ? (
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                ) : (
                  <svg 
                    className="w-4 h-4"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M19 9l-7 7-7-7" 
                    />
                  </svg>
                )}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50">
                  <Link
                    to="/model-performance"
                    className="block px-4 py-2 text-sm hover:bg-gray-700 hover:text-blue-400 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Model Performance
                  </Link>
                  <Link
                    to="/model-architecture"
                    className="block px-4 py-2 text-sm hover:bg-gray-700 hover:text-blue-400 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Model Architecture
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/settings"
                  className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  title="Account Settings"
                >
                  ⚙️ {user?.email}
                </Link>

                {/* Admin Dropdown - Only visible to admins */}
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

                    {/* Admin Dropdown Menu */}
                    {isAdminDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 rounded-md shadow-lg py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-700">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">Admin Actions</span>
                        </div>

                        {/* Sync Types Button */}
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

                        {/* Sync Result Message */}
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
                  className="text-sm hover:text-blue-400 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-blue-600 px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
