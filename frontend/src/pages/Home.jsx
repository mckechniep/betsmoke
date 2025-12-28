// ============================================
// HOME PAGE (Dashboard)
// ============================================
// Main dashboard showing:
// - Hero section
// - Quick links to main pages
// - Research journal CTA
// - Premier League standings (via LeagueStandings component)
// ============================================

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LeagueStandings from '../components/LeagueStandings';

// Premier League ID in SportsMonks
const PREMIER_LEAGUE_ID = 8;

const Home = () => {
  const { isAuthenticated } = useAuth();

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          BetSmoke
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Your personal betting research journal. Track fixtures, analyze teams,
          and keep notes on your insights.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link
          to="/fixtures"
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Fixtures</h2>
          <p className="text-gray-600">Browse upcoming and past matches by date.</p>
        </Link>

        <Link
          to="/teams"
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Teams</h2>
          <p className="text-gray-600">Search and explore team statistics.</p>
        </Link>

        <Link
          to="/standings"
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All Standings</h2>
          <p className="text-gray-600">View standings for all leagues.</p>
        </Link>
      </div>

      {/* Notes CTA (for non-authenticated users) */}
      {!isAuthenticated && (
        <div className="bg-blue-50 p-6 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Start Your Research Journal
          </h3>
          <p className="text-gray-600 mb-4">
            Create an account to save notes and track your betting research.
          </p>
          <Link
            to="/register"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Notes CTA (for authenticated users) */}
      {isAuthenticated && (
        <div className="bg-green-50 p-6 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Your Research Journal
          </h3>
          <p className="text-gray-600 mb-4">
            Access your notes and continue your research.
          </p>
          <Link
            to="/notes"
            className="inline-block bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            View Notes
          </Link>
        </div>
      )}

      {/* ============================================ */}
      {/* PREMIER LEAGUE STANDINGS */}
      {/* ============================================ */}
      <LeagueStandings 
        leagueId={PREMIER_LEAGUE_ID} 
        leagueName="Premier League" 
        showZones={true}
      />
    </div>
  );
};

export default Home;
