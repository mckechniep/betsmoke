// ============================================
// TEAM DETAIL PAGE
// ============================================
// Shows team information including:
// - Basic team info (name, logo, venue)
// - Coach/Manager information
// - Home/Away Performance breakdown (all competitions)
// - Win/Draw/Loss Distribution bars (Premier League only)
// - Half & Timing Analysis (goals by half, comebacks, injury time)
// - Over/Under Goals Analysis (for betting research)
// - Scoring Pattern by minute range
// - Corners Statistics (all competitions)
// - Squad list
// ============================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dataApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import SquadRoster from '../components/SquadRoster';
import FloatingNoteWidget from '../components/FloatingNoteWidget';
import AppIcon from '../components/AppIcon';

// ============================================
// TYPE IDS FROM SPORTSMONKS
// ============================================
// Team Statistics Type IDs
const STAT_TYPE_IDS = {
  // Results (value contains: all, home, away with count & percentage)
  WIN: 214,
  DRAW: 215,
  LOST: 216,
  // Goals
  GOALS: 52,           // value: { all, home, away with count, average, percentage }
  GOALS_CONCEDED: 88,  // value: { all, home, away with count, average }
  // Other useful stats
  GAMES_PLAYED: 27263, // value: { total, home, away }
  CLEANSHEET: 194,     // value: { all, home, away with count & percentage }
  BTTS: 192,           // Both Teams To Score
  FAILED_TO_SCORE: 575,
  // Scoring minutes
  SCORING_MINUTES: 196,
  CONCEDED_SCORING_MINUTES: 213,
  
  // Half & Timing Analysis
  MOST_SCORED_HALF: 27250,    // value: { most_scored_half, details: { "1st-half": { total }, "2nd-half": { total } } }
  HALF_RESULTS: 27256,        // value: { won_both_halves, scored_both_halves, comebacks }
  INJURY_TIME_GOALS: 27260,   // value: { total, average }
  
  // Over/Under Goals
  OVER_GOALS: 191,            // value: { over_0_5, over_1_5, etc. with matches & team }
  
  // Set Pieces
  CORNERS: 34,                // value: { count, average }
  // Note: PENALTIES (47) is NOT available at team level - only fixture/player level
};

// ============================================
// MINUTE RANGE LABELS (in order)
// ============================================
const MINUTE_RANGES = [
  { key: '0-15', label: '0-15 min' },
  { key: '15-30', label: '15-30 min' },
  { key: '30-45', label: '30-45 min' },
  { key: '45-60', label: '45-60 min' },
  { key: '60-75', label: '60-75 min' },
  { key: '75-90', label: '75-90 min' }
];

// ============================================
// HOME/AWAY PERFORMANCE COMPONENT
// ============================================
// Displays a breakdown of home vs away performance
// with season selection dropdown

