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

// ============================================
// LEAGUE IDS (Our subscription)
// ============================================
const ALLOWED_LEAGUES = {
  8: 'Premier League',
  24: 'FA Cup',
  27: 'Carabao Cup'
};

const ALLOWED_LEAGUE_IDS = Object.keys(ALLOWED_LEAGUES).map(Number);

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
// HELPER: Parse date string without timezone shift
// ============================================
// When JS parses "2024-12-26", it treats it as UTC midnight.
// In EST (UTC-5), that becomes Dec 25th at 7pm - wrong day!
// This function parses the date parts manually to avoid timezone issues.
function parseDateString(dateString) {
  // Handle both "2024-12-26" and "2024-12-26 15:00:00" formats
  const datePart = dateString.split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  // Create date in LOCAL timezone (month is 0-indexed)
  return new Date(year, month - 1, day);
}

// ============================================
// HELPER: Format date for display
// ============================================
function formatDate(dateString) {
  const date = parseDateString(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ============================================
// HELPER: Format short date for display
// ============================================
function formatShortDate(dateString) {
  const date = parseDateString(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// ============================================
// HELPER: Parse UTC datetime string to Date object
// ============================================
// SportsMonks returns times in UTC format: "2024-12-26 15:00:00"
// We need to explicitly tell JavaScript this is UTC, then convert to Eastern.
function parseUTCDateTime(dateString) {
  // "2024-12-26 15:00:00" -> "2024-12-26T15:00:00Z" (ISO format with Z = UTC)
  const isoString = dateString.replace(' ', 'T') + 'Z';
  return new Date(isoString);
}

// ============================================
// HELPER: Format time for display (Eastern Time)
// ============================================
function formatTime(dateString) {
  const date = parseUTCDateTime(dateString);
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  });
  return `${timeStr} ET`;
}

// ============================================
// HELPER: Get Eastern Time date string from UTC datetime
// ============================================
// Converts UTC datetime to Eastern Time and returns YYYY-MM-DD format
function getEasternDateString(dateString) {
  const date = parseUTCDateTime(dateString);
  // Format as YYYY-MM-DD in Eastern timezone
  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/New_York'
  }); // en-CA gives YYYY-MM-DD format
}

