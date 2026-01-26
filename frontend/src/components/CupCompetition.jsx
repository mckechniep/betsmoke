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
// - leagueLogo (string): URL to the league logo image (optional)
// - accentColor (string): Tailwind color for styling (e.g., "red", "green")
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dataApi } from '../api/client';
import AppIcon from './AppIcon';

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
  
  // Common state IDs (from SportsMonks API):
  // 1 = Not Started (NS)
  // 2 = 1st Half (INPLAY_1ST_HALF) - LIVE
  // 3 = Half Time (HT)
  // 4 = Break (BREAK)
  // 5 = Full Time (FT) - FINISHED
  // 6 = Extra Time (INPLAY_ET) - LIVE
  // 7 = After Extra Time (AET) - FINISHED (cup games)
  // 8 = After Penalties (FT_PEN) - FINISHED (cup games)
  // 9 = Penalties (INPLAY_PENALTIES) - LIVE
  // 10 = Postponed (POSTPONED)
  // 11 = Suspended
  // 13 = Cancelled
  // 14 = TBA
  // 15 = Walkover (WO) - FINISHED
  // 16 = Abandoned
  // 17 = Interrupted
  // 19 = Awaiting Updates (AU) - Ghost/stale fixture
  // 22 = 2nd Half (INPLAY_2ND_HALF) - LIVE
  
  // FINISHED states (game is over, result is final)
  if (state === 'FT' || stateId === 5) return { text: 'FT', class: 'bg-gray-500' };
  if (state === 'AET' || stateId === 7) return { text: 'AET', class: 'bg-gray-500' };
  if (state === 'FT_PEN' || stateId === 8) return { text: 'FT (Pen)', class: 'bg-gray-500' };
  if (state === 'WO' || stateId === 15) return { text: 'W/O', class: 'bg-gray-500' };
  
  // STALE/GHOST fixture (SportsMonks data issue)
  if (state === 'AWAITING_UPDATES' || stateId === 19) return { text: 'Stale', class: 'bg-gray-400' };
  
  // LIVE states (game is currently being played)
  if (state === 'INPLAY_1ST_HALF' || stateId === 2) return { text: '1st Half', class: 'bg-red-500 animate-pulse' };
  if (state === 'INPLAY_2ND_HALF' || stateId === 22) return { text: '2nd Half', class: 'bg-red-500 animate-pulse' };
  if (state === 'HT' || stateId === 3) return { text: 'HT', class: 'bg-yellow-500' };
  if (state === 'BREAK' || stateId === 4) return { text: 'Break', class: 'bg-yellow-500' };
  if (state === 'INPLAY_ET' || stateId === 6) return { text: 'ET', class: 'bg-red-500 animate-pulse' };
  if (state === 'INPLAY_PENALTIES' || stateId === 9) return { text: 'Penalties', class: 'bg-red-500 animate-pulse' };
  
  // UPCOMING state
  if (state === 'NS' || stateId === 1) return { text: 'Upcoming', class: 'bg-blue-500' };
  if (state === 'TBA' || stateId === 14) return { text: 'TBA', class: 'bg-blue-500' };
  
  // DISRUPTED states (game didn't complete normally)
  if (state === 'POSTPONED' || stateId === 10) return { text: 'Postponed', class: 'bg-orange-500' };
  if (state === 'SUSP' || stateId === 11) return { text: 'Suspended', class: 'bg-orange-500' };
  if (state === 'CANCELLED' || stateId === 13) return { text: 'Cancelled', class: 'bg-red-700' };
  if (state === 'ABANDONED' || stateId === 16) return { text: 'Abandoned', class: 'bg-red-700' };
  if (state === 'INT' || stateId === 17) return { text: 'Interrupted', class: 'bg-orange-500' };
  
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
  leagueLogo = null,      // URL to league logo image
  accentColor = 'blue'    // Tailwind color: red, green, blue, purple, etc.
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
  
  // State for team name filter (fuzzy search)
  const [teamFilter, setTeamFilter] = useState('');

  // ============================================
  // COLOR CLASS MAPPINGS
  // ============================================
  const colorClasses = {
    red: {
      gradient: 'from-red-700 to-red-900',
      badge: 'bg-red-900/50 text-red-400',
      button: 'bg-red-600 hover:bg-red-700',
      buttonActive: 'bg-red-700 border-red-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-red-400',
    },
    green: {
      gradient: 'from-green-700 to-green-900',
      badge: 'bg-green-900/50 text-green-400',
      button: 'bg-green-600 hover:bg-green-700',
      buttonActive: 'bg-green-700 border-green-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-green-400',
    },
    blue: {
      gradient: 'from-blue-700 to-blue-900',
      badge: 'bg-blue-900/50 text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700',
      buttonActive: 'bg-blue-700 border-blue-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-blue-400',
    },
    purple: {
      gradient: 'from-purple-700 to-purple-900',
      badge: 'bg-purple-900/50 text-purple-400',
      button: 'bg-purple-600 hover:bg-purple-700',
      buttonActive: 'bg-purple-700 border-purple-300',
      buttonInactive: 'bg-white/10 hover:bg-white/20 border-white/30',
      accent: 'text-purple-400',
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
        
        // ============================================
        // AUTO-SELECT THE "CURRENT" STAGE
        // ============================================
        // Priority:
        // 1. Stage with is_current = true (from API)
        // 2. First stage with upcoming/unfinished fixtures (the "active" round)
        // 3. Last stage with fixtures (most recent completed round)
        // 4. First stage as fallback
        if (sortedStages.length > 0) {
          // Helper: Check if a stage has any fixtures still pending (not resolved)
          // 
          // RESOLVED states (game won't be played or is done):
          // - Finished: 5 (FT), 7 (AET), 8 (FT_PEN), 15 (W/O)
          // - Disrupted: 10 (POSTPONED), 11 (SUSP), 13 (CANCELLED), 16 (ABANDONED), 17 (INT)
          // - Stale: 19 (AWAITING_UPDATES) - ghost fixtures from SportsMonks
          //
          // PENDING states (game still needs to happen or is live):
          // - Upcoming: 1 (NS), 14 (TBA)
          // - Live: 2, 3, 4, 6, 9, 22
          //
          // NOTE: Fixtures without state data are treated as resolved (ghost/bad data)
          const resolvedStateIds = [5, 7, 8, 15, 10, 11, 13, 16, 17, 19];
          const resolvedStates = ['FT', 'AET', 'FT_PEN', 'WO', 'POSTPONED', 'SUSP', 'CANCELLED', 'ABANDONED', 'INT', 'AWAITING_UPDATES'];
          
          const hasUpcomingFixtures = (stage) => {
            return stage.fixtures?.some(f => {
              const state = f.state?.state || '';
              const stateId = f.state_id;
              
              // If no state data at all, treat as resolved (ghost fixture)
              // This prevents bad SportsMonks data from keeping us stuck on old rounds
              if (!stateId && !state) {
                return false; // Not pending
              }
              
              // Pending if state is NOT in resolved list
              const isResolved = resolvedStateIds.includes(stateId) || resolvedStates.includes(state);
              return !isResolved;
            });
          };
          
          // Try to find the current stage using multiple strategies
          const apiCurrentStage = sortedStages.find(s => s.is_current);
          const activeStage = sortedStages.find(s => hasUpcomingFixtures(s));
          const lastStageWithFixtures = [...sortedStages].reverse().find(s => s.fixtures?.length > 0);
          
          // Pick the best option
          const selected = apiCurrentStage || activeStage || lastStageWithFixtures || sortedStages[0];
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
  const allFixtures = selectedStage?.fixtures || [];
  
  // ============================================
  // HELPER: Filter fixtures by team name
  // ============================================
  const filterFixturesByTeam = (fixtureList, searchText) => {
    if (!searchText.trim()) return fixtureList;
    
    const lowerSearch = searchText.toLowerCase().trim();
    return fixtureList.filter(fixture => {
      const participants = fixture.participants || [];
      const homeTeam = participants.find(p => p.meta?.location === 'home') || participants[0];
      const awayTeam = participants.find(p => p.meta?.location === 'away') || participants[1];
      
      const homeMatch = homeTeam?.name?.toLowerCase().includes(lowerSearch);
      const awayMatch = awayTeam?.name?.toLowerCase().includes(lowerSearch);
      
      return homeMatch || awayMatch;
    });
  };
  
  // ============================================
  // FILTER FIXTURES BY TEAM NAME (fuzzy search)
  // ============================================
  // First, filter current stage fixtures
  const currentStageFiltered = filterFixturesByTeam(allFixtures, teamFilter);
  
  // If filter is active but no results in current stage,
  // search across ALL stages and group by stage
  const crossStageResults = [];
  let isShowingCrossStageResults = false;
  
  if (teamFilter.trim() && currentStageFiltered.length === 0 && stages.length > 0) {
    isShowingCrossStageResults = true;
    
    // Search all stages for matching fixtures
    stages.forEach(stage => {
      const stageFixtures = stage.fixtures || [];
      const matches = filterFixturesByTeam(stageFixtures, teamFilter);
      
      if (matches.length > 0) {
        crossStageResults.push({
          stage: stage,
          fixtures: matches
        });
      }
    });
  }
  
  // The fixtures to display (either current stage filtered, or we'll handle cross-stage separately)
  const fixtures = currentStageFiltered;

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
    
    // Check if match is finished (includes cup-specific states like AET and FT_PEN)
    // Finished state IDs: 5 (FT), 7 (AET), 8 (FT_PEN), 15 (W/O)
    const finishedStateIds = [5, 7, 8, 15];
    const finishedStates = ['FT', 'AET', 'FT_PEN', 'WO'];
    const isFinished = finishedStateIds.includes(fixture.state_id) || 
                       finishedStates.includes(fixture.state?.state);
    
    return (
      <Link
        key={fixture.id}
        to={`/fixtures/${fixture.id}`}
        className="block bg-gray-700 hover:bg-gray-600 rounded-lg p-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <div className="flex-1 flex items-center justify-end space-x-3">
            <span className="font-medium text-gray-100 text-right">
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
                <span className="text-2xl font-bold text-gray-100">{score.home}</span>
                <span className="text-gray-400">-</span>
                <span className="text-2xl font-bold text-gray-100">{score.away}</span>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm font-medium text-gray-300">
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
            <span className="font-medium text-gray-100">
              {awayTeam?.name || 'TBD'}
            </span>
          </div>
        </div>

        {/* Venue */}
        {fixture.venue?.name && (
          <div className="mt-2 text-center text-xs text-gray-500 flex items-center justify-center gap-1">
            <AppIcon name="location" size="xs" className="text-gray-500" />
            <span>{fixture.venue.name}</span>
          </div>
        )}
      </Link>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header with Season Selector */}
      <div className={`px-4 py-4 bg-gradient-to-r ${colors.gradient} flex items-center justify-between`}>
        <div className="flex items-center space-x-3">
          {/* Cup Logo */}
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1">
            {leagueLogo ? (
              <img 
                src={leagueLogo} 
                alt={leagueName}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <span className={`${colors.accent} font-bold text-sm`}>
                {leagueName.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </span>
            )}
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
            onChange={(e) => {
              setSelectedSeasonId(parseInt(e.target.value));
              setTeamFilter(''); // Clear filter when changing seasons
            }}
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
                onClick={() => {
                  setSelectedStageId(stage.id);
                  setTeamFilter(''); // Clear filter when changing stages
                }}
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

      {/* Team Filter Input */}
      {!stagesLoading && allFixtures.length > 0 && (
        <div className="px-4 py-3 bg-gray-700 border-b border-gray-600">
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by team name (e.g. 'ful' for Fulham)..."
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-600 rounded-lg bg-gray-800 text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                         text-sm placeholder-gray-500"
            />
            {/* Search Icon */}
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            {/* Clear Button */}
            {teamFilter && (
              <button
                onClick={() => setTeamFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 
                           hover:text-gray-300 text-sm font-medium"
              >
                ✕
              </button>
            )}
          </div>
          {/* Filter Results Count */}
          {teamFilter.trim() && (
            <p className="text-xs text-gray-500 mt-2">
              {isShowingCrossStageResults ? (
                // Cross-stage search results
                crossStageResults.length > 0 ? (
                  <span>
                    No matches in current round. Found <strong>{crossStageResults.reduce((sum, r) => sum + r.fixtures.length, 0)}</strong> fixture(s) in other rounds.
                  </span>
                ) : (
                  <span>No matches found in any round</span>
                )
              ) : (
                // Current stage results
                <span>
                  Showing {fixtures.length} of {allFixtures.length} fixtures
                  {fixtures.length === 0 && ' — no matches found'}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 border-b border-gray-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {/* 
        Show loading when:
        - Seasons are still loading (can't fetch stages without a season)
        - OR stages are actively being fetched
      */}
      {seasonsLoading || stagesLoading ? (
        <div className="text-center py-12 text-gray-500">
          Loading fixtures...
        </div>
      ) : stages.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No stages available for this season.
        </div>
      ) : fixtures.length === 0 && !isShowingCrossStageResults ? (
        <div className="text-center py-12 text-gray-500">
          No fixtures in this stage yet.
        </div>
      ) : isShowingCrossStageResults && crossStageResults.length > 0 ? (
        /* Cross-Stage Search Results */
        <div className="p-4 space-y-6">
          <div className="text-center pb-3 border-b border-gray-700">
            <p className="text-sm text-gray-400">
              🔍 Showing all "{teamFilter}" fixtures across rounds
            </p>
          </div>
          
          {crossStageResults.map(({ stage, fixtures: stageFixtures }) => (
            <div key={stage.id} className="space-y-3">
              {/* Stage Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-100">{stage.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                  {stageFixtures.length} {stageFixtures.length === 1 ? 'Match' : 'Matches'}
                </span>
              </div>
              
              {/* Stage Fixtures */}
              {stageFixtures.map(renderFixture)}
            </div>
          ))}
        </div>
      ) : isShowingCrossStageResults && crossStageResults.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No matches found for "{teamFilter}" in any round.
        </div>
      ) : (
        /* Fixtures List */
        <div className="p-4 space-y-3">
          {/* Stage Info Header */}
          {selectedStage && (
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
              <div>
                <h3 className="font-semibold text-gray-100">{selectedStage.name}</h3>
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

      {/* Footer with Stage Stats - Hide when showing cross-stage results */}
      {!stagesLoading && stages.length > 0 && selectedStage && !isShowingCrossStageResults && fixtures.length > 0 && (
        <div className="px-4 py-3 bg-gray-700 border-t border-gray-600 text-xs text-gray-400">
          <p>
            <AppIcon name="stats" size="xs" className="text-gray-400 inline-block" /> <strong>Stage Status:</strong> {selectedStage.finished ? 'Completed' : 'In Progress'}
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
