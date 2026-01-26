// ============================================
// HOME PAGE
// ============================================
// Shows different content based on authentication:
// - Non-authenticated: Marketing landing page with features & CTA
// - Authenticated: Dashboard with quick links and Premier League standings
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataApi } from '../api/client';
import LeagueStandings from '../components/LeagueStandings';
import AppIcon from '../components/AppIcon';
import heroLogo from '../assets/logo-hero-size-2.png';
import aiProbabilityImage from '../assets/ai-probability-betsmoke-3.png';

// Premier League ID in SportsMonks
const PREMIER_LEAGUE_ID = 8;

// ============================================
// LANDING PAGE (Non-Authenticated Users)
// ============================================
const LandingPage = () => {
  return (
    <div className="space-y-12 bg-gray-100 -mx-4 px-4 -my-6 py-6 min-h-screen text-gray-900">
      {/* Hero Section */}
      <div className="rounded-lg">
        {/* Hero Logo */}
        <img
          src={heroLogo}
          alt="BetSmoke"
          className="w-full max-w-xl mx-auto rounded-lg"
        />
        {/* Text and buttons below the logo */}
        <div className="text-center py-8 bg-gray-800 mt-6 rounded-lg shadow-lg mx-2">
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-6 px-4">
            Your personal betting research terminal. Aggregate football data,
            track insights, and make disciplined betting decisions.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/register"
              className="bg-amber-500 text-gray-900 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-amber-400 transition-colors"
            >
              Sign Up
            </Link>
            <Link
              to="/login"
              className="bg-gray-700 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-600 transition-colors border border-amber-500/30"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* AI Predictions Highlight */}
      <div className="bg-white shadow-lg mx-2 px-6 py-8 rounded-lg">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">
          <img
            src={aiProbabilityImage}
            alt="AI Predictions"
            className="w-24 h-24 object-contain"
          />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Powered by State-of-the-Art AI Predictions
            </h2>
            <p className="text-gray-600 mb-4">
              Our machine learning models analyze thousands of data points to generate match predictions
              with full transparency on model performance and accuracy metrics.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm">
              <span className="bg-gray-300 text-gray-700 px-3 py-1 rounded-full">Match Results</span>
              <span className="bg-gray-300 text-gray-700 px-3 py-1 rounded-full">Over/Under Goals</span>
              <span className="bg-gray-300 text-gray-700 px-3 py-1 rounded-full">Both Teams to Score</span>
              <span className="bg-gray-300 text-gray-700 px-3 py-1 rounded-full">Correct Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
          Tools for Disciplined Betting
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-amber-500">
            <AppIcon name="stats" size="3xl" className="text-amber-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Live & Historical Data</h3>
            <p className="text-gray-600">
              Real-time scores and historical fixtures, statistics, and trends from
              the Premier League, FA Cup, and Carabao Cup.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-amber-500">
            <AppIcon name="notes" size="3xl" className="text-amber-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Research Journal</h3>
            <p className="text-gray-600">
              Keep notes on teams, fixtures, and trends. Build your own database
              of insights to inform future bets.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-amber-500">
            <AppIcon name="money" size="3xl" className="text-amber-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Odds Comparison</h3>
            <p className="text-gray-600">
              Compare pre-match odds across multiple bookmakers to find
              the best value for your bets.
            </p>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div className="py-8 bg-gray-900 mx-2 px-4 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-white text-center mb-8">
          Comprehensive Football Data
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-500 mb-2">H2H</div>
            <p className="text-gray-400">Head-to-head history</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-500 mb-2">ODDS</div>
            <p className="text-gray-400">Pre-match betting odds</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-500 mb-2">STATS</div>
            <p className="text-gray-400">Team & player statistics</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-500 mb-2">FORM</div>
            <p className="text-gray-400">Recent form & trends</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to Start Your Research?
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-xl mx-auto">
          Join BetSmoke and take a disciplined approach to your betting research.
        </p>
        <Link
          to="/register"
          className="bg-amber-500 text-gray-900 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-amber-400 transition-colors"
        >
          Sign Up
        </Link>
      </div>

      {/* Footer Note */}
      <div className="text-center text-sm text-gray-500 py-4 border-t">
        <p>
          BetSmoke is a research tool only. We do not place bets or process payments.
        </p>
      </div>
    </div>
  );
};

