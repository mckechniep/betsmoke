// ============================================
// SQUAD ROSTER COMPONENT
// ============================================
// Displays a full team roster with player statistics
// in a table/spreadsheet format.
//
// Features:
// - Season/Competition selector (PL, FA Cup, Carabao Cup)
// - Sortable columns
// - Position-based grouping
// - All player statistics from SportsMonks
//
// Statistics displayed:
// - Appearances, Lineups, Minutes Played
// - Goals, Assists, Own Goals
// - Yellow Cards, Red Cards, Yellow-Red Cards
// - Clean Sheets, Goals Conceded (for goalkeepers)
// ============================================

import { useState, useEffect } from 'react';
import { dataApi } from '../api/client';

// ============================================
// POSITION MAPPING
// ============================================
// Maps SportsMonks position_id to readable names
const POSITION_NAMES = {
  24: 'GK',   // Goalkeeper
  25: 'DEF',  // Defender
  26: 'MID',  // Midfielder
  27: 'FWD',  // Forward/Attacker
};

// Position order for sorting (GK first, then DEF, MID, FWD)
const POSITION_ORDER = [24, 25, 26, 27];

// ============================================
// LEAGUE NAME HELPER
// ============================================
const getLeagueName = (leagueId) => {
  switch (leagueId) {
    case 8: return 'Premier League';
    case 24: return 'FA Cup';
    case 27: return 'EFL Cup';
    default: return `League ${leagueId}`;
  }
};

