// ============================================
// CUP COMPETITION COMPONENT
// ============================================
// Reusable component for displaying cup competition fixtures
// organized by stage (FA Cup, Carabao Cup, etc.)
//
// Features:
// - Season selector for historical views
// - Stage navigation (clickable tabs for each round)
// - Fixture list with scores and dates
// - Links to fixture details
//
// Props:
// - leagueId (number): The league ID (24 = FA Cup, 27 = EFL Cup)
// - leagueName (string): Display name (e.g., "FA Cup")
// - accentColor (string): Tailwind color for styling (e.g., "red", "green")
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dataApi } from '../api/client';

// ============================================
// HELPER: Format date for display
// ============================================
const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  
  // Parse as UTC to avoid timezone issues
  const date = new Date(dateString + 'Z');
  
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
};

// ============================================
// HELPER: Format time for display
// ============================================
const formatTime = (dateString) => {
  if (!dateString) return '';
  
  // Parse as UTC to avoid timezone issues
  const date = new Date(dateString + 'Z');
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
};

// ============================================
// HELPER: Get match state display
// ============================================
const getMatchState = (fixture) => {
  const stateId = fixture.state_id;
  const state = fixture.state?.state;
  
  // Common state IDs:
  // 1 = Not Started (NS)
  // 2 = In Play (LIVE)
  // 3 = Half Time (HT)
  // 5 = Finished (FT)
  // 7 = Postponed
  // 13 = Cancelled
  
  if (state === 'FT' || stateId === 5) return { text: 'FT', class: 'bg-gray-500' };
  if (state === 'LIVE' || stateId === 2) return { text: 'LIVE', class: 'bg-red-500 animate-pulse' };
  if (state === 'HT' || stateId === 3) return { text: 'HT', class: 'bg-yellow-500' };
  if (state === 'NS' || stateId === 1) return { text: 'Upcoming', class: 'bg-blue-500' };
  if (stateId === 7) return { text: 'Postponed', class: 'bg-orange-500' };
  if (stateId === 13) return { text: 'Cancelled', class: 'bg-red-700' };
  
  return { text: 'TBD', class: 'bg-gray-400' };
};

// ============================================
// HELPER: Get score display
// ============================================
const getScore = (fixture) => {
  // Find the CURRENT score (final/current score)
  const scores = fixture.scores || [];
  
  let homeScore = fixture.home_score;
  let awayScore = fixture.away_score;
  
  // If we have detailed scores, look for CURRENT
  if (scores.length > 0) {
    const currentScores = scores.filter(s => s.description === 'CURRENT');
    if (currentScores.length === 2) {
      const home = currentScores.find(s => s.score?.participant === 'home');
      const away = currentScores.find(s => s.score?.participant === 'away');
      if (home) homeScore = home.score?.goals;
      if (away) awayScore = away.score?.goals;
    }
  }
  
  return { home: homeScore ?? '-', away: awayScore ?? '-' };
};

