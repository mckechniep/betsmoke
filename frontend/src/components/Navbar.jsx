// ============================================
// NAVBAR COMPONENT
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // "MORE" DROPDOWN STATE
  // ============================================
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Ref for detecting clicks outside the dropdown
  const dropdownRef = useRef(null);

  // ============================================
  // CLICK OUTSIDE HANDLER
  // ============================================
  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    // Add listener when open
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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