// ============================================
// SQUAD ROSTER COMPONENT
// ============================================
const SquadRoster = ({ teamId }) => {
  // ============================================
  // STATE
  // ============================================
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('appearances');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // View mode: 'all' shows all stats, 'compact' shows essential stats
  const [viewMode, setViewMode] = useState('compact');

  // ============================================
  // FETCH AVAILABLE SEASONS
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Sort by year descending, then by league (Premier League first)
        const sorted = teamSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          if (bYear !== aYear) return bYear - aYear;
          
          // Premier League (8) first, then FA Cup (24), then EFL Cup (27)
          const aLeagueId = a.league_id || a.league?.id || 999;
          const bLeagueId = b.league_id || b.league?.id || 999;
          return aLeagueId - bLeagueId;
        });
        
        setSeasons(sorted);
        
        // Auto-select the current Premier League season
        if (sorted.length > 0) {
          const currentPL = sorted.find(s => s.is_current && (s.league_id === 8 || s.league?.id === 8));
          const anyCurrent = sorted.find(s => s.is_current);
          const firstPL = sorted.find(s => s.league_id === 8 || s.league?.id === 8);
          const selected = currentPL || anyCurrent || firstPL || sorted[0];
          setSelectedSeasonId(selected.id);
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
        setError('Failed to load seasons');
      }
    };

    fetchSeasons();
  }, [teamId]);

  // ============================================
  // FETCH SQUAD DATA WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchSquad = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamFullSquad(teamId, selectedSeasonId);
        setPlayers(data.players || []);
      } catch (err) {
        console.error('Failed to fetch squad:', err);
        setError('Failed to load squad data');
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSquad();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // SORTING LOGIC
  // ============================================
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Sort players based on current sort settings
  const sortedPlayers = [...players].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    
    // Handle name sorting (alphabetical)
    if (sortColumn === 'name') {
      aVal = aVal?.toLowerCase() || '';
      bVal = bVal?.toLowerCase() || '';
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    // Handle position sorting (by position order)
    if (sortColumn === 'positionId') {
      const aOrder = POSITION_ORDER.indexOf(aVal) >= 0 ? POSITION_ORDER.indexOf(aVal) : 999;
      const bOrder = POSITION_ORDER.indexOf(bVal) >= 0 ? POSITION_ORDER.indexOf(bVal) : 999;
      return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
    }
    
    // Numeric sorting
    aVal = aVal || 0;
    bVal = bVal || 0;
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // ============================================
  // TABLE COLUMN DEFINITIONS
  // ============================================
  // Compact view columns (most essential for betting research)
  const compactColumns = [
    { key: 'name', label: 'Player', sortable: true, sticky: true },
    { key: 'positionId', label: 'Pos', sortable: true },
    { key: 'jerseyNumber', label: '#', sortable: true },
    { key: 'appearances', label: 'App', sortable: true, title: 'Appearances' },
    { key: 'minutesPlayed', label: 'Min', sortable: true, title: 'Minutes Played' },
    { key: 'goals', label: 'G', sortable: true, title: 'Goals' },
    { key: 'assists', label: 'A', sortable: true, title: 'Assists' },
    { key: 'yellowCards', label: 'YC', sortable: true, title: 'Yellow Cards' },
    { key: 'redCards', label: 'RC', sortable: true, title: 'Red Cards' },
  ];
  
  // Full view columns (all available stats)
  const fullColumns = [
    { key: 'name', label: 'Player', sortable: true, sticky: true },
    { key: 'positionId', label: 'Pos', sortable: true },
    { key: 'jerseyNumber', label: '#', sortable: true },
    { key: 'appearances', label: 'App', sortable: true, title: 'Appearances' },
    { key: 'lineups', label: 'Starts', sortable: true, title: 'Starting Lineups' },
    { key: 'minutesPlayed', label: 'Min', sortable: true, title: 'Minutes Played' },
    { key: 'goals', label: 'G', sortable: true, title: 'Goals' },
    { key: 'assists', label: 'A', sortable: true, title: 'Assists' },
    { key: 'ownGoals', label: 'OG', sortable: true, title: 'Own Goals' },
    { key: 'yellowCards', label: 'YC', sortable: true, title: 'Yellow Cards' },
    { key: 'yellowRedCards', label: 'Y2R', sortable: true, title: 'Yellow-Red Cards (2nd Yellow)' },
    { key: 'redCards', label: 'RC', sortable: true, title: 'Red Cards' },
    { key: 'cleanSheets', label: 'CS', sortable: true, title: 'Clean Sheets (GK)' },
    { key: 'goalsConceded', label: 'GC', sortable: true, title: 'Goals Conceded (GK)' },
    { key: 'teamWins', label: 'W', sortable: true, title: 'Team Wins (while playing)' },
    { key: 'teamDraws', label: 'D', sortable: true, title: 'Team Draws (while playing)' },
    { key: 'teamLosses', label: 'L', sortable: true, title: 'Team Losses (while playing)' },
  ];

  const columns = viewMode === 'compact' ? compactColumns : fullColumns;

  // ============================================
  // RENDER SORT INDICATOR
  // ============================================
  const SortIndicator = ({ column }) => {
    if (sortColumn !== column) return null;
    return (
      <span className="ml-1 text-blue-600">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // ============================================
  // RENDER CELL VALUE
  // ============================================
  const renderCellValue = (player, column) => {
    const value = player[column.key];
    
    // Special rendering for player name (with image)
    if (column.key === 'name') {
      return (
        <div className="flex items-center space-x-2">
          {player.image ? (
            <img 
              src={player.image} 
              alt={player.name}
              className="w-8 h-8 rounded-full object-cover bg-gray-100"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
              ?
            </div>
          )}
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      );
    }
    
    // Position ID to readable name
    if (column.key === 'positionId') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          value === 24 ? 'bg-yellow-100 text-yellow-800' :  // GK
          value === 25 ? 'bg-blue-100 text-blue-800' :      // DEF
          value === 26 ? 'bg-green-100 text-green-800' :    // MID
          value === 27 ? 'bg-red-100 text-red-800' :        // FWD
          'bg-gray-100 text-gray-800'
        }`}>
          {POSITION_NAMES[value] || '?'}
        </span>
      );
    }
    
    // Highlight goals and assists
    if (column.key === 'goals' && value > 0) {
      return <span className="font-semibold text-green-600">{value}</span>;
    }
    if (column.key === 'assists' && value > 0) {
      return <span className="font-semibold text-blue-600">{value}</span>;
    }
    
    // Highlight cards
    if (column.key === 'yellowCards' && value > 0) {
      return <span className="text-yellow-600">{value}</span>;
    }
    if (column.key === 'redCards' && value > 0) {
      return <span className="font-semibold text-red-600">{value}</span>;
    }
    if (column.key === 'yellowRedCards' && value > 0) {
      return <span className="text-orange-600">{value}</span>;
    }
    
    // Clean sheets (highlight for GKs)
    if (column.key === 'cleanSheets' && value > 0 && player.positionId === 24) {
      return <span className="font-semibold text-green-600">{value}</span>;
    }
    
    // Default: show value or dash for 0
    return value || '-';
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-900">
          👥 Squad Roster
        </h2>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">View:</span>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1 text-sm rounded-l-md border ${
                viewMode === 'compact' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-3 py-1 text-sm rounded-r-md border-t border-r border-b ${
                viewMode === 'full' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Full Stats
            </button>
          </div>
          
          {/* Season Selector Dropdown */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Season:</label>
            <select
              value={selectedSeasonId || ''}
              onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
              disabled={seasons.length === 0}
            >
              {seasons.length === 0 ? (
                <option value="">Loading...</option>
              ) : (
                seasons.map((season) => {
                  const leagueId = season.league_id || season.league?.id;
                  const leagueName = season.league?.name || getLeagueName(leagueId);
                  
                  return (
                    <option key={season.id} value={season.id}>
                      {season.name} - {leagueName} {season.is_current ? '✓' : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-pulse">Loading squad data...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Squad Table */}
      {!loading && !error && players.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Table Header */}
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    title={column.title || column.label}
                    className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                    } ${column.sticky ? 'sticky left-0 bg-gray-50 z-10' : ''}`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center">
                      {column.label}
                      {column.sortable && <SortIndicator column={column.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            {/* Table Body */}
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPlayers.map((player, index) => (
                <tr 
                  key={player.playerId || index}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-3 whitespace-nowrap text-sm ${
                        column.sticky ? 'sticky left-0 bg-white z-10' : ''
                      }`}
                    >
                      {renderCellValue(player, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No Players State */}
      {!loading && !error && players.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No squad data available for this season
        </div>
      )}

      {/* Footer Stats */}
      {!loading && !error && players.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>
            <strong>{players.length}</strong> players
          </span>
          <span>
            <strong>{players.filter(p => p.positionId === 24).length}</strong> GKs
          </span>
          <span>
            <strong>{players.filter(p => p.positionId === 25).length}</strong> Defenders
          </span>
          <span>
            <strong>{players.filter(p => p.positionId === 26).length}</strong> Midfielders
          </span>
          <span>
            <strong>{players.filter(p => p.positionId === 27).length}</strong> Forwards
          </span>
          <span className="ml-auto text-xs text-gray-400">
            Click column headers to sort
          </span>
        </div>
      )}
    </div>
  );
};

export default SquadRoster;
