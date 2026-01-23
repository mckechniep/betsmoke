// ============================================
// FIXTURE DETAIL PAGE
// ============================================
// Shows detailed information about a specific fixture including:
// - Match header (teams, date, venue)
// - Odds with bookmaker selection (American format)
// - Head-to-head history (clickable)
// - Collapsible accordion sections for additional data
// - Add Note modal
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dataApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MatchPredictions from '../components/MatchPredictions';
import FloatingNoteWidget from '../components/FloatingNoteWidget';
import {
  formatTime as formatTimeUtil,
  formatDate as formatDateUtil,
  formatShortDate as formatShortDateUtil,
  formatTemperature,
  formatOdds,
  getOddsValue
} from '../utils/formatters';

// ============================================
// DEFAULT BOOKMAKERS (prepopulated)
// ============================================
// These are common bookmakers with good coverage
// IDs from SportsMonks:
//   - Betfair = 4
//   - Unibet = 9
// Note: Defaults are filtered to only show bookmakers that have odds for the fixture
const DEFAULT_BOOKMAKER_IDS = [4, 9]; // Betfair, Unibet

// ============================================
// NOTE: Date/Time formatting functions have been moved to
// src/utils/formatters.js for centralized user preference handling.
// The component uses the useAuth hook to get user preferences.
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
// HELPER: Get score from fixture
// ============================================
// SportsMonks returns different score formats for different eras:
// - Modern fixtures: description = "CURRENT" (aggregated final score)
// - Older fixtures: description = "2ND_HALF" or "1ST_HALF" (period scores)
//
// For older fixtures, "2ND_HALF" represents the cumulative score at that point,
// which IS the final score for a normal 90-minute match.
function getScore(fixture, location) {
  if (!fixture.scores || fixture.scores.length === 0) return null;
  
  // Priority 1: Look for "CURRENT" (modern fixtures)
  const currentScore = fixture.scores.find(
    s => s.description === 'CURRENT' && s.score?.participant === location
  );
  if (currentScore) return currentScore.score?.goals ?? null;
  
  // Priority 2: Look for "2ND_HALF" (older fixtures - this is the final score)
  const secondHalfScore = fixture.scores.find(
    s => s.description === '2ND_HALF' && s.score?.participant === location
  );
  if (secondHalfScore) return secondHalfScore.score?.goals ?? null;
  
  // Priority 3: Look for "1ST_HALF" as last resort (partial data)
  const firstHalfScore = fixture.scores.find(
    s => s.description === '1ST_HALF' && s.score?.participant === location
  );
  if (firstHalfScore) return firstHalfScore.score?.goals ?? null;
  
  return null;
}

// ============================================
// HELPER: Get weather display data from weatherReport
// ============================================
// Uses SportsMonks weather icon URL and description
// Weather data is only available close to match day (24-48 hours before)
// weatherReport is a SEPARATE include from metadata (not nested inside it)
// temperatureUnit: 'FAHRENHEIT' or 'CELSIUS' (user preference)
function getWeatherDisplay(weatherReport, temperatureUnit = 'FAHRENHEIT') {
  if (!weatherReport) return null;

  const weather = weatherReport;
  const condition = weather.description?.toLowerCase() || weather.type?.toLowerCase() || '';
  const temp = weather.temperature?.day; // Daytime temperature in Celsius
  const humidity = weather.humidity;
  const wind = weather.wind?.speed; // Wind speed
  const iconUrl = weather.icon; // SportsMonks CDN icon URL

  const label = weather.description || condition || 'Unknown';

  // Format temperature using user preference
  const tempDisplay = formatTemperature(temp, temperatureUnit);

  return { iconUrl, label, tempDisplay, humidity, wind, condition };
}

// ============================================
// HELPER: Get formations from metadata
// ============================================
// Extracts team formations from metadata array (type_id: 159)
// Returns: { home: "4-3-3", away: "4-2-3-1" } or null
function getFormationsFromMetadata(metadata) {
  if (!metadata || !Array.isArray(metadata)) return null;
  
  // type_id 159 = formations
  const formationMeta = metadata.find(m => m.type_id === 159);
  if (!formationMeta?.values) return null;
  
  return {
    home: formationMeta.values.home || null,
    away: formationMeta.values.away || null
  };
}

// ============================================
// HELPER: Check if lineups are confirmed from metadata
// ============================================
// Extracts lineup confirmation status (type_id: 572)
// Returns true if confirmed, false if predicted
function getLineupsConfirmed(metadata) {
  if (!metadata || !Array.isArray(metadata)) return null;
  
  // type_id 572 = lineup confirmed
  const confirmedMeta = metadata.find(m => m.type_id === 572);
  return confirmedMeta?.values?.confirmed ?? null;
}

// ============================================
// HELPER: Get attendance from metadata
// ============================================
// Extracts attendance (type_id: 578) - only available for finished matches
function getAttendanceFromMetadata(metadata) {
  if (!metadata || !Array.isArray(metadata)) return null;
  
  // type_id 578 = attendance
  const attendanceMeta = metadata.find(m => m.type_id === 578);
  return attendanceMeta?.values?.attendance ?? null;
}

// ============================================
// BETTING MARKET NAMES LOOKUP
// ============================================
// Maps SportsMonks market_id to user-friendly names
// Used as fallback when market.name is not included in API response
const MARKET_NAMES = {
  1: 'Fulltime Result (1X2)',
  2: 'Home/Away',
  5: 'Alternative Match Goals',
  10: 'Home/Away',
  12: 'Over/Under Goals',
  14: 'Both Teams to Score',
  28: 'Asian Handicap',
  29: 'Asian Handicap Cards',
  30: 'Asian Total Cards',
  31: 'First Card Received',
  32: 'Time of First Card',
  33: 'Team Cards',
  34: 'Corner Match Bet',
  35: 'Corner Handicap',
  36: 'Time of First Corner',
  37: '1st Half Result',
  38: '2nd Half Over/Under',
  39: 'Team Corners',
  47: '2nd Half Over/Under',
  63: 'Double Chance',
  69: 'Team to Score First',
  75: 'Team to Score Last',
  80: '2nd Half Result',
  83: 'Handicap Result',
  97: 'Exact Goals',
  98: 'Goal Range',
  99: 'Odd/Even Goals',
  100: 'Result & Both Teams Score',
  101: 'Result & Over/Under',
  13343: 'Team Clean Sheet',
  28075: 'Fulltime Result',
  28076: 'To Win 2nd Half'
};

// Helper to get market name from ID
function getMarketName(marketId) {
  return MARKET_NAMES[marketId] || `Market ${marketId}`;
}

// ============================================
// HELPER: Format Odd Label for Display
// ============================================
// Makes cryptic labels like "1", "X", "2", "Yes", "No" more user-friendly
// based on the market context
function formatOddLabel(label, marketId) {
  if (!label) return '-';
  
  // Fulltime Result / 1X2 markets (1, 37, 80, 28075)
  if ([1, 37, 80, 28075].includes(marketId)) {
    if (label === '1') return 'Home Win';
    if (label === 'X') return 'Draw';
    if (label === '2') return 'Away Win';
  }
  
  // Both Teams to Score (market 14)
  if (marketId === 14) {
    if (label.toLowerCase() === 'yes') return 'Yes (BTTS)';
    if (label.toLowerCase() === 'no') return 'No';
  }
  
  // Double Chance (market 63)
  if (marketId === 63) {
    if (label === '1X') return 'Home or Draw';
    if (label === 'X2') return 'Draw or Away';
    if (label === '12') return 'Home or Away';
  }
  
  // Over/Under (market 12, 38, 47) - clean up format
  if ([12, 38, 47].includes(marketId)) {
    // Labels like "Over 2.5" or "Under 1.5" - keep as-is but capitalize
    const cleaned = label.replace(/over/i, 'Over').replace(/under/i, 'Under');
    // Handle "more 2" style labels
    if (label.toLowerCase().startsWith('more')) {
      return label.replace(/more/i, 'Over');
    }
    if (label.toLowerCase().startsWith('less')) {
      return label.replace(/less/i, 'Under');
    }
    return cleaned;
  }
  
  // Team to Score First/Last (markets 69, 75)
  if ([69, 75].includes(marketId)) {
    if (label === '1') return 'Home';
    if (label === '2') return 'Away';
    if (label.toLowerCase() === 'none' || label === 'X') return 'No Goal';
  }
  
  // Odd/Even (market 99)
  if (marketId === 99) {
    if (label.toLowerCase() === 'odd') return 'Odd (1,3,5...)';
    if (label.toLowerCase() === 'even') return 'Even (0,2,4...)';
  }
  
  // Home/Away markets - team-specific
  if ([2, 10].includes(marketId)) {
    if (label === '1') return 'Home';
    if (label === '2') return 'Away';
  }
  
  // Clean up common patterns
  // Handle "0", "1", "2" etc. for exact goals
  if (marketId === 97 && /^\d+$/.test(label)) {
    return `Exactly ${label} ${label === '1' ? 'Goal' : 'Goals'}`;
  }
  
  // Return original label if no special formatting needed
  return label;
}