function HomeAwayPerformanceSection({ teamId }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [selectedSeasonLeagueId, setSelectedSeasonLeagueId] = useState(null); // Track league for PL-only features
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================
  // FETCH AVAILABLE SEASONS
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Sort by year descending, then by league ID (Premier League first)
        const sorted = teamSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          if (bYear !== aYear) return bYear - aYear;
          
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
          setSelectedSeasonLeagueId(selected.league_id || selected.league?.id);
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
        setError('Failed to load seasons');
      }
    };

    fetchSeasons();
  }, [teamId]);

  // ============================================
  // FETCH STATS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamStatsBySeason(teamId, selectedSeasonId);
        setStats(data.team);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics for this season');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // HELPER: Get stat by type_id
  // ============================================
  const getStat = (typeId) => {
    if (!stats?.statistics?.[0]?.details) return null;
    return stats.statistics[0].details.find(d => d.type_id === typeId);
  };

  // ============================================
  // EXTRACT HOME/AWAY DATA
  // ============================================
  const getPerformanceData = () => {
    const wins = getStat(STAT_TYPE_IDS.WIN)?.value;
    const draws = getStat(STAT_TYPE_IDS.DRAW)?.value;
    const losses = getStat(STAT_TYPE_IDS.LOST)?.value;
    const goals = getStat(STAT_TYPE_IDS.GOALS)?.value;
    const conceded = getStat(STAT_TYPE_IDS.GOALS_CONCEDED)?.value;
    const gamesPlayed = getStat(STAT_TYPE_IDS.GAMES_PLAYED)?.value;
    const cleansheets = getStat(STAT_TYPE_IDS.CLEANSHEET)?.value;
    const failedToScore = getStat(STAT_TYPE_IDS.FAILED_TO_SCORE)?.value;

    // Calculate points (W*3 + D*1)
    const calculatePoints = (w, d) => (w * 3) + d;

    // Home stats
    const homeData = {
      played: gamesPlayed?.home ?? '-',
      won: wins?.home?.count ?? '-',
      drawn: draws?.home?.count ?? '-',
      lost: losses?.home?.count ?? '-',
      goalsFor: goals?.home?.count ?? '-',
      goalsAgainst: conceded?.home?.count ?? '-',
      cleansheets: cleansheets?.home?.count ?? '-',
      failedToScore: failedToScore?.home?.count ?? '-',
      points: (wins?.home?.count !== undefined && draws?.home?.count !== undefined)
        ? calculatePoints(wins.home.count, draws.home.count)
        : '-',
      // Percentages for bar graph (calculate from counts)
      winPct: 0,
      drawPct: 0,
      lossPct: 0
    };
    homeData.goalDiff = (homeData.goalsFor !== '-' && homeData.goalsAgainst !== '-')
      ? homeData.goalsFor - homeData.goalsAgainst
      : '-';
    // Calculate percentages for home
    if (homeData.played !== '-' && homeData.played > 0) {
      homeData.winPct = Math.round((homeData.won / homeData.played) * 100);
      homeData.drawPct = Math.round((homeData.drawn / homeData.played) * 100);
      homeData.lossPct = Math.round((homeData.lost / homeData.played) * 100);
    }

    // Away stats
    const awayData = {
      played: gamesPlayed?.away ?? '-',
      won: wins?.away?.count ?? '-',
      drawn: draws?.away?.count ?? '-',
      lost: losses?.away?.count ?? '-',
      goalsFor: goals?.away?.count ?? '-',
      goalsAgainst: conceded?.away?.count ?? '-',
      cleansheets: cleansheets?.away?.count ?? '-',
      failedToScore: failedToScore?.away?.count ?? '-',
      points: (wins?.away?.count !== undefined && draws?.away?.count !== undefined)
        ? calculatePoints(wins.away.count, draws.away.count)
        : '-',
      // Percentages for bar graph
      winPct: 0,
      drawPct: 0,
      lossPct: 0
    };
    awayData.goalDiff = (awayData.goalsFor !== '-' && awayData.goalsAgainst !== '-')
      ? awayData.goalsFor - awayData.goalsAgainst
      : '-';
    // Calculate percentages for away
    if (awayData.played !== '-' && awayData.played > 0) {
      awayData.winPct = Math.round((awayData.won / awayData.played) * 100);
      awayData.drawPct = Math.round((awayData.drawn / awayData.played) * 100);
      awayData.lossPct = Math.round((awayData.lost / awayData.played) * 100);
    }

    // Overall stats for comparison
    const overallData = {
      played: gamesPlayed?.total ?? '-',
      won: wins?.all?.count ?? '-',
      drawn: draws?.all?.count ?? '-',
      lost: losses?.all?.count ?? '-',
      goalsFor: goals?.all?.count ?? '-',
      goalsAgainst: conceded?.all?.count ?? '-',
      cleansheets: cleansheets?.all?.count ?? '-',
    };

    return { homeData, awayData, overallData };
  };

  const { homeData, awayData, overallData } = getPerformanceData();

  // ============================================
  // RENDER STAT ROW
  // ============================================
  const StatRow = ({ label, home, away, highlight = false }) => (
    <div className={`flex items-center py-2 ${highlight ? 'bg-gray-700 font-semibold' : ''}`}>
      <div className="w-1/3 text-center text-green-400">{home}</div>
      <div className="w-1/3 text-center text-gray-400 text-sm">{label}</div>
      <div className="w-1/3 text-center text-blue-400">{away}</div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
          <AppIcon name="home" size="lg" className="text-gray-400" />
          <span>Home vs Away Performance</span>
        </h2>
        
        {/* Season Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => {
              const newSeasonId = parseInt(e.target.value);
              setSelectedSeasonId(newSeasonId);
              // Update league ID when season changes
              const selectedSeason = seasons.find(s => s.id === newSeasonId);
              setSelectedSeasonLeagueId(selectedSeason?.league_id || selectedSeason?.league?.id);
            }}
            className="border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              seasons.map((season) => {
                const leagueName = season.league?.name || 
                  (season.league_id === 8 ? 'Premier League' : 
                   season.league_id === 24 ? 'FA Cup' : 
                   season.league_id === 27 ? 'EFL Cup' : 
                   `League ${season.league_id}`);
                
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && (
        <div>
          {/* Column Headers */}
          <div className="flex items-center py-3 border-b-2 border-gray-700 mb-2">
            <div className="w-1/3 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm font-semibold">
                <AppIcon name="home" size="sm" className="text-green-400" /> Home
              </span>
            </div>
            <div className="w-1/3 text-center text-gray-400 text-sm font-medium">
              Statistic
            </div>
            <div className="w-1/3 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-sm font-semibold">
                <AppIcon name="away" size="sm" className="text-blue-400" /> Away
              </span>
            </div>
          </div>

          {/* Stats Rows */}
          <div className="divide-y divide-gray-700">
            <StatRow label="Matches Played" home={homeData.played} away={awayData.played} />
            <StatRow label="Wins" home={homeData.won} away={awayData.won} />
            <StatRow label="Draws" home={homeData.drawn} away={awayData.drawn} />
            <StatRow label="Losses" home={homeData.lost} away={awayData.lost} />
            <StatRow label="Goals Scored" home={homeData.goalsFor} away={awayData.goalsFor} />
            <StatRow label="Goals Conceded" home={homeData.goalsAgainst} away={awayData.goalsAgainst} />
            <StatRow label="Goal Difference" home={homeData.goalDiff > 0 ? `+${homeData.goalDiff}` : homeData.goalDiff} away={awayData.goalDiff > 0 ? `+${awayData.goalDiff}` : awayData.goalDiff} />
            <StatRow label="Clean Sheets" home={homeData.cleansheets} away={awayData.cleansheets} />
            <StatRow label="Failed to Score" home={homeData.failedToScore} away={awayData.failedToScore} />
            {/* Only show Points for league competitions (not cups) */}
            {/* Premier League = 8, FA Cup = 24, Carabao Cup = 27 */}
            {selectedSeasonLeagueId === 8 && (
              <StatRow label="Points" home={homeData.points} away={awayData.points} highlight={true} />
            )}
          </div>

          {/* Points Per Game - Only for league competitions (Premier League) */}
          {selectedSeasonLeagueId === 8 && homeData.played !== '-' && awayData.played !== '-' && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center">
                <div className="w-1/3 text-center text-green-400 font-medium">
                  {homeData.points !== '-' && homeData.played > 0
                    ? (homeData.points / homeData.played).toFixed(2)
                    : '-'}
                </div>
                <div className="w-1/3 text-center text-gray-400 text-sm">
                  Points Per Game
                </div>
                <div className="w-1/3 text-center text-blue-400 font-medium">
                  {awayData.points !== '-' && awayData.played > 0
                    ? (awayData.points / awayData.played).toFixed(2)
                    : '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// WIN/DRAW/LOSS DISTRIBUTION COMPONENT
// ============================================
// Displays horizontal stacked bar graphs showing W/D/L percentages
// for home and away matches - PREMIER LEAGUE ONLY

function WinDrawLossDistributionSection({ teamId }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [selectedSeasonLeagueId, setSelectedSeasonLeagueId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================
  // FETCH AVAILABLE SEASONS (Premier League only)
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Filter to Premier League seasons only (league_id: 8)
        const plSeasons = teamSeasons.filter(s => 
          s.league_id === 8 || s.league?.id === 8
        );
        
        // Sort by year descending
        const sorted = plSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          return bYear - aYear;
        });
        
        setSeasons(sorted);
        
        // Auto-select the current Premier League season
        if (sorted.length > 0) {
          const currentPL = sorted.find(s => s.is_current);
          const selected = currentPL || sorted[0];
          setSelectedSeasonId(selected.id);
          setSelectedSeasonLeagueId(selected.league_id || selected.league?.id);
        }
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
        setError('Failed to load seasons');
      }
    };

    fetchSeasons();
  }, [teamId]);

  // ============================================
  // FETCH STATS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamStatsBySeason(teamId, selectedSeasonId);
        setStats(data.team);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // HELPER: Get stat by type_id
  // ============================================
  const getStat = (typeId) => {
    if (!stats?.statistics?.[0]?.details) return null;
    return stats.statistics[0].details.find(d => d.type_id === typeId);
  };

  // ============================================
  // EXTRACT W/D/L DATA
  // ============================================
  const getWDLData = () => {
    const wins = getStat(STAT_TYPE_IDS.WIN)?.value;
    const draws = getStat(STAT_TYPE_IDS.DRAW)?.value;
    const losses = getStat(STAT_TYPE_IDS.LOST)?.value;
    const gamesPlayed = getStat(STAT_TYPE_IDS.GAMES_PLAYED)?.value;

    // Home stats
    const homeData = {
      played: gamesPlayed?.home ?? 0,
      won: wins?.home?.count ?? 0,
      drawn: draws?.home?.count ?? 0,
      lost: losses?.home?.count ?? 0,
      winPct: 0,
      drawPct: 0,
      lossPct: 0
    };
    if (homeData.played > 0) {
      homeData.winPct = Math.round((homeData.won / homeData.played) * 100);
      homeData.drawPct = Math.round((homeData.drawn / homeData.played) * 100);
      homeData.lossPct = Math.round((homeData.lost / homeData.played) * 100);
    }

    // Away stats
    const awayData = {
      played: gamesPlayed?.away ?? 0,
      won: wins?.away?.count ?? 0,
      drawn: draws?.away?.count ?? 0,
      lost: losses?.away?.count ?? 0,
      winPct: 0,
      drawPct: 0,
      lossPct: 0
    };
    if (awayData.played > 0) {
      awayData.winPct = Math.round((awayData.won / awayData.played) * 100);
      awayData.drawPct = Math.round((awayData.drawn / awayData.played) * 100);
      awayData.lossPct = Math.round((awayData.lost / awayData.played) * 100);
    }

    return { homeData, awayData };
  };

  // If no Premier League seasons found, don't render anything
  if (seasons.length === 0 && !loading) {
    return null;
  }

  const { homeData, awayData } = getWDLData();

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">
          Win / Draw / Loss Distribution
        </h2>
        
        {/* Season Selector - Premier League seasons only */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => {
              const newSeasonId = parseInt(e.target.value);
              setSelectedSeasonId(newSeasonId);
              const selectedSeason = seasons.find(s => s.id === newSeasonId);
              setSelectedSeasonLeagueId(selectedSeason?.league_id || selectedSeason?.league?.id);
            }}
            className="border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} - Premier League {season.is_current ? '✓' : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* W/D/L Bar Graphs */}
      {!loading && !error && homeData.played > 0 && (
        <div>
          {/* Home W/D/L Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                <AppIcon name="home" size="sm" className="text-green-400" /> Home
              </span>
              <span className="text-xs text-gray-400">{homeData.played} games</span>
            </div>
            <div className="h-8 rounded-full overflow-hidden flex bg-gray-700">
              {/* Win segment */}
              {homeData.winPct > 0 && (
                <div 
                  className="h-full bg-green-500 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${homeData.winPct}%` }}
                >
                  {homeData.winPct >= 12 && (
                    <span className="text-xs font-bold text-white">W {homeData.winPct}%</span>
                  )}
                </div>
              )}
              {/* Draw segment */}
              {homeData.drawPct > 0 && (
                <div 
                  className="h-full bg-gray-400 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${homeData.drawPct}%` }}
                >
                  {homeData.drawPct >= 12 && (
                    <span className="text-xs font-bold text-white">D {homeData.drawPct}%</span>
                  )}
                </div>
              )}
              {/* Loss segment */}
              {homeData.lossPct > 0 && (
                <div 
                  className="h-full bg-red-500 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${homeData.lossPct}%` }}
                >
                  {homeData.lossPct >= 12 && (
                    <span className="text-xs font-bold text-white">L {homeData.lossPct}%</span>
                  )}
                </div>
              )}
            </div>
            {/* Home W-D-L counts */}
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{homeData.won}W - {homeData.drawn}D - {homeData.lost}L</span>
            </div>
          </div>

          {/* Away W/D/L Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                <AppIcon name="away" size="sm" className="text-blue-400" /> Away
              </span>
              <span className="text-xs text-gray-400">{awayData.played} games</span>
            </div>
            <div className="h-8 rounded-full overflow-hidden flex bg-gray-700">
              {/* Win segment */}
              {awayData.winPct > 0 && (
                <div 
                  className="h-full bg-green-500 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${awayData.winPct}%` }}
                >
                  {awayData.winPct >= 12 && (
                    <span className="text-xs font-bold text-white">W {awayData.winPct}%</span>
                  )}
                </div>
              )}
              {/* Draw segment */}
              {awayData.drawPct > 0 && (
                <div 
                  className="h-full bg-gray-400 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${awayData.drawPct}%` }}
                >
                  {awayData.drawPct >= 12 && (
                    <span className="text-xs font-bold text-white">D {awayData.drawPct}%</span>
                  )}
                </div>
              )}
              {/* Loss segment */}
              {awayData.lossPct > 0 && (
                <div 
                  className="h-full bg-red-500 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${awayData.lossPct}%` }}
                >
                  {awayData.lossPct >= 12 && (
                    <span className="text-xs font-bold text-white">L {awayData.lossPct}%</span>
                  )}
                </div>
              )}
            </div>
            {/* Away W-D-L counts */}
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{awayData.won}W - {awayData.drawn}D - {awayData.lost}L</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-sm text-gray-400">Win</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400"></div>
              <span className="text-sm text-gray-400">Draw</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm text-gray-400">Loss</span>
            </div>
          </div>
        </div>
      )}

      {/* No data state */}
      {!loading && !error && homeData.played === 0 && (
        <div className="text-center py-8 text-gray-400">
          No match data available for this season yet
        </div>
      )}
    </div>
  );
}

