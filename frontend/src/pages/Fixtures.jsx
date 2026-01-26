// ============================================
// FIXTURES PAGE
// ============================================
// Shows upcoming fixtures for Premier League, FA Cup, and Carabao Cup
// from today through the end of the following week (second Sunday).
// Includes search by team (with autocomplete) and by date functionality.
// ============================================

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { dataApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/AppIcon';
import {
  formatTime as formatTimeUtil,
  formatDateOnly,
  formatShortDateOnly,
  getTimezoneDateString,
  formatTemperature
} from '../utils/formatters';

// ============================================
// LEAGUE IDS (Our subscription)
// ============================================
const ALLOWED_LEAGUE_IDS = [8, 24, 27]; // Premier League, FA Cup, Carabao Cup

// Fallback league names (used if API data not loaded)
const LEAGUE_NAMES = {
  8: 'Premier League',
  24: 'FA Cup',
  27: 'Carabao Cup'
};

// Helper to get league name by ID (uses fetched data if available, falls back to static names)
const getLeagueName = (leagueId, leaguesData = null) => {
  if (leaguesData && leaguesData[leagueId]) {
    return leaguesData[leagueId].name;
  }
  return LEAGUE_NAMES[leagueId] || 'Unknown';
};

// ============================================
// CONSTANTS
// ============================================
const MAX_DATE_RANGE_DAYS = 30; // Max days for general date range search (all teams)
const MAX_TEAM_DATE_RANGE_DAYS = 100; // Max days for team-specific date range

// ============================================
// SEASON OPTIONS (for historical search)
// ============================================
const SEASON_OPTIONS = [];
for (let year = 2024; year >= 2015; year--) {
  SEASON_OPTIONS.push({
    value: `${year}`,
    label: `${year}/${year + 1}`,
    startDate: `${year}-07-01`,
    endDate: `${year + 1}-06-30`
  });
}

// ============================================
// HELPER: Calculate date range (today → second Sunday)
// ============================================
function getDateRange() {
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  
  const secondSunday = new Date(today);
  secondSunday.setDate(today.getDate() + daysUntilSunday + 7);
  
  const endDate = secondSunday.toISOString().split('T')[0];
  
  return { startDate, endDate };
}

// ============================================
// NOTE: Date/Time formatting functions have been moved to
// src/utils/formatters.js for centralized user preference handling.
// The Fixtures component uses hooks to get user preferences and
// passes them to the formatters.
// ============================================

// ============================================
// HELPER: Parse UTC datetime string to Date object
// ============================================
// SportsMonks returns times in UTC format: "2024-12-26 15:00:00"
// We need to explicitly tell JavaScript this is UTC, then convert.
// (Still needed locally for sorting operations)
function parseUTCDateTime(dateString) {
  // "2024-12-26 15:00:00" -> "2024-12-26T15:00:00Z" (ISO format with Z = UTC)
  const isoString = dateString.replace(' ', 'T') + 'Z';
  return new Date(isoString);
}

// ============================================
// HELPER: Group fixtures by date (user's timezone)
// ============================================
function groupFixturesByDate(fixtures, timezone = 'America/New_York') {
  const groups = {};

  fixtures.forEach(fixture => {
    // Group by user's timezone date, not UTC date
    const date = getTimezoneDateString(fixture.starting_at, timezone);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(fixture);
  });

  const sortedDates = Object.keys(groups).sort();

  return sortedDates.map(date => ({
    date,
    fixtures: groups[date].sort((a, b) =>
      parseUTCDateTime(a.starting_at) - parseUTCDateTime(b.starting_at)
    )
  }));
}

// ============================================
// HELPER: Get normalized match state
// ============================================
// SportsMonks short_name values (lowercase after normalization):
//   "ns" = Not Started
//   "1st" = First Half (INPLAY_1ST_HALF)
//   "ht" = Half Time
//   "2nd" = Second Half (INPLAY_2ND_HALF)
//   "et" = Extra Time
//   "pen" = Penalty Shootout (in progress)
//   "ft" = Full Time (90 mins)
//   "aet" = After Extra Time
//   "ftp" = After Penalties (FT_PEN)
//
// Returns lowercase short_name, or null if state unknown.
function getMatchState(fixture) {
  const stateObj = fixture.state;
  if (!stateObj) return null;

  // Use short_name - it's consistent across all endpoints
  if (stateObj.short_name) {
    return stateObj.short_name.toLowerCase();
  }

  return null;
}

// ============================================
// HELPER: Format match state for display
// ============================================
// Converts short state codes to user-friendly text
// e.g., "1st" → "1st Half", "2nd" → "2nd Half"
function formatMatchStateDisplay(matchState) {
  if (!matchState) return 'Scheduled';

  const stateMap = {
    '1st': '1st Half',
    '1h': '1st Half',
    '2nd': '2nd Half',
    '2h': '2nd Half',
    'ht': 'Half Time',
    'et': 'Extra Time',
    'pen': 'Penalties',
    'break': 'Break',
    'live': 'Live',
    'inplay': 'Live',
  };

  return stateMap[matchState] || matchState.toUpperCase();
}

// ============================================
// HELPER: Get score display
// ============================================
// Only returns a score if the match is LIVE or FINISHED.
// For upcoming matches, returns null so kickoff time is shown instead.
//
// Score type_ids (from SportsMonks):
//   - 1525 = CURRENT (the score to display)
//   - 1 = 1ST_HALF
//   - 2 = 2ND_HALF
//   - 39 = PENALTY_SHOOTOUT
function getScoreDisplay(fixture) {
  const matchState = getMatchState(fixture);
  
  // Valid states where we should show a score
  // SportsMonks uses: "1st", "2nd", "ht", "et", "pen", "ft", "aet", "ftp"
  // Also include legacy values for compatibility
  const validStatesForScore = ['1st', '2nd', 'ht', 'et', 'pen', 'ft', 'aet', 'ftp', '1h', '2h'];
  
  if (!matchState || !validStatesForScore.includes(matchState)) {
    return null;
  }
  
  // No scores array = can't show score
  if (!fixture.scores || fixture.scores.length === 0) {
    return null;
  }
  
  let homeScore = null;
  let awayScore = null;
  
  // Method 1: Find by description === 'CURRENT'
  for (const s of fixture.scores) {
    if (s.description === 'CURRENT') {
      if (s.score?.participant === 'home') homeScore = s.score?.goals;
      if (s.score?.participant === 'away') awayScore = s.score?.goals;
    }
  }
  
  // Method 2: Find by type_id 1525 (CURRENT) if description didn't work
  if (homeScore === null || awayScore === null) {
    for (const s of fixture.scores) {
      if (s.type_id === 1525) {
        if (s.score?.participant === 'home') homeScore = s.score?.goals;
        if (s.score?.participant === 'away') awayScore = s.score?.goals;
      }
    }
  }
  
  if (homeScore !== null && awayScore !== null) {
    return `${homeScore} - ${awayScore}`;
  }
  
  return null;
}

// ============================================
// HELPER: Calculate days between dates
// ============================================
function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// HELPER: Get weather display data from weatherReport
// ============================================
// Uses SportsMonks weather icon URL and description
// weatherReport is a SEPARATE include from metadata (not nested inside it)
// temperatureUnit: 'FAHRENHEIT' or 'CELSIUS' (user preference)
function getWeatherDisplay(weatherReport, temperatureUnit = 'FAHRENHEIT') {
  if (!weatherReport) return null;

  const weather = weatherReport;
  const condition = weather.description?.toLowerCase() || weather.type?.toLowerCase() || '';
  const temp = weather.temperature?.day; // Daytime temperature in Celsius
  const iconUrl = weather.icon; // SportsMonks CDN icon URL

  const label = weather.description || condition || 'Unknown';

  // Format temperature using user preference
  const tempDisplay = formatTemperature(temp, temperatureUnit);

  return { iconUrl, label, tempDisplay, condition };
}

// ============================================
// HELPER: Get "time ago" text for last updated
// ============================================
// Returns "X minutes ago" if under 60 minutes,
// otherwise "X hours ago" (rounded to nearest hour)
function getTimeAgoText(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  // Less than 1 minute = "just now"
  if (diffMinutes < 1) {
    return 'just now';
  }
  
  // Less than 60 minutes = "X minutes ago"
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  
  // 60+ minutes = round to nearest hour
  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
}

// ============================================
// FIXTURE LEGEND COMPONENT
// ============================================
// Shows the color key for Live and Finished matches.
// Reusable across DefaultFixtures and SearchResults.
function FixtureLegend() {
  return (
    <div className="text-xs text-gray-500 flex items-center space-x-4 mb-2">
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 bg-green-500 rounded"></div>
        <span>Live Match</span>
      </div>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 bg-gray-400 rounded"></div>
        <span>Finished</span>
      </div>
    </div>
  );
}

// ============================================
// REFRESH BAR COMPONENT
// ============================================
// Shows "Last Updated" timestamp and a Refresh button.
// Reusable across DefaultFixtures and SearchResults.
function RefreshBar({ timeAgoText, loading, onRefresh }) {
  return (
    <div className="flex items-center justify-between mb-4 bg-gray-700 rounded-lg px-4 py-2">
      <div className="text-sm text-gray-500">
        {timeAgoText && (
          <span className="flex items-center gap-1">
            <AppIcon name="clock" size="sm" /> Last updated: <span className="font-medium">{timeAgoText}</span>
          </span>
        )}
      </div>
      
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center space-x-2 px-3 py-1.5 border border-amber-500 text-amber-500
                   rounded-md text-sm font-medium hover:bg-amber-500/10
                   disabled:border-gray-500 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
            <span>Refreshing...</span>
          </>
        ) : (
          <>
            <AppIcon name="refresh" size="md" className="text-amber-500" />
            <span>Refresh</span>
          </>
        )}
      </button>
    </div>
  );
}

