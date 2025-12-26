// ============================================
// NAVBAR COMPONENT
// ============================================

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
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
            <Link to="/standings" className="hover:text-blue-400 transition-colors">
              Standings
            </Link>

            {isAuthenticated && (
              <Link to="/notes" className="hover:text-blue-400 transition-colors">
                Notes
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-400">{user?.email}</span>
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