// ============================================
// HALF & TIMING ANALYSIS COMPONENT
// ============================================
// Displays half-related statistics including:
// - Most Scored Half (1st vs 2nd half goals)
// - Won Both Halves / Scored Both Halves / Comebacks
// - Injury Time Goals (scored vs conceded)
// All competitions, with season selector

function HalfTimingAnalysisSection({ teamId }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================
  // FETCH AVAILABLE SEASONS (All competitions)
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Sort by year descending, then by league ID (Premier League first)
        const sorted = teamSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          if (bYear !== aYear) return bYear - aYear;
          
          const aLeagueId = a.league_id || a.league?.id || 999;
          const bLeagueId = b.league_id || b.league?.id || 999;
          return aLeagueId - bLeagueId;
        });
        
        setSeasons(sorted);
        
        // Auto-select the current Premier League season first, else any current
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
  // FETCH STATS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamStatsBySeason(teamId, selectedSeasonId);
        setStats(data.team);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // HELPER: Get stat by type_id
  // ============================================
  const getStat = (typeId) => {
    if (!stats?.statistics?.[0]?.details) return null;
    return stats.statistics[0].details.find(d => d.type_id === typeId);
  };

  // ============================================
  // EXTRACT HALF & TIMING DATA
  // ============================================
  const getHalfTimingData = () => {
    // Get the raw stat objects
    const mostScoredHalfStat = getStat(STAT_TYPE_IDS.MOST_SCORED_HALF);
    const halfResultsStat = getStat(STAT_TYPE_IDS.HALF_RESULTS);
    const injuryTimeGoalsStat = getStat(STAT_TYPE_IDS.INJURY_TIME_GOALS);

    // ============================================
    // MOST SCORED HALF (Type ID 27250)
    // ============================================
    // API Structure:
    // value: {
    //   most_scored_half: "2nd-half",
    //   most_scored_half_goals: 27,
    //   details: {
    //     "1st-half": { period: "1st-half", total: 22 },
    //     "2nd-half": { period: "2nd-half", total: 27 }
    //   }
    // }
    const mostScoredHalfValue = mostScoredHalfStat?.value;
    const halfDetails = mostScoredHalfValue?.details;
    
    // Extract goal counts from the details object
    // Note: API uses "1st-half" (hyphen) not "1st_half" (underscore)
    const firstHalfGoals = halfDetails?.['1st-half']?.total ?? 0;
    const secondHalfGoals = halfDetails?.['2nd-half']?.total ?? 0;
    
    // Calculate percentages (API doesn't provide them)
    const totalHalfGoals = firstHalfGoals + secondHalfGoals;
    const firstHalfPct = totalHalfGoals > 0 
      ? Math.round((firstHalfGoals / totalHalfGoals) * 100) 
      : 0;
    const secondHalfPct = totalHalfGoals > 0 
      ? Math.round((secondHalfGoals / totalHalfGoals) * 100) 
      : 0;

    // ============================================
    // HALF RESULTS (Type ID 27256)
    // ============================================
    // Expected structure may vary - check actual API response
    const halfResults = halfResultsStat?.value;
    
    // ============================================
    // INJURY TIME GOALS (Type ID 27260)
    // ============================================
    // API Structure:
    // value: { total: 6, average: 0.35 }
    // Note: API only provides total, not scored vs conceded breakdown
    const injuryTimeGoals = injuryTimeGoalsStat?.value;

    return {
      // Most Scored Half - now correctly parsed
      firstHalfGoals,
      firstHalfPct,
      secondHalfGoals,
      secondHalfPct,
      
      // Half Results
      wonBothHalves: halfResults?.won_both_halves ?? 0,
      scoredBothHalves: halfResults?.scored_both_halves ?? 0,
      comebacks: halfResults?.comebacks ?? 0,
      
      // Injury Time Goals - API only provides total, not scored/conceded split
      injuryTimeTotal: injuryTimeGoals?.total ?? 0,
      injuryTimeAverage: injuryTimeGoals?.average ?? 0,
    };
  };

  const halfData = getHalfTimingData();
  
  // Calculate which half is stronger
  const totalHalfGoals = halfData.firstHalfGoals + halfData.secondHalfGoals;
  const strongerHalf = halfData.firstHalfGoals > halfData.secondHalfGoals ? '1st' : 
                       halfData.secondHalfGoals > halfData.firstHalfGoals ? '2nd' : 'Equal';

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">
          Half & Timing Analysis
        </h2>
        
        {/* Season Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              seasons.map((season) => {
                const leagueName = season.league?.name || 
                  (season.league_id === 8 ? 'Premier League' : 
                   season.league_id === 24 ? 'FA Cup' : 
                   season.league_id === 27 ? 'EFL Cup' : 
                   `League ${season.league_id}`);
                
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && (
        <div className="space-y-6">
          
          {/* Most Scored Half - Visual Bar */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Goals by Half
            </h3>
            
            {totalHalfGoals > 0 ? (
              <div>
                {/* Stacked Bar */}
                <div className="h-10 rounded-full overflow-hidden flex bg-gray-700 mb-2">
                  {/* 1st Half */}
                  {halfData.firstHalfPct > 0 && (
                    <div 
                      className="h-full bg-amber-500 flex items-center justify-center transition-all duration-300"
                      style={{ width: `${halfData.firstHalfPct}%` }}
                    >
                      {halfData.firstHalfPct >= 15 && (
                        <span className="text-xs font-bold text-white">
                          1H: {halfData.firstHalfGoals} ({Math.round(halfData.firstHalfPct)}%)
                        </span>
                      )}
                    </div>
                  )}
                  {/* 2nd Half */}
                  {halfData.secondHalfPct > 0 && (
                    <div 
                      className="h-full bg-purple-500 flex items-center justify-center transition-all duration-300"
                      style={{ width: `${halfData.secondHalfPct}%` }}
                    >
                      {halfData.secondHalfPct >= 15 && (
                        <span className="text-xs font-bold text-white">
                          2H: {halfData.secondHalfGoals} ({Math.round(halfData.secondHalfPct)}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-amber-500"></span>
                    1st Half: {halfData.firstHalfGoals} goals
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-purple-500"></span>
                    2nd Half: {halfData.secondHalfGoals} goals
                  </span>
                </div>
                
                {/* Stronger Half Indicator */}
                <div className="mt-2 text-center">
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    strongerHalf === '1st' ? 'bg-amber-900/30 text-amber-400' :
                    strongerHalf === '2nd' ? 'bg-purple-900/30 text-purple-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {strongerHalf === 'Equal' ? 'Even across both halves' :
                     `Stronger in ${strongerHalf} Half`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm bg-gray-700 rounded">
                No half goal data available
              </div>
            )}
          </div>

          {/* Half Results Grid */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Match Dominance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Won Both Halves */}
              <div className="bg-green-900/30 rounded-lg p-4 border border-green-700 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {halfData.wonBothHalves}
                </div>
                <div className="text-xs text-green-400 font-medium mt-1">
                  Won Both Halves
                </div>
              </div>

              {/* Scored Both Halves */}
              <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {halfData.scoredBothHalves}
                </div>
                <div className="text-xs text-blue-400 font-medium mt-1">
                  Scored Both Halves
                </div>
              </div>

              {/* Comebacks */}
              <div className="bg-orange-900/30 rounded-lg p-4 border border-orange-700 text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {halfData.comebacks}
                </div>
                <div className="text-xs text-orange-400 font-medium mt-1">
                  Comebacks
                </div>
              </div>
            </div>
          </div>

          {/* Injury Time Goals */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <AppIcon name="timer" size="md" className="text-gray-400" />
              <span>Injury Time Goals</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Total Injury Time Goals */}
              <div className="bg-amber-900/30 rounded-lg p-4 border border-amber-700 text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {halfData.injuryTimeTotal}
                </div>
                <div className="text-xs text-amber-400 font-medium mt-1">
                  Total Goals
                </div>
              </div>

              {/* Average Per Game */}
              <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 text-center">
                <div className="text-2xl font-bold text-gray-300">
                  {halfData.injuryTimeAverage.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 font-medium mt-1">
                  Per Game
                </div>
              </div>
            </div>
          </div>

          {/* Betting Insight */}
          <div className="pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              <strong>Betting Insight:</strong> 
              {strongerHalf !== 'Equal' && ` This team scores more in the ${strongerHalf} half.`}
              {halfData.comebacks > 0 && ` They've come from behind to win ${halfData.comebacks} time${halfData.comebacks !== 1 ? 's' : ''}.`}
              {halfData.injuryTimeTotal > 0 && ` They've scored ${halfData.injuryTimeTotal} injury time goal${halfData.injuryTimeTotal !== 1 ? 's' : ''} (${halfData.injuryTimeAverage.toFixed(2)}/game).`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// OVER/UNDER GOALS ANALYSIS COMPONENT
// ============================================
// Displays Over/Under goals statistics for betting research
// Shows both match totals and team-only goals
// All competitions, with season selector

function OverUnderGoalsSection({ teamId }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================
  // FETCH AVAILABLE SEASONS (All competitions)
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Sort by year descending, then by league ID (Premier League first)
        const sorted = teamSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          if (bYear !== aYear) return bYear - aYear;
          
          const aLeagueId = a.league_id || a.league?.id || 999;
          const bLeagueId = b.league_id || b.league?.id || 999;
          return aLeagueId - bLeagueId;
        });
        
        setSeasons(sorted);
        
        // Auto-select the current Premier League season first, else any current
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
  // FETCH STATS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamStatsBySeason(teamId, selectedSeasonId);
        setStats(data.team);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // HELPER: Get stat by type_id
  // ============================================
  const getStat = (typeId) => {
    if (!stats?.statistics?.[0]?.details) return null;
    return stats.statistics[0].details.find(d => d.type_id === typeId);
  };

  // ============================================
  // EXTRACT OVER/UNDER DATA
  // ============================================
  const getOverUnderData = () => {
    // Type ID 191 = Over Goals
    // Structure: { over_0_5: { matches: { count, percentage }, team: { count, percentage } }, ... }
    const overGoals = getStat(STAT_TYPE_IDS.OVER_GOALS)?.value;
    
    if (!overGoals) return null;

    // Extract data for each threshold
    const thresholds = ['over_0_5', 'over_1_5', 'over_2_5', 'over_3_5', 'over_4_5', 'over_5_5'];
    const labels = ['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'];
    
    return thresholds.map((key, index) => {
      const data = overGoals[key];
      return {
        label: labels[index],
        // Match totals (both teams combined)
        matchCount: data?.matches?.count ?? 0,
        matchPct: data?.matches?.percentage ?? 0,
        // Team only goals
        teamCount: data?.team?.count ?? 0,
        teamPct: data?.team?.percentage ?? 0,
      };
    });
  };

  const overUnderData = getOverUnderData();
  const hasData = overUnderData && overUnderData.some(d => d.matchCount > 0 || d.teamCount > 0);

  // ============================================
  // RENDER BAR
  // ============================================
  const renderBar = (percentage, color) => (
    <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">
          Over/Under Goals Analysis
        </h2>
        
        {/* Season Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              seasons.map((season) => {
                const leagueName = season.league?.name || 
                  (season.league_id === 8 ? 'Premier League' : 
                   season.league_id === 24 ? 'FA Cup' : 
                   season.league_id === 27 ? 'EFL Cup' : 
                   `League ${season.league_id}`);
                
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && hasData && (
        <div>
          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Match Totals (Both Teams) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                <span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
                Match Totals (Both Teams)
              </h3>
              <div className="space-y-2">
                {overUnderData.map((item) => (
                  <div key={`match-${item.label}`} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-gray-400 font-medium text-right">
                      Over {item.label}
                    </div>
                    {renderBar(item.matchPct, 'bg-amber-500')}
                    <div className="w-12 text-xs text-gray-400 text-right">
                      {Math.round(item.matchPct)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Goals Only */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                Team Goals Only
              </h3>
              <div className="space-y-2">
                {overUnderData.map((item) => (
                  <div key={`team-${item.label}`} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-gray-400 font-medium text-right">
                      Over {item.label}
                    </div>
                    {renderBar(item.teamPct, 'bg-green-500')}
                    <div className="w-12 text-xs text-gray-400 text-right">
                      {Math.round(item.teamPct)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Stats Highlight */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Over 1.5 Match */}
              <div className="bg-amber-900/30 rounded-lg p-3 text-center border border-amber-700">
                <div className="text-xl font-bold text-amber-400">
                  {Math.round(overUnderData[1]?.matchPct || 0)}%
                </div>
                <div className="text-xs text-amber-400">Over 1.5 (Match)</div>
              </div>

              {/* Over 2.5 Match - Most Popular */}
              <div className="bg-blue-900/30 rounded-lg p-3 text-center border-2 border-blue-500">
                <div className="text-xl font-bold text-blue-400">
                  {Math.round(overUnderData[2]?.matchPct || 0)}%
                </div>
                <div className="text-xs text-blue-400 font-semibold">Over 2.5 (Match) ★</div>
              </div>

              {/* Over 1.5 Team */}
              <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-700">
                <div className="text-xl font-bold text-green-400">
                  {Math.round(overUnderData[1]?.teamPct || 0)}%
                </div>
                <div className="text-xs text-green-400">Over 1.5 (Team)</div>
              </div>

              {/* Over 2.5 Team */}
              <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-700">
                <div className="text-xl font-bold text-green-400">
                  {Math.round(overUnderData[2]?.teamPct || 0)}%
                </div>
                <div className="text-xs text-green-400">Over 2.5 (Team)</div>
              </div>
            </div>
          </div>

          {/* Betting Insight */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              <strong>Betting Insight:</strong> 
              {overUnderData[2]?.matchPct >= 50 && ` ${Math.round(overUnderData[2].matchPct)}% of this team's matches go Over 2.5 goals.`}
              {overUnderData[2]?.matchPct < 50 && ` Only ${Math.round(overUnderData[2]?.matchPct || 0)}% of matches go Over 2.5 - consider Under bets.`}
              {overUnderData[1]?.teamPct >= 70 && ' This team regularly scores 2+ goals.'}
            </p>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && !hasData && (
        <div className="text-center py-8 text-gray-400">
          No Over/Under goals data available for this season
        </div>
      )}
    </div>
  );
}

// ============================================
// SCORING PATTERN COMPONENT
// ============================================
// Displays a visual breakdown of when a team scores/concedes
// with season selection dropdown

function ScoringPatternSection({ teamId }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================
  // FETCH AVAILABLE SEASONS
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Sort by year descending, then by league ID (Premier League first)
        const sorted = teamSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          if (bYear !== aYear) return bYear - aYear;
          
          const aLeagueId = a.league_id || a.league?.id || 999;
          const bLeagueId = b.league_id || b.league?.id || 999;
          return aLeagueId - bLeagueId;
        });
        
        setSeasons(sorted);
        
        // Auto-select the current Premier League season (league_id: 8)
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
  // FETCH STATS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamStatsBySeason(teamId, selectedSeasonId);
        setStats(data.team);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics for this season');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // EXTRACT SCORING MINUTES DATA
  // ============================================
  const getScoringData = (typeId) => {
    if (!stats?.statistics?.[0]?.details) return null;

    const stat = stats.statistics[0].details.find(d => d.type_id === typeId);
    if (!stat?.value) return null;

    const data = [];
    let totalGoals = 0;

    MINUTE_RANGES.forEach(({ key }) => {
      const rangeData = stat.value[key];
      if (rangeData) {
        const count = rangeData.count || 0;
        const percentage = rangeData.percentage || 0;
        data.push({
          range: key,
          goals: count,
          percentage: Math.round(percentage * 10) / 10
        });
        totalGoals += count;
      } else {
        data.push({ range: key, goals: 0, percentage: 0 });
      }
    });

    return { data, totalGoals };
  };

  const scoringResult = getScoringData(STAT_TYPE_IDS.SCORING_MINUTES);
  const concedingResult = getScoringData(STAT_TYPE_IDS.CONCEDED_SCORING_MINUTES);
  
  const scoringData = scoringResult?.data || [];
  const concedingData = concedingResult?.data || [];
  const totalScored = scoringResult?.totalGoals || 0;
  const totalConceded = concedingResult?.totalGoals || 0;

  // ============================================
  // RENDER BAR CHART ROW
  // ============================================
  const renderBar = (data, maxPercentage, color) => {
    return MINUTE_RANGES.map(({ key, label }) => {
      const item = data.find(d => d.range === key) || { goals: 0, percentage: 0 };
      const barWidth = maxPercentage > 0 ? (item.percentage / maxPercentage) * 100 : 0;
      
      return (
        <div key={key} className="flex items-center space-x-3">
          <div className="w-20 text-xs text-gray-400 text-right font-medium">
            {label}
          </div>
          
          <div className="flex-1 h-7 bg-gray-700 rounded overflow-hidden relative">
            <div
              className={`h-full ${color} transition-all duration-500 ease-out`}
              style={{ width: `${barWidth}%` }}
            />
            <div className="absolute inset-0 flex items-center px-2">
              <span className={`text-xs font-semibold ${item.goals > 0 ? 'text-white' : 'text-gray-400'}`}>
                {item.goals > 0 ? `${item.goals} ${item.goals === 1 ? 'goal' : 'goals'}` : '—'}
              </span>
            </div>
          </div>
          
          <div className="w-14 text-xs text-gray-400 text-right">
            {item.percentage > 0 ? `${item.percentage}%` : '—'}
          </div>
        </div>
      );
    });
  };

  const maxScoringPct = Math.max(...scoringData.map(d => d.percentage), 1);
  const maxConcedingPct = Math.max(...concedingData.map(d => d.percentage), 1);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
          <AppIcon name="timer" size="lg" className="text-gray-400" />
          <span>Scoring Pattern by Minute</span>
        </h2>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              seasons.map((season) => {
                const leagueName = season.league?.name || 
                  (season.league_id === 8 ? 'Premier League' : 
                   season.league_id === 24 ? 'FA Cup' : 
                   season.league_id === 27 ? 'EFL Cup' : 
                   `League ${season.league_id}`);
                
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Goals Scored Pattern */}
          <div>
            <h3 className="text-sm font-semibold text-green-400 mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Goals Scored
              <span className="ml-2 text-gray-400 font-normal">
                ({totalScored} total)
              </span>
            </h3>
            
            {scoringData.length > 0 && totalScored > 0 ? (
              <div className="space-y-2">
                {renderBar(scoringData, maxScoringPct, 'bg-green-500')}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm bg-gray-700 rounded">
                No scoring data available for this season
              </div>
            )}
          </div>

          {/* Goals Conceded Pattern */}
          <div>
            <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Goals Conceded
              <span className="ml-2 text-gray-400 font-normal">
                ({totalConceded} total)
              </span>
            </h3>
            
            {concedingData.length > 0 && totalConceded > 0 ? (
              <div className="space-y-2">
                {renderBar(concedingData, maxConcedingPct, 'bg-red-500')}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm bg-gray-700 rounded">
                No conceding data available for this season
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insight Note */}
      {!loading && !error && (totalScored > 0 || totalConceded > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            <strong>Betting Insight:</strong> Shows when this team typically scores and concedes goals.
            Useful for in-play betting, goal timing predictions, and identifying vulnerable periods.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// CORNERS SECTION
// ============================================
// Displays corner kick statistics with HOME/AWAY breakdown
// Premier League only, current season
// Uses our cached corner averages endpoint for home/away split

function CornersSection({ teamId }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [stats, setStats] = useState(null);
  const [cornerAvg, setCornerAvg] = useState(null);  // Home/away breakdown from our endpoint
  const [loading, setLoading] = useState(true);
  const [cornerAvgLoading, setCornerAvgLoading] = useState(false);
  const [error, setError] = useState('');

  // ============================================
  // FETCH AVAILABLE SEASONS (Premier League only)
  // ============================================
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const data = await dataApi.getTeamSeasons(teamId);
        const teamSeasons = data.seasons || [];
        
        // Filter to Premier League seasons only (league_id: 8)
        const plSeasons = teamSeasons.filter(s => 
          s.league_id === 8 || s.league?.id === 8
        );
        
        // Sort by year descending
        const sorted = plSeasons.sort((a, b) => {
          const aYear = parseInt(a.name?.split('/')[0] || a.name || '0');
          const bYear = parseInt(b.name?.split('/')[0] || b.name || '0');
          return bYear - aYear;
        });
        
        setSeasons(sorted);
        
        // Auto-select the current Premier League season
        if (sorted.length > 0) {
          const currentPL = sorted.find(s => s.is_current);
          const selected = currentPL || sorted[0];
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
  // FETCH STATS WHEN SEASON CHANGES
  // ============================================
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeamStatsBySeason(teamId, selectedSeasonId);
        setStats(data.team);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // FETCH CORNER AVERAGES (home/away breakdown)
  // ============================================
  // Uses our cached endpoint that calculates from historical fixtures
  useEffect(() => {
    if (!selectedSeasonId) return;

    const fetchCornerAvg = async () => {
      setCornerAvgLoading(true);
      try {
        const data = await dataApi.getTeamCornerAverages(teamId, selectedSeasonId);
        setCornerAvg(data);
      } catch (err) {
        console.error('Failed to fetch corner averages:', err);
        // Non-critical - just won't show home/away breakdown
        setCornerAvg(null);
      } finally {
        setCornerAvgLoading(false);
      }
    };

    fetchCornerAvg();
  }, [teamId, selectedSeasonId]);

  // ============================================
  // HELPER: Get stat by type_id
  // ============================================
  const getStat = (typeId) => {
    if (!stats?.statistics?.[0]?.details) return null;
    return stats.statistics[0].details.find(d => d.type_id === typeId);
  };

  // ============================================
  // EXTRACT CORNERS DATA (overall from team stats)
  // ============================================
  const getCornersData = () => {
    // Type ID 34 = CORNERS
    // API Structure: { count: 96, average: 5.65 }
    const cornersStat = getStat(STAT_TYPE_IDS.CORNERS);
    const corners = cornersStat?.value;
    
    // Get games played for context
    const wins = getStat(STAT_TYPE_IDS.WIN)?.value;
    const draws = getStat(STAT_TYPE_IDS.DRAW)?.value;
    const losses = getStat(STAT_TYPE_IDS.LOST)?.value;
    
    const homeGames = (wins?.home?.count || 0) + (draws?.home?.count || 0) + (losses?.home?.count || 0);
    const awayGames = (wins?.away?.count || 0) + (draws?.away?.count || 0) + (losses?.away?.count || 0);
    const totalGames = homeGames + awayGames;

    return {
      total: corners?.count ?? null,
      average: corners?.average ?? null,
      gamesPlayed: totalGames
    };
  };

  const cornersData = getCornersData();
  const hasData = cornersData.total !== null;

  // If no Premier League seasons found, don't render anything
  if (seasons.length === 0 && !loading) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
          <AppIcon name="corner-flag" size="lg" className="text-gray-400" />
          <span>Corners</span>
        </h2>
        
        {/* Season Selector - Premier League only */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-800"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} - Premier League {season.is_current ? '✓' : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && hasData && (() => {
        // ============================================
        // DATA QUALITY CHECK (runs early to determine what to show)
        // ============================================
        // Compare our calculated game count vs official game count
        // If they don't match, the historical fixture data is incomplete
        const calculatedGames = cornerAvg?.corners?.overall?.games ?? 0;
        const officialGames = cornersData.gamesPlayed;
        
        // Data is complete if we found stats for at least 80% of matches
        const completenessRatio = officialGames > 0 
          ? calculatedGames / officialGames 
          : 0;
        const isDataComplete = completenessRatio >= 0.8;
        
        // Also check if the average seems realistic (PL teams get 3-8 corners/game)
        const isAverageRealistic = cornersData.average >= 2.0;
        
        // Determine if we should show full stats or just a warning
        const showFullStats = isDataComplete && isAverageRealistic;
        
        // ============================================
        // INCOMPLETE DATA - Show warning only
        // ============================================
        if (!showFullStats && !cornerAvgLoading) {
          return (
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-center">
              <div className="text-amber-400 text-sm font-medium mb-1 flex items-center justify-center gap-2">
                <AppIcon name="warning" size="md" className="text-amber-400" />
                <span>Incomplete Historical Data</span>
              </div>
              <p className="text-xs text-amber-300">
                Detailed corner statistics are not available for this historical season.
                {calculatedGames > 0 && !isDataComplete && (
                  <span> (Found data for {calculatedGames} of {officialGames} matches)</span>
                )}
              </p>
            </div>
          );
        }
        
        // ============================================
        // COMPLETE DATA - Show full stats
        // ============================================
        return (
          <div>
            {/* Main Stats Grid - Overall */}
            <div className="grid grid-cols-3 gap-4">
              {/* Total Corners */}
              <div className="bg-orange-900/30 rounded-lg p-4 border border-orange-700 text-center">
                <div className="text-xs text-orange-400 font-semibold mb-1">TOTAL</div>
                <div className="text-3xl font-bold text-orange-400">
                  {cornersData.total}
                </div>
                <div className="text-xs text-gray-400 mt-1">corners won</div>
              </div>

              {/* Average Per Game */}
              <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700 text-center">
                <div className="text-xs text-blue-400 font-semibold mb-1">AVERAGE</div>
                <div className="text-3xl font-bold text-blue-400">
                  {cornersData.average ?? '-'}
                </div>
                <div className="text-xs text-gray-400 mt-1">per game</div>
              </div>

              {/* Games Played */}
              <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 text-center">
                <div className="text-xs text-gray-400 font-semibold mb-1">GAMES</div>
                <div className="text-3xl font-bold text-gray-300">
                  {cornersData.gamesPlayed}
                </div>
                <div className="text-xs text-gray-400 mt-1">played</div>
              </div>
            </div>

            {/* ============================================ */}
            {/* HOME / AWAY BREAKDOWN */}
            {/* ============================================ */}
            {cornerAvgLoading ? (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="text-center py-4 text-gray-400 text-sm">
                  <div className="animate-pulse">Loading home/away breakdown...</div>
                </div>
              </div>
            ) : cornerAvg?.corners ? (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Home vs Away Breakdown
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Home Corners */}
                  <div className="bg-green-900/30 rounded-lg p-4 border border-green-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                        <AppIcon name="home" size="sm" className="text-green-400" />
                        <span>HOME</span>
                      </span>
                      <span className="text-xs text-gray-400">
                        {cornerAvg.corners.home.games} games
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-green-400">
                          {cornerAvg.corners.home.total}
                        </span>
                        <span className="text-sm text-gray-400 ml-1">corners</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-400">
                          {cornerAvg.corners.home.average}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">avg</span>
                      </div>
                    </div>
                  </div>

                  {/* Away Corners */}
                  <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                        <AppIcon name="away" size="sm" className="text-blue-400" />
                        <span>AWAY</span>
                      </span>
                      <span className="text-xs text-gray-400">
                        {cornerAvg.corners.away.games} games
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-blue-400">
                          {cornerAvg.corners.away.total}
                        </span>
                        <span className="text-sm text-gray-400 ml-1">corners</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-blue-400">
                          {cornerAvg.corners.away.average}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">avg</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Home vs Away Comparison Insight */}
                {cornerAvg.corners.home.average !== cornerAvg.corners.away.average && (
                  <div className="mt-3 text-center">
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      cornerAvg.corners.home.average > cornerAvg.corners.away.average
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-blue-900/30 text-blue-400'
                    }`}>
                      {cornerAvg.corners.home.average > cornerAvg.corners.away.average
                        ? `+${(cornerAvg.corners.home.average - cornerAvg.corners.away.average).toFixed(1)} more corners at home`
                        : `+${(cornerAvg.corners.away.average - cornerAvg.corners.home.average).toFixed(1)} more corners away`
                      }
                    </span>
                  </div>
                )}

                {/* Cache indicator */}
                {cornerAvg.fromCache && (
                  <div className="text-xs text-gray-400 text-right mt-2">
                    📦 Cached data
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })()}

      {/* No Data State */}
      {!loading && !error && !hasData && (
        <div className="text-center py-8 text-gray-400">
          No corner data available for this season
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN TEAM DETAIL COMPONENT
// ============================================
const TeamDetail = () => {
  const { id } = useParams();
  const { token, isAuthenticated } = useAuth();
  
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await dataApi.getTeam(id);
        setTeam(data.team || data);
      } catch (err) {
        setError(err.message || 'Failed to load team');
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Loading team...</div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-900/30 text-red-400 p-3 rounded-md">{error}</div>
        <Link to="/teams" className="text-amber-500 hover:underline">
          &larr; Back to Teams
        </Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12 text-gray-400">Team not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/teams" className="text-amber-500 hover:underline">
        &larr; Back to Teams
      </Link>

      {/* Team Header */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-6">
          {team.image_path && (
            <img
              src={team.image_path}
              alt={team.name}
              className="w-24 h-24 object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-100">{team.name}</h1>
            <p className="text-gray-400">{team.country?.name}</p>
            {team.venue?.name && (
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <AppIcon name="stadium" size="sm" /> {team.venue.name}
                {team.venue.capacity && ` (${team.venue.capacity.toLocaleString()} capacity)`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Coach Section */}
      {team.coaches && team.coaches.length > 0 && (
        <div className="bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2"><AppIcon name="player" size="lg" /> Manager</h2>
          <div className="flex items-center space-x-4">
            {team.coaches[0].image_path && (
              <img
                src={team.coaches[0].image_path}
                alt={team.coaches[0].common_name}
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-medium">{team.coaches[0].common_name}</p>
              <p className="text-sm text-gray-400">{team.coaches[0].nationality?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Home/Away Performance Section */}
      <HomeAwayPerformanceSection teamId={id} />

      {/* W/D/L Distribution Section - Premier League Only */}
      <WinDrawLossDistributionSection teamId={id} />

      {/* Half & Timing Analysis Section - All Competitions */}
      <HalfTimingAnalysisSection teamId={id} />

      {/* Over/Under Goals Analysis Section - All Competitions */}
      <OverUnderGoalsSection teamId={id} />

      {/* Scoring Pattern Section */}
      <ScoringPatternSection teamId={id} />

      {/* Corners Section */}
      <CornersSection teamId={id} />

      {/* Squad Roster Section - Full stats table with sorting */}
      <SquadRoster teamId={id} />

      {/* ============================================ */}
      {/* FLOATING NOTE WIDGET */}
      {/* ============================================ */}
      {/* Shows on the right side, minimizes to bottom-right corner */}
      {/* Auto-links to this team */}
      {isAuthenticated && team && (
        <FloatingNoteWidget
          token={token}
          contextType="team"
          contextId={id}
          contextLabel={team.name}
          additionalLinks={[]}  // No additional links for team pages
          onNoteAdded={() => {
            console.log('Note added successfully');
          }}
        />
      )}
    </div>
  );
};

export default TeamDetail;