// ============================================
// DASHBOARD (Authenticated Users)
// ============================================
const Dashboard = () => {
  // State for Premier League logo
  const [plLogo, setPlLogo] = useState(null);

  // Fetch Premier League logo on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const data = await dataApi.getLeague(PREMIER_LEAGUE_ID);
        setPlLogo(data.league?.image_path || null);
      } catch (err) {
        console.error('Failed to fetch Premier League logo:', err);
      }
    };
    fetchLogo();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">
          Welcome to BetSmoke
        </h1>
        <p className="text-gray-400">
          Your betting research terminal is ready.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-4 gap-4">
        <Link
          to="/fixtures"
          className="group block p-4 bg-gray-800 rounded-lg shadow-md border border-transparent
                     hover:bg-gray-700 hover:border-amber-500 hover:shadow-xl
                     transition-all duration-200 text-center cursor-pointer"
        >
          <AppIcon name="calendar" size="xl" className="text-gray-400 group-hover:text-amber-400 mb-2 mx-auto transition-colors" />
          <h2 className="text-lg font-semibold text-gray-100">Fixtures</h2>
          <p className="text-sm text-gray-400">View matches</p>
        </Link>

        <Link
          to="/teams"
          className="group block p-4 bg-gray-800 rounded-lg shadow-md border border-transparent
                     hover:bg-gray-700 hover:border-amber-500 hover:shadow-xl
                     transition-all duration-200 text-center cursor-pointer"
        >
          <AppIcon name="team" size="xl" className="text-gray-400 group-hover:text-amber-400 mb-2 mx-auto transition-colors" />
          <h2 className="text-lg font-semibold text-gray-100">Teams</h2>
          <p className="text-sm text-gray-400">Search teams</p>
        </Link>

        <Link
          to="/competitions"
          className="group block p-4 bg-gray-800 rounded-lg shadow-md border border-transparent
                     hover:bg-gray-700 hover:border-amber-500 hover:shadow-xl
                     transition-all duration-200 text-center cursor-pointer"
        >
          <AppIcon name="trophy" size="xl" className="text-gray-400 group-hover:text-amber-400 mb-2 mx-auto transition-colors" />
          <h2 className="text-lg font-semibold text-gray-100">Competitions</h2>
          <p className="text-sm text-gray-400">Standings & cups</p>
        </Link>

        <Link
          to="/notes"
          className="group block p-4 bg-gray-800 rounded-lg shadow-md border border-transparent
                     hover:bg-gray-700 hover:border-amber-500 hover:shadow-xl
                     transition-all duration-200 text-center cursor-pointer"
        >
          <AppIcon name="notes" size="xl" className="text-gray-400 group-hover:text-amber-400 mb-2 mx-auto transition-colors" />
          <h2 className="text-lg font-semibold text-gray-100">Notes</h2>
          <p className="text-sm text-gray-400">Your journal</p>
        </Link>
      </div>

      {/* Premier League Standings */}
      <LeagueStandings
        leagueId={PREMIER_LEAGUE_ID}
        leagueName="Premier League"
        leagueLogo={plLogo}
        showZones={true}
      />
    </div>
  );
};

// ============================================
// HOME COMPONENT (Router)
// ============================================
const Home = () => {
  const { isAuthenticated } = useAuth();

  // Show landing page for non-authenticated users
  // Show dashboard for authenticated users
  return isAuthenticated ? <Dashboard /> : <LandingPage />;
};

export default Home;