// ============================================
// CUP COMPETITION COMPONENT
// ============================================
const CupCompetition = ({
  leagueId,
  leagueName = 'Cup Competition',
  accentColor = 'blue'  // Tailwind color: red, green, blue, purple, etc.
}) => {
  // State for seasons dropdown
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  
  // State for stages data (stages = rounds in cup competitions)
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [error, setError] = useState('');

  // ============================================
  // COLOR CLASS MAPPINGS
  // ============================================
  const colorClasses = {
    red: {
      gradient: 'from-red-700 to-red-900',
      badge: 'bg-red-100 text-red-800',
      button: 'bg-red-600 hover:bg-red-700',
      buttonActive: 'bg-red-700 border-red-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-red-600',
    },
    green: {
      gradient: 'from-green-700 to-green-900',
      badge: 'bg-green-100 text-green-800',
      button: 'bg-green-600 hover:bg-green-700',
      buttonActive: 'bg-green-700 border-green-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-green-600',
    },
    blue: {
      gradient: 'from-blue-700 to-blue-900',
      badge: 'bg-blue-100 text-blue-800',
      button: 'bg-blue-600 hover:bg-blue-700',
      buttonActive: 'bg-blue-700 border-blue-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-blue-600',
    },
    purple: {
      gradient: 'from-purple-700 to-purple-900',
      badge: 'bg-purple-100 text-purple-800',
      button: 'bg-purple-600 hover:bg-purple-700',
      buttonActive: 'bg-purple-700 border-purple-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-purple-600',
    },
  };
  
  const colors = colorClasses[accentColor] || colorClasses.blue;

  // ============================================
  // FETCH SEASONS FOR THIS LEAGUE
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      setSeasonsLoading(true);
      try {
        // Get league details which includes seasons
        const data = await dataApi.getSeasonsByLeague(leagueId);
        
        // Extract seasons from the response
        // The response structure is: { league: { id, name, seasons: [...] } }
        const leagueSeasons = data.league?.seasons || data.seasons || [];
        
        // Sort by name descending (most recent first)
        const sorted = leagueSeasons.sort((a, b) => {
          return b.name?.localeCompare(a.name);
        });
        
        setSeasons(sorted);
        
        // Auto-select the current season, or the most recent one
        if (sorted.length > 0) {
          const currentSeason = sorted.find(s => s.is_current);
          const selected = currentSeason || sorted[0];
          setSelectedSeasonId(selected.id);
        }
      } catch (err) {
        console.error(`Failed to fetch ${leagueName} seasons:`, err);
        setError(`Failed to load ${leagueName} seasons`);
      } finally {
        setSeasonsLoading(false);
      }
    };

    fetchSeasons();
  }, [leagueId, leagueName]);

  // ============================================
  // FETCH STAGES WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStages = async () => {
      setStagesLoading(true);
      setError('');

      try {
        const data = await dataApi.getStagesBySeason(selectedSeasonId);
        
        // Get stages from the response
        // The backend returns: { seasonId, totalStages, totalFixtures, stages: [...] }
        const fetchedStages = data.stages || [];
        
        // Sort stages by starting_at date (chronological order)
        // NOTE: We use date instead of sort_order because SportsMonks' sort_order
        // can be inconsistent for some seasons (e.g., FA Cup 2025/2026)
        // Chronological sorting always works correctly for cup competitions
        const sortedStages = fetchedStages.sort((a, b) => {
          // Primary sort: by starting_at date
          const dateA = new Date(a.starting_at || '9999-12-31');
          const dateB = new Date(b.starting_at || '9999-12-31');
          
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA - dateB;
          }
          
          // Fallback: if same date, use sort_order
          if (a.sort_order !== undefined && b.sort_order !== undefined) {
            return a.sort_order - b.sort_order;
          }
          
          // Last resort: alphabetical by name
          return (a.name || '').localeCompare(b.name || '');
        });
        
        setStages(sortedStages);
        
        // Auto-select the current stage, or the first stage with fixtures
        if (sortedStages.length > 0) {
          const currentStage = sortedStages.find(s => s.is_current);
          const stageWithFixtures = sortedStages.find(s => s.fixtures?.length > 0);
          const selected = currentStage || stageWithFixtures || sortedStages[0];
          setSelectedStageId(selected.id);
        }
      } catch (err) {
        console.error(`Failed to fetch ${leagueName} stages:`, err);
        setError('Failed to load stages');
        setStages([]);
      } finally {
        setStagesLoading(false);
      }
    };

    fetchStages();
  }, [selectedSeasonId, leagueName]);

  // ============================================
  // GET SELECTED STAGE DATA
  // ============================================
  const selectedStage = stages.find(s => s.id === selectedStageId);
  const fixtures = selectedStage?.fixtures || [];

  // ============================================
  // GET SEASON NAME FOR DISPLAY
  // ============================================
  const getSelectedSeasonName = () => {
    const season = seasons.find(s => s.id === selectedSeasonId);
    return season ? season.name : '';
  };

  // ============================================
  // RENDER FIXTURE ROW
  // ============================================
  const renderFixture = (fixture) => {
    const participants = fixture.participants || [];
    const homeTeam = participants.find(p => p.meta?.location === 'home') || participants[0];
    const awayTeam = participants.find(p => p.meta?.location === 'away') || participants[1];
    const score = getScore(fixture);
    const matchState = getMatchState(fixture);
    const isFinished = fixture.state?.state === 'FT' || fixture.state_id === 5;
    
    return (
      <Link
        key={fixture.id}
        to={`/fixtures/${fixture.id}`}
        className="block bg-gray-50 hover:bg-gray-100 rounded-lg p-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <div className="flex-1 flex items-center justify-end space-x-3">
            <span className="font-medium text-gray-900 text-right">
              {homeTeam?.name || 'TBD'}
            </span>
            {homeTeam?.image_path && (
              <img
                src={homeTeam.image_path}
                alt={homeTeam.name}
                className="w-8 h-8 object-contain"
              />
            )}
          </div>

          {/* Score / Time */}
          <div className="w-32 flex flex-col items-center mx-4">
            {isFinished ? (
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">{score.home}</span>
                <span className="text-gray-400">-</span>
                <span className="text-2xl font-bold text-gray-900">{score.away}</span>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600">
                  {formatDate(fixture.starting_at)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatTime(fixture.starting_at)} ET
                </div>
              </div>
            )}
            <span className={`mt-1 px-2 py-0.5 rounded text-xs font-medium text-white ${matchState.class}`}>
              {matchState.text}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex-1 flex items-center space-x-3">
            {awayTeam?.image_path && (
              <img
                src={awayTeam.image_path}
                alt={awayTeam.name}
                className="w-8 h-8 object-contain"
              />
            )}
            <span className="font-medium text-gray-900">
              {awayTeam?.name || 'TBD'}
            </span>
          </div>
        </div>

        {/* Venue */}
        {fixture.venue?.name && (
          <div className="mt-2 text-center text-xs text-gray-500">
            📍 {fixture.venue.name}
          </div>
        )}
      </Link>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header with Season Selector */}
      <div className={`px-4 py-4 bg-gradient-to-r ${colors.gradient} flex items-center justify-between`}>
        <div className="flex items-center space-x-3">
          {/* Cup "Logo" placeholder */}
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className={`${colors.accent} font-bold text-sm`}>
              {leagueName.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{leagueName}</h2>
            <p className="text-white/70 text-sm">
              {getSelectedSeasonName() || 'Loading...'}
            </p>
          </div>
        </div>

        {/* Season Dropdown */}
        {seasonsLoading ? (
          <div className="text-white/70 text-sm">Loading seasons...</div>
        ) : (
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="px-3 py-2 bg-white/10 text-white border border-white/30 rounded-md 
                       focus:outline-none focus:ring-2 focus:ring-white/50
                       cursor-pointer"
          >
            {seasons.map((season) => (
              <option 
                key={season.id} 
                value={season.id}
                className="text-gray-900"
              >
                {season.name} {season.is_current ? '(Current)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stage Navigation Tabs */}
      {!stagesLoading && stages.length > 0 && (
        <div className="bg-gray-900 px-4 py-3 overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                  ${selectedStageId === stage.id
                    ? `${colors.buttonActive} text-white border`
                    : `${colors.buttonInactive} text-white border`
                  }`}
              >
                {stage.name}
                {stage.is_current && (
                  <span className="ml-2 text-xs opacity-75">●</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 border-b">
          {error}
        </div>
      )}

      {/* Loading State */}
      {stagesLoading ? (
        <div className="text-center py-12 text-gray-500">
          Loading fixtures...
        </div>
      ) : stages.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No stages available for this season.
        </div>
      ) : fixtures.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No fixtures in this stage yet.
        </div>
      ) : (
        /* Fixtures List */
        <div className="p-4 space-y-3">
          {/* Stage Info Header */}
          {selectedStage && (
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedStage.name}</h3>
                {selectedStage.starting_at && (
                  <p className="text-sm text-gray-500">
                    {formatDate(selectedStage.starting_at)}
                    {selectedStage.ending_at && selectedStage.ending_at !== selectedStage.starting_at && (
                      <span> - {formatDate(selectedStage.ending_at)}</span>
                    )}
                  </p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.badge}`}>
                {fixtures.length} {fixtures.length === 1 ? 'Match' : 'Matches'}
              </span>
            </div>
          )}

          {/* Fixtures */}
          {fixtures.map(renderFixture)}
        </div>
      )}

      {/* Footer with Stage Stats */}
      {!stagesLoading && stages.length > 0 && selectedStage && (
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
          <p>
            📊 <strong>Stage Status:</strong> {selectedStage.finished ? 'Completed' : 'In Progress'}
            {selectedStage.finished && fixtures.length > 0 && (
              <span> • All {fixtures.length} matches played</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default CupCompetition;