// ============================================
// HELPER: Group fixtures by date (Eastern Time)
// ============================================
function groupFixturesByDate(fixtures) {
  const groups = {};
  
  fixtures.forEach(fixture => {
    // Group by Eastern Time date, not UTC date
    const date = getEasternDateString(fixture.starting_at);
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
// SportsMonks short_name values (lowercase):
//   "ns" = Not Started
//   "1h" = First Half
//   "ht" = Half Time  
//   "2h" = Second Half
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
  // Note: "ftp" = after penalties (FT_PEN), "aet" = after extra time
  const validStatesForScore = ['1h', '2h', 'ht', 'et', 'pen', 'ft', 'aet', 'ftp'];
  
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
// FIXTURE CARD COMPONENT
// ============================================
function FixtureCard({ fixture }) {
  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const score = getScoreDisplay(fixture);
  
  // Get normalized match state using our helper
  const matchState = getMatchState(fixture);
  
  // Match is finished if it's FT, AET, or FTP (after penalties)
  const isFinished = ['ft', 'aet', 'ftp'].includes(matchState);
  const isAfterExtraTime = matchState === 'aet';
  const isAfterPenalties = matchState === 'ftp';
  
  // Match is live if in progress
  const isLive = ['1h', '2h', 'ht', 'et', 'pen'].includes(matchState);
  
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
        block bg-white rounded-lg shadow-md p-4 
        hover:shadow-lg transition-shadow cursor-pointer
        ${isLive ? 'border-l-4 border-l-green-500' : ''}
        ${isFinished ? 'border-l-4 border-l-gray-400' : ''}
      `}
    >
      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
        <span className="font-medium">
          {fixture.league?.name || ALLOWED_LEAGUES[fixture.league_id]}
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
                {isAfterPenalties ? 'P' : isAfterExtraTime ? 'AET' : isFinished ? 'FT' : isLive ? matchState?.toUpperCase() : 'Scheduled'}
              </div>
              {/* Penalty score and winner (only for penalty shootout wins) */}
              {isAfterPenalties && penaltyScore && (
                <div className="text-xs text-gray-500 mt-1">
                  <div className="font-medium">({penaltyScore.home}-{penaltyScore.away})</div>
                  {penaltyWinnerName && (
                    <div className="text-gray-600 mt-0.5">{penaltyWinnerName} wins on penalties</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-lg font-medium text-gray-700">
                {formatTime(fixture.starting_at)}
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

      {fixture.venue?.name && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          📍 {fixture.venue.name}
        </div>
      )}

      <div className="mt-2 text-xs text-blue-500 text-center">
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
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     ${selectedTeam ? 'border-green-500 bg-green-50' : 'border-gray-300'}
                     ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          )}
          {selectedTeam && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600"
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
          className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => handleSelect(team)}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center space-x-3 border-b last:border-b-0"
            >
              {team.image_path && (
                <img 
                  src={team.image_path} 
                  alt="" 
                  className="w-6 h-6 object-contain"
                />
              )}
              <div>
                <div className="font-medium text-gray-900">{team.name}</div>
                {team.country?.name && (
                  <div className="text-xs text-gray-500">{team.country.name}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && suggestions.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500">
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
        query: ALLOWED_LEAGUES[selectedCompetition],
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
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">🔍 Search Fixtures</h2>
        
        {isSearchActive && (
          <button
            onClick={handleClear}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium
                       hover:bg-gray-200 transition-colors"
          >
            ✕ Clear &amp; Show Default
          </button>
        )}
      </div>
      
      {/* Search Mode Tabs */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setSearchMode('team')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${searchMode === 'team'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          🏟️ By Team
        </button>
        <button
          onClick={() => setSearchMode('competition')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${searchMode === 'competition'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          🏆 By Competition
        </button>
        <button
          onClick={() => setSearchMode('date')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${searchMode === 'date'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          📅 By Date
        </button>
      </div>

      {/* ============================================ */}
      {/* TEAM SEARCH MODE */}
      {/* ============================================ */}
      {searchMode === 'team' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team
            </label>
            <TeamAutocomplete
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
              disabled={teamSearchLoading}
            />
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
                className="text-blue-600 focus:ring-blue-500"
                disabled={teamSearchLoading}
              />
              <span className="text-sm text-gray-700">Upcoming (next 100 days)</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="searchType"
                value="historical"
                checked={searchType === 'historical'}
                onChange={() => setSearchType('historical')}
                className="text-blue-600 focus:ring-blue-500"
                disabled={teamSearchLoading}
              />
              <span className="text-sm text-gray-700">Full Season</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="searchType"
                value="dateRange"
                checked={searchType === 'dateRange'}
                onChange={() => setSearchType('dateRange')}
                className="text-blue-600 focus:ring-blue-500"
                disabled={teamSearchLoading}
              />
              <span className="text-sm text-gray-700">Custom Date Range</span>
            </label>
          </div>
          
          {/* Season Selector (for historical) */}
          {searchType === 'historical' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Season
              </label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={teamStartDate}
                    onChange={(e) => setTeamStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={teamSearchLoading}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={teamEndDate}
                    onChange={(e) => setTeamEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={teamSearchLoading}
                  />
                </div>
              </div>
              
              {teamStartDate && teamEndDate && (
                <div className={`text-sm ${isTeamDateRangeValid ? 'text-gray-600' : 'text-red-600'}`}>
                  {isTeamDateRangeValid 
                    ? `📅 ${teamDateRangeDays} days selected`
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
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-md font-medium
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors"
          >
            {teamSearchLoading ? 'Searching...' : 'Search Fixtures'}
          </button>
          
          {loadingProgress && (
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-md animate-pulse">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Competition
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ALLOWED_LEAGUES).map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedCompetition(parseInt(id))}
                  disabled={competitionSearchLoading}
                  className={`px-3 py-3 rounded-md text-sm font-medium transition-colors border-2
                    ${selectedCompetition === parseInt(id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }
                    ${competitionSearchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {id === '8' && '⚽ '}
                  {id === '24' && '🏆 '}
                  {id === '27' && '🏆 '}
                  {name}
                </button>
              ))}
            </div>
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
                className="text-blue-600 focus:ring-blue-500"
                disabled={competitionSearchLoading}
              />
              <span className="text-sm text-gray-700">Upcoming (next 30 days)</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="competitionSearchType"
                value="dateRange"
                checked={competitionSearchType === 'dateRange'}
                onChange={() => setCompetitionSearchType('dateRange')}
                className="text-blue-600 focus:ring-blue-500"
                disabled={competitionSearchLoading}
              />
              <span className="text-sm text-gray-700">Custom Date Range (max {MAX_DATE_RANGE_DAYS} days)</span>
            </label>
          </div>
          
          {/* Date Range Inputs (for custom range) */}
          {competitionSearchType === 'dateRange' && (
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={competitionStartDate}
                    onChange={(e) => setCompetitionStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={competitionSearchLoading}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={competitionEndDate}
                    onChange={(e) => setCompetitionEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={competitionSearchLoading}
                  />
                </div>
              </div>
              
              {competitionStartDate && competitionEndDate && (
                <div className={`text-sm ${isCompetitionDateRangeValid ? 'text-gray-600' : 'text-red-600'}`}>
                  {isCompetitionDateRangeValid 
                    ? `📅 ${competitionDateRangeDays} days selected`
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
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-md font-medium
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
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
                className="text-blue-600 focus:ring-blue-500"
                disabled={dateSearchLoading}
              />
              <span className="text-sm text-gray-700">Single Date</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="dateSearchType"
                value="range"
                checked={dateSearchType === 'range'}
                onChange={() => setDateSearchType('range')}
                className="text-blue-600 focus:ring-blue-500"
                disabled={dateSearchLoading}
              />
              <span className="text-sm text-gray-700">Date Range (max {MAX_DATE_RANGE_DAYS} days)</span>
            </label>
          </div>
          
          {/* Single Date Input */}
          {dateSearchType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Date
              </label>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={dateSearchLoading}
              />
            </div>
          )}
          
          {/* Date Range Inputs */}
          {dateSearchType === 'range' && (
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={dateSearchLoading}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={dateSearchLoading}
                  />
                </div>
              </div>
              
              {/* Date range validation message */}
              {dateRangeStart && dateRangeEnd && (
                <div className={`text-sm ${isGeneralDateRangeValid ? 'text-gray-600' : 'text-red-600'}`}>
                  {isGeneralDateRangeValid 
                    ? `📅 ${generalDateRangeDays} days selected`
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
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-md font-medium
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
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

      {/* Helper Text */}
      <p className="mt-3 text-xs text-gray-500">
        {searchMode === 'team'
          ? 'Start typing to see matching teams. Select a team, then choose how to search.'
          : searchMode === 'competition'
            ? 'Select a competition to view upcoming fixtures or search by date range.'
            : dateSearchType === 'single'
              ? 'Select a date to view all Premier League, FA Cup, and Carabao Cup fixtures.'
              : `Select a date range (up to ${MAX_DATE_RANGE_DAYS} days) to view fixtures across multiple days.`
        }
      </p>
    </div>
  );
}

// ============================================
// SEARCH RESULTS COMPONENT
// ============================================
function SearchResults({ searchData, onClear }) {
  const { type, query, fixtures, isHistorical, season, teamId, competitionId, dateRange, startDate, endDate, isRange } = searchData;
  
  const groupedFixtures = groupFixturesByDate(fixtures);
  
  const getHeaderText = () => {
    if (type === 'team') {
      if (season) {
        return `${query} - ${season} Season`;
      }
      if (dateRange) {
        return `${query} (${formatShortDate(dateRange.startDate)} - ${formatShortDate(dateRange.endDate)})`;
      }
      return `Upcoming: ${query}`;
    }
    if (type === 'competition') {
      if (dateRange) {
        return `${query} (${formatShortDate(dateRange.startDate)} - ${formatShortDate(dateRange.endDate)})`;
      }
      return `Upcoming: ${query}`;
    }
    if (type === 'dateRange' || isRange) {
      return `Fixtures: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
    }
    return `Fixtures on ${formatDate(query)}`;
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {getHeaderText()}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {fixtures.length} {fixtures.length === 1 ? 'fixture' : 'fixtures'} found
            {type === 'team' && teamId && (
              <span className="ml-2">
                • <Link to={`/teams/${teamId}`} className="text-blue-600 hover:underline">
                  View team page →
                </Link>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium
                     hover:bg-gray-200 transition-colors"
        >
          ✕ Clear Search
        </button>
      </div>

      {fixtures.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
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
                ${isHistorical ? 'bg-amber-100' : 'bg-blue-100'}`}
              >
                <h3 className={`font-semibold ${isHistorical ? 'text-amber-800' : 'text-blue-800'}`}>
                  {formatDate(date)}
                </h3>
              </div>

              <div className="space-y-3">
                {dayFixtures.map((fixture) => (
                  <FixtureCard key={fixture.id} fixture={fixture} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isHistorical && fixtures.length > 0 && (
        <div className="mt-6 text-xs text-gray-500 flex items-center space-x-4 pt-4 border-t">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>Completed Match</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// DEFAULT FIXTURES COMPONENT
// ============================================
function DefaultFixtures({ fixtures, loading, error, dateRange, timeAgoText, onRefresh }) {
  const groupedFixtures = groupFixturesByDate(fixtures);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          📅 Fixture List
        </h2>
        
        {dateRange.startDate && dateRange.endDate && (
          <div className="text-sm text-gray-500 text-right">
            <div>{formatDate(dateRange.startDate)}</div>
            <div className="text-gray-400">to</div>
            <div>{formatDate(dateRange.endDate)}</div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* LEGEND - Live Match Indicator */}
      {/* ============================================ */}
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

      {/* ============================================ */}
      {/* REFRESH BUTTON + LAST UPDATED INDICATOR */}
      {/* ============================================ */}
      <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-lg px-4 py-2">
        <div className="text-sm text-gray-500">
          {timeAgoText && (
            <span>
              🕒 Last updated: <span className="font-medium">{timeAgoText}</span>
            </span>
          )}
        </div>
        
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white 
                     rounded-md text-sm font-medium hover:bg-blue-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading fixtures...
        </div>
      ) : groupedFixtures.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No Upcoming Fixtures
          </h2>
          <p className="text-gray-500">
            No Premier League, FA Cup, or Carabao Cup fixtures before{' '}
            <span className="font-medium">{formatDate(dateRange.endDate)}</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedFixtures.map(({ date, fixtures: dayFixtures }) => (
            <div key={date}>
              <div className="sticky top-0 bg-gray-100 px-4 py-2 rounded-md mb-3 z-10">
                <h3 className="font-semibold text-gray-700">
                  {formatDate(date)}
                </h3>
              </div>

              <div className="space-y-3">
                {dayFixtures.map((fixture) => (
                  <FixtureCard key={fixture.id} fixture={fixture} />
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
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [searchResults, setSearchResults] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null); // Track when data was last fetched
  const [timeAgoText, setTimeAgoText] = useState('');   // Display text for "X minutes ago"

  // ============================================
  // FETCH FIXTURES FUNCTION (reusable for refresh)
  // ============================================
  const fetchFixtures = async () => {
    setLoading(true);
    setError('');

    const { startDate, endDate } = getDateRange();
    setDateRange({ startDate, endDate });

    try {
      // Fetch fixtures by date range AND live scores in parallel
      // The fixtures/between endpoint gives us the schedule,
      // but livescores endpoint gives us real-time match states
      const [fixturesData, livescoresData] = await Promise.all([
        dataApi.getFixturesByDateRange(startDate, endDate),
        dataApi.getLivescores()
      ]);
      
      // Filter to our allowed leagues
      let filteredFixtures = (fixturesData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );
      
      // Get live fixtures from our allowed leagues
      const liveFixtures = (livescoresData.fixtures || []).filter(
        fixture => ALLOWED_LEAGUE_IDS.includes(fixture.league_id)
      );
      
      // Create a map of live fixture IDs to their live data
      const liveFixtureMap = new Map();
      liveFixtures.forEach(liveFixture => {
        liveFixtureMap.set(liveFixture.id, liveFixture);
      });
      
      // Merge live data into fixtures
      // If a fixture is currently live, replace it with the live version
      filteredFixtures = filteredFixtures.map(fixture => {
        const liveVersion = liveFixtureMap.get(fixture.id);
        if (liveVersion) {
          // Merge: keep scheduled fixture data but update with live state/scores
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
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    fetchFixtures();
  }, []);

  // ============================================
  // UPDATE "TIME AGO" TEXT EVERY MINUTE
  // ============================================
  // This keeps the "Last updated: X minutes ago" text current
  // without making new API calls
  useEffect(() => {
    if (!lastUpdated) return;
    
    // Update immediately
    setTimeAgoText(getTimeAgoText(lastUpdated));
    
    // Then update every 60 seconds
    const interval = setInterval(() => {
      setTimeAgoText(getTimeAgoText(lastUpdated));
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleSearchResults = (results) => {
    setSearchResults(results);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearSearch = () => {
    setSearchResults(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fixtures</h1>
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
        />
      ) : (
        <DefaultFixtures
          fixtures={fixtures}
          loading={loading}
          error={error}
          dateRange={dateRange}
          timeAgoText={timeAgoText}
          onRefresh={() => fetchFixtures()}
        />
      )}
    </div>
  );
};

export default Fixtures;
