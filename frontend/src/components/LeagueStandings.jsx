// ============================================
// LEAGUE STANDINGS COMPONENT
// ============================================
// Reusable standings table component that displays:
// - Season selector dropdown
// - Overall / Home / Away table views
// - Team form badges (W/D/L)
// - Champions League & Relegation zone indicators
//
// Props:
// - leagueId (number): The league to show (default: 8 = Premier League)
// - leagueName (string): Display name (default: "Premier League")
// - leagueLogo (string): URL to the league logo image (optional)
// - showZones (boolean): Show CL/Relegation zone indicators (default: true)
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dataApi } from '../api/client';

// ============================================
// STANDINGS TYPE IDS (from SportsMonks)
// ============================================
const TYPE_IDS = {
  // Overall
  OVERALL_PLAYED: 129,
  OVERALL_WON: 130,
  OVERALL_DRAWN: 131,
  OVERALL_LOST: 132,
  OVERALL_GOALS_FOR: 133,
  OVERALL_GOALS_AGAINST: 134,
  OVERALL_GOAL_DIFF: 179,
  OVERALL_POINTS: 187,     // Total points (also available as row.points)
  // Home
  HOME_PLAYED: 135,
  HOME_WON: 136,
  HOME_DRAWN: 137,
  HOME_LOST: 138,
  HOME_GOALS_FOR: 139,
  HOME_GOALS_AGAINST: 140,
  HOME_POINTS: 185,        // Fixed: was 176 (which is STREAK)
  // Away
  AWAY_PLAYED: 141,
  AWAY_WON: 142,
  AWAY_DRAWN: 143,
  AWAY_LOST: 144,
  AWAY_GOALS_FOR: 145,
  AWAY_GOALS_AGAINST: 146,
  AWAY_POINTS: 186,        // Fixed: was 185 (which is HOME_POINTS)
};

