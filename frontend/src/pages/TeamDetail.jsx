// ============================================
// TEAM DETAIL PAGE
// ============================================
// Shows team information including:
// - Basic team info (name, logo, venue)
// - Coach information
// - Home/Away Performance breakdown
// - Scoring Pattern by minute range (with season selector)
// - Squad list
// ============================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dataApi } from '../api/client';

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
      points: (wins?.home?.count !== undefined && draws?.home?.count !== undefined)
        ? calculatePoints(wins.home.count, draws.home.count)
        : '-'
    };
    homeData.goalDiff = (homeData.goalsFor !== '-' && homeData.goalsAgainst !== '-')
      ? homeData.goalsFor - homeData.goalsAgainst
      : '-';

    // Away stats
    const awayData = {
      played: gamesPlayed?.away ?? '-',
      won: wins?.away?.count ?? '-',
      drawn: draws?.away?.count ?? '-',
      lost: losses?.away?.count ?? '-',
      goalsFor: goals?.away?.count ?? '-',
      goalsAgainst: conceded?.away?.count ?? '-',
      cleansheets: cleansheets?.away?.count ?? '-',
      points: (wins?.away?.count !== undefined && draws?.away?.count !== undefined)
        ? calculatePoints(wins.away.count, draws.away.count)
        : '-'
    };
    awayData.goalDiff = (awayData.goalsFor !== '-' && awayData.goalsAgainst !== '-')
      ? awayData.goalsFor - awayData.goalsAgainst
      : '-';

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
    <div className={`flex items-center py-2 ${highlight ? 'bg-gray-50 font-semibold' : ''}`}>
      <div className="w-1/3 text-center text-green-700">{home}</div>
      <div className="w-1/3 text-center text-gray-600 text-sm">{label}</div>
      <div className="w-1/3 text-center text-blue-700">{away}</div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          🏠 Home vs Away Performance
        </h2>
        
        {/* Season Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
        <div className="text-center py-8 text-gray-500">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && (
        <div>
          {/* Column Headers */}
          <div className="flex items-center py-3 border-b-2 border-gray-200 mb-2">
            <div className="w-1/3 text-center">
              <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                🏠 Home
              </span>
            </div>
            <div className="w-1/3 text-center text-gray-500 text-sm font-medium">
              Statistic
            </div>
            <div className="w-1/3 text-center">
              <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                ✈️ Away
              </span>
            </div>
          </div>

          {/* Stats Rows */}
          <div className="divide-y divide-gray-100">
            <StatRow label="Matches Played" home={homeData.played} away={awayData.played} />
            <StatRow label="Wins" home={homeData.won} away={awayData.won} />
            <StatRow label="Draws" home={homeData.drawn} away={awayData.drawn} />
            <StatRow label="Losses" home={homeData.lost} away={awayData.lost} />
            <StatRow label="Goals Scored" home={homeData.goalsFor} away={awayData.goalsFor} />
            <StatRow label="Goals Conceded" home={homeData.goalsAgainst} away={awayData.goalsAgainst} />
            <StatRow label="Goal Difference" home={homeData.goalDiff > 0 ? `+${homeData.goalDiff}` : homeData.goalDiff} away={awayData.goalDiff > 0 ? `+${awayData.goalDiff}` : awayData.goalDiff} />
            <StatRow label="Clean Sheets" home={homeData.cleansheets} away={awayData.cleansheets} />
            <StatRow label="Points" home={homeData.points} away={awayData.points} highlight={true} />
          </div>

          {/* Points Per Game */}
          {homeData.played !== '-' && awayData.played !== '-' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center">
                <div className="w-1/3 text-center text-green-700 font-medium">
                  {homeData.points !== '-' && homeData.played > 0 
                    ? (homeData.points / homeData.played).toFixed(2) 
                    : '-'}
                </div>
                <div className="w-1/3 text-center text-gray-500 text-sm">
                  Points Per Game
                </div>
                <div className="w-1/3 text-center text-blue-700 font-medium">
                  {awayData.points !== '-' && awayData.played > 0 
                    ? (awayData.points / awayData.played).toFixed(2) 
                    : '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insight Note */}
      {!loading && !error && homeData.played !== '-' && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            📊 <strong>Betting Insight:</strong> Compare home and away records to identify if a team
            has strong home advantage or travels well. Useful for 1X2, Over/Under, and handicap markets.
          </p>
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
          <div className="w-20 text-xs text-gray-600 text-right font-medium">
            {label}
          </div>
          
          <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
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
          
          <div className="w-14 text-xs text-gray-600 text-right">
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
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header with Season Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          ⏱️ Scoring Pattern by Minute
        </h2>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Season:</label>
          <select
            value={selectedSeasonId || ''}
            onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
        <div className="text-center py-8 text-gray-500">
          <div className="animate-pulse">Loading statistics...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats Display */}
      {!loading && !error && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Goals Scored Pattern */}
          <div>
            <h3 className="text-sm font-semibold text-green-700 mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Goals Scored
              <span className="ml-2 text-gray-500 font-normal">
                ({totalScored} total)
              </span>
            </h3>
            
            {scoringData.length > 0 && totalScored > 0 ? (
              <div className="space-y-2">
                {renderBar(scoringData, maxScoringPct, 'bg-green-500')}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded">
                No scoring data available for this season
              </div>
            )}
          </div>

          {/* Goals Conceded Pattern */}
          <div>
            <h3 className="text-sm font-semibold text-red-700 mb-4 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Goals Conceded
              <span className="ml-2 text-gray-500 font-normal">
                ({totalConceded} total)
              </span>
            </h3>
            
            {concedingData.length > 0 && totalConceded > 0 ? (
              <div className="space-y-2">
                {renderBar(concedingData, maxConcedingPct, 'bg-red-500')}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded">
                No conceding data available for this season
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insight Note */}
      {!loading && !error && (totalScored > 0 || totalConceded > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            📊 <strong>Betting Insight:</strong> Shows when this team typically scores and concedes goals.
            Useful for in-play betting, goal timing predictions, and identifying vulnerable periods.
          </p>
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
      <div className="text-center py-12 text-gray-500">Loading team...</div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>
        <Link to="/teams" className="text-blue-600 hover:underline">
          &larr; Back to Teams
        </Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12 text-gray-500">Team not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/teams" className="text-blue-600 hover:underline">
        &larr; Back to Teams
      </Link>

      {/* Team Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-6">
          {team.image_path && (
            <img
              src={team.image_path}
              alt={team.name}
              className="w-24 h-24 object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
            <p className="text-gray-500">{team.country?.name}</p>
            {team.venue?.name && (
              <p className="text-sm text-gray-400">
                🏟️ {team.venue.name}
                {team.venue.capacity && ` (${team.venue.capacity.toLocaleString()} capacity)`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Coach Section */}
      {team.coaches && team.coaches.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">👔 Manager</h2>
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
              <p className="text-sm text-gray-500">{team.coaches[0].nationality?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Home/Away Performance Section */}
      <HomeAwayPerformanceSection teamId={id} />

      {/* Scoring Pattern Section */}
      <ScoringPatternSection teamId={id} />

      {/* Squad Section */}
      {team.players && team.players.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">👥 Squad</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.players.map((player) => (
              <div key={player.player_id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                {player.player?.image_path && (
                  <img
                    src={player.player.image_path}
                    alt={player.player.common_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-sm">{player.player?.common_name}</p>
                  <p className="text-xs text-gray-500">
                    #{player.jersey_number} - {player.position?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamDetail;