// ============================================
// FIXTURE CARD COMPONENT
// ============================================
function FixtureCard({ fixture, timezone, temperatureUnit }) {
  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const score = getScoreDisplay(fixture);

  // Get weather info from weatherreport (separate include from metadata)
  const weather = getWeatherDisplay(fixture.weatherreport, temperatureUnit);

  // Get normalized match state using our helper
  const matchState = getMatchState(fixture);

  // Match is finished if it's FT, AET, or FTP (after penalties)
  const isFinished = ['ft', 'aet', 'ftp'].includes(matchState);
  const isAfterExtraTime = matchState === 'aet';
  const isAfterPenalties = matchState === 'ftp';

  // Match is live if in progress
  // SportsMonks uses: "1st" (1st half), "2nd" (2nd half), "HT" (half time), "ET", "PEN"
  // Also check for legacy values and variations
  const isLive = ['1st', '2nd', 'ht', 'et', 'pen', 'live', 'inplay', '1h', '2h'].includes(matchState);
  
  // ============================================
  // GET PENALTY SCORE (for FT_PEN matches only)
  // ============================================
  let penaltyScore = null;
  let penaltyWinner = null; // 'home' or 'away'
  
  if (isAfterPenalties) {
    // Look for PENALTY_SHOOTOUT scores by description
    let homePenGoals = null;
    let awayPenGoals = null;
    
    const penaltyScoresByDesc = fixture.scores?.filter(s => s.description === 'PENALTY_SHOOTOUT');
    if (penaltyScoresByDesc && penaltyScoresByDesc.length > 0) {
      penaltyScoresByDesc.forEach(penScore => {
        if (penScore.score?.participant === 'home') homePenGoals = penScore.score?.goals;
        if (penScore.score?.participant === 'away') awayPenGoals = penScore.score?.goals;
      });
    }
    
    // Fallback: Try by type_id (type_id for penalty shootout may vary)
    if (homePenGoals === null || awayPenGoals === null) {
      // Type ID 39 is often PENALTY_SHOOTOUT
      const penaltyScoresByType = fixture.scores?.filter(s => s.type_id === 39);
      if (penaltyScoresByType && penaltyScoresByType.length > 0) {
        penaltyScoresByType.forEach(penScore => {
          if (penScore.score?.participant === 'home') homePenGoals = penScore.score?.goals;
          if (penScore.score?.participant === 'away') awayPenGoals = penScore.score?.goals;
        });
      }
    }
    
    if (homePenGoals !== null && awayPenGoals !== null) {
      penaltyScore = { home: homePenGoals, away: awayPenGoals };
      if (homePenGoals > awayPenGoals) penaltyWinner = 'home';
      else if (awayPenGoals > homePenGoals) penaltyWinner = 'away';
    }
    
    // Fallback: Check result_info or winner_team_id if no penalty scores found
    if (!penaltyWinner) {
      if (fixture.result_info) {
        const resultInfo = fixture.result_info.toLowerCase();
        const homeNameLower = homeTeam?.name?.toLowerCase() || '';
        const awayNameLower = awayTeam?.name?.toLowerCase() || '';
        if (homeNameLower && resultInfo.includes(homeNameLower) && resultInfo.includes('won')) {
          penaltyWinner = 'home';
        } else if (awayNameLower && resultInfo.includes(awayNameLower) && resultInfo.includes('won')) {
          penaltyWinner = 'away';
        }
      }
      if (!penaltyWinner && fixture.winner_team_id) {
        if (fixture.winner_team_id === homeTeam?.id) penaltyWinner = 'home';
        else if (fixture.winner_team_id === awayTeam?.id) penaltyWinner = 'away';
      }
    }
  }
  
  // Get winning team name for penalty display
  const penaltyWinnerName = penaltyWinner === 'home' ? homeTeam?.name : 
                            penaltyWinner === 'away' ? awayTeam?.name : null;

  return (
    <Link
      to={`/fixtures/${fixture.id}`}
      className={`
        block bg-gray-800 rounded-lg shadow-md p-4 
        hover:shadow-lg transition-shadow cursor-pointer
        ${isLive ? 'border-l-4 border-l-green-500' : ''}
        ${isFinished ? 'border-l-4 border-l-gray-400' : ''}
      `}
    >
      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
        <span className="font-medium">
          {fixture.league?.name || getLeagueName(fixture.league_id)}
        </span>
        {isLive && (
          <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse">
            LIVE
          </span>
        )}
        {isFinished && (
          <span className="bg-gray-400 text-white px-2 py-0.5 rounded text-xs font-bold">
            FT
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {/* Home Team - no special styling for AET/penalty wins */}
        <div className="flex-1 flex items-center justify-end space-x-3">
          <span className="font-medium text-right">
            {homeTeam?.name || 'Home'}
          </span>
          {homeTeam?.image_path && (
            <img
              src={homeTeam.image_path}
              alt={homeTeam.name}
              className="w-8 h-8 object-contain"
            />
          )}
        </div>

        {/* Score Section */}
        <div className="px-6 text-center min-w-[120px]">
          {score ? (
            <div>
              <div className={`text-xl font-bold ${isLive ? 'text-green-600' : ''}`}>
                {score}
              </div>
              {/* State indicator */}
              <div className="text-xs text-gray-400 mt-1">
                {isAfterPenalties ? 'P' : isAfterExtraTime ? 'AET' : isFinished ? 'FT' : isLive ? formatMatchStateDisplay(matchState) : 'Scheduled'}
              </div>
              {/* Penalty score and winner (only for penalty shootout wins) */}
              {isAfterPenalties && penaltyScore && (
                <div className="text-xs text-gray-500 mt-1">
                  <div className="font-medium">({penaltyScore.home}-{penaltyScore.away})</div>
                  {penaltyWinnerName && (
                    <div className="text-gray-400 mt-0.5">{penaltyWinnerName} wins on penalties</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-lg font-medium text-gray-300">
                {formatTimeUtil(fixture.starting_at, timezone)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Scheduled</div>
            </div>
          )}
        </div>

        {/* Away Team - no special styling for AET/penalty wins */}
        <div className="flex-1 flex items-center space-x-3">
          {awayTeam?.image_path && (
            <img
              src={awayTeam.image_path}
              alt={awayTeam.name}
              className="w-8 h-8 object-contain"
            />
          )}
          <span className="font-medium">
            {awayTeam?.name || 'Away'}
          </span>
        </div>
      </div>

      {/* Venue */}
      {fixture.venue?.name && (
        <div className="mt-2 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <AppIcon name="location" size="xs" /> {fixture.venue.name}
        </div>
      )}

      {/* Weather - below venue */}
      {weather && (
        <div className="mt-1 text-sm text-gray-500 text-center flex items-center justify-center space-x-2">
          {weather.iconUrl && (
            <div className="bg-gradient-to-b from-sky-100 to-slate-200 rounded-full p-1 shadow-sm">
              <img src={weather.iconUrl} alt={weather.label} className="w-8 h-8" />
            </div>
          )}
          {weather.tempDisplay && <span className="font-medium">{weather.tempDisplay}</span>}
        </div>
      )}

      <div className="mt-2 text-xs text-amber-500 text-center">
        Click for details, odds &amp; H2H →
      </div>
    </Link>
  );
}

// ============================================
// TEAM AUTOCOMPLETE COMPONENT
// ============================================
function TeamAutocomplete({ selectedTeam, onSelectTeam, disabled }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2 || selectedTeam) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await dataApi.searchTeams(query);
        const teams = data.teams || [];
        setSuggestions(teams);
        setShowDropdown(teams.length > 0);
      } catch (err) {
        console.error('Team search failed:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, selectedTeam]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (team) => {
    onSelectTeam(team);
    setQuery(team.name);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    if (selectedTeam && value !== selectedTeam.name) {
      onSelectTeam(null);
    }
  };

  const handleClear = () => {
    setQuery('');
    onSelectTeam(null);
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Type team name (e.g., Man, Liv, Ars...)"
          disabled={disabled}
          className={`w-full px-4 py-2 border rounded-md 
                     focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                     ${selectedTeam ? 'border-green-500 bg-green-900/30' : 'border-gray-600'}
                     ${disabled ? 'bg-gray-600 cursor-not-allowed' : ''}`}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
          {loading && (
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          )}
          {selectedTeam && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {selectedTeam && (
        <div className="mt-1 text-xs text-green-600 flex items-center space-x-1">
          <span>Selected:</span>
          <span className="font-medium">{selectedTeam.name}</span>
          {selectedTeam.image_path && (
            <img 
              src={selectedTeam.image_path} 
              alt="" 
              className="w-4 h-4 object-contain"
            />
          )}
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => handleSelect(team)}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-3 border-b last:border-b-0"
            >
              {team.image_path && (
                <img 
                  src={team.image_path} 
                  alt="" 
                  className="w-6 h-6 object-contain"
                />
              )}
              <div>
                <div className="font-medium text-gray-100">{team.name}</div>
                {team.country?.name && (
                  <div className="text-xs text-gray-500">{team.country.name}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && suggestions.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg p-3 text-sm text-gray-500">
          No teams found matching "{query}"
        </div>
      )}
    </div>
  );
}

// ============================================
// SEARCH PANEL COMPONENT
// ============================================
function SearchPanel({ onSearchResults, onClearSearch, isSearchActive }) {
  // Search mode: 'team', 'competition', or 'date'
  const [searchMode, setSearchMode] = useState('team');

  // Leagues data (fetched from API for logos)
  const [leaguesData, setLeaguesData] = useState(null);
  const [leaguesLoading, setLeaguesLoading] = useState(false);

  // Competition search state
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [competitionSearchType, setCompetitionSearchType] = useState('upcoming'); // 'upcoming' or 'dateRange'
  const [competitionStartDate, setCompetitionStartDate] = useState('');
  const [competitionEndDate, setCompetitionEndDate] = useState('');
  const [competitionSearchLoading, setCompetitionSearchLoading] = useState(false);
  
  // Team search state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamSearchLoading, setTeamSearchLoading] = useState(false);
  const [searchType, setSearchType] = useState('upcoming'); // 'upcoming', 'historical', 'dateRange'
  const [selectedSeason, setSelectedSeason] = useState('2024');
  
  // Team date range state (for custom range - max 100 days)
  const [teamStartDate, setTeamStartDate] = useState('');
  const [teamEndDate, setTeamEndDate] = useState('');
  
  // Date search state
  const [dateSearchType, setDateSearchType] = useState('single'); // 'single' or 'range'
  const [searchDate, setSearchDate] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [dateSearchLoading, setDateSearchLoading] = useState(false);
  
  // Error and progress state
  const [searchError, setSearchError] = useState('');
  const [loadingProgress, setLoadingProgress] = useState('');

  // ============================================
  // FETCH LEAGUES DATA (for competition logos)
  // ============================================
  useEffect(() => {
    // Only fetch when switching to competition mode and data not yet loaded
    if (searchMode === 'competition' && !leaguesData && !leaguesLoading) {
      const fetchLeagues = async () => {
        setLeaguesLoading(true);
        try {
          const data = await dataApi.getLeagues();
          // Convert array to object keyed by league ID for easy lookup
          const leaguesMap = {};
          (data.leagues || []).forEach(league => {
            if (ALLOWED_LEAGUE_IDS.includes(league.id)) {
              leaguesMap[league.id] = {
                name: league.name,
                logo: league.image_path
              };
            }
          });
          setLeaguesData(leaguesMap);
        } catch (err) {
          console.error('Failed to fetch leagues:', err);
          // Will fall back to static names, no logo
        } finally {
          setLeaguesLoading(false);
        }
      };
      fetchLeagues();
    }
  }, [searchMode, leaguesData, leaguesLoading]);

  // ============================================
  // Calculate days in selected ranges
  // ============================================
  const teamDateRangeDays = teamStartDate && teamEndDate ? daysBetween(teamStartDate, teamEndDate) : 0;
  const isTeamDateRangeValid = teamDateRangeDays > 0 && teamDateRangeDays <= MAX_TEAM_DATE_RANGE_DAYS;
  
  const generalDateRangeDays = dateRangeStart && dateRangeEnd ? daysBetween(dateRangeStart, dateRangeEnd) : 0;
  const isGeneralDateRangeValid = generalDateRangeDays > 0 && generalDateRangeDays <= MAX_DATE_RANGE_DAYS;
  
  const competitionDateRangeDays = competitionStartDate && competitionEndDate ? daysBetween(competitionStartDate, competitionEndDate) : 0;
  const isCompetitionDateRangeValid = competitionDateRangeDays > 0 && competitionDateRangeDays <= MAX_DATE_RANGE_DAYS;

  // ============================================
  // SEARCH BY TEAM
  // ============================================
  const handleTeamSearch = async (e) => {
    e.preventDefault();
    
    if (!selectedTeam) {
      setSearchError('Please select a team from the dropdown first.');
      return;
    }
    
    setTeamSearchLoading(true);
    setSearchError('');
    setLoadingProgress('Loading fixtures...');
    
    try {
      let fixturesStartDate, fixturesEndDate, isHistorical = false, seasonLabel = null;
      
      if (searchType === 'upcoming') {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + 100);
        fixturesStartDate = today.toISOString().split('T')[0];
        fixturesEndDate = futureDate.toISOString().split('T')[0];
        
      } else if (searchType === 'historical') {
        const season = SEASON_OPTIONS.find(s => s.value === selectedSeason);
        fixturesStartDate = season.startDate;
        fixturesEndDate = season.endDate;
        isHistorical = true;
        seasonLabel = season.label;
        
      } else if (searchType === 'dateRange') {
        if (!isTeamDateRangeValid) {
          setSearchError(`Please select a valid date range (max ${MAX_TEAM_DATE_RANGE_DAYS} days).`);
          setTeamSearchLoading(false);
          setLoadingProgress('');
          return;
        }
        fixturesStartDate = teamStartDate;
        fixturesEndDate = teamEndDate;
        isHistorical = new Date(teamEndDate) < new Date();
      }
      
      const fixturesData = await dataApi.getTeamFixturesByDateRange(
        fixturesStartDate,
        fixturesEndDate,
        selectedTeam.id
      );
      
      let filteredFixtures = (fixturesData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );
      
      filteredFixtures.sort((a, b) => 
        new Date(a.starting_at) - new Date(b.starting_at)
      );
      
      onSearchResults({
        type: 'team',
        query: selectedTeam.name,
        teamId: selectedTeam.id,
        isHistorical,
        season: seasonLabel,
        dateRange: searchType === 'dateRange' ? { startDate: teamStartDate, endDate: teamEndDate } : null,
        fixtures: filteredFixtures
      });
      
    } catch (err) {
      console.error('Team search failed:', err);
      setSearchError(err.message || 'Search failed. Please try again.');
    } finally {
      setTeamSearchLoading(false);
      setLoadingProgress('');
    }
  };

  // ============================================
  // SEARCH BY COMPETITION
  // ============================================
  const handleCompetitionSearch = async (e) => {
    e.preventDefault();
    
    if (!selectedCompetition) {
      setSearchError('Please select a competition.');
      return;
    }
    
    setCompetitionSearchLoading(true);
    setSearchError('');
    
    try {
      let fixturesStartDate, fixturesEndDate, isHistorical = false;
      
      if (competitionSearchType === 'upcoming') {
        // Show next 30 days of fixtures for this competition
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + 30);
        fixturesStartDate = today.toISOString().split('T')[0];
        fixturesEndDate = futureDate.toISOString().split('T')[0];
      } else {
        // Custom date range
        if (!isCompetitionDateRangeValid) {
          setSearchError(`Please select a valid date range (max ${MAX_DATE_RANGE_DAYS} days).`);
          setCompetitionSearchLoading(false);
          return;
        }
        fixturesStartDate = competitionStartDate;
        fixturesEndDate = competitionEndDate;
        isHistorical = new Date(competitionEndDate) < new Date();
      }
      
      const data = await dataApi.getFixturesByDateRange(fixturesStartDate, fixturesEndDate);
      
      // Filter to only the selected competition
      let filteredFixtures = (data.fixtures || []).filter(
        fixture => fixture.league_id === selectedCompetition
      );
      
      filteredFixtures.sort((a, b) => 
        new Date(a.starting_at) - new Date(b.starting_at)
      );
      
      onSearchResults({
        type: 'competition',
        query: getLeagueName(selectedCompetition, leaguesData),
        competitionId: selectedCompetition,
        isHistorical,
        dateRange: competitionSearchType === 'dateRange' 
          ? { startDate: competitionStartDate, endDate: competitionEndDate } 
          : null,
        fixtures: filteredFixtures
      });
      
    } catch (err) {
      console.error('Competition search failed:', err);
      setSearchError(err.message || 'Search failed. Please try again.');
    } finally {
      setCompetitionSearchLoading(false);
    }
  };

  // ============================================
  // SEARCH BY DATE (single or range)
  // ============================================
  const handleDateSearch = async (e) => {
    e.preventDefault();
    
    setDateSearchLoading(true);
    setSearchError('');
    
    try {
      let fixtures = [];
      let queryInfo = {};
      
      if (dateSearchType === 'single') {
        // Single date search
        if (!searchDate) {
          setSearchError('Please select a date.');
          setDateSearchLoading(false);
          return;
        }
        
        const data = await dataApi.getFixturesByDate(searchDate);
        fixtures = (data.fixtures || []).filter(
          fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
        );
        
        queryInfo = {
          type: 'date',
          query: searchDate,
          isRange: false
        };
        
      } else {
        // Date range search
        if (!isGeneralDateRangeValid) {
          setSearchError(`Please select a valid date range (max ${MAX_DATE_RANGE_DAYS} days).`);
          setDateSearchLoading(false);
          return;
        }
        
        const data = await dataApi.getFixturesByDateRange(dateRangeStart, dateRangeEnd);
        fixtures = (data.fixtures || []).filter(
          fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
        );
        
        queryInfo = {
          type: 'dateRange',
          startDate: dateRangeStart,
          endDate: dateRangeEnd,
          isRange: true
        };
      }
      
      fixtures.sort((a, b) => 
        new Date(a.starting_at) - new Date(b.starting_at)
      );
      
      // Check if dates are in the past
      const isHistorical = dateSearchType === 'single' 
        ? new Date(searchDate) < new Date()
        : new Date(dateRangeEnd) < new Date();
      
      onSearchResults({
        ...queryInfo,
        isHistorical,
        fixtures
      });
      
    } catch (err) {
      console.error('Date search failed:', err);
      setSearchError(err.message || 'Search failed. Please try again.');
    } finally {
      setDateSearchLoading(false);
    }
  };

  // ============================================
  // CLEAR SEARCH
  // ============================================
  const handleClear = () => {
    setSelectedTeam(null);
    setSearchDate('');
    setTeamStartDate('');
    setTeamEndDate('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setSelectedCompetition(null);
    setCompetitionStartDate('');
    setCompetitionEndDate('');
    setCompetitionSearchType('upcoming');
    setSearchError('');
    setSearchType('upcoming');
    setDateSearchType('single');
    setLoadingProgress('');
    onClearSearch();
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
          <AppIcon name="search" size="lg" className="text-gray-400" />
          <span>Search Fixtures</span>
        </h2>
        
        {isSearchActive && (
          <button
            onClick={handleClear}
            className="px-3 py-1 bg-gray-600 text-gray-200 rounded-md text-sm font-medium
                       hover:bg-gray-500 transition-colors"
          >
            ✕ Clear &amp; Show Default
          </button>
        )}
      </div>
      
      {/* Search Mode Tabs */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setSearchMode('team')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${searchMode === 'team'
              ? 'bg-gray-700 text-amber-400 ring-2 ring-amber-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <AppIcon name="team" size="sm" /> By Team
        </button>
        <button
          onClick={() => setSearchMode('competition')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${searchMode === 'competition'
              ? 'bg-gray-700 text-amber-400 ring-2 ring-amber-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <AppIcon name="trophy" size="sm" /> By Competition
        </button>
        <button
          onClick={() => setSearchMode('date')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${searchMode === 'date'
              ? 'bg-gray-700 text-amber-400 ring-2 ring-amber-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <AppIcon name="calendar" size="sm" /> By Date
        </button>
      </div>

      {/* ============================================ */}
      {/* TEAM SEARCH MODE */}
      {/* ============================================ */}
      {searchMode === 'team' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Team
            </label>
            <TeamAutocomplete
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
              disabled={teamSearchLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Start typing to see matching teams. Select a team, then choose how to search.
            </p>
          </div>

          {/* Search Type Options */}
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="searchType"
                value="upcoming"
                checked={searchType === 'upcoming'}
                onChange={() => setSearchType('upcoming')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={teamSearchLoading}
              />
              <span className="text-sm text-gray-300">Upcoming</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="searchType"
                value="dateRange"
                checked={searchType === 'dateRange'}
                onChange={() => setSearchType('dateRange')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={teamSearchLoading}
              />
              <span className="text-sm text-gray-300">Custom Date Range</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="searchType"
                value="historical"
                checked={searchType === 'historical'}
                onChange={() => setSearchType('historical')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={teamSearchLoading}
              />
              <span className="text-sm text-gray-300">Historical Seasons</span>
            </label>
          </div>

          {/* Season Selector (for historical) */}
          {searchType === 'historical' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Season
              </label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="px-3 py-2 border border-gray-600 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
                disabled={teamSearchLoading}
              >
                {SEASON_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Inputs (for custom range) */}
          {searchType === 'dateRange' && (
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={teamStartDate}
                    onChange={(e) => setTeamStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={teamSearchLoading}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={teamEndDate}
                    onChange={(e) => setTeamEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={teamSearchLoading}
                  />
                </div>
              </div>

              {teamStartDate && teamEndDate && (
                <div className={`text-sm ${isTeamDateRangeValid ? 'text-gray-400' : 'text-red-400'}`}>
                  {isTeamDateRangeValid
                    ? `${teamDateRangeDays} days selected`
                    : teamDateRangeDays > MAX_TEAM_DATE_RANGE_DAYS
                      ? `⚠️ ${teamDateRangeDays} days selected (max ${MAX_TEAM_DATE_RANGE_DAYS} days allowed)`
                      : '⚠️ End date must be after start date'
                  }
                </div>
              )}
            </div>
          )}

          {/* Search Button */}
          <button
            onClick={handleTeamSearch}
            disabled={!selectedTeam || teamSearchLoading || (searchType === 'dateRange' && !isTeamDateRangeValid)}
            className="w-full px-6 py-2 bg-amber-500 text-gray-900 rounded-md font-medium
                       hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors"
          >
            {teamSearchLoading ? 'Searching...' : 'Search Fixtures'}
          </button>

          {/* Contextual hint based on search type */}
          {searchType === 'upcoming' && (
            <p className="text-xs text-gray-500 text-center">
              Shows all scheduled fixtures for the next 100 days
            </p>
          )}
          {searchType === 'dateRange' && (
            <p className="text-xs text-gray-500 text-center">
              Search any date range up to 100 days
            </p>
          )}

          {loadingProgress && (
            <div className="text-sm text-amber-500 bg-gray-700 p-2 rounded-md animate-pulse">
              ⏳ {loadingProgress}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* COMPETITION SEARCH MODE */}
      {/* ============================================ */}
      {searchMode === 'competition' && (
        <div className="space-y-4">
          {/* Competition Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Competition
            </label>
            {leaguesLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {ALLOWED_LEAGUE_IDS.map((id) => {
                  const league = leaguesData?.[id];
                  const leagueName = league?.name || LEAGUE_NAMES[id];
                  const leagueLogo = league?.logo;

                  // Color scheme matching Competitions page
                  const colorConfig = {
                    8: { // Premier League
                      gradient: 'from-purple-600 to-purple-800',
                      hoverGradient: 'hover:from-purple-700 hover:to-purple-900',
                      selectedRing: 'ring-purple-300',
                      textColor: 'text-purple-700'
                    },
                    24: { // FA Cup
                      gradient: 'from-red-600 to-red-800',
                      hoverGradient: 'hover:from-red-700 hover:to-red-900',
                      selectedRing: 'ring-red-300',
                      textColor: 'text-red-700'
                    },
                    27: { // Carabao Cup
                      gradient: 'from-green-600 to-green-800',
                      hoverGradient: 'hover:from-green-700 hover:to-green-900',
                      selectedRing: 'ring-green-300',
                      textColor: 'text-green-700'
                    }
                  };

                  const colors = colorConfig[id] || colorConfig[8];

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedCompetition(id)}
                      disabled={competitionSearchLoading}
                      className={`p-4 rounded-lg transition-all duration-200
                        flex flex-col items-center justify-center space-y-3
                        bg-gradient-to-r ${colors.gradient} ${colors.hoverGradient}
                        shadow-md hover:shadow-lg
                        ${selectedCompetition === id
                          ? `ring-4 ${colors.selectedRing} shadow-lg`
                          : ''
                        }
                        ${competitionSearchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center p-2">
                        {leagueLogo ? (
                          <img
                            src={leagueLogo}
                            alt={leagueName}
                            className="w-24 h-24 object-contain"
                          />
                        ) : (
                          <span className={`font-bold text-2xl ${colors.textColor}`}>
                            {id === 8 ? 'PL' : id === 24 ? 'FA' : 'CC'}
                          </span>
                        )}
                      </div>
                      <span className="text-white font-bold text-sm">{leagueName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Search Type Options */}
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="competitionSearchType"
                value="upcoming"
                checked={competitionSearchType === 'upcoming'}
                onChange={() => setCompetitionSearchType('upcoming')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={competitionSearchLoading}
              />
              <span className="text-sm text-gray-300">Upcoming (next 30 days)</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="competitionSearchType"
                value="dateRange"
                checked={competitionSearchType === 'dateRange'}
                onChange={() => setCompetitionSearchType('dateRange')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={competitionSearchLoading}
              />
              <span className="text-sm text-gray-300">Custom Date Range (max {MAX_DATE_RANGE_DAYS} days)</span>
            </label>
          </div>
          
          {/* Date Range Inputs (for custom range) */}
          {competitionSearchType === 'dateRange' && (
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={competitionStartDate}
                    onChange={(e) => setCompetitionStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={competitionSearchLoading}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={competitionEndDate}
                    onChange={(e) => setCompetitionEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={competitionSearchLoading}
                  />
                </div>
              </div>
              
              {competitionStartDate && competitionEndDate && (
                <div className={`text-sm ${isCompetitionDateRangeValid ? 'text-gray-400' : 'text-red-400'}`}>
                  {isCompetitionDateRangeValid 
                    ? `${competitionDateRangeDays} days selected`
                    : competitionDateRangeDays > MAX_DATE_RANGE_DAYS
                      ? `⚠️ ${competitionDateRangeDays} days selected (max ${MAX_DATE_RANGE_DAYS} days allowed)`
                      : '⚠️ End date must be after start date'
                  }
                </div>
              )}
            </div>
          )}
          
          {/* Search Button */}
          <button
            onClick={handleCompetitionSearch}
            disabled={
              !selectedCompetition || 
              competitionSearchLoading || 
              (competitionSearchType === 'dateRange' && !isCompetitionDateRangeValid)
            }
            className="w-full px-6 py-2 bg-amber-500 text-gray-900 rounded-md font-medium
                       hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors"
          >
            {competitionSearchLoading ? 'Searching...' : 'Search Fixtures'}
          </button>
        </div>
      )}

      {/* ============================================ */}
      {/* DATE SEARCH MODE */}
      {/* ============================================ */}
      {searchMode === 'date' && (
        <div className="space-y-4">
          {/* Date Type Toggle */}
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="dateSearchType"
                value="single"
                checked={dateSearchType === 'single'}
                onChange={() => setDateSearchType('single')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={dateSearchLoading}
              />
              <span className="text-sm text-gray-300">Single Date</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="dateSearchType"
                value="range"
                checked={dateSearchType === 'range'}
                onChange={() => setDateSearchType('range')}
                className="text-amber-500 focus:ring-amber-500"
                disabled={dateSearchLoading}
              />
              <span className="text-sm text-gray-300">Date Range (max {MAX_DATE_RANGE_DAYS} days)</span>
            </label>
          </div>
          
          {/* Single Date Input */}
          {dateSearchType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Select Date
              </label>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-600 rounded-md 
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                disabled={dateSearchLoading}
              />
            </div>
          )}
          
          {/* Date Range Inputs */}
          {dateSearchType === 'range' && (
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={dateSearchLoading}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={dateSearchLoading}
                  />
                </div>
              </div>
              
              {/* Date range validation message */}
              {dateRangeStart && dateRangeEnd && (
                <div className={`text-sm ${isGeneralDateRangeValid ? 'text-gray-400' : 'text-red-400'}`}>
                  {isGeneralDateRangeValid 
                    ? `${generalDateRangeDays} days selected`
                    : generalDateRangeDays > MAX_DATE_RANGE_DAYS
                      ? `⚠️ ${generalDateRangeDays} days selected (max ${MAX_DATE_RANGE_DAYS} days for all-teams search)`
                      : '⚠️ End date must be after start date'
                  }
                </div>
              )}
            </div>
          )}
          
          {/* Search Button */}
          <button
            onClick={handleDateSearch}
            disabled={
              dateSearchLoading || 
              (dateSearchType === 'single' && !searchDate) ||
              (dateSearchType === 'range' && !isGeneralDateRangeValid)
            }
            className="w-full px-6 py-2 bg-amber-500 text-gray-900 rounded-md font-medium
                       hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors"
          >
            {dateSearchLoading ? 'Searching...' : 'Search Fixtures'}
          </button>
        </div>
      )}

      {/* Error Message */}
      {searchError && (
        <div className="mt-3 text-red-600 text-sm bg-red-50 p-3 rounded-md">
          {searchError}
        </div>
      )}

      {/* Helper Text (not shown for team mode - has its own helper) */}
      {searchMode !== 'team' && (
        <p className="mt-3 text-xs text-gray-500">
          {searchMode === 'competition'
            ? 'Select a competition to view upcoming fixtures or search by date range.'
            : dateSearchType === 'single'
              ? 'Select a date to view all Premier League, FA Cup, and Carabao Cup fixtures.'
              : `Select a date range (up to ${MAX_DATE_RANGE_DAYS} days) to view fixtures across multiple days.`
          }
        </p>
      )}
    </div>
  );
}

// ============================================
// SEARCH RESULTS COMPONENT
// ============================================
// Props:
//   - searchData: The search results object
//   - onClear: Function to clear search and return to default view
//   - loading: Whether a refresh is in progress
//   - timeAgoText: "X minutes ago" text for last updated
//   - onRefresh: Function to refresh the search results
//   - timezone: User's timezone preference
//   - dateFormat: User's date format preference
//   - temperatureUnit: User's temperature unit preference
function SearchResults({ searchData, onClear, loading, timeAgoText, onRefresh, timezone, dateFormat, temperatureUnit }) {
  const { type, query, fixtures, isHistorical, season, teamId, competitionId, dateRange, startDate, endDate, isRange } = searchData;

  const groupedFixtures = groupFixturesByDate(fixtures, timezone);
  
  // Determine if we should show the refresh button
  // Show refresh if the search could contain live matches (not purely historical)
  const showRefresh = !isHistorical;
  
  const getHeaderText = () => {
    if (type === 'team') {
      if (season) {
        return `${query} - ${season} Season`;
      }
      if (dateRange) {
        return `${query} (${formatShortDateOnly(dateRange.startDate, dateFormat)} - ${formatShortDateOnly(dateRange.endDate, dateFormat)})`;
      }
      return `Upcoming: ${query}`;
    }
    if (type === 'competition') {
      if (dateRange) {
        return `${query} (${formatShortDateOnly(dateRange.startDate, dateFormat)} - ${formatShortDateOnly(dateRange.endDate, dateFormat)})`;
      }
      return `Upcoming: ${query}`;
    }
    if (type === 'dateRange' || isRange) {
      return `Fixtures: ${formatShortDateOnly(startDate, dateFormat)} - ${formatShortDateOnly(endDate, dateFormat)}`;
    }
    return `Fixtures on ${formatDateOnly(query, dateFormat)}`;
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100">
            {getHeaderText()}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {fixtures.length} {fixtures.length === 1 ? 'fixture' : 'fixtures'} found
            {type === 'team' && teamId && (
              <span className="ml-2">
                • <Link to={`/teams/${teamId}`} className="text-amber-500 hover:underline">
                  View team page →
                </Link>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-gray-600 text-gray-200 rounded-md text-sm font-medium
                     hover:bg-gray-500 transition-colors"
        >
          ✕ Clear Search
        </button>
      </div>

      {/* Legend - always show */}
      <FixtureLegend />
      
      {/* Refresh bar - only show for non-historical searches */}
      {showRefresh && (
        <RefreshBar 
          timeAgoText={timeAgoText} 
          loading={loading} 
          onRefresh={onRefresh} 
        />
      )}

      {fixtures.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-200 mb-2">
            No Fixtures Found
          </h3>
          <p className="text-gray-500">
            {type === 'team'
              ? `No Premier League, FA Cup, or Carabao Cup fixtures found for ${query} in this time period.`
              : type === 'competition'
                ? `No ${query} fixtures found in this time period.`
                : 'No fixtures scheduled for the selected date(s).'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedFixtures.map(({ date, fixtures: dayFixtures }) => (
            <div key={date}>
              <div className={`sticky top-0 px-4 py-2 rounded-md mb-3 z-10
                ${isHistorical ? 'bg-amber-100' : 'bg-amber-900/30'}`}
              >
                <h3 className={`font-semibold ${isHistorical ? 'text-amber-800' : 'text-amber-400'}`}>
                  {formatDateOnly(date, dateFormat)}
                </h3>
              </div>

              <div className="space-y-3">
                {dayFixtures.map((fixture) => (
                  <FixtureCard key={fixture.id} fixture={fixture} timezone={timezone} temperatureUnit={temperatureUnit} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// DEFAULT FIXTURES COMPONENT
// ============================================
function DefaultFixtures({ fixtures, loading, error, dateRange, timeAgoText, onRefresh, timezone, dateFormat, temperatureUnit }) {
  const groupedFixtures = groupFixturesByDate(fixtures, timezone);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <AppIcon name="calendar" size="lg" /> Fixture List
        </h2>
        
        {dateRange.startDate && dateRange.endDate && (
          <div className="text-sm text-gray-500 text-right">
            <div>{formatDateOnly(dateRange.startDate, dateFormat)}</div>
            <div className="text-gray-400">to</div>
            <div>{formatDateOnly(dateRange.endDate, dateFormat)}</div>
          </div>
        )}
      </div>

      {/* Legend and Refresh - using reusable components */}
      <FixtureLegend />
      <RefreshBar 
        timeAgoText={timeAgoText} 
        loading={loading} 
        onRefresh={onRefresh} 
      />

      {error && (
        <div className="bg-red-900/30 text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading fixtures...
        </div>
      ) : groupedFixtures.length === 0 ? (
        <div className="bg-gray-700 rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-4"><AppIcon name="calendar" size="3xl" /></div>
          <h2 className="text-xl font-semibold text-gray-200 mb-2">
            No Upcoming Fixtures
          </h2>
          <p className="text-gray-500">
            No Premier League, FA Cup, or Carabao Cup fixtures before{' '}
            <span className="font-medium">{formatDateOnly(dateRange.endDate, dateFormat)}</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedFixtures.map(({ date, fixtures: dayFixtures }) => (
            <div key={date}>
              <div className="sticky top-0 bg-gray-700 px-4 py-2 rounded-md mb-3 z-10">
                <h3 className="font-semibold text-gray-200">
                  {formatDateOnly(date, dateFormat)}
                </h3>
              </div>

              <div className="space-y-3">
                {dayFixtures.map((fixture) => (
                  <FixtureCard key={fixture.id} fixture={fixture} timezone={timezone} temperatureUnit={temperatureUnit} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// FIXTURES COMPONENT (MAIN)
// ============================================
const Fixtures = () => {
  // ============================================
  // USER PREFERENCES
  // ============================================
  const { user } = useAuth();
  const timezone = user?.timezone || 'America/New_York';
  const dateFormat = user?.dateFormat || 'US';
  const temperatureUnit = user?.temperatureUnit || 'FAHRENHEIT';

  // ============================================
  // STATE: Default Fixtures View
  // ============================================
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeAgoText, setTimeAgoText] = useState('');

  // ============================================
  // STATE: Search Results View
  // ============================================
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLastUpdated, setSearchLastUpdated] = useState(null);
  const [searchTimeAgoText, setSearchTimeAgoText] = useState('');

  // ============================================
  // FETCH DEFAULT FIXTURES (reusable for refresh)
  // ============================================
  const fetchFixtures = async () => {
    setLoading(true);
    setError('');

    const { startDate, endDate } = getDateRange();
    setDateRange({ startDate, endDate });

    try {
      // Fetch fixtures by date range, live scores, AND in-play scores in parallel
      // Using both livescores (today's fixtures) and livescoresInplay (currently playing)
      // to ensure we catch all live match states
      const [fixturesData, livescoresData, inplayData] = await Promise.all([
        dataApi.getFixturesByDateRange(startDate, endDate),
        dataApi.getLivescores(),
        dataApi.getLivescoresInplay()
      ]);

      // Filter to our allowed leagues
      let filteredFixtures = (fixturesData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );

      // Get live fixtures from our allowed leagues (from both endpoints)
      const liveFixtures = (livescoresData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );
      const inplayFixtures = (inplayData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );

      // Create a map of fixture IDs to their live data
      // Start with livescores, then override with inplay (more accurate for current state)
      const liveFixtureMap = new Map();
      liveFixtures.forEach(liveFixture => {
        liveFixtureMap.set(liveFixture.id, liveFixture);
      });
      // Inplay data takes precedence (more real-time)
      inplayFixtures.forEach(inplayFixture => {
        liveFixtureMap.set(inplayFixture.id, inplayFixture);
      });

      // Merge live data into fixtures
      filteredFixtures = filteredFixtures.map(fixture => {
        const liveVersion = liveFixtureMap.get(fixture.id);
        if (liveVersion) {
          return {
            ...fixture,
            state: liveVersion.state,
            scores: liveVersion.scores,
          };
        }
        return fixture;
      });

      setFixtures(filteredFixtures);

      // Update the "last updated" timestamp
      const now = new Date();
      setLastUpdated(now);
      setTimeAgoText(getTimeAgoText(now));
    } catch (err) {
      console.error('Failed to fetch fixtures:', err);
      setError(err.message || 'Failed to load fixtures');
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // REFRESH SEARCH RESULTS
  // ============================================
  // Re-fetches the same search with live data merged in.
  // Uses the stored searchResults to know what to re-fetch.
  const refreshSearchResults = async () => {
    if (!searchResults) return;
    
    setSearchLoading(true);
    
    try {
      const { type, teamId, competitionId, dateRange: searchDateRange, query, startDate, endDate, isRange } = searchResults;
      
      let fixturesStartDate, fixturesEndDate;
      let newFixtures = [];
      
      // ============================================
      // Determine date range based on search type
      // ============================================
      if (type === 'team') {
        // Team search - use the original date range
        if (searchDateRange) {
          fixturesStartDate = searchDateRange.startDate;
          fixturesEndDate = searchDateRange.endDate;
        } else {
          // Upcoming search (next 100 days)
          const today = new Date();
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + 100);
          fixturesStartDate = today.toISOString().split('T')[0];
          fixturesEndDate = futureDate.toISOString().split('T')[0];
        }
        
        // Fetch team fixtures
        const fixturesData = await dataApi.getTeamFixturesByDateRange(
          fixturesStartDate,
          fixturesEndDate,
          teamId
        );
        
        newFixtures = (fixturesData.fixtures || []).filter(
          fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
        );
        
      } else if (type === 'competition') {
        // Competition search
        if (searchDateRange) {
          fixturesStartDate = searchDateRange.startDate;
          fixturesEndDate = searchDateRange.endDate;
        } else {
          // Upcoming (next 30 days)
          const today = new Date();
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + 30);
          fixturesStartDate = today.toISOString().split('T')[0];
          fixturesEndDate = futureDate.toISOString().split('T')[0];
        }
        
        const data = await dataApi.getFixturesByDateRange(fixturesStartDate, fixturesEndDate);
        newFixtures = (data.fixtures || []).filter(
          fixture => fixture.league_id === competitionId
        );
        
      } else if (type === 'date') {
        // Single date search
        fixturesStartDate = query;
        fixturesEndDate = query;
        
        const data = await dataApi.getFixturesByDate(query);
        newFixtures = (data.fixtures || []).filter(
          fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
        );
        
      } else if (type === 'dateRange' || isRange) {
        // Date range search
        fixturesStartDate = startDate;
        fixturesEndDate = endDate;
        
        const data = await dataApi.getFixturesByDateRange(startDate, endDate);
        newFixtures = (data.fixtures || []).filter(
          fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
        );
      }
      
      // ============================================
      // Fetch live scores and merge
      // ============================================
      // Fetch both livescores and inplay in parallel for most accurate live state
      const [livescoresData, inplayData] = await Promise.all([
        dataApi.getLivescores(),
        dataApi.getLivescoresInplay()
      ]);

      const liveFixtures = (livescoresData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );
      const inplayFixtures = (inplayData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );

      // Create map with livescores, then override with inplay (more real-time)
      const liveFixtureMap = new Map();
      liveFixtures.forEach(liveFixture => {
        liveFixtureMap.set(liveFixture.id, liveFixture);
      });
      inplayFixtures.forEach(inplayFixture => {
        liveFixtureMap.set(inplayFixture.id, inplayFixture);
      });

      // Merge live data into fixtures
      newFixtures = newFixtures.map(fixture => {
        const liveVersion = liveFixtureMap.get(fixture.id);
        if (liveVersion) {
          return {
            ...fixture,
            state: liveVersion.state,
            scores: liveVersion.scores,
          };
        }
        return fixture;
      });
      
      // Sort by date
      newFixtures.sort((a, b) => 
        new Date(a.starting_at) - new Date(b.starting_at)
      );
      
      // Update search results with new fixtures (keep all other metadata)
      setSearchResults(prev => ({
        ...prev,
        fixtures: newFixtures
      }));
      
      // Update timestamp
      const now = new Date();
      setSearchLastUpdated(now);
      setSearchTimeAgoText(getTimeAgoText(now));
      
    } catch (err) {
      console.error('Failed to refresh search results:', err);
      // Don't clear results on error, just log it
    } finally {
      setSearchLoading(false);
    }
  };

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    fetchFixtures();
  }, []);

  // ============================================
  // UPDATE "TIME AGO" TEXT EVERY MINUTE
  // ============================================
  useEffect(() => {
    if (!lastUpdated) return;
    
    setTimeAgoText(getTimeAgoText(lastUpdated));
    
    const interval = setInterval(() => {
      setTimeAgoText(getTimeAgoText(lastUpdated));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // ============================================
  // UPDATE SEARCH "TIME AGO" TEXT EVERY MINUTE
  // ============================================
  useEffect(() => {
    if (!searchLastUpdated) return;
    
    setSearchTimeAgoText(getTimeAgoText(searchLastUpdated));
    
    const interval = setInterval(() => {
      setSearchTimeAgoText(getTimeAgoText(searchLastUpdated));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [searchLastUpdated]);

  // ============================================
  // HANDLE SEARCH RESULTS FROM SearchPanel
  // ============================================
  const handleSearchResults = (results) => {
    setSearchResults(results);
    
    // Set initial timestamp for search results
    const now = new Date();
    setSearchLastUpdated(now);
    setSearchTimeAgoText(getTimeAgoText(now));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================
  // CLEAR SEARCH AND RETURN TO DEFAULT VIEW
  // ============================================
  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchLastUpdated(null);
    setSearchTimeAgoText('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Fixtures</h1>
        <p className="text-sm text-gray-500 mt-1">
          Premier League, FA Cup &amp; Carabao Cup
        </p>
      </div>

      <SearchPanel 
        onSearchResults={handleSearchResults}
        onClearSearch={handleClearSearch}
        isSearchActive={searchResults !== null}
      />

      {searchResults ? (
        <SearchResults
          searchData={searchResults}
          onClear={handleClearSearch}
          loading={searchLoading}
          timeAgoText={searchTimeAgoText}
          onRefresh={refreshSearchResults}
          timezone={timezone}
          dateFormat={dateFormat}
          temperatureUnit={temperatureUnit}
        />
      ) : (
        <DefaultFixtures
          fixtures={fixtures}
          loading={loading}
          error={error}
          dateRange={dateRange}
          timeAgoText={timeAgoText}
          onRefresh={() => fetchFixtures()}
          timezone={timezone}
          dateFormat={dateFormat}
          temperatureUnit={temperatureUnit}
        />
      )}
    </div>
  );
};

export default Fixtures;
