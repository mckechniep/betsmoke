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
import AppIcon from './AppIcon';

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
  // Mobile: #, Team, P, W-D-L (combined), GF-GA (combined), GD, Pts, Form
  // Desktop: All individual columns
  const renderTableHeaders = () => {
    return (
      <tr>
        <th className="px-1 md:px-4 py-2 md:py-3 text-left w-7 md:w-12">#</th>
        <th className="px-1 md:px-4 py-2 md:py-3 text-left">Team</th>
        <th className="px-1 md:px-4 py-2 md:py-3 text-center w-6 md:w-12">P</th>
        {/* Mobile: Combined W-D-L column */}
        <th className="md:hidden px-1 py-2 text-center text-[10px] w-14">W-D-L</th>
        {/* Desktop: Separate W, D, L columns */}
        <th className="hidden md:table-cell px-4 py-3 text-center w-12">W</th>
        <th className="hidden md:table-cell px-4 py-3 text-center w-12">D</th>
        <th className="hidden md:table-cell px-4 py-3 text-center w-12">L</th>
        {/* Mobile: Combined GF-GA column */}
        <th className="md:hidden px-1 py-2 text-center text-[10px] w-12">GF-GA</th>
        {/* Desktop: Separate GF, GA columns */}
        <th className="hidden md:table-cell px-4 py-3 text-center w-12">GF</th>
        <th className="hidden md:table-cell px-4 py-3 text-center w-12">GA</th>
        <th className="px-1 md:px-4 py-2 md:py-3 text-center w-7 md:w-12">GD</th>
        <th className="px-1 md:px-4 py-2 md:py-3 text-center w-8 md:w-14">Pts</th>
        {tableView === 'overall' && (
          <th className="px-1 md:px-4 py-2 md:py-3 text-center">Form</th>
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

    // Build row className - use box-shadow for consistent mobile border rendering
    const rowClasses = [
      'hover:bg-gray-700',
      isChampionsLeague ? 'border-l-4 border-l-blue-500' : '',
      isRelegation ? 'border-l-4 border-l-red-500' : ''
    ].filter(Boolean).join(' ');

    // Get values for combined mobile columns
    const won = getStatValue(row.details, wonId);
    const drawn = getStatValue(row.details, drawnId);
    const lost = getStatValue(row.details, lostId);
    const goalsFor = getStatValue(row.details, gfId);
    const goalsAgainst = getStatValue(row.details, gaId);

    return (
      <tr
        key={row.participant_id}
        className={rowClasses}
        style={{ boxShadow: 'inset 0 -1px 0 0 #374151' }}
      >
        {/* Position */}
        <td className="px-1 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-gray-100">
          {displayPosition}
        </td>

        {/* Team Name + Logo */}
        <td className="px-1 md:px-4 py-2 md:py-3">
          <Link
            to={`/teams/${row.participant_id}`}
            className="flex items-center space-x-1 md:space-x-3 text-gray-100 hover:text-amber-400"
          >
            {row.participant?.image_path && (
              <img
                src={row.participant.image_path}
                alt={row.participant.name}
                className="w-4 h-4 md:w-6 md:h-6 object-contain flex-shrink-0"
              />
            )}
            <span className="font-medium text-[11px] md:text-sm truncate max-w-[70px] md:max-w-none">
              {row.participant?.name}
            </span>
          </Link>
        </td>

        {/* Played */}
        <td className="px-1 md:px-4 py-2 md:py-3 text-center text-[11px] md:text-sm text-gray-300">
          {getStatValue(row.details, playedId)}
        </td>

        {/* Mobile: Combined W-D-L */}
        <td className="md:hidden px-1 py-2 text-center text-[11px] text-gray-300">
          {won}-{drawn}-{lost}
        </td>

        {/* Desktop: Won */}
        <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-gray-300">
          {won}
        </td>

        {/* Desktop: Drawn */}
        <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-gray-300">
          {drawn}
        </td>

        {/* Desktop: Lost */}
        <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-gray-300">
          {lost}
        </td>

        {/* Mobile: Combined GF-GA */}
        <td className="md:hidden px-1 py-2 text-center text-[11px] text-gray-300">
          {goalsFor}-{goalsAgainst}
        </td>

        {/* Desktop: Goals For */}
        <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-gray-300">
          {goalsFor}
        </td>

        {/* Desktop: Goals Against */}
        <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-gray-300">
          {goalsAgainst}
        </td>

        {/* Goal Difference */}
        <td className="px-1 md:px-4 py-2 md:py-3 text-center text-[11px] md:text-sm text-gray-300">
          {gd}
        </td>

        {/* Points */}
        <td className="px-1 md:px-4 py-2 md:py-3 text-center text-[11px] md:text-sm font-bold text-gray-100">
          {pointsValue}
        </td>

        {/* Form (Only for Overall view) */}
        {tableView === 'overall' && (
          <td className="px-1 md:px-4 py-2 md:py-3 text-center">
            <div className="flex justify-center space-x-0.5 md:space-x-1">
              {row.form && row.form.length > 0 ? (
                [...row.form]
                  .sort((a, b) => b.sort_order - a.sort_order)
                  .slice(0, 5)
                  .reverse()
                  .map((match, idx) => (
                    <span
                      key={idx}
                      className={`
                        w-4 h-4 md:w-6 md:h-6 flex items-center justify-center rounded text-[10px] md:text-xs font-bold text-white
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
                <span className="text-gray-400 text-xs md:text-sm">-</span>
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
    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header with Season Selector */}
      {/* Mobile: Stack vertically, Desktop: Side by side */}
      <div className="px-4 py-4 bg-gradient-to-r from-purple-700 to-purple-900
                      flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-3">
          {/* League Logo - Larger on mobile for visibility */}
          <div className="w-14 h-14 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center p-1.5 md:p-1 flex-shrink-0">
            {leagueLogo ? (
              <img
                src={leagueLogo}
                alt={leagueName}
                className="w-11 h-11 md:w-8 md:h-8 object-contain"
              />
            ) : (
              <span className="text-purple-700 font-bold text-base md:text-sm">
                {leagueName.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">{leagueName}</h2>
            <p className="text-purple-200 text-xs md:text-sm">
              {getSelectedSeasonName() || 'Loading...'}
            </p>
          </div>
        </div>

        {/* Season Dropdown - Compact on mobile */}
        {seasonsLoading ? (
          <div className="text-purple-200 text-sm">Loading seasons...</div>
        ) : (
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="px-2 py-1.5 md:px-3 md:py-2 text-sm md:text-base
                       bg-white/10 text-white border border-white/30 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-white/50
                       cursor-pointer w-full md:w-auto"
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
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setTableView('overall')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2
            ${tableView === 'overall'
              ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
        >
          <AppIcon name="overall" size="md" className={tableView === 'overall' ? 'text-purple-400' : 'text-gray-400'} />
          Overall
        </button>
        <button
          onClick={() => setTableView('home')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2
            ${tableView === 'home'
              ? 'text-green-400 border-b-2 border-green-400 bg-green-900/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
        >
          <AppIcon name="home" size="md" className={tableView === 'home' ? 'text-green-400' : 'text-gray-400'} />
          Home
        </button>
        <button
          onClick={() => setTableView('away')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2
            ${tableView === 'away'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
        >
          <AppIcon name="away" size="md" className={tableView === 'away' ? 'text-blue-400' : 'text-gray-400'} />
          Away
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 border-b border-gray-700">
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
        <div className="text-center py-12 text-gray-400">
          Loading standings...
        </div>
      ) : sortedStandings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No standings available for this season.
        </div>
      ) : (
        /* Standings Table */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700 text-sm text-gray-400">
              {renderTableHeaders()}
            </thead>
            <tbody>
              {sortedStandings.map((row, index) => renderTableRow(row, index))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Legend (Only for Overall view with zones enabled) */}
      {showZones && tableView === 'overall' && sortedStandings.length > 0 && (
        <div className="px-4 py-3 bg-gray-700 border-t border-gray-600 text-xs text-gray-400 flex space-x-6">
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
        <div className="px-4 py-3 bg-gray-700 border-t border-gray-600 text-xs text-gray-400 flex items-start gap-2">
          <AppIcon name="stats" size="md" className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p>
            <strong>Betting Insight:</strong> {tableView === 'home'
              ? 'Home table shows how teams perform at their own stadium. Great for identifying home-field advantage.'
              : 'Away table reveals which teams travel well. Useful for predicting away wins and draws.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LeagueStandings;