// ============================================
// ACCORDION SECTION COMPONENT
// ============================================
function AccordionSection({ title, icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span>{icon}</span>
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="p-4 bg-white border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// HEAD TO HEAD SECTION COMPONENT
// ============================================
// Shows H2H history with expandable "Show More" button
function HeadToHeadSection({ h2h, h2hLoading, timezone, dateFormat }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY = 5; // Show 5 matches initially
  
  // Safety check - ensure h2h is an array
  const safeH2h = Array.isArray(h2h) ? h2h : [];
  
  // Determine which matches to display
  const displayedMatches = showAll ? safeH2h : safeH2h.slice(0, INITIAL_DISPLAY);
  const hasMore = safeH2h.length > INITIAL_DISPLAY;
  const remainingCount = safeH2h.length - INITIAL_DISPLAY;

  // ============================================
  // Helper to get score from a match
  // ============================================
  // SportsMonks returns different score formats for different eras:
  // - Modern fixtures: description = "CURRENT" (aggregated final score)
  // - Older fixtures: description = "2ND_HALF" or "1ST_HALF" (period scores)
  //
  // For older fixtures, "2ND_HALF" represents the cumulative score at that point,
  // which IS the final score for a normal 90-minute match.
  const getMatchScore = (match, location) => {
    if (!match.scores || match.scores.length === 0) return null;
    
    // Priority 1: Look for "CURRENT" (modern fixtures)
    const currentScore = match.scores.find(
      s => s.description === 'CURRENT' && s.score?.participant === location
    );
    if (currentScore) return currentScore.score?.goals;
    
    // Priority 2: Look for "2ND_HALF" (older fixtures - this is the final score)
    const secondHalfScore = match.scores.find(
      s => s.description === '2ND_HALF' && s.score?.participant === location
    );
    if (secondHalfScore) return secondHalfScore.score?.goals;
    
    // Priority 3: Look for "1ST_HALF" as last resort (partial data)
    const firstHalfScore = match.scores.find(
      s => s.description === '1ST_HALF' && s.score?.participant === location
    );
    if (firstHalfScore) return firstHalfScore.score?.goals;
    
    // No score found
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        ⚔️ Head to Head
        {safeH2h.length > 0 && (
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({safeH2h.length} {safeH2h.length === 1 ? 'meeting' : 'meetings'})
          </span>
        )}
      </h2>

      {h2hLoading ? (
        <div className="text-center py-4 text-gray-500">Loading H2H...</div>
      ) : safeH2h.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No previous meetings found</div>
      ) : (
        <div className="space-y-2">
          {/* Display matches */}
          {displayedMatches.map(match => {
            const mHomeTeam = match.participants?.find(p => p.meta?.location === 'home');
            const mAwayTeam = match.participants?.find(p => p.meta?.location === 'away');
            const mHomeScore = getMatchScore(match, 'home');
            const mAwayScore = getMatchScore(match, 'away');

            return (
              <Link
                key={match.id}
                to={`/fixtures/${match.id}`}
                className="block bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 w-20">
                    {formatShortDateUtil(match.starting_at, timezone, dateFormat)}
                  </div>
                  <div className="flex items-center space-x-2 text-sm flex-1 justify-center">
                    <span className={`text-right ${mHomeScore > mAwayScore ? 'font-bold' : ''}`}>
                      {mHomeTeam?.name}
                    </span>
                    <span className="font-bold text-gray-900 bg-white px-2 py-1 rounded min-w-[50px] text-center">
                      {mHomeScore ?? '?'} - {mAwayScore ?? '?'}
                    </span>
                    <span className={mAwayScore > mHomeScore ? 'font-bold' : ''}>
                      {mAwayTeam?.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 w-24 text-right truncate">
                    {match.league?.name}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Show More / Show Less Button */}
          {hasMore && (
            <div className="pt-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 
                           hover:bg-blue-50 rounded-md transition-colors
                           flex items-center justify-center space-x-1"
              >
                {showAll ? (
                  <>
                    <span>▲</span>
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <span>▼</span>
                    <span>Show More ({remainingCount} more {remainingCount === 1 ? 'match' : 'matches'})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SIDELINED PLAYERS SECTION COMPONENT
// ============================================
// Shows injured and suspended players for both teams
// Critical for betting research - key player absence affects odds
function SidelinedPlayersSection({ sidelined, homeTeam, awayTeam }) {
  // If no sidelined data, don't render the section
  if (!sidelined || sidelined.length === 0) {
    return null;
  }

  // Separate sidelined players by team
  // Note: The sidelined data from fixture API uses 'participant_id' for the team,
  // NOT 'team_id' (which is nested inside sideline object)
  const homeSidelined = sidelined.filter(s => s.participant_id === homeTeam?.id);
  const awaySidelined = sidelined.filter(s => s.participant_id === awayTeam?.id);

  // Helper to get injury/suspension icon based on type info
  // SportsMonks provides a `type` object with specific reason (e.g., "Red Card", "Hamstring Injury")
  const getStatusIcon = (sidelinedEntry) => {
    // First check the specific type name (most accurate)
    const typeName = sidelinedEntry.type?.name?.toLowerCase() || '';
    const typeCode = sidelinedEntry.type?.code?.toLowerCase() || '';
    
    // Check for red card specifically
    if (typeName.includes('red card') || typeCode.includes('red-card')) {
      return '🟥'; // Actual red card
    }
    
    // Check for illness
    if (typeName.includes('illness') || typeCode.includes('illness') ||
        typeName.includes('sick') || typeCode.includes('sick')) {
      return '🤒';
    }
    
    // Check for injury (most injury types contain "injury" or specific body parts)
    if (typeName.includes('injury') || typeCode.includes('injury') ||
        typeName.includes('hamstring') || typeName.includes('knee') ||
        typeName.includes('ankle') || typeName.includes('groin') ||
        typeName.includes('muscle') || typeName.includes('fracture') ||
        typeName.includes('ligament') || typeName.includes('acl') ||
        typeName.includes('mcl') || typeName.includes('calf') ||
        typeName.includes('thigh') || typeName.includes('back') ||
        typeName.includes('shoulder') || typeName.includes('concussion')) {
      return '🏥'; // Injury
    }
    
    // Fall back to category if type isn't available
    const category = sidelinedEntry.sideline?.category?.toLowerCase() || '';
    if (category.includes('injury')) return '🏥';
    if (category.includes('illness')) return '🤒';
    
    // Everything else (suspension without red card, not registered, other)
    return '⚠️';
  };

  // Helper to format the reason - use the specific type name when available
  const formatReason = (player) => {
    // First priority: use the specific type name (e.g., "Hamstring Injury", "Red Card")
    if (player.type?.name) {
      return player.type.name;
    }
    
    // Second priority: use category from sideline data
    if (player.sideline?.category) {
      return player.sideline.category;
    }
    
    // Fallback
    if (player.category) return player.category;
    return 'Unavailable';
  };

  // Helper to get player name
  const getPlayerName = (sidelinedEntry) => {
    // Player data might be nested under 'player' include
    if (sidelinedEntry.player?.display_name) return sidelinedEntry.player.display_name;
    if (sidelinedEntry.player?.name) return sidelinedEntry.player.name;
    if (sidelinedEntry.player?.common_name) return sidelinedEntry.player.common_name;
    if (sidelinedEntry.player_name) return sidelinedEntry.player_name;
    return 'Unknown Player';
  };

  // Helper to format expected return
  const formatExpectedReturn = (endDate) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expected back';
    if (diffDays === 0) return 'Returns today';
    if (diffDays === 1) return 'Returns tomorrow';
    if (diffDays <= 7) return `~${diffDays} days`;
    if (diffDays <= 30) return `~${Math.ceil(diffDays / 7)} weeks`;
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render a single team's sidelined players
  const renderTeamSidelined = (players, teamName, teamLogo) => (
    <div className="flex-1">
      <div className="flex items-center space-x-2 mb-3">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h3 className="font-medium text-gray-800">{teamName}</h3>
        <span className="text-xs text-gray-500">({players.length})</span>
      </div>
      
      {players.length === 0 ? (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          ✓ No reported absences
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player, idx) => (
            <div 
              key={player.id || idx} 
              className="bg-gray-50 rounded-lg p-2 text-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <span>{getStatusIcon(player)}</span>
                  <span className="font-medium">{getPlayerName(player)}</span>
                </div>
                {player.sideline?.games_missed > 0 && (
                  <span className="text-xs text-gray-400">
                    {player.sideline.games_missed} {player.sideline.games_missed === 1 ? 'game' : 'games'} missed
                  </span>
                )}
              </div>
              <div className="ml-6 text-xs text-gray-500 mt-1">
                <span>{formatReason(player)}</span>
                {player.sideline?.end_date && (
                  <span className="ml-2 text-blue-600">
                    • {formatExpectedReturn(player.sideline.end_date)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🚑 Injuries & Suspensions
        <span className="text-sm font-normal text-gray-500 ml-2">
          ({sidelined.length} {sidelined.length === 1 ? 'player' : 'players'} out)
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-4">
        {renderTeamSidelined(homeSidelined, homeTeam?.name, homeTeam?.image_path)}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />
        {renderTeamSidelined(awaySidelined, awayTeam?.name, awayTeam?.image_path)}
      </div>
    </div>
  );
}

// ============================================
// SCORING PATTERNS SECTION COMPONENT
// ============================================
// Shows when teams score and concede goals (by time period)
// Critical for betting: over/under timing, live betting insights
function ScoringPatternsSection({ homeStats, awayStats, homeTeam, awayTeam, loading }) {
  // Define the time periods we want to show
  // Note: SportsMonks API uses 0-15, 15-30, 30-45 format (overlapping endpoints)
  // not 0-15, 16-30, 31-45 format
  const TIME_PERIODS = [
    { key: '0-15', label: "0-15'" },
    { key: '15-30', label: "15-30'" },
    { key: '30-45', label: "30-45'" },
    { key: '45-60', label: "45-60'" },
    { key: '60-75', label: "60-75'" },
    { key: '75-90', label: "75-90'+" }
  ];

  // Helper to extract scoring minutes data from team stats
  // The API returns data like: { "0-15": {count: 5, percentage: 12.5}, "15-30": {count: 3, ...}, ... }
  const extractScoringMinutes = (stats, typeId) => {
    if (!stats?.statistics) return null;
    
    // Find the scoring-minutes stat (type_id 196 for scored, 213 for conceded)
    for (const statGroup of stats.statistics) {
      if (!statGroup.details) continue;
      
      for (const detail of statGroup.details) {
        if (detail.type_id === typeId && detail.value) {
          // The value might be an object with time periods or a nested structure
          if (typeof detail.value === 'object') {
            return detail.value;
          }
        }
      }
    }
    return null;
  };

  // Get scored and conceded data for each team
  const homeScoringMinutes = extractScoringMinutes(homeStats, 196);
  const homeConcededMinutes = extractScoringMinutes(homeStats, 213);
  const awayScoringMinutes = extractScoringMinutes(awayStats, 196);
  const awayConcededMinutes = extractScoringMinutes(awayStats, 213);

  // If no data available, don't render
  const hasData = homeScoringMinutes || awayScoringMinutes;
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⏱️ Scoring Patterns</h2>
        <div className="text-center py-4 text-gray-500">Loading scoring data...</div>
      </div>
    );
  }

  if (!hasData) {
    return null; // Don't show section if no data
  }

  // Helper to get value for a time period
  // The value might be a number OR an object like {count: 5, percentage: 25}
  const getValue = (data, period) => {
    if (!data) return 0;
    
    // Try different key formats
    let value = data[period] || data[period.replace('-', '_')];
    
    if (!value) return 0;
    
    // If it's a number, return it directly
    if (typeof value === 'number') return value;
    
    // If it's an object like {count, percentage}, extract count
    if (typeof value === 'object') {
      if (value.count !== undefined) return value.count;
      if (value.total !== undefined) return value.total;
      if (value.all !== undefined) return value.all;
      return 0; // Can't extract a number
    }
    
    // If it's a string, try to parse
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  };

  // Find max value for scaling bars
  const allValues = TIME_PERIODS.flatMap(p => [
    getValue(homeScoringMinutes, p.key),
    getValue(awayScoringMinutes, p.key)
  ]);
  const maxValue = Math.max(...allValues, 1); // Minimum 1 to avoid division by zero

  // Render a single team's scoring pattern bar chart
  const renderTeamPattern = (scoringData, concededData, teamName, teamLogo, isHome) => (
    <div className="flex-1">
      <div className="flex items-center space-x-2 mb-3">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h3 className="font-medium text-gray-800">{teamName}</h3>
      </div>

      {/* Goals Scored */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2 flex items-center">
          <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
          Goals Scored
        </div>
        <div className="space-y-1">
          {TIME_PERIODS.map(period => {
            const value = getValue(scoringData, period.key);
            const width = (value / maxValue) * 100;
            return (
              <div key={period.key} className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 w-12">{period.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-6 text-right">{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Goals Conceded */}
      {concededData && (
        <div>
          <div className="text-xs text-gray-500 mb-2 flex items-center">
            <span className="w-3 h-3 rounded-full bg-red-400 mr-1"></span>
            Goals Conceded
          </div>
          <div className="space-y-1">
            {TIME_PERIODS.map(period => {
              const value = getValue(concededData, period.key);
              const width = (value / maxValue) * 100;
              return (
                <div key={period.key} className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 w-12">{period.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div 
                      className="h-full bg-red-400 rounded-full transition-all duration-300"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        ⏱️ Scoring Patterns
        <span className="text-sm font-normal text-gray-500 ml-2">
          (this season)
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        {renderTeamPattern(
          homeScoringMinutes, 
          homeConcededMinutes, 
          homeTeam?.name, 
          homeTeam?.image_path, 
          true
        )}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />
        {renderTeamPattern(
          awayScoringMinutes, 
          awayConcededMinutes, 
          awayTeam?.name, 
          awayTeam?.image_path, 
          false
        )}
      </div>
    </div>
  );
}

// ============================================
// TOP SCORERS SECTION COMPONENT
// ============================================
// Shows top scorers from both teams for the current season
// Useful for goalscorer betting markets
function TopScorersSection({ seasonTopScorers, homeTeam, awayTeam, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🏆 Top Scorers</h2>
        <div className="text-center py-4 text-gray-500">Loading scorers...</div>
      </div>
    );
  }

  if (!seasonTopScorers || seasonTopScorers.length === 0) {
    return null;
  }

  // Filter to only players from these two teams
  const teamIds = [homeTeam?.id, awayTeam?.id].filter(Boolean);
  const relevantScorers = seasonTopScorers.filter(scorer => 
    teamIds.includes(scorer.participant?.id || scorer.team_id)
  );

  if (relevantScorers.length === 0) {
    return null;
  }

  // Separate by team
  const homeScorers = relevantScorers
    .filter(s => (s.participant?.id || s.team_id) === homeTeam?.id)
    .slice(0, 3); // Top 3 per team
  const awayScorers = relevantScorers
    .filter(s => (s.participant?.id || s.team_id) === awayTeam?.id)
    .slice(0, 3);

  // Render a single scorer row
  const renderScorer = (scorer, rank) => {
    // Extract goals - could be a number or object like {count, percentage}
    let goals = scorer.total || scorer.goals || 0;
    if (typeof goals === 'object') {
      goals = goals.count || goals.total || goals.all || 0;
    }
    
    const playerName = scorer.player?.display_name || scorer.player?.name || scorer.player_name || 'Unknown';
    
    return (
      <div key={scorer.player_id || rank} className="flex items-center justify-between py-1">
        <div className="flex items-center space-x-2">
          <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
            {rank}
          </span>
          <span className="text-sm truncate max-w-[120px]">{playerName}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-green-600">{goals}</span>
          <span className="text-xs text-gray-400">⚽</span>
        </div>
      </div>
    );
  };

  // Render team's top scorers
  const renderTeamScorers = (scorers, teamName, teamLogo) => (
    <div className="flex-1">
      <div className="flex items-center space-x-2 mb-3">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h3 className="font-medium text-gray-800">{teamName}</h3>
      </div>
      
      {scorers.length === 0 ? (
        <div className="text-sm text-gray-500">No scorers in top list</div>
      ) : (
        <div className="space-y-1">
          {scorers.map((scorer, idx) => renderScorer(scorer, idx + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🏆 Top Scorers
        <span className="text-sm font-normal text-gray-500 ml-2">
          (this season)
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        {renderTeamScorers(homeScorers, homeTeam?.name, homeTeam?.image_path)}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />
        {renderTeamScorers(awayScorers, awayTeam?.name, awayTeam?.image_path)}
      </div>

      {/* Betting Insight */}
      <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
        💡 <strong>Goalscorer Markets:</strong> These players are the most likely to score. 
        Check anytime goalscorer odds for value.
      </div>
    </div>
  );
}

// ============================================
// TOP SCORERS & ASSISTS SECTION COMPONENT
// ============================================
// Shows top 5 scorers and top 5 assist providers for each team
// Data comes from squad statistics endpoint for the current season
// Useful for goalscorer and assist betting markets
function TopScorersAssistsSection({ homeTopStats, awayTopStats, homeTeam, awayTeam, loading }) {
  // If loading, show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🎯 Top Scorers & Assists</h2>
        <div className="text-center py-4 text-gray-500">Loading player stats...</div>
      </div>
    );
  }

  // If no data for either team, don't render
  const hasHomeData = homeTopStats?.topScorers?.length > 0 || homeTopStats?.topAssists?.length > 0;
  const hasAwayData = awayTopStats?.topScorers?.length > 0 || awayTopStats?.topAssists?.length > 0;
  
  if (!hasHomeData && !hasAwayData) {
    return null;
  }

  // Render a single player row
  const renderPlayer = (player, stat, icon) => (
    <div key={player.playerId} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {/* Jersey number */}
        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
          {player.jerseyNumber || '-'}
        </span>
        {/* Player name */}
        <span className="text-sm truncate">{player.name}</span>
      </div>
      {/* Stat value */}
      <div className="flex items-center space-x-1">
        <span className="text-sm font-bold text-green-600">{stat}</span>
        <span className="text-xs">{icon}</span>
      </div>
    </div>
  );

  // Render a team's stats (scorers + assists)
  const renderTeamStats = (topStats, teamName, teamLogo) => (
    <div className="flex-1">
      {/* Team header */}
      <div className="flex items-center space-x-2 mb-4">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h3 className="font-medium text-gray-800">{teamName}</h3>
      </div>

      {/* Top Scorers */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          Top Scorers
        </div>
        {topStats?.topScorers?.length > 0 ? (
          <div className="space-y-1">
            {topStats.topScorers.map(player => renderPlayer(player, player.goals, '⚽'))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">No scorers found</div>
        )}
      </div>

      {/* Top Assists */}
      <div>
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
          Top Assists
        </div>
        {topStats?.topAssists?.length > 0 ? (
          <div className="space-y-1">
            {topStats.topAssists.map(player => renderPlayer(player, player.assists, '🅰️'))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">No assists found</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🎯 Top Scorers & Assists
        <span className="text-sm font-normal text-gray-500 ml-2">
          (this season)
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        {renderTeamStats(homeTopStats, homeTeam?.name, homeTeam?.image_path)}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />
        {renderTeamStats(awayTopStats, awayTeam?.name, awayTeam?.image_path)}
      </div>
    </div>
  );
}

// ============================================
// ENHANCED LINEUPS SECTION COMPONENT
// ============================================
// Organizes players by position (GK, DEF, MID, ATT)
// Separates Starting XI from Bench
function EnhancedLineupsSection({ lineups, homeTeam, awayTeam }) {
  // Early return if no lineup data or not an array
  if (!lineups || !Array.isArray(lineups) || lineups.length === 0) {
    return null;
  }
  
  // Extra safety check for team data
  if (!homeTeam?.id || !awayTeam?.id) {
    return null;
  }

  // Position mapping - SportsMonks uses position_id
  // Common IDs: 24=GK, 25=DEF, 26=MID, 27=ATT (but can vary)
  const getPositionGroup = (player) => {
    // Try to determine position from various possible fields
    const positionId = player.position_id || player.position?.id;
    const positionName = player.position?.name?.toLowerCase() || player.position_name?.toLowerCase() || '';
    const detailedPosition = player.detailed_position?.name?.toLowerCase() || '';
    
    // Check by position name first (most reliable)
    if (positionName.includes('goalkeeper') || positionName.includes('goalie') || positionName === 'gk') return 'GK';
    if (positionName.includes('defender') || positionName.includes('back') || positionName === 'def') return 'DEF';
    if (positionName.includes('midfielder') || positionName.includes('mid')) return 'MID';
    if (positionName.includes('forward') || positionName.includes('striker') || positionName.includes('winger') || positionName === 'att') return 'ATT';
    
    // Check detailed position
    if (detailedPosition.includes('keeper')) return 'GK';
    if (detailedPosition.includes('back') || detailedPosition.includes('defender')) return 'DEF';
    if (detailedPosition.includes('mid')) return 'MID';
    if (detailedPosition.includes('forward') || detailedPosition.includes('striker') || detailedPosition.includes('wing')) return 'ATT';
    
    // Fallback by position ID (common patterns)
    if (positionId === 24 || positionId === 1) return 'GK';
    if (positionId === 25 || positionId === 2) return 'DEF';
    if (positionId === 26 || positionId === 3) return 'MID';
    if (positionId === 27 || positionId === 4) return 'ATT';
    
    return 'OTHER';
  };

  // Check if player is in starting XI (type_id = 11) or bench (type_id = 12)
  const isStartingXI = (player) => {
    return player.type_id === 11 || player.lineup_type === 'starting' || player.starting === true;
  };

  // Group players by team, then by starting/bench, then by position
  const organizeLineup = (players, teamId) => {
    const teamPlayers = players.filter(p => p.team_id === teamId);
    
    const starting = teamPlayers.filter(isStartingXI);
    const bench = teamPlayers.filter(p => !isStartingXI(p));
    
    // Group by position
    const groupByPosition = (playerList) => {
      const groups = { GK: [], DEF: [], MID: [], ATT: [], OTHER: [] };
      playerList.forEach(player => {
        const pos = getPositionGroup(player);
        groups[pos].push(player);
      });
      return groups;
    };
    
    return {
      starting: groupByPosition(starting),
      bench: groupByPosition(bench),
      startingCount: starting.length,
      benchCount: bench.length
    };
  };

  const homeLineup = organizeLineup(lineups, homeTeam?.id);
  const awayLineup = organizeLineup(lineups, awayTeam?.id);

  // Position colors for visual distinction
  const positionStyles = {
    GK: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '🧤 Goalkeeper' },
    DEF: { bg: 'bg-blue-50', text: 'text-blue-700', label: '🛡️ Defenders' },
    MID: { bg: 'bg-green-50', text: 'text-green-700', label: '⚙️ Midfielders' },
    ATT: { bg: 'bg-red-50', text: 'text-red-700', label: '⚽ Attackers' },
    OTHER: { bg: 'bg-gray-50', text: 'text-gray-700', label: '📋 Other' }
  };

  // Render a single position group
  const renderPositionGroup = (players, position) => {
    if (!players || players.length === 0) return null;
    const style = positionStyles[position];
    
    return (
      <div key={position} className={`${style.bg} rounded-lg p-2 mb-2`}>
        <div className={`text-xs font-medium ${style.text} mb-1`}>{style.label}</div>
        <div className="space-y-1">
          {players.map((player, idx) => (
            <div key={player.player_id || idx} className="text-sm flex items-center space-x-2">
              <span className="w-6 text-gray-500 font-medium">{player.jersey_number || '-'}</span>
              <span className="flex-1 truncate">{player.player_name || 'Unknown'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render team lineup
  const renderTeamLineup = (lineup, teamName, teamLogo) => (
    <div className="flex-1">
      <div className="flex items-center space-x-2 mb-3">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h3 className="font-medium text-gray-800">{teamName}</h3>
        <span className="text-xs text-gray-500">({lineup.startingCount} + {lineup.benchCount})</span>
      </div>

      {/* Starting XI */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          Starting XI
        </div>
        {['GK', 'DEF', 'MID', 'ATT', 'OTHER'].map(pos => 
          renderPositionGroup(lineup.starting[pos], pos)
        )}
      </div>

      {/* Bench */}
      {lineup.benchCount > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center">
            <span className="w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
            Substitutes ({lineup.benchCount})
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(lineup.bench)
                .flatMap(([pos, players]) => players)
                .map((player, idx) => (
                  <div key={player.player_id || idx} className="text-xs flex items-center space-x-1">
                    <span className="w-5 text-gray-400">{player.jersey_number || '-'}</span>
                    <span className="truncate">{player.player_name || 'Unknown'}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        👥 Lineups
        <span className="text-sm font-normal text-gray-500 ml-2">
          (by position)
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        {renderTeamLineup(homeLineup, homeTeam?.name, homeTeam?.image_path)}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />
        {renderTeamLineup(awayLineup, awayTeam?.name, awayTeam?.image_path)}
      </div>
    </div>
  );
}

// ============================================
// RECENT FORM SECTION COMPONENT
// ============================================
// Shows last 5 matches for each team with W/D/L badges
// Helps assess momentum and current form
function RecentFormSection({ homeForm, awayForm, homeTeam, awayTeam, loading }) {
  // Safety check - ensure forms are arrays
  const safeHomeForm = Array.isArray(homeForm) ? homeForm : [];
  const safeAwayForm = Array.isArray(awayForm) ? awayForm : [];
  
  // Helper to get result badge
  const getResultBadge = (result) => {
    switch (result) {
      case 'W':
        return <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">W</span>;
      case 'D':
        return <span className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center">D</span>;
      case 'L':
        return <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">L</span>;
      default:
        return <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">?</span>;
    }
  };

  // Calculate form summary
  const getFormSummary = (form) => {
    if (!form || form.length === 0) return { wins: 0, draws: 0, losses: 0, points: 0, gf: 0, ga: 0 };
    
    let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
    
    form.forEach(match => {
      if (match.result === 'W') wins++;
      else if (match.result === 'D') draws++;
      else if (match.result === 'L') losses++;
      
      gf += match.goalsFor || 0;
      ga += match.goalsAgainst || 0;
    });
    
    return {
      wins,
      draws,
      losses,
      points: (wins * 3) + draws,
      gf,
      ga
    };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🔥 Recent Form</h2>
        <div className="text-center py-4 text-gray-500">Loading form...</div>
      </div>
    );
  }

  if (safeHomeForm.length === 0 && safeAwayForm.length === 0) {
    return null;
  }

  const homeSummary = getFormSummary(safeHomeForm);
  const awaySummary = getFormSummary(safeAwayForm);

  // Render a single team's form
  const renderTeamForm = (form, summary, teamName, teamLogo) => (
    <div className="flex-1">
      <div className="flex items-center space-x-2 mb-3">
        {teamLogo && (
          <img src={teamLogo} alt={teamName} className="w-6 h-6 object-contain" />
        )}
        <h3 className="font-medium text-gray-800">{teamName}</h3>
      </div>

      {/* Form badges - reversed so most recent is on the RIGHT (standard PL format) */}
      <div className="flex space-x-1 mb-3">
        {form && form.length > 0 ? (
          [...form.slice(0, 5)].reverse().map((match, idx) => (
            <div key={idx} title={`${match.opponent}: ${match.goalsFor}-${match.goalsAgainst}`}>
              {getResultBadge(match.result)}
            </div>
          ))
        ) : (
          <span className="text-sm text-gray-500">No recent matches</span>
        )}
      </div>

      {/* Summary stats */}
      {form && form.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-gray-50 rounded p-2">
            <div className="font-bold text-green-600">{summary.points}</div>
            <div className="text-gray-500">Points</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="font-bold">{summary.gf}</div>
            <div className="text-gray-500">GF</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="font-bold">{summary.ga}</div>
            <div className="text-gray-500">GA</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🔥 Recent Form
        <span className="text-sm font-normal text-gray-500 ml-2">
          (Last 5 matches)
        </span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        {renderTeamForm(safeHomeForm, homeSummary, homeTeam?.name, homeTeam?.image_path)}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />
        {renderTeamForm(safeAwayForm, awaySummary, awayTeam?.name, awayTeam?.image_path)}
      </div>
    </div>
  );
}

// ============================================
// CORNERS BREAKDOWN SECTION COMPONENT
// ============================================
// Shows each team's corner kick statistics for the season
// Now uses HOME/AWAY breakdown from our calculated endpoint:
// - Home team: shows their average when playing AT HOME
// - Away team: shows their average when playing AWAY
// This gives contextually accurate predictions for the fixture
function CornersBreakdownSection({ homeCornerAvg, awayCornerAvg, homeTeam, awayTeam, loading }) {
  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🚩 Corner Kicks</h2>
        <div className="text-center py-4 text-gray-500">Loading corners data...</div>
      </div>
    );
  }

  // Don't render if no corners data available for either team
  if (!homeCornerAvg?.corners && !awayCornerAvg?.corners) {
    return null;
  }

  // ============================================
  // EXTRACT CONTEXTUAL DATA
  // ============================================
  // Home team: their corners when playing AT HOME
  // Away team: their corners when playing AWAY
  const homeTeamHomeData = homeCornerAvg?.corners?.home;
  const awayTeamAwayData = awayCornerAvg?.corners?.away;

  // Combined expected corners for this fixture
  const combinedExpected = homeTeamHomeData?.average && awayTeamAwayData?.average
    ? (homeTeamHomeData.average + awayTeamAwayData.average).toFixed(1)
    : null;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🚩 Corner Kicks
      </h2>

      {/* Two-column layout for team comparison */}
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Home Team - Their HOME corners */}
        <div className="flex-1 bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center space-x-2 mb-3">
            {homeTeam?.image_path && (
              <img 
                src={homeTeam.image_path} 
                alt={homeTeam.name} 
                className="w-8 h-8 object-contain" 
              />
            )}
            <div>
              <h3 className="font-medium text-gray-800">{homeTeam?.name || 'Home'}</h3>
              <span className="text-xs text-blue-600 font-medium">🏠 Playing at Home</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Corners at Home */}
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {homeTeamHomeData?.total ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Corners at Home</div>
            </div>
            
            {/* Average Per Home Game */}
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {homeTeamHomeData?.average ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Per Home Game</div>
            </div>
          </div>
          
          {homeTeamHomeData?.games > 0 && (
            <div className="text-xs text-gray-400 mt-2 text-center">
              ({homeTeamHomeData.games} home games)
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-gray-200" />
        <div className="md:hidden h-px bg-gray-200" />

        {/* Away Team - Their AWAY corners */}
        <div className="flex-1 bg-red-50 rounded-lg p-4 border border-red-100">
          <div className="flex items-center space-x-2 mb-3">
            {awayTeam?.image_path && (
              <img 
                src={awayTeam.image_path} 
                alt={awayTeam.name} 
                className="w-8 h-8 object-contain" 
              />
            )}
            <div>
              <h3 className="font-medium text-gray-800">{awayTeam?.name || 'Away'}</h3>
              <span className="text-xs text-red-600 font-medium">✈️ Playing Away</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Corners Away */}
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-red-600">
                {awayTeamAwayData?.total ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Corners Away</div>
            </div>
            
            {/* Average Per Away Game */}
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-red-600">
                {awayTeamAwayData?.average ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Per Away Game</div>
            </div>
          </div>
          
          {awayTeamAwayData?.games > 0 && (
            <div className="text-xs text-gray-400 mt-2 text-center">
              ({awayTeamAwayData.games} away games)
            </div>
          )}
        </div>
      </div>

      {/* Combined Expected Corners */}
      {combinedExpected && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-red-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-center space-x-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{combinedExpected}</div>
              <div className="text-sm text-gray-600">Expected Total Corners</div>
            </div>
          </div>
        </div>
      )}

      {/* Cache indicator (small, subtle) */}
      {(homeCornerAvg?.fromCache || awayCornerAvg?.fromCache) && (
        <div className="text-xs text-gray-400 text-right mt-2">
          📦 Cached data
        </div>
      )}
    </div>
  );
}

// ============================================
// TEAM STATS COMPARISON SECTION COMPONENT
// ============================================
// Side-by-side comparison of key betting stats
// Shows: Goals, Clean Sheets, BTTS, Failed to Score, etc.
function TeamStatsComparisonSection(props) {
  // Defensive check - if props is undefined, return null
  if (!props) return null;
  
  const { homeStats, awayStats, homeTeam, awayTeam, loading } = props;
  // Helper to extract a stat value from team statistics
  // Type IDs: 52=goals, 88=goals_conceded, 194=cleansheets, 575=failed_to_score, 192=btts
  // 214=wins, 215=draws, 216=losses
  const extractStat = (stats, typeId) => {
    if (!stats?.statistics) return null;
    
    for (const statGroup of stats.statistics) {
      if (!statGroup.details) continue;
      
      for (const detail of statGroup.details) {
        if (detail.type_id === typeId) {
          const value = detail.value;
          
          // Value could be a number - return directly
          if (typeof value === 'number') {
            return value;
          }
          
          // Value could be null/undefined
          if (value === null || value === undefined) {
            return null;
          }
          
          // Value is an object - try to extract the numeric value
          if (typeof value === 'object') {
            // Common patterns:
            // - {count, percentage}
            // - {all: {count, percentage}, home: {...}, away: {...}}
            // - {total, ...}
            if (value.count !== undefined) return value.count;
            if (value.all !== undefined) {
              // value.all might be a number or an object like {count, percentage}
              if (typeof value.all === 'number') return value.all;
              if (typeof value.all === 'object' && value.all.count !== undefined) {
                return value.all.count;
              }
            }
            if (value.total !== undefined) return value.total;
            // If it's an object we can't handle, return null instead of the object
            return null;
          }
          
          // Value is a string that might be a number
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? null : parsed;
          }
          
          // Unknown format - return null to be safe
          return null;
        }
      }
    }
    return null;
  };

  // Calculate games played from wins + draws + losses
  const getGamesPlayed = (stats) => {
    const wins = extractStat(stats, 214) || 0;
    const draws = extractStat(stats, 215) || 0;
    const losses = extractStat(stats, 216) || 0;
    return wins + draws + losses;
  };

  // Calculate a percentage
  const calcPercentage = (value, total) => {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Season Stats</h2>
        <div className="text-center py-4 text-gray-500">Loading stats...</div>
      </div>
    );
  }

  // Check if we have data
  if (!homeStats?.statistics && !awayStats?.statistics) {
    return null;
  }

  // Extract key stats for both teams
  const homeGames = getGamesPlayed(homeStats);
  const awayGames = getGamesPlayed(awayStats);

  const stats = [
    {
      label: 'Goals Scored',
      home: extractStat(homeStats, 52),
      away: extractStat(awayStats, 52),
      icon: '⚽',
      better: 'higher',
      hidePercentage: true  // Percentage doesn't make sense for goals
    },
    {
      label: 'Goals Conceded',
      home: extractStat(homeStats, 88),
      away: extractStat(awayStats, 88),
      icon: '🥅',
      better: 'lower',
      hidePercentage: true  // Percentage doesn't make sense for goals
    },
    {
      label: 'Clean Sheets',
      home: extractStat(homeStats, 194),
      away: extractStat(awayStats, 194),
      icon: '🛡️',
      better: 'higher'
    },
    {
      label: 'Failed to Score',
      home: extractStat(homeStats, 575),
      away: extractStat(awayStats, 575),
      icon: '❌',
      better: 'lower'
    },
    {
      label: 'BTTS (Both Score)',
      home: extractStat(homeStats, 192),
      away: extractStat(awayStats, 192),
      icon: '↔️',
      better: 'neutral'
    },
    {
      label: 'Wins',
      home: extractStat(homeStats, 214),
      away: extractStat(awayStats, 214),
      icon: '🌟',
      better: 'higher'
    },
    {
      label: 'Draws',
      home: extractStat(homeStats, 215),
      away: extractStat(awayStats, 215),
      icon: '🤝',
      better: 'neutral'
    },
    {
      label: 'Losses',
      home: extractStat(homeStats, 216),
      away: extractStat(awayStats, 216),
      icon: '📉',
      better: 'lower'
    }
  ];

  // Filter to only show stats that have data
  const availableStats = stats.filter(s => s.home !== null || s.away !== null);

  if (availableStats.length === 0) {
    return null;
  }

  // Determine which team has the better value
  const getBetterTeam = (stat) => {
    if (stat.home === null || stat.away === null) return 'neutral';
    if (stat.home === stat.away) return 'neutral';
    
    if (stat.better === 'higher') {
      return stat.home > stat.away ? 'home' : 'away';
    } else if (stat.better === 'lower') {
      return stat.home < stat.away ? 'home' : 'away';
    }
    return 'neutral';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        📊 Season Stats Comparison
        <span className="text-sm font-normal text-gray-500 ml-2">
          ({homeGames || '?'} vs {awayGames || '?'} games)
        </span>
      </h2>

      {/* Team Headers */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
        <div className="flex items-center space-x-2 flex-1">
          {homeTeam?.image_path && (
            <img src={homeTeam.image_path} alt={homeTeam.name} className="w-6 h-6 object-contain" />
          )}
          <span className="font-medium text-sm truncate">{homeTeam?.name}</span>
        </div>
        <div className="w-24 text-center text-xs text-gray-500">Stat</div>
        <div className="flex items-center space-x-2 flex-1 justify-end">
          <span className="font-medium text-sm truncate">{awayTeam?.name}</span>
          {awayTeam?.image_path && (
            <img src={awayTeam.image_path} alt={awayTeam.name} className="w-6 h-6 object-contain" />
          )}
        </div>
      </div>

      {/* Stats Rows */}
      <div className="space-y-2">
        {availableStats.map((stat, idx) => {
          const better = getBetterTeam(stat);

          // Safely render stat values - they might be objects from the API
          const renderStatValue = (value) => {
            if (value === null || value === undefined) return '-';
            if (typeof value === 'object') {
              // Try to extract a number from common object patterns
              return value.count ?? value.total ?? value.all ?? '-';
            }
            return value;
          };

          const homeValue = renderStatValue(stat.home);
          const awayValue = renderStatValue(stat.away);

          return (
            <div key={idx} className="flex items-center justify-between py-1">
              {/* Home Value */}
              <div className={`flex-1 text-left font-medium ${
                better === 'home' ? 'text-green-600' : 'text-gray-700'
              }`}>
                {homeValue}
                {/* Show percentage for most stats, but not for goals */}
                {!stat.hidePercentage && homeGames > 0 && typeof homeValue === 'number' && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({calcPercentage(homeValue, homeGames)}%)
                  </span>
                )}
              </div>

              {/* Stat Label */}
              <div className="w-32 text-center text-xs text-gray-600 flex items-center justify-center">
                <span className="mr-1">{stat.icon}</span>
                {stat.label}
              </div>

              {/* Away Value */}
              <div className={`flex-1 text-right font-medium ${
                better === 'away' ? 'text-green-600' : 'text-gray-700'
              }`}>
                {/* Show percentage for most stats, but not for goals */}
                {!stat.hidePercentage && awayGames > 0 && typeof awayValue === 'number' && (
                  <span className="text-xs text-gray-400 mr-1">
                    ({calcPercentage(awayValue, awayGames)}%)
                  </span>
                )}
                {awayValue}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ============================================
// ALL BETTING MARKETS CONTENT COMPONENT
// ============================================
// Shows ALL markets with odds grouped by bookmaker within each market
// Each market is individually expandable/collapsible
// This section ignores the main bookmaker filter - shows everything
function AllBettingMarketsContent({ odds, bookmakers, oddsFormat, formatOddLabel, getMarketName }) {
  // State to track which markets are expanded
  // Default: all collapsed (empty set)
  const [expandedMarkets, setExpandedMarkets] = useState(new Set());

  // Toggle a specific market's expanded state
  const toggleMarket = (marketId) => {
    setExpandedMarkets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(marketId)) {
        newSet.delete(marketId);
      } else {
        newSet.add(marketId);
      }
      return newSet;
    });
  };

  // Expand all markets
  const expandAll = () => {
    const allMarketIds = [...new Set(odds.map(o => o.market_id))];
    setExpandedMarkets(new Set(allMarketIds));
  };

  // Collapse all markets
  const collapseAll = () => {
    setExpandedMarkets(new Set());
  };

  // Build a map of bookmaker ID -> name from the odds data
  // This ensures we show proper names even for bookmakers not in the main filter
  const bookmakerNames = useMemo(() => {
    const names = {};
    odds.forEach(odd => {
      if (odd.bookmaker_id && !names[odd.bookmaker_id]) {
        names[odd.bookmaker_id] = odd.bookmaker?.name || `Bookmaker ${odd.bookmaker_id}`;
      }
    });
    return names;
  }, [odds]);

  // Group ALL odds by market (ignoring any filter)
  const allOddsByMarket = useMemo(() => {
    return odds.reduce((acc, odd) => {
      const marketId = odd.market_id;
      if (!acc[marketId]) {
        acc[marketId] = [];
      }
      acc[marketId].push(odd);
      return acc;
    }, {});
  }, [odds]);

  // If no odds available, show message
  if (Object.keys(allOddsByMarket).length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No betting markets available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Expand/Collapse All Controls */}
      <div className="flex justify-end space-x-3 text-sm mb-2">
        <button
          onClick={expandAll}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          Expand All
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={collapseAll}
          className="text-gray-600 hover:text-gray-800 hover:underline"
        >
          Collapse All
        </button>
      </div>

      {/* Market Cards */}
      {Object.entries(allOddsByMarket).map(([marketId, marketOdds]) => {
        const mId = parseInt(marketId);
        const isExpanded = expandedMarkets.has(mId);
        
        // Get market name from the included market data, or fallback to lookup
        const marketName = marketOdds[0]?.market?.name || getMarketName(mId);
        
        // Group odds by bookmaker within this market
        const oddsByBookmaker = marketOdds.reduce((acc, odd) => {
          const bmId = odd.bookmaker_id;
          if (!acc[bmId]) {
            acc[bmId] = [];
          }
          acc[bmId].push(odd);
          return acc;
        }, {});
        
        // Count unique bookmakers for this market
        const bookmakerCount = Object.keys(oddsByBookmaker).length;
        
        // Get unique selection labels for this market (for header preview)
        const uniqueLabels = [...new Set(marketOdds.map(o => o.label || o.name))].slice(0, 4);
        
        return (
          <div key={marketId} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Market Header (clickable to expand/collapse) */}
            <button
              onClick={() => toggleMarket(mId)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-3">
                <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>
                <span className="font-medium text-gray-800">{marketName}</span>
                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                  {bookmakerCount} bookmaker{bookmakerCount !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Preview of selections when collapsed */}
              {!isExpanded && (
                <div className="text-xs text-gray-400 hidden sm:block">
                  {uniqueLabels.map(label => formatOddLabel(label, mId)).join(' • ')}
                </div>
              )}
            </button>
            
            {/* Expanded Content - Odds grouped by bookmaker */}
            {isExpanded && (
              <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                {Object.entries(oddsByBookmaker)
                  .sort((a, b) => {
                    // Sort bookmakers alphabetically by name
                    const nameA = bookmakerNames[a[0]] || '';
                    const nameB = bookmakerNames[b[0]] || '';
                    return nameA.localeCompare(nameB);
                  })
                  .map(([bmId, bmOdds]) => {
                    const bookmakerName = bookmakerNames[bmId] || `Bookmaker ${bmId}`;
                    
                    // Get unique labels for this bookmaker's odds
                    let labels = [...new Set(bmOdds.map(o => o.label || o.name))];
                    
                    // ============================================
                    // ENFORCE CONSISTENT ORDER FOR 1X2 MARKETS
                    // ============================================
                    // For Fulltime Result markets (1, 37, 80, 28075), always show:
                    // Home (1) → Draw (X) → Away (2)
                    // This ensures consistent display across all bookmakers
                    // Handle both uppercase and lowercase variants
                    if ([1, 37, 80, 28075].includes(mId)) {
                      const sortOrder = { 
                        '1': 0, 'x': 1, 'X': 1, '2': 2,
                        'Home': 0, 'home': 0, 'Draw': 1, 'draw': 1, 'Away': 2, 'away': 2
                      };
                      labels = labels.sort((a, b) => {
                        const orderA = sortOrder[a] ?? 999; // Unknown labels go to end
                        const orderB = sortOrder[b] ?? 999;
                        return orderA - orderB;
                      });
                    }
                    
                    return (
                      <div key={bmId} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                        {/* Bookmaker Name */}
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          {bookmakerName}
                        </div>
                        
                        {/* Odds Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {labels.map(label => {
                            const odd = bmOdds.find(o => (o.label || o.name) === label);
                            const displayLabel = formatOddLabel(label, mId);
                            const formattedOdd = formatOdds(odd, oddsFormat);

                            // Skip if no valid odds value
                            if (formattedOdd === '-') return null;

                            return (
                              <div
                                key={label}
                                className="bg-gray-50 p-2 rounded text-center hover:bg-gray-100 transition-colors"
                              >
                                <div
                                  className="text-xs text-gray-500 truncate mb-1"
                                  title={displayLabel}
                                >
                                  {displayLabel}
                                </div>
                                <div className="font-bold text-gray-800">
                                  {formattedOdd}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN FIXTURE DETAIL COMPONENT
// ============================================
const FixtureDetail = () => {
  const { id } = useParams();
  const { token, isAuthenticated, user } = useAuth();

  // ============================================
  // USER PREFERENCES
  // ============================================
  const timezone = user?.timezone || 'America/New_York';
  const dateFormat = user?.dateFormat || 'US';
  const temperatureUnit = user?.temperatureUnit || 'FAHRENHEIT';
  const oddsFormat = user?.oddsFormat || 'AMERICAN';

  // Main fixture data
  const [fixture, setFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Odds data
  const [odds, setOdds] = useState([]);
  const [bookmakers, setBookmakers] = useState([]);
  const [selectedBookmakerIds, setSelectedBookmakerIds] = useState(DEFAULT_BOOKMAKER_IDS);
  const [oddsLoading, setOddsLoading] = useState(false);

  // Head to head data
  const [h2h, setH2h] = useState([]);
  const [h2hLoading, setH2hLoading] = useState(false);

  // Team stats for scoring patterns
  const [homeTeamStats, setHomeTeamStats] = useState(null);
  const [awayTeamStats, setAwayTeamStats] = useState(null);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);

  // Recent form data (derived from recent fixtures)
  const [homeRecentForm, setHomeRecentForm] = useState([]);
  const [awayRecentForm, setAwayRecentForm] = useState([]);
  const [formLoading, setFormLoading] = useState(false);

  // Top scorers/assists data for each team
  const [homeTopStats, setHomeTopStats] = useState(null);
  const [awayTopStats, setAwayTopStats] = useState(null);
  const [topStatsLoading, setTopStatsLoading] = useState(false);

  // Corner averages (calculated from historical fixtures)
  const [homeCornerAvg, setHomeCornerAvg] = useState(null);
  const [awayCornerAvg, setAwayCornerAvg] = useState(null);
  const [cornersLoading, setCornersLoading] = useState(false);

  // ============================================
  // FETCH FIXTURE DATA ON MOUNT
  // ============================================
  useEffect(() => {
    const fetchFixture = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getFixture(id, true); // Include odds
        setFixture(data.fixture);

        // Extract odds from fixture if included
        if (data.fixture?.odds) {
          setOdds(data.fixture.odds);
        }
      } catch (err) {
        console.error('Failed to fetch fixture:', err);
        setError(err.message || 'Failed to load fixture');
      } finally {
        setLoading(false);
      }
    };

    fetchFixture();
  }, [id]);

  // ============================================
  // BUILD BOOKMAKERS LIST FROM ODDS DATA
  // ============================================
  // The odds data now includes bookmaker names directly (via odds.bookmaker include)
  // This ensures:
  // 1. Only bookmakers with odds for THIS fixture appear in the dropdown
  // 2. The filter actually works (IDs match between dropdown and odds)
  // 3. Bookmaker names come directly from the odds data - no separate API call needed
  useEffect(() => {
    if (!odds || odds.length === 0) return;
    
    // For 1X2 market (market_id = 1), find which bookmakers have valid odds
    const market1Odds = odds.filter(o => o.market_id === 1);
    
    // Build a map of bookmaker ID -> name from the odds data
    // Each odd object now has a 'bookmaker' property with { id, name, ... }
    const bookmakerMap = {};
    odds.forEach(odd => {
      if (odd.bookmaker_id && !bookmakerMap[odd.bookmaker_id]) {
        // Get name from embedded bookmaker object, or use ID as fallback
        const name = odd.bookmaker?.name || `Bookmaker ${odd.bookmaker_id}`;
        bookmakerMap[odd.bookmaker_id] = name;
      }
    });
    
    // Build bookmaker list - only include those with valid 1X2 odds
    const bookmakersWithValid1X2 = Object.keys(bookmakerMap)
      .map(bmId => {
        const id = parseInt(bmId);
        // Check if this bookmaker has valid 1X2 odds
        const bmOdds = market1Odds.filter(o => o.bookmaker_id === id);
        const homeOdd = bmOdds.find(o => o.label === '1' || o.name?.toLowerCase().includes('home'));
        const drawOdd = bmOdds.find(o => o.label === 'X' || o.name?.toLowerCase().includes('draw'));
        const awayOdd = bmOdds.find(o => o.label === '2' || o.name?.toLowerCase().includes('away'));
        
        const hasValid1X2 = (
          (homeOdd?.american !== null && homeOdd?.american !== undefined) ||
          (drawOdd?.american !== null && drawOdd?.american !== undefined) ||
          (awayOdd?.american !== null && awayOdd?.american !== undefined)
        );
        
        return {
          id,
          name: bookmakerMap[bmId],
          hasValid1X2
        };
      })
      .filter(bm => bm.hasValid1X2) // Only show bookmakers with valid 1X2 odds
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    
    console.log('[DEBUG Odds] Bookmakers with valid 1X2 odds:', bookmakersWithValid1X2.map(b => b.name));
    
    setBookmakers(bookmakersWithValid1X2);
    
    // Set default selection: prefer Betfair (4) and Unibet (9) if available
    const availableIds = bookmakersWithValid1X2.map(b => b.id);
    const defaultsAvailable = DEFAULT_BOOKMAKER_IDS.filter(id => availableIds.includes(id));
    
    if (defaultsAvailable.length >= 2) {
      setSelectedBookmakerIds(defaultsAvailable);
    } else if (defaultsAvailable.length === 1) {
      // Add one more bookmaker to the defaults
      const others = availableIds.filter(id => !defaultsAvailable.includes(id));
      setSelectedBookmakerIds([...defaultsAvailable, ...(others.slice(0, 1))]);
    } else {
      // Use first 2 available bookmakers
      setSelectedBookmakerIds(availableIds.slice(0, 2));
    }
  }, [odds]);

  // ============================================
  // FETCH H2H WHEN FIXTURE LOADS
  // ============================================
  useEffect(() => {
    if (!fixture) return;

    const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');

    if (!homeTeam || !awayTeam) return;

    const fetchH2H = async () => {
      setH2hLoading(true);
      try {
        const data = await dataApi.getHeadToHead(homeTeam.id, awayTeam.id);
        // Filter out the current fixture and sort by date (most recent first)
        const filtered = (data.fixtures || [])
          .filter(f => f.id !== parseInt(id))
          .sort((a, b) => new Date(b.starting_at) - new Date(a.starting_at));
        setH2h(filtered);
      } catch (err) {
        console.error('Failed to fetch H2H:', err);
      } finally {
        setH2hLoading(false);
      }
    };

    fetchH2H();
  }, [fixture, id]);

  // ============================================
  // FETCH TEAM STATS FOR SCORING PATTERNS
  // ============================================
  useEffect(() => {
    if (!fixture) return;

    const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');

    // Get the season ID from the fixture to filter stats correctly
    const seasonId = fixture.season_id || fixture.season?.id;

    if (!homeTeam || !awayTeam) return;

    const fetchTeamStats = async () => {
      setTeamStatsLoading(true);
      try {
        // Fetch stats for both teams in parallel
        // Use getTeamStatsBySeason if we have a season ID to get accurate stats
        // for the correct season, otherwise fall back to general stats
        const [homeData, awayData] = await Promise.all([
          seasonId
            ? dataApi.getTeamStatsBySeason(homeTeam.id, seasonId)
            : dataApi.getTeamStats(homeTeam.id),
          seasonId
            ? dataApi.getTeamStatsBySeason(awayTeam.id, seasonId)
            : dataApi.getTeamStats(awayTeam.id)
        ]);

        setHomeTeamStats(homeData.team || homeData);
        setAwayTeamStats(awayData.team || awayData);
      } catch (err) {
        console.error('Failed to fetch team stats:', err);
        // Non-critical, don't show error to user
      } finally {
        setTeamStatsLoading(false);
      }
    };

    fetchTeamStats();
  }, [fixture]);

  // ============================================
  // FETCH RECENT FORM (Last 5 matches per team)
  // ============================================
  useEffect(() => {
    if (!fixture) return;

    const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');

    if (!homeTeam || !awayTeam) return;

    // Helper to calculate form from fixtures
    const calculateForm = (fixtures, teamId) => {
      // DEBUG: Log raw fixtures received
      console.log('[DEBUG Recent Form] Raw fixtures for team', teamId, ':', fixtures.length, 'total');
      console.log('[DEBUG Recent Form] Sample fixture state:', fixtures[0]?.state);
      
      const finishedMatches = fixtures.filter(f => f.state?.state === 'FT');
      console.log('[DEBUG Recent Form] Finished matches (FT):', finishedMatches.length);
      
      if (finishedMatches.length === 0) {
        console.log('[DEBUG Recent Form] No finished matches found! Check if state is included in API response.');
        console.log('[DEBUG Recent Form] Available states in fixtures:', fixtures.map(f => f.state).slice(0, 5));
      }
      
      return finishedMatches
        .sort((a, b) => new Date(b.starting_at) - new Date(a.starting_at)) // Most recent first
        .slice(0, 5) // Last 5
        .map(f => {
          const isHome = f.participants?.find(p => p.id === teamId)?.meta?.location === 'home';
          const homeScore = f.scores?.find(s => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
          const awayScore = f.scores?.find(s => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
          
          const goalsFor = isHome ? homeScore : awayScore;
          const goalsAgainst = isHome ? awayScore : homeScore;
          
          let result;
          if (goalsFor > goalsAgainst) result = 'W';
          else if (goalsFor < goalsAgainst) result = 'L';
          else result = 'D';
          
          const opponent = f.participants?.find(p => p.id !== teamId)?.name || 'Unknown';
          
          return { result, goalsFor, goalsAgainst, opponent, date: f.starting_at };
        });
    };

    const fetchRecentForm = async () => {
      setFormLoading(true);
      try {
        // Get fixtures from last 60 days for both teams
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const [homeFixtures, awayFixtures] = await Promise.all([
          dataApi.getTeamFixturesByDateRange(startDate, endDate, homeTeam.id),
          dataApi.getTeamFixturesByDateRange(startDate, endDate, awayTeam.id)
        ]);
        
        // Filter out the current fixture
        const homeFiltered = (homeFixtures.fixtures || []).filter(f => f.id !== parseInt(id));
        const awayFiltered = (awayFixtures.fixtures || []).filter(f => f.id !== parseInt(id));
        
        setHomeRecentForm(calculateForm(homeFiltered, homeTeam.id));
        setAwayRecentForm(calculateForm(awayFiltered, awayTeam.id));
      } catch (err) {
        console.error('Failed to fetch recent form:', err);
      } finally {
        setFormLoading(false);
      }
    };

    fetchRecentForm();
  }, [fixture, id]);

  // ============================================
  // FETCH TOP SCORERS & ASSISTS FOR EACH TEAM
  // ============================================
  // Uses the squad endpoint with player statistics to get
  // top 5 scorers and top 5 assist providers for each team
  useEffect(() => {
    if (!fixture) return;

    const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
    const seasonId = fixture.season_id || fixture.season?.id;

    // Need both teams and a season to fetch stats
    if (!homeTeam || !awayTeam || !seasonId) return;

    const fetchTopStats = async () => {
      setTopStatsLoading(true);
      try {
        // Fetch top stats for both teams in parallel
        const [homeData, awayData] = await Promise.all([
          dataApi.getTeamTopStats(homeTeam.id, seasonId),
          dataApi.getTeamTopStats(awayTeam.id, seasonId)
        ]);

        setHomeTopStats(homeData);
        setAwayTopStats(awayData);
      } catch (err) {
        console.error('Failed to fetch top stats:', err);
        // Non-critical, don't show error to user
      } finally {
        setTopStatsLoading(false);
      }
    };

    fetchTopStats();
  }, [fixture]);

  // ============================================
  // FETCH CORNER AVERAGES (from new endpoint)
  // ============================================
  // Fetches calculated home/away corner averages for each team
  // Uses the new cached endpoint that calculates from historical fixtures
  useEffect(() => {
    if (!fixture) return;

    const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
    const seasonId = fixture.season_id || fixture.season?.id;

    // Need both teams and a season to fetch corner averages
    if (!homeTeam || !awayTeam || !seasonId) return;

    const fetchCornerAverages = async () => {
      setCornersLoading(true);
      try {
        // Fetch corner averages for both teams in parallel
        const [homeData, awayData] = await Promise.all([
          dataApi.getTeamCornerAverages(homeTeam.id, seasonId),
          dataApi.getTeamCornerAverages(awayTeam.id, seasonId)
        ]);

        setHomeCornerAvg(homeData);
        setAwayCornerAvg(awayData);
      } catch (err) {
        console.error('Failed to fetch corner averages:', err);
        // Non-critical, don't show error to user
      } finally {
        setCornersLoading(false);
      }
    };

    fetchCornerAverages();
  }, [fixture]);

  // ============================================
  // BOOKMAKER TOGGLE HANDLER
  // ============================================
  const toggleBookmaker = (bookmakerId) => {
    setSelectedBookmakerIds(prev => {
      if (prev.includes(bookmakerId)) {
        return prev.filter(id => id !== bookmakerId);
      } else {
        return [...prev, bookmakerId];
      }
    });
  };

  const selectAllBookmakers = () => {
    setSelectedBookmakerIds(bookmakers.map(b => b.id));
  };

  const clearBookmakers = () => {
    setSelectedBookmakerIds([]);
  };

  // ============================================
  // FILTER ODDS BY SELECTED BOOKMAKERS
  // ============================================
  // Safety check - ensure odds is an array before filtering
  const safeOdds = Array.isArray(odds) ? odds : [];
  const filteredOdds = safeOdds.filter(
    odd => selectedBookmakerIds.length === 0 || selectedBookmakerIds.includes(odd.bookmaker_id)
  );

  // Group odds by market
  const oddsByMarket = filteredOdds.reduce((acc, odd) => {
    const marketId = odd.market_id;
    if (!acc[marketId]) {
      acc[marketId] = [];
    }
    acc[marketId].push(odd);
    return acc;
  }, {});

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading fixture...
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error || !fixture) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error || 'Fixture not found'}</div>
        <Link to="/fixtures" className="text-blue-600 hover:underline">
          ← Back to Fixtures
        </Link>
      </div>
    );
  }

  // ============================================
  // EXTRACT TEAM DATA
  // ============================================
  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const homeScore = getScore(fixture, 'home');
  const awayScore = getScore(fixture, 'away');
  const isFinished = fixture.state?.state === 'FT';
  const isLive = ['1H', '2H', 'HT', 'ET', 'PEN'].includes(fixture.state?.state);
  const fixtureName = `${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`;
  
  // ============================================
  // DETERMINE FIXTURE TYPE (UPCOMING vs HISTORICAL)
  // ============================================
  // Upcoming = not started yet (scheduled, postponed, etc.)
  // Historical = finished (FT) or was live
  // This determines which sections to show:
  // - UPCOMING: Odds, H2H, Recent Form, Sidelined, Scoring Patterns, Team Stats
  // - HISTORICAL: Sidelined, Lineups, Match Events, Match Statistics
  const isUpcoming = !isFinished && !isLive;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/fixtures" className="text-blue-600 hover:underline text-sm">
        ← Back to Fixtures
      </Link>

      {/* ============================================ */}
      {/* MATCH HEADER */}
      {/* ============================================ */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* League banner */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-900 px-4 py-2 text-white text-sm flex items-center justify-between">
          <span>{fixture.league?.name || 'League'}</span>
          {isLive && (
            <span className="bg-green-500 px-2 py-0.5 rounded text-xs font-bold animate-pulse">
              LIVE
            </span>
          )}
        </div>

        {/* Teams and score */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            {/* Home team */}
            <Link 
              to={`/teams/${homeTeam?.id}`}
              className="flex-1 flex flex-col items-center text-center hover:text-blue-600"
            >
              {homeTeam?.image_path && (
                <img
                  src={homeTeam.image_path}
                  alt={homeTeam.name}
                  className="w-20 h-20 object-contain mb-2"
                />
              )}
              <span className="font-semibold text-lg">{homeTeam?.name || 'Home'}</span>
            </Link>

            {/* Score / Time */}
            <div className="px-8 text-center">
              {homeScore !== null && awayScore !== null ? (
                <div className={`text-4xl font-bold ${isLive ? 'text-green-600' : ''}`}>
                  {homeScore} - {awayScore}
                </div>
              ) : (
                <div className="text-2xl font-medium text-gray-700">
                  {formatTimeUtil(fixture.starting_at, timezone)}
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2">
                {isFinished ? 'Full Time' : isLive ? fixture.state?.state : 'Scheduled'}
              </div>
            </div>

            {/* Away team */}
            <Link 
              to={`/teams/${awayTeam?.id}`}
              className="flex-1 flex flex-col items-center text-center hover:text-blue-600"
            >
              {awayTeam?.image_path && (
                <img
                  src={awayTeam.image_path}
                  alt={awayTeam.name}
                  className="w-20 h-20 object-contain mb-2"
                />
              )}
              <span className="font-semibold text-lg">{awayTeam?.name || 'Away'}</span>
            </Link>
          </div>

          {/* Date, venue, formations, and weather */}
          <div className="mt-4 text-center text-sm text-gray-500 space-y-1">
            <div>📅 {formatDateUtil(fixture.starting_at, timezone, dateFormat)}</div>
            {fixture.venue?.name && (
              <div>📍 {fixture.venue.name}{fixture.venue.city ? `, ${fixture.venue.city}` : ''}</div>
            )}
            
            {/* Formations - very useful for betting research */}
            {(() => {
              const formations = getFormationsFromMetadata(fixture.metadata);
              const lineupsConfirmed = getLineupsConfirmed(fixture.metadata);
              if (!formations || (!formations.home && !formations.away)) return null;
              
              return (
                <div className="flex items-center justify-center space-x-3 text-gray-600">
                  <span className="font-medium">{formations.home || '?'}</span>
                  <span className="text-xs text-gray-400 flex flex-col items-center">
                    <span>🎯 Formations</span>
                    {lineupsConfirmed === false && (
                      <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">
                        Predicted
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{formations.away || '?'}</span>
                </div>
              );
            })()}
            
            {/* Attendance - only show for finished matches */}
            {(() => {
              const attendance = getAttendanceFromMetadata(fixture.metadata);
              if (!attendance) return null;
              
              return (
                <div className="text-gray-500">
                  🏟️ {attendance.toLocaleString()} attendance
                </div>
              );
            })()}
            
            {/* Weather conditions - only available close to match day */}
            {/* Note: Weather data only available ~24-48 hours before kickoff */}
            {(() => {
              const weather = getWeatherDisplay(fixture.weatherreport, temperatureUnit);
              if (!weather) return null;

              return (
                <div className="flex items-center justify-center space-x-2">
                  {weather.iconUrl && (
                    <img
                      src={weather.iconUrl}
                      alt={weather.label}
                      className="w-10 h-10"
                    />
                  )}
                  <span className="capitalize">{weather.label}</span>
                  {weather.tempDisplay && (
                    <span className="font-medium">{weather.tempDisplay}</span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* AI PREDICTIONS SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Most important section for betting research - placed right after match header */}
      {isUpcoming && (
        <MatchPredictions 
          fixtureId={id}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      )}

      {/* ============================================ */}
      {/* ODDS SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Only show odds for upcoming fixtures - no point after match is finished */}
      {isUpcoming && (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">💰 Odds</h2>
          
          {/* Bookmaker filter */}
          <div className="relative group">
            <button className="text-sm text-blue-600 hover:underline">
              Filter Bookmakers ({selectedBookmakerIds.length})
            </button>
            
            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <div className="p-2 border-b border-gray-200 flex justify-between">
                <button 
                  onClick={selectAllBookmakers}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <button 
                  onClick={clearBookmakers}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                {bookmakers.map(bm => (
                  <label key={bm.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedBookmakerIds.includes(bm.id)}
                      onChange={() => toggleBookmaker(bm.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{bm.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 1X2 Odds Display */}
        {filteredOdds.length > 0 ? (
          <div className="space-y-4">
            {/* Group by bookmaker for 1X2 market (market_id = 1) */}
            {oddsByMarket[1] && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Match Result (1X2)</h3>
                <div className="space-y-2">
                  {/* Group by bookmaker - filter out bookmakers with no valid odds */}
                  {Array.from(new Set(oddsByMarket[1].map(o => o.bookmaker_id)))
                    .filter(bmId => {
                      // Only include bookmakers that have at least one valid odd value
                      const bmOdds = oddsByMarket[1].filter(o => o.bookmaker_id === bmId);
                      const homeOdd = bmOdds.find(o => o.label === '1' || o.name?.toLowerCase().includes('home'));
                      const drawOdd = bmOdds.find(o => o.label === 'X' || o.name?.toLowerCase().includes('draw'));
                      const awayOdd = bmOdds.find(o => o.label === '2' || o.name?.toLowerCase().includes('away'));
                      
                      return (
                        (homeOdd?.american !== null && homeOdd?.american !== undefined) ||
                        (drawOdd?.american !== null && drawOdd?.american !== undefined) ||
                        (awayOdd?.american !== null && awayOdd?.american !== undefined)
                      );
                    })
                    .map(bmId => {
                    const bmOdds = oddsByMarket[1].filter(o => o.bookmaker_id === bmId);
                    const bm = bookmakers.find(b => b.id === bmId);
                    
                    // Find home, draw, away odds
                    const homeOdd = bmOdds.find(o => o.label === '1' || o.name?.toLowerCase().includes('home'));
                    const drawOdd = bmOdds.find(o => o.label === 'X' || o.name?.toLowerCase().includes('draw'));
                    const awayOdd = bmOdds.find(o => o.label === '2' || o.name?.toLowerCase().includes('away'));

                    return (
                      <div key={bmId} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-700 w-32">
                          {bm?.name || `Bookmaker ${bmId}`}
                        </span>
                        <div className="flex space-x-4">
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Home</div>
                            <div className="font-bold text-blue-600">
                              {formatOdds(homeOdd, oddsFormat)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Draw</div>
                            <div className="font-bold text-gray-600">
                              {formatOdds(drawOdd, oddsFormat)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Away</div>
                            <div className="font-bold text-red-600">
                              {formatOdds(awayOdd, oddsFormat)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No odds available for this fixture
          </div>
        )}
      </div>
      )}

      {/* ============================================ */}
      {/* HEAD TO HEAD SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Only show H2H for upcoming fixtures - historical context for betting research */}
      {isUpcoming && (
        <HeadToHeadSection h2h={h2h} h2hLoading={h2hLoading} timezone={timezone} dateFormat={dateFormat} />
      )}

      {/* ============================================ */}
      {/* RECENT FORM SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Only show recent form for upcoming fixtures - shows momentum going into match */}
      {isUpcoming && (
        <RecentFormSection
          homeForm={homeRecentForm}
          awayForm={awayRecentForm}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={formLoading}
        />
      )}

      {/* ============================================ */}
      {/* SIDELINED PLAYERS SECTION */}
      {/* ============================================ */}
      <SidelinedPlayersSection 
        sidelined={fixture.sidelined} 
        homeTeam={homeTeam} 
        awayTeam={awayTeam} 
      />

      {/* ============================================ */}
      {/* SCORING PATTERNS SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Only show for upcoming - helps predict when goals might happen */}
      {isUpcoming && (
        <ScoringPatternsSection
          homeStats={homeTeamStats}
          awayStats={awayTeamStats}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={teamStatsLoading}
        />
      )}

      {/* ============================================ */}
      {/* TOP SCORERS & ASSISTS SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Shows each team's top 5 scorers and assist providers this season */}
      {/* Useful for goalscorer and assist betting markets */}
      {isUpcoming && (
        <TopScorersAssistsSection
          homeTopStats={homeTopStats}
          awayTopStats={awayTopStats}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={topStatsLoading}
        />
      )}

      {/* ============================================ */}
      {/* TEAM STATS COMPARISON SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Only show for upcoming - season stats comparison for betting research */}
      {isUpcoming && (
        <TeamStatsComparisonSection
          homeStats={homeTeamStats}
          awayStats={awayTeamStats}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={teamStatsLoading}
        />
      )}

      {/* ============================================ */}
      {/* CORNERS BREAKDOWN SECTION - UPCOMING ONLY */}
      {/* ============================================ */}
      {/* Shows each team's HOME/AWAY corner averages for corners betting */}
      {isUpcoming && (
        <CornersBreakdownSection
          homeCornerAvg={homeCornerAvg}
          awayCornerAvg={awayCornerAvg}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={cornersLoading}
        />
      )}

      {/* ============================================ */}
      {/* ENHANCED LINEUPS SECTION - HISTORICAL ONLY */}
      {/* ============================================ */}
      {/* Only show for finished/live matches - lineups aren't confirmed until ~1hr before */}
      {!isUpcoming && (
        <EnhancedLineupsSection
          lineups={fixture.lineups}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      )}

      {/* ============================================ */}
      {/* COLLAPSIBLE SECTIONS */}
      {/* ============================================ */}
      <div className="space-y-3">
        {/* Detailed Odds - UPCOMING ONLY */}
        {/* This section uses ALL odds (ignoring main filter) and groups by bookmaker */}
        {isUpcoming && (
        <AccordionSection title="All Betting Markets" icon="📊">
          <AllBettingMarketsContent
            odds={safeOdds}
            bookmakers={bookmakers}
            oddsFormat={oddsFormat}
            formatOddLabel={formatOddLabel}
            getMarketName={getMarketName}
          />
        </AccordionSection>
        )}

        {/* Match Events (if finished or live) */}
        {/* ============================================
            EVENT TYPE DISPLAY
            ============================================
            The backend now enriches events with `typeName` from our
            local SportsMonks types database. This means we don't need
            hardcoded type_id mappings anymore!
            
            Common event types (for reference):
              14 = Goal
              15 = Own Goal  
              16 = Penalty (scored)
              17 = Missed Penalty
              18 = Substitution
              19 = Yellow Card
              20 = Red Card
              21 = Yellow-Red Card (second yellow)
              22 = Penalty Shootout Miss
              23 = Penalty Shootout Goal
            ============================================ */}
        {fixture.events && fixture.events.length > 0 && (
          <AccordionSection title="Match Events" icon="⚽" defaultOpen={isFinished || isLive}>
            <div className="space-y-2">
              {fixture.events
                .sort((a, b) => (a.minute || 0) - (b.minute || 0))
                .map((event, idx) => {
                  // ============================================
                  // GET EVENT ICON BASED ON TYPE
                  // ============================================
                  // Use the enriched typeName from backend, with fallback
                  // to type.name (if API included it) or type_id lookup
                  const eventTypeName = (
                    event.typeName ||           // From backend enrichment (preferred)
                    event.type?.name ||         // From API include (fallback)
                    `Type ${event.type_id}`     // Last resort
                  ).toLowerCase();
                  
                  // Map type name to emoji icon
                  let eventIcon = '📋'; // Default
                  if (eventTypeName.includes('goal') && !eventTypeName.includes('own')) {
                    eventIcon = '⚽';
                  } else if (eventTypeName.includes('own goal')) {
                    eventIcon = '⚽🔴'; // Own goal indicator
                  } else if (eventTypeName.includes('penalty') && !eventTypeName.includes('miss')) {
                    eventIcon = '⚽🎯'; // Penalty scored
                  } else if (eventTypeName.includes('missed penalty') || eventTypeName.includes('penalty miss')) {
                    eventIcon = '❌🎯'; // Missed penalty
                  } else if (eventTypeName.includes('yellow') && eventTypeName.includes('red')) {
                    eventIcon = '🟨🟥'; // Second yellow = red
                  } else if (eventTypeName.includes('yellow')) {
                    eventIcon = '🟨';
                  } else if (eventTypeName.includes('red')) {
                    eventIcon = '🟥';
                  } else if (eventTypeName.includes('substitution') || eventTypeName.includes('sub')) {
                    eventIcon = '🔄';
                  } else if (eventTypeName.includes('var')) {
                    eventIcon = '📺'; // VAR decision
                  }
                  
                  // Format display name (capitalize first letter)
                  const displayName = event.typeName || event.type?.name || 'Event';
                  
                  return (
                    <div key={idx} className="flex items-center space-x-3 text-sm">
                      <span className="w-8 text-gray-500">{event.minute}'</span>
                      <span className="w-8">{eventIcon}</span>
                      <span className="text-gray-600 w-24 text-xs">{displayName}</span>
                      <span className="font-medium">{event.player_name || 'Player'}</span>
                    </div>
                  );
                })}
            </div>
          </AccordionSection>
        )}

        {/* Statistics */}
        {/* ============================================
            MATCH STATISTICS DISPLAY
            ============================================
            The backend now enriches statistics with `typeName` from our
            local SportsMonks types database. This means we get proper
            names like "Corners", "Shots On Target", etc. instead of
            cryptic "Stat 34" fallbacks.
            
            Common statistic types (for reference):
              34 = Corners
              41 = Shots Off Target
              42 = Shots Total
              45 = Ball Possession
              52 = Goals
              56 = Fouls
              86 = Shots On Target
            ============================================ */}
        {fixture.statistics && fixture.statistics.length > 0 && (
          <AccordionSection title="Match Statistics" icon="📈">
            <div className="space-y-3">
              {(() => {
                // Group statistics by type_id
                // Each stat comes as a separate entry per team with location: "home" or "away"
                const statsByType = {};
                
                fixture.statistics.forEach(stat => {
                  const typeId = stat.type_id;
                  if (!typeId) return;
                  
                  if (!statsByType[typeId]) {
                    statsByType[typeId] = {
                      typeId,
                      // Use enriched typeName from backend (preferred),
                      // fall back to API include, then type_id as last resort
                      typeName: stat.typeName || stat.type?.name || `Stat ${typeId}`,
                      home: null,
                      away: null
                    };
                  }
                  
                  // Extract the actual value from data
                  // data could be: { value: 5 }, or just a number, or an object
                  let value = stat.data;
                  if (typeof value === 'object' && value !== null) {
                    // Try common patterns
                    value = value.value ?? value.count ?? value.total ?? value;
                  }
                  
                  // Assign to home or away based on location
                  if (stat.location === 'home') {
                    statsByType[typeId].home = value;
                  } else if (stat.location === 'away') {
                    statsByType[typeId].away = value;
                  }
                });
                
                // Convert to array and filter to stats that have both values
                const groupedStats = Object.values(statsByType)
                  .filter(s => s.home !== null || s.away !== null)
                  .slice(0, 10); // Show top 10
                
                return groupedStats.map((stat, idx) => {
                  // Handle different value types for display
                  const formatValue = (val) => {
                    if (val === null || val === undefined) return '-';
                    if (typeof val === 'object') {
                      return val.value ?? val.count ?? val.total ?? '-';
                    }
                    return val;
                  };
                  
                  const homeVal = formatValue(stat.home);
                  const awayVal = formatValue(stat.away);
                  
                  // Calculate bar widths (handle non-numeric values)
                  const homeNum = typeof homeVal === 'number' ? homeVal : parseFloat(homeVal) || 0;
                  const awayNum = typeof awayVal === 'number' ? awayVal : parseFloat(awayVal) || 0;
                  const total = homeNum + awayNum;
                  const homePercent = total > 0 ? (homeNum / total) * 100 : 50;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{homeVal}</span>
                        <span className="text-gray-600">{stat.typeName}</span>
                        <span>{awayVal}</span>
                      </div>
                      <div className="flex h-2 rounded overflow-hidden">
                        <div 
                          className="bg-blue-500" 
                          style={{ width: `${homePercent}%` }}
                        />
                        <div 
                          className="bg-red-500" 
                          style={{ width: `${100 - homePercent}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </AccordionSection>
        )}
      </div>

      {/* ============================================ */}
      {/* FLOATING NOTE WIDGET */}
      {/* ============================================ */}
      {/* Shows on the right side, minimizes to bottom-right corner */}
      {/* Auto-links to this fixture + both teams */}
      {isAuthenticated && homeTeam && awayTeam && (
        <FloatingNoteWidget
          token={token}
          contextType="fixture"
          contextId={id}
          contextLabel={fixtureName}
          additionalLinks={[
            { contextType: 'team', contextId: homeTeam.id, label: homeTeam.name },
            { contextType: 'team', contextId: awayTeam.id, label: awayTeam.name }
          ]}
          onNoteAdded={() => {
            console.log('Note added successfully');
          }}
        />
      )}
    </div>
  );
};

export default FixtureDetail;
