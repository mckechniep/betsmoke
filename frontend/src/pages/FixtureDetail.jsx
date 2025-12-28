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

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dataApi, notesApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MatchPredictions from '../components/MatchPredictions';

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
// HELPER: Format American Odds for Display
// ============================================
// The API provides american odds directly, but we need to
// add the + sign for positive values
function formatAmericanOdds(americanOdd) {
  if (americanOdd === null || americanOdd === undefined) return '-';

  // Convert to string first to handle both number and string inputs
  const oddStr = String(americanOdd);
  const num = parseInt(oddStr);
  if (isNaN(num)) return oddStr;

  // Add + sign for positive odds (API may or may not include it)
  if (num > 0 && !oddStr.startsWith('+')) {
    return `+${num}`;
  }

  return oddStr;
}

// ============================================
// HELPER: Convert Celsius to Fahrenheit
// ============================================
// SportsMonks provides temperature in Celsius by default
function celsiusToFahrenheit(celsius) {
  if (celsius === null || celsius === undefined) return null;
  return Math.round((celsius * 9/5) + 32);
}

// ============================================
// HELPER: Get weather icon
// ============================================
function getWeatherIcon(description) {
  if (!description) return '🌤️';
  
  const desc = description.toLowerCase();
  
  if (desc.includes('clear') || desc.includes('sun')) return '☀️';
  if (desc.includes('cloud')) return '☁️';
  if (desc.includes('rain') || desc.includes('drizzle')) return '🌧️';
  if (desc.includes('thunder')) return '⛈️';
  if (desc.includes('snow')) return '❄️';
  if (desc.includes('mist') || desc.includes('fog') || desc.includes('haze')) return '🌫️';
  
  return '🌤️';
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
// HELPER: Format date for display (Eastern Time)
// ============================================
function formatDate(dateString) {
  const date = parseUTCDateTime(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
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
// HELPER: Format short date for H2H display (Eastern Time)
// ============================================
function formatShortDate(dateString) {
  const date = parseUTCDateTime(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
}

// ============================================
// HELPER: Get score from fixture
// ============================================
function getScore(fixture, location) {
  const score = fixture.scores?.find(
    s => s.description === 'CURRENT' && s.score?.participant === location
  );
  return score?.score?.goals ?? null;
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
function HeadToHeadSection({ h2h, h2hLoading }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY = 5; // Show 5 matches initially
  
  // Safety check - ensure h2h is an array
  const safeH2h = Array.isArray(h2h) ? h2h : [];
  
  // Determine which matches to display
  const displayedMatches = showAll ? safeH2h : safeH2h.slice(0, INITIAL_DISPLAY);
  const hasMore = safeH2h.length > INITIAL_DISPLAY;
  const remainingCount = safeH2h.length - INITIAL_DISPLAY;

  // Helper to get score from a match
  const getMatchScore = (match, location) => {
    return match.scores?.find(
      s => s.description === 'CURRENT' && s.score?.participant === location
    )?.score?.goals;
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
                    {formatShortDate(match.starting_at)}
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

      {/* Betting Insight */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
        💡 <strong>Betting Insight:</strong> Look for patterns like "slow starters" or "late surges". 
        Teams that score late (76-90') are good targets for live betting.
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

      {/* Betting Insight */}
      <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
        💡 <strong>Goalscorer Markets:</strong> Check anytime goalscorer odds for these players.
        Assist markets often offer better value than goal markets.
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

      {/* Form badges */}
      <div className="flex space-x-1 mb-3">
        {form && form.length > 0 ? (
          form.slice(0, 5).map((match, idx) => (
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
// Uses HOME/AWAY splits for contextually relevant data:
// - Home team: shows their corners when playing AT HOME
// - Away team: shows their corners when playing AWAY
// Type ID: 34 = CORNERS (from SportsMonks team statistics)
function CornersBreakdownSection({ homeStats, awayStats, homeTeam, awayTeam, loading }) {
  // ============================================
  // HELPER: Extract full corners object from team statistics
  // ============================================
  // SportsMonks returns corners with home/away breakdown:
  // { all: {count, percentage}, home: {count, percentage}, away: {count, percentage} }
  const extractCornersData = (stats) => {
    if (!stats?.statistics) return null;
    
    for (const statGroup of stats.statistics) {
      if (!statGroup.details) continue;
      
      for (const detail of statGroup.details) {
        // Type ID 34 = CORNERS
        if (detail.type_id === 34) {
          const value = detail.value;
          
          // Return the full object if it has home/away breakdown
          if (value && typeof value === 'object') {
            return {
              all: value.all?.count ?? value.count ?? null,
              home: value.home?.count ?? null,
              away: value.away?.count ?? null
            };
          }
          
          // Simple number value (no breakdown)
          if (typeof value === 'number') {
            return { all: value, home: null, away: null };
          }
          
          return null;
        }
      }
    }
    return null;
  };

  // ============================================
  // HELPER: Extract games played with home/away split
  // ============================================
  // Type IDs: 214=wins, 215=draws, 216=losses
  // Each has {all, home, away} breakdown
  const getGamesBreakdown = (stats) => {
    if (!stats?.statistics) return { all: 0, home: 0, away: 0 };
    
    let wins = { all: 0, home: 0, away: 0 };
    let draws = { all: 0, home: 0, away: 0 };
    let losses = { all: 0, home: 0, away: 0 };
    
    for (const statGroup of stats.statistics) {
      if (!statGroup.details) continue;
      
      for (const detail of statGroup.details) {
        const value = detail.value;
        if (!value || typeof value !== 'object') continue;
        
        const extractCount = (obj) => ({
          all: obj?.all?.count ?? obj?.count ?? 0,
          home: obj?.home?.count ?? 0,
          away: obj?.away?.count ?? 0
        });
        
        if (detail.type_id === 214) wins = extractCount(value);      // Wins
        if (detail.type_id === 215) draws = extractCount(value);     // Draws
        if (detail.type_id === 216) losses = extractCount(value);    // Losses
      }
    }
    
    return {
      all: wins.all + draws.all + losses.all,
      home: wins.home + draws.home + losses.home,
      away: wins.away + draws.away + losses.away
    };
  };

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

  // ============================================
  // EXTRACT CORNERS DATA (type_id = 34)
  // ============================================
  const homeTeamCorners = extractCornersData(homeStats);
  const awayTeamCorners = extractCornersData(awayStats);
  const homeTeamGames = getGamesBreakdown(homeStats);
  const awayTeamGames = getGamesBreakdown(awayStats);

  // Don't render if no corners data available
  if (!homeTeamCorners && !awayTeamCorners) {
    return null;
  }

  // ============================================
  // CALCULATE CONTEXTUAL AVERAGES
  // ============================================
  // Home team: their corners when playing AT HOME
  // Away team: their corners when playing AWAY
  const homeTeamHomeCorners = homeTeamCorners?.home ?? null;
  const homeTeamHomeGames = homeTeamGames.home;
  const homeTeamHomeAvg = homeTeamHomeGames > 0 && homeTeamHomeCorners !== null
    ? (homeTeamHomeCorners / homeTeamHomeGames).toFixed(1)
    : null;

  const awayTeamAwayCorners = awayTeamCorners?.away ?? null;
  const awayTeamAwayGames = awayTeamGames.away;
  const awayTeamAwayAvg = awayTeamAwayGames > 0 && awayTeamAwayCorners !== null
    ? (awayTeamAwayCorners / awayTeamAwayGames).toFixed(1)
    : null;

  // Combined expected corners for this fixture
  const combinedExpected = homeTeamHomeAvg && awayTeamAwayAvg
    ? (parseFloat(homeTeamHomeAvg) + parseFloat(awayTeamAwayAvg)).toFixed(1)
    : null;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        🚩 Corner Kicks Breakdown
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Contextual stats: Home team at home, Away team on the road
      </p>

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
                {homeTeamHomeCorners !== null ? homeTeamHomeCorners : '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Corners at Home</div>
            </div>
            
            {/* Average Per Home Game */}
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {homeTeamHomeAvg ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Per Home Game</div>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 mt-2 text-center">
            ({homeTeamHomeGames} home games)
          </div>
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
                {awayTeamAwayCorners !== null ? awayTeamAwayCorners : '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Corners Away</div>
            </div>
            
            {/* Average Per Away Game */}
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-red-600">
                {awayTeamAwayAvg ?? '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Per Away Game</div>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 mt-2 text-center">
            ({awayTeamAwayGames} away games)
          </div>
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
          <div className="text-xs text-gray-500 text-center mt-2">
            Based on {homeTeam?.name}'s home avg ({homeTeamHomeAvg}) + {awayTeam?.name}'s away avg ({awayTeamAwayAvg})
          </div>
        </div>
      )}

      {/* Betting Insight Box */}
      <div className="mt-4 p-3 bg-orange-50 rounded-lg text-sm text-orange-800">
        <strong>💡 Corners Insight:</strong>
        {combinedExpected ? (
          <span>
            {' '}Expected <strong>{combinedExpected}</strong> total corners. 
            {parseFloat(combinedExpected) >= 11 
              ? 'High corner activity expected - consider over 10.5.' 
              : parseFloat(combinedExpected) >= 9 
                ? 'Moderate activity - 9-10 range common for this matchup.' 
                : 'Lower corner activity - under markets may have value.'}
          </span>
        ) : (
          <span> Home/away splits not available - check overall averages.</span>
        )}
      </div>
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
      better: 'higher'
    },
    {
      label: 'Goals Conceded',
      home: extractStat(homeStats, 88),
      away: extractStat(awayStats, 88),
      icon: '🥅',
      better: 'lower'
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
                {homeGames > 0 && typeof homeValue === 'number' && (
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
                {awayGames > 0 && typeof awayValue === 'number' && (
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

      {/* Betting Insight */}
      <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
        💡 <strong>Quick Analysis:</strong> Compare Clean Sheets vs BTTS for over/under decisions. 
        High "Failed to Score" = potential under bet.
      </div>
    </div>
  );
}



// ============================================
// ADD NOTE MODAL COMPONENT
// ============================================
function AddNoteModal({ isOpen, onClose, fixtureId, fixtureName, token, onNoteAdded }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(`Note: ${fixtureName}`);
      setContent('');
      setError('');
    }
  }, [isOpen, fixtureName]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Please enter some content for your note');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await notesApi.create({
        title: title.trim() || `Note: ${fixtureName}`,
        content: content.trim(),
        contextType: 'fixture',
        contextId: fixtureId.toString()
      }, token);

      onNoteAdded?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    // Semi-transparent backdrop that doesn't block interaction with page
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Modal positioned to the side so user can still see data */}
      <div className="absolute right-4 top-20 w-96 pointer-events-auto">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-blue-600 rounded-t-lg">
            <h3 className="font-semibold text-white">Add Note</h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Note title..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Your research notes..."
                autoFocus
              />
            </div>

            <div className="text-xs text-gray-500">
              📎 Linked to: {fixtureName}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN FIXTURE DETAIL COMPONENT
// ============================================
const FixtureDetail = () => {
  const { id } = useParams();
  const { token, isAuthenticated } = useAuth();

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

  // Note modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);

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
                  {formatTime(fixture.starting_at)}
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

          {/* Date, venue, and weather */}
          <div className="mt-4 text-center text-sm text-gray-500 space-y-1">
            <div>📅 {formatDate(fixture.starting_at)}</div>
            {fixture.venue?.name && (
              <div>📍 {fixture.venue.name}{fixture.venue.city ? `, ${fixture.venue.city}` : ''}</div>
            )}
            {fixture.weatherReport && (
              <div className="flex items-center justify-center space-x-2">
                <span>{getWeatherIcon(fixture.weatherReport.description)}</span>
                <span>
                  {fixture.weatherReport.temperature?.temp 
                    ? `${celsiusToFahrenheit(fixture.weatherReport.temperature.temp)}°F`
                    : fixture.weatherReport.description
                  }
                </span>
                {fixture.weatherReport.wind?.speed && (
                  <span className="text-gray-400">
                    💨 {Math.round(fixture.weatherReport.wind.speed * 2.237)} mph
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add Note button */}
        {isAuthenticated && (
          <div className="px-6 pb-4">
            <button
              onClick={() => setNoteModalOpen(true)}
              className="w-full py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center space-x-2"
            >
              <span>📝</span>
              <span>Add Note</span>
            </button>
          </div>
        )}
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
                              {formatAmericanOdds(homeOdd?.american)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Draw</div>
                            <div className="font-bold text-gray-600">
                              {formatAmericanOdds(drawOdd?.american)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Away</div>
                            <div className="font-bold text-red-600">
                              {formatAmericanOdds(awayOdd?.american)}
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
        <HeadToHeadSection h2h={h2h} h2hLoading={h2hLoading} />
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
      {/* Shows each team's season corner stats for corners betting */}
      {isUpcoming && (
        <CornersBreakdownSection
          homeStats={homeTeamStats}
          awayStats={awayTeamStats}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          loading={teamStatsLoading}
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
        {isUpcoming && (
        <AccordionSection title="All Betting Markets" icon="📊">
          {Object.keys(oddsByMarket).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(oddsByMarket).map(([marketId, marketOdds]) => {
                // Get unique values for this market
                const uniqueLabels = [...new Set(marketOdds.map(o => o.label || o.name))];
                
                return (
                  <div key={marketId} className="border-b border-gray-100 pb-3 last:border-0">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Market {marketId}
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {uniqueLabels.slice(0, 6).map(label => {
                        const odd = marketOdds.find(o => (o.label || o.name) === label);
                        return (
                          <div key={label} className="bg-gray-50 p-2 rounded text-center">
                            <div className="text-xs text-gray-500 truncate">{label}</div>
                            <div className="font-bold">{formatAmericanOdds(odd?.american)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              No additional markets available
            </div>
          )}
        </AccordionSection>
        )}

        {/* Match Events (if finished or live) */}
        {fixture.events && fixture.events.length > 0 && (
          <AccordionSection title="Match Events" icon="⚽" defaultOpen={isFinished || isLive}>
            <div className="space-y-2">
              {fixture.events
                .sort((a, b) => (a.minute || 0) - (b.minute || 0))
                .map((event, idx) => (
                  <div key={idx} className="flex items-center space-x-3 text-sm">
                    <span className="w-8 text-gray-500">{event.minute}'</span>
                    <span>
                      {event.type?.name || event.type_id === 14 ? '⚽ Goal' : 
                       event.type_id === 18 ? '🟨 Yellow' : 
                       event.type_id === 19 ? '🟥 Red' :
                       event.type_id === 20 ? '🔄 Sub' : '📋'}
                    </span>
                    <span>{event.player_name || 'Player'}</span>
                  </div>
                ))}
            </div>
          </AccordionSection>
        )}

        {/* Statistics */}
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
                      typeName: stat.type?.name || `Stat ${typeId}`,
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
      {/* ADD NOTE MODAL */}
      {/* ============================================ */}
      <AddNoteModal
        isOpen={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        fixtureId={id}
        fixtureName={fixtureName}
        token={token}
        onNoteAdded={() => {
          // Could show a toast or refresh notes
          console.log('Note added successfully');
        }}
      />
    </div>
  );
};

export default FixtureDetail;