// ============================================
// LEAGUE STANDINGS COMPONENT
// ============================================
const LeagueStandings = ({ 
  leagueId = 8,           // Default: Premier League
  leagueName = 'Premier League',
  leagueLogo = null,      // URL to league logo image
  showZones = true        // Show CL/Relegation indicators
}) => {
  // State for seasons dropdown
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [seasonsLoading, setSeasonsLoading] = useState(true);

  // State for standings table
  const [standings, setStandings] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [error, setError] = useState('');

  // State for table view (overall, home, away)
  const [tableView, setTableView] = useState('overall');

  // ============================================
  // FETCH LEAGUE SEASONS ON MOUNT
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      setSeasonsLoading(true);
      try {
        const data = await dataApi.getSeasonsByLeague(leagueId);
        
        // Sort seasons by name (most recent first)
        const sortedSeasons = (data.seasons || []).sort((a, b) => {
          return b.name?.localeCompare(a.name);
        });

        setSeasons(sortedSeasons);

        // Auto-select the current season, or the most recent one
        const currentSeason = sortedSeasons.find(s => s.is_current);
        if (currentSeason) {
          setSelectedSeasonId(currentSeason.id.toString());
        } else if (sortedSeasons.length > 0) {
          setSelectedSeasonId(sortedSeasons[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
        setError(`Failed to load ${leagueName} seasons`);
      } finally {
        setSeasonsLoading(false);
      }
    };

    fetchSeasons();
  }, [leagueId, leagueName]);

  // ============================================
  // FETCH STANDINGS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStandings = async () => {
      setStandingsLoading(true);
      setError('');

      try {
        const data = await dataApi.getStandings(selectedSeasonId);
        setStandings(data.standings || []);
      } catch (err) {
        console.error('Failed to fetch standings:', err);
        setError('Failed to load standings');
        setStandings([]);
      } finally {
        setStandingsLoading(false);
      }
    };

    fetchStandings();
  }, [selectedSeasonId]);

  // ============================================
  // HELPER: Get stat value from details array
  // ============================================
  const getStatValue = (details, typeId) => {
    if (!details) return '-';
    const stat = details.find(d => d.type_id === typeId);
    return stat?.value ?? '-';
  };

  // ============================================
  // HELPER: Calculate goal difference for home/away
  // ============================================
  const calculateGD = (details, gfTypeId, gaTypeId) => {
    const gf = getStatValue(details, gfTypeId);
    const ga = getStatValue(details, gaTypeId);
    if (gf === '-' || ga === '-') return '-';
    return gf - ga;
  };

  // ============================================
  // HELPER: Get selected season name for display
  // ============================================
  const getSelectedSeasonName = () => {
    const season = seasons.find(s => s.id.toString() === selectedSeasonId);
    return season ? season.name : '';
  };

  // ============================================
  // SORT STANDINGS BASED ON VIEW
  // ============================================
  const getSortedStandings = () => {
    if (tableView === 'overall') {
      // Already sorted by position from API
      return standings;
    }

    // For home/away, sort by points then goal difference
    const pointsTypeId = tableView === 'home' ? TYPE_IDS.HOME_POINTS : TYPE_IDS.AWAY_POINTS;
    const gfTypeId = tableView === 'home' ? TYPE_IDS.HOME_GOALS_FOR : TYPE_IDS.AWAY_GOALS_FOR;
    const gaTypeId = tableView === 'home' ? TYPE_IDS.HOME_GOALS_AGAINST : TYPE_IDS.AWAY_GOALS_AGAINST;

    return [...standings].sort((a, b) => {
      const aPoints = getStatValue(a.details, pointsTypeId);
      const bPoints = getStatValue(b.details, pointsTypeId);
      
      // Sort by points descending
      if (aPoints !== bPoints) {
        return (bPoints === '-' ? -999 : bPoints) - (aPoints === '-' ? -999 : aPoints);
      }
      
      // If points are equal, sort by goal difference
      const aGD = calculateGD(a.details, gfTypeId, gaTypeId);
      const bGD = calculateGD(b.details, gfTypeId, gaTypeId);
      return (bGD === '-' ? -999 : bGD) - (aGD === '-' ? -999 : aGD);
    });
  };

  // ============================================
  // RENDER TABLE HEADERS
  // ============================================
  const renderTableHeaders = () => {
    return (
      <tr>
        <th className="px-4 py-3 text-left w-12">#</th>
        <th className="px-4 py-3 text-left">Team</th>
        <th className="px-4 py-3 text-center w-12">P</th>
        <th className="px-4 py-3 text-center w-12">W</th>
        <th className="px-4 py-3 text-center w-12">D</th>
        <th className="px-4 py-3 text-center w-12">L</th>
        <th className="px-4 py-3 text-center w-12">GF</th>
        <th className="px-4 py-3 text-center w-12">GA</th>
        <th className="px-4 py-3 text-center w-12">GD</th>
        <th className="px-4 py-3 text-center w-14">Pts</th>
        {tableView === 'overall' && (
          <th className="px-4 py-3 text-center">Form</th>
        )}
      </tr>
    );
  };

  // ============================================
  // RENDER TABLE ROW
  // ============================================
  const renderTableRow = (row, index) => {
    // Determine which type IDs to use based on view
    let playedId, wonId, drawnId, lostId, gfId, gaId, gdId, pointsValue;

    if (tableView === 'overall') {
      playedId = TYPE_IDS.OVERALL_PLAYED;
      wonId = TYPE_IDS.OVERALL_WON;
      drawnId = TYPE_IDS.OVERALL_DRAWN;
      lostId = TYPE_IDS.OVERALL_LOST;
      gfId = TYPE_IDS.OVERALL_GOALS_FOR;
      gaId = TYPE_IDS.OVERALL_GOALS_AGAINST;
      gdId = TYPE_IDS.OVERALL_GOAL_DIFF;
      pointsValue = row.points; // Overall points come from main object
    } else if (tableView === 'home') {
      playedId = TYPE_IDS.HOME_PLAYED;
      wonId = TYPE_IDS.HOME_WON;
      drawnId = TYPE_IDS.HOME_DRAWN;
      lostId = TYPE_IDS.HOME_LOST;
      gfId = TYPE_IDS.HOME_GOALS_FOR;
      gaId = TYPE_IDS.HOME_GOALS_AGAINST;
      gdId = null; // Calculate manually
      pointsValue = getStatValue(row.details, TYPE_IDS.HOME_POINTS);
    } else {
      playedId = TYPE_IDS.AWAY_PLAYED;
      wonId = TYPE_IDS.AWAY_WON;
      drawnId = TYPE_IDS.AWAY_DRAWN;
      lostId = TYPE_IDS.AWAY_LOST;
      gfId = TYPE_IDS.AWAY_GOALS_FOR;
      gaId = TYPE_IDS.AWAY_GOALS_AGAINST;
      gdId = null; // Calculate manually
      pointsValue = getStatValue(row.details, TYPE_IDS.AWAY_POINTS);
    }

    // Calculate GD for home/away (not stored in API)
    const gd = gdId 
      ? getStatValue(row.details, gdId) 
      : calculateGD(row.details, gfId, gaId);

    // For home/away tables, use index+1 as position (since we re-sorted)
    const displayPosition = tableView === 'overall' ? row.position : index + 1;

    // Zone styling (only for overall view with showZones enabled)
    const isChampionsLeague = showZones && tableView === 'overall' && index < 4;
    const isRelegation = showZones && tableView === 'overall' && index >= 17;

    return (
      <tr 
        key={row.participant_id} 
        className={`
          hover:bg-gray-50 
          ${isChampionsLeague ? 'border-l-4 border-l-blue-500' : ''} 
          ${isRelegation ? 'border-l-4 border-l-red-500' : ''}
        `}
      >
        {/* Position */}
        <td className="px-4 py-3 text-sm font-medium text-gray-900">
          {displayPosition}
        </td>

        {/* Team Name + Logo */}
        <td className="px-4 py-3">
          <Link 
            to={`/teams/${row.participant_id}`}
            className="flex items-center space-x-3 hover:text-blue-600"
          >
            {row.participant?.image_path && (
              <img
                src={row.participant.image_path}
                alt={row.participant.name}
                className="w-6 h-6 object-contain"
              />
            )}
            <span className="font-medium text-sm">
              {row.participant?.name}
            </span>
          </Link>
        </td>

        {/* Played */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {getStatValue(row.details, playedId)}
        </td>

        {/* Won */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {getStatValue(row.details, wonId)}
        </td>

        {/* Drawn */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {getStatValue(row.details, drawnId)}
        </td>

        {/* Lost */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {getStatValue(row.details, lostId)}
        </td>

        {/* Goals For */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {getStatValue(row.details, gfId)}
        </td>

        {/* Goals Against */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {getStatValue(row.details, gaId)}
        </td>

        {/* Goal Difference */}
        <td className="px-4 py-3 text-center text-sm text-gray-600">
          {gd}
        </td>

        {/* Points */}
        <td className="px-4 py-3 text-center text-sm font-bold text-gray-900">
          {pointsValue}
        </td>

        {/* Form (Only for Overall view) */}
        {tableView === 'overall' && (
          <td className="px-4 py-3 text-center">
            <div className="flex justify-center space-x-1">
              {row.form && row.form.length > 0 ? (
                [...row.form]
                  .sort((a, b) => b.sort_order - a.sort_order)
                  .slice(0, 5)
                  .reverse()
                  .map((match, idx) => (
                    <span
                      key={idx}
                      className={`
                        w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-white
                        ${match.form === 'W' ? 'bg-green-500' : ''}
                        ${match.form === 'D' ? 'bg-gray-400' : ''}
                        ${match.form === 'L' ? 'bg-red-500' : ''}
                      `}
                      title={match.form === 'W' ? 'Win' : match.form === 'D' ? 'Draw' : 'Loss'}
                    >
                      {match.form}
                    </span>
                  ))
              ) : (
                <span className="text-gray-400 text-sm">-</span>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  // Get sorted standings based on current view
  const sortedStandings = getSortedStandings();

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header with Season Selector */}
      <div className="px-4 py-4 bg-gradient-to-r from-purple-700 to-purple-900 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* League Logo */}
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1">
            {leagueLogo ? (
              <img 
                src={leagueLogo} 
                alt={leagueName}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <span className="text-purple-700 font-bold text-sm">
                {leagueName.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{leagueName}</h2>
            <p className="text-purple-200 text-sm">
              {getSelectedSeasonName() || 'Loading...'}
            </p>
          </div>
        </div>

        {/* Season Dropdown */}
        {seasonsLoading ? (
          <div className="text-purple-200 text-sm">Loading seasons...</div>
        ) : (
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
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

      {/* ============================================ */}
      {/* TABLE VIEW TABS (Overall / Home / Away) */}
      {/* ============================================ */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTableView('overall')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${tableView === 'overall' 
              ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          📊 Overall
        </button>
        <button
          onClick={() => setTableView('home')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${tableView === 'home' 
              ? 'text-green-700 border-b-2 border-green-700 bg-green-50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          🏠 Home
        </button>
        <button
          onClick={() => setTableView('away')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${tableView === 'away' 
              ? 'text-blue-700 border-b-2 border-blue-700 bg-blue-50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          ✈️ Away
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 border-b">
          {error}
        </div>
      )}

      {/* Loading State */}
      {/* 
        Show loading when:
        - Seasons are still loading (can't fetch standings without a season)
        - OR standings are actively being fetched
      */}
      {seasonsLoading || standingsLoading ? (
        <div className="text-center py-12 text-gray-500">
          Loading standings...
        </div>
      ) : sortedStandings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No standings available for this season.
        </div>
      ) : (
        /* Standings Table */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-sm text-gray-500">
              {renderTableHeaders()}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedStandings.map((row, index) => renderTableRow(row, index))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Legend (Only for Overall view with zones enabled) */}
      {showZones && tableView === 'overall' && sortedStandings.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500 flex space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
            <span>Champions League</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
            <span>Relegation</span>
          </div>
        </div>
      )}

      {/* Betting Insight for Home/Away */}
      {tableView !== 'overall' && sortedStandings.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
          <p>
            📊 <strong>Betting Insight:</strong> {tableView === 'home' 
              ? 'Home table shows how teams perform at their own stadium. Great for identifying home-field advantage.' 
              : 'Away table reveals which teams travel well. Useful for predicting away wins and draws.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LeagueStandings;
