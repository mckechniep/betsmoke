// ============================================
// MATCH PREDICTIONS COMPONENT
// ============================================
// A reusable component that displays AI predictions for a fixture.
// Designed to be placed prominently on the fixture detail page.
//
// Features:
// - Accordion tabs for organized display
// - All prediction types from SportsMonks
// - Color-coded probability bars
// - Betting insights
//
// Usage:
//   <MatchPredictions 
//     fixtureId={19427635}
//     homeTeam={{ id: 1, name: "West Ham", image_path: "..." }}
//     awayTeam={{ id: 11, name: "Fulham", image_path: "..." }}
//   />
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dataApi } from '../api/client';
import aiPredictionsIcon from '../assets/ai-probability-betsmoke-3.png';
import AppIcon from './AppIcon';

// ============================================
// PREDICTION TYPE IDS (from SportsMonks)
// ============================================
// These are the type_id values that identify each prediction type
const PREDICTION_TYPES = {
  // Match Result
  FULLTIME_RESULT: 237,
  DOUBLE_CHANCE: 239,
  FIRST_HALF_WINNER: 233,
  HTFT: 232, // Half Time / Full Time
  
  // Goals
  BTTS: 231,
  TEAM_TO_SCORE_FIRST: 238,
  OVER_UNDER_1_5: 234,
  OVER_UNDER_2_5: 235,
  OVER_UNDER_3_5: 236,
  OVER_UNDER_4_5: 1679,
  
  // Home Goals
  HOME_OVER_0_5: 334,
  HOME_OVER_1_5: 331,
  HOME_OVER_2_5: 330,
  HOME_OVER_3_5: 326,
  
  // Away Goals
  AWAY_OVER_0_5: 333,
  AWAY_OVER_1_5: 332,
  AWAY_OVER_2_5: 328,
  AWAY_OVER_3_5: 327,
  
  // Correct Score
  CORRECT_SCORE: 240,
  
  // Corners
  CORNERS_OVER_4: 1690,
  CORNERS_OVER_5: 1683,
  CORNERS_OVER_6: 1685,
  CORNERS_OVER_7: 1686,
  CORNERS_OVER_8: 1689,
  CORNERS_OVER_9: 1687,
  CORNERS_OVER_10: 1688,
  CORNERS_OVER_10_5: 1585,
  CORNERS_OVER_11: 1684,
};

// ============================================
// ACCORDION SECTION COMPONENT
// ============================================
// When a section is expanded (isOpen), it gets a blue border/ring
// to indicate focus. All sections have the same grey header styling.
function AccordionSection({ title, icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Check if icon is an AppIcon name (no emoji characters) or an emoji
  const isAppIconName = icon && !/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(icon);

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      isOpen ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-600'
    }`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors bg-gray-700 hover:bg-gray-600"
      >
        <div className="flex items-center space-x-2">
          {isAppIconName ? (
            <AppIcon name={icon} size="lg" className="text-gray-400" />
          ) : (
            <span className="text-lg">{icon}</span>
          )}
          <span className="font-medium text-gray-100">{title}</span>
        </div>
        <AppIcon name="chevron-down" size="md" className={`transform transition-transform text-amber-500 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-800 border-t border-gray-600">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// PROBABILITY BAR COMPONENT
// ============================================
// Displays a horizontal bar showing probability percentage
function ProbabilityBar({ label, value, color = 'blue', showPercentage = true }) {
  // Ensure value is a number and clamp between 0-100
  const percentage = Math.min(100, Math.max(0, parseFloat(value) || 0));
  
  // Color mappings
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    gray: 'bg-gray-400',
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-400 w-24 truncate">{label}</span>
      <div className="flex-1 bg-gray-600 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color] || colorClasses.blue} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-sm font-medium text-gray-200 w-12 text-right">{percentage.toFixed(1)}%</span>
      )}
    </div>
  );
}

// ============================================
// THREE-WAY PROBABILITY COMPONENT
// ============================================
// For predictions like Home/Draw/Away
function ThreeWayProbability({ home, draw, away, homeLabel = 'Home', drawLabel = 'Draw', awayLabel = 'Away' }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div className="bg-blue-900/30 rounded-lg p-3">
        <div className="text-2xl font-bold text-blue-400">{parseFloat(home).toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">{homeLabel}</div>
      </div>
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="text-2xl font-bold text-gray-300">{parseFloat(draw).toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">{drawLabel}</div>
      </div>
      <div className="bg-red-900/30 rounded-lg p-3">
        <div className="text-2xl font-bold text-red-400">{parseFloat(away).toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">{awayLabel}</div>
      </div>
    </div>
  );
}

// ============================================
// YES/NO PROBABILITY COMPONENT
// ============================================
// For predictions like BTTS Yes/No
function YesNoProbability({ yes, no, yesLabel = 'Yes', noLabel = 'No' }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-center">
      <div className="bg-green-900/30 rounded-lg p-3">
        <div className="text-2xl font-bold text-green-400">{parseFloat(yes).toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">{yesLabel}</div>
      </div>
      <div className="bg-red-900/30 rounded-lg p-3">
        <div className="text-2xl font-bold text-red-400">{parseFloat(no).toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">{noLabel}</div>
      </div>
    </div>
  );
}

// ============================================
// MATCH RESULT SECTION
// ============================================
function MatchResultSection({ predictions, homeTeam, awayTeam }) {
  // Find the fulltime result prediction
  const fulltimeResult = predictions.find(p => p.type_id === PREDICTION_TYPES.FULLTIME_RESULT);
  const doubleChance = predictions.find(p => p.type_id === PREDICTION_TYPES.DOUBLE_CHANCE);
  const firstHalfWinner = predictions.find(p => p.type_id === PREDICTION_TYPES.FIRST_HALF_WINNER);

  if (!fulltimeResult) {
    return <div className="text-gray-500 text-center py-2">No match result predictions available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Fulltime Result */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Full Time Result</h4>
        <ThreeWayProbability 
          home={fulltimeResult.predictions?.home || 0}
          draw={fulltimeResult.predictions?.draw || 0}
          away={fulltimeResult.predictions?.away || 0}
          homeLabel={homeTeam?.name || 'Home'}
          awayLabel={awayTeam?.name || 'Away'}
        />
      </div>

      {/* Double Chance */}
      {doubleChance && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Double Chance</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-blue-900/30 rounded-lg p-2">
              <div className="text-lg font-bold text-blue-400">
                {parseFloat(doubleChance.predictions?.draw_home || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">Home or Draw</div>
            </div>
            <div className="bg-purple-900/30 rounded-lg p-2">
              <div className="text-lg font-bold text-purple-400">
                {parseFloat(doubleChance.predictions?.home_away || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">Home or Away</div>
            </div>
            <div className="bg-red-900/30 rounded-lg p-2">
              <div className="text-lg font-bold text-red-400">
                {parseFloat(doubleChance.predictions?.draw_away || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">Away or Draw</div>
            </div>
          </div>
        </div>
      )}

      {/* First Half Winner */}
      {firstHalfWinner && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">First Half Winner</h4>
          <ThreeWayProbability 
            home={firstHalfWinner.predictions?.home || 0}
            draw={firstHalfWinner.predictions?.draw || 0}
            away={firstHalfWinner.predictions?.away || 0}
            homeLabel={homeTeam?.name || 'Home'}
            awayLabel={awayTeam?.name || 'Away'}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// GOALS SECTION
// ============================================
function GoalsSection({ predictions, homeTeam, awayTeam }) {
  const btts = predictions.find(p => p.type_id === PREDICTION_TYPES.BTTS);
  const teamToScoreFirst = predictions.find(p => p.type_id === PREDICTION_TYPES.TEAM_TO_SCORE_FIRST);
  const over15 = predictions.find(p => p.type_id === PREDICTION_TYPES.OVER_UNDER_1_5);
  const over25 = predictions.find(p => p.type_id === PREDICTION_TYPES.OVER_UNDER_2_5);
  const over35 = predictions.find(p => p.type_id === PREDICTION_TYPES.OVER_UNDER_3_5);
  const over45 = predictions.find(p => p.type_id === PREDICTION_TYPES.OVER_UNDER_4_5);

  return (
    <div className="space-y-6">
      {/* BTTS */}
      {btts && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Both Teams To Score (BTTS)</h4>
          <YesNoProbability 
            yes={btts.predictions?.yes || 0}
            no={btts.predictions?.no || 0}
          />
        </div>
      )}

      {/* Team to Score First */}
      {teamToScoreFirst && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Team To Score First</h4>
          <ThreeWayProbability 
            home={teamToScoreFirst.predictions?.home || 0}
            draw={teamToScoreFirst.predictions?.draw || 0}
            away={teamToScoreFirst.predictions?.away || 0}
            homeLabel={homeTeam?.name || 'Home'}
            drawLabel="No Goal"
            awayLabel={awayTeam?.name || 'Away'}
          />
        </div>
      )}

      {/* Over/Under Goals */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Total Goals Over/Under</h4>
        <div className="space-y-2">
          {over15 && (
            <ProbabilityBar 
              label="Over 1.5" 
              value={over15.predictions?.yes || 0} 
              color="green"
            />
          )}
          {over25 && (
            <ProbabilityBar 
              label="Over 2.5" 
              value={over25.predictions?.yes || 0} 
              color="blue"
            />
          )}
          {over35 && (
            <ProbabilityBar 
              label="Over 3.5" 
              value={over35.predictions?.yes || 0} 
              color="purple"
            />
          )}
          {over45 && (
            <ProbabilityBar 
              label="Over 4.5" 
              value={over45.predictions?.yes || 0} 
              color="red"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TEAM GOALS SECTION
// ============================================
function TeamGoalsSection({ predictions, homeTeam, awayTeam }) {
  // Home team predictions
  const homeOver05 = predictions.find(p => p.type_id === PREDICTION_TYPES.HOME_OVER_0_5);
  const homeOver15 = predictions.find(p => p.type_id === PREDICTION_TYPES.HOME_OVER_1_5);
  const homeOver25 = predictions.find(p => p.type_id === PREDICTION_TYPES.HOME_OVER_2_5);
  const homeOver35 = predictions.find(p => p.type_id === PREDICTION_TYPES.HOME_OVER_3_5);
  
  // Away team predictions
  const awayOver05 = predictions.find(p => p.type_id === PREDICTION_TYPES.AWAY_OVER_0_5);
  const awayOver15 = predictions.find(p => p.type_id === PREDICTION_TYPES.AWAY_OVER_1_5);
  const awayOver25 = predictions.find(p => p.type_id === PREDICTION_TYPES.AWAY_OVER_2_5);
  const awayOver35 = predictions.find(p => p.type_id === PREDICTION_TYPES.AWAY_OVER_3_5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Home Team */}
      <div>
        <div className="flex items-center space-x-2 mb-3">
          {homeTeam?.image_path && (
            <img src={homeTeam.image_path} alt={homeTeam.name} className="w-5 h-5 object-contain" />
          )}
          <h4 className="text-sm font-medium text-gray-300">{homeTeam?.name || 'Home'} Goals</h4>
        </div>
        <div className="space-y-2">
          {homeOver05 && (
            <ProbabilityBar label="Over 0.5" value={homeOver05.predictions?.yes || 0} color="blue" />
          )}
          {homeOver15 && (
            <ProbabilityBar label="Over 1.5" value={homeOver15.predictions?.yes || 0} color="blue" />
          )}
          {homeOver25 && (
            <ProbabilityBar label="Over 2.5" value={homeOver25.predictions?.yes || 0} color="blue" />
          )}
          {homeOver35 && (
            <ProbabilityBar label="Over 3.5" value={homeOver35.predictions?.yes || 0} color="blue" />
          )}
        </div>
      </div>

      {/* Away Team */}
      <div>
        <div className="flex items-center space-x-2 mb-3">
          {awayTeam?.image_path && (
            <img src={awayTeam.image_path} alt={awayTeam.name} className="w-5 h-5 object-contain" />
          )}
          <h4 className="text-sm font-medium text-gray-300">{awayTeam?.name || 'Away'} Goals</h4>
        </div>
        <div className="space-y-2">
          {awayOver05 && (
            <ProbabilityBar label="Over 0.5" value={awayOver05.predictions?.yes || 0} color="red" />
          )}
          {awayOver15 && (
            <ProbabilityBar label="Over 1.5" value={awayOver15.predictions?.yes || 0} color="red" />
          )}
          {awayOver25 && (
            <ProbabilityBar label="Over 2.5" value={awayOver25.predictions?.yes || 0} color="red" />
          )}
          {awayOver35 && (
            <ProbabilityBar label="Over 3.5" value={awayOver35.predictions?.yes || 0} color="red" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CORRECT SCORE SECTION
// ============================================
function CorrectScoreSection({ predictions, homeTeam, awayTeam }) {
  const correctScore = predictions.find(p => p.type_id === PREDICTION_TYPES.CORRECT_SCORE);
  
  if (!correctScore?.predictions?.scores) {
    return <div className="text-gray-500 text-center py-2">No correct score predictions available</div>;
  }

  const scores = correctScore.predictions.scores;
  
  // Convert to array and sort by probability (highest first)
  const sortedScores = Object.entries(scores)
    .filter(([key]) => !key.startsWith('Other')) // Exclude "Other" entries
    .map(([score, probability]) => ({ score, probability: parseFloat(probability) }))
    .sort((a, b) => b.probability - a.probability);

  // Top 6 most likely scores
  const topScores = sortedScores.slice(0, 6);
  
  // Other scores for expandable view
  const otherScores = sortedScores.slice(6);

  // State for showing all scores
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-4">
      {/* Top Scores */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Most Likely Scores</h4>
        <div className="grid grid-cols-3 gap-2">
          {topScores.map(({ score, probability }) => {
            // Determine if home win, draw, or away win
            const [home, away] = score.split('-').map(Number);
            let bgColor = 'bg-gray-700';
            let textColor = 'text-gray-100';
            if (home > away) { bgColor = 'bg-blue-900/30'; textColor = 'text-blue-400'; }
            else if (away > home) { bgColor = 'bg-red-900/30'; textColor = 'text-red-400'; }

            return (
              <div key={score} className={`${bgColor} rounded-lg p-2 text-center`}>
                <div className={`text-lg font-bold ${textColor}`}>{score}</div>
                <div className="text-xs text-gray-400">{probability.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show More Button */}
      {otherScores.length > 0 && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-2 text-sm text-amber-500 hover:text-amber-400 hover:bg-gray-700 rounded-md transition-colors flex items-center justify-center space-x-1"
          >
            <span>{showAll ? '▲' : '▼'}</span>
            <span>{showAll ? 'Show Less' : `Show All Scores (${otherScores.length} more)`}</span>
          </button>

          {showAll && (
            <div className="grid grid-cols-4 gap-2">
              {otherScores.map(({ score, probability }) => (
                <div key={score} className="bg-gray-700 rounded p-1.5 text-center text-xs">
                  <div className="font-medium">{score}</div>
                  <div className="text-gray-400">{probability.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// CORNERS SECTION
// ============================================
function CornersSection({ predictions }) {
  // Find all corner predictions
  const cornerPredictions = [
    { label: 'Over 4', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_4) },
    { label: 'Over 5', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_5) },
    { label: 'Over 6', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_6) },
    { label: 'Over 7', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_7) },
    { label: 'Over 8', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_8) },
    { label: 'Over 9', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_9) },
    { label: 'Over 10', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_10) },
    { label: 'Over 11', data: predictions.find(p => p.type_id === PREDICTION_TYPES.CORNERS_OVER_11) },
  ].filter(p => p.data); // Only include predictions that exist

  if (cornerPredictions.length === 0) {
    return <div className="text-gray-500 text-center py-2">No corner predictions available</div>;
  }

  return (
    <div className="space-y-2">
      {cornerPredictions.map(({ label, data }) => (
        <ProbabilityBar 
          key={label}
          label={label} 
          value={data.predictions?.yes || 0} 
          color="yellow"
        />
      ))}
    </div>
  );
}

// ============================================
// HALFTIME / FULLTIME SECTION
// ============================================
function HalfTimeFullTimeSection({ predictions, homeTeam, awayTeam }) {
  const htft = predictions.find(p => p.type_id === PREDICTION_TYPES.HTFT);
  
  if (!htft?.predictions) {
    return <div className="text-gray-500 text-center py-2">No HT/FT predictions available</div>;
  }

  const htftData = htft.predictions;
  
  // Create grid of all 9 combinations
  const combinations = [
    { ht: 'home', ft: 'home', key: 'home_home', label: `${homeTeam?.short_code || 'H'}/${homeTeam?.short_code || 'H'}` },
    { ht: 'home', ft: 'draw', key: 'home_draw', label: `${homeTeam?.short_code || 'H'}/D` },
    { ht: 'home', ft: 'away', key: 'home_away', label: `${homeTeam?.short_code || 'H'}/${awayTeam?.short_code || 'A'}` },
    { ht: 'draw', ft: 'home', key: 'draw_home', label: `D/${homeTeam?.short_code || 'H'}` },
    { ht: 'draw', ft: 'draw', key: 'draw_draw', label: 'D/D' },
    { ht: 'draw', ft: 'away', key: 'draw_away', label: `D/${awayTeam?.short_code || 'A'}` },
    { ht: 'away', ft: 'home', key: 'away_home', label: `${awayTeam?.short_code || 'A'}/${homeTeam?.short_code || 'H'}` },
    { ht: 'away', ft: 'draw', key: 'away_draw', label: `${awayTeam?.short_code || 'A'}/D` },
    { ht: 'away', ft: 'away', key: 'away_away', label: `${awayTeam?.short_code || 'A'}/${awayTeam?.short_code || 'A'}` },
  ];

  // Sort by probability
  const sortedCombinations = combinations
    .map(c => ({ ...c, probability: parseFloat(htftData[c.key] || 0) }))
    .sort((a, b) => b.probability - a.probability);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {sortedCombinations.map(({ label, probability, ft }) => {
          // Color based on full time result
          let bgColor = 'bg-gray-700';
          let textColor = 'text-gray-100';
          if (ft === 'home') { bgColor = 'bg-blue-900/30'; textColor = 'text-blue-400'; }
          else if (ft === 'away') { bgColor = 'bg-red-900/30'; textColor = 'text-red-400'; }

          return (
            <div key={label} className={`${bgColor} rounded-lg p-2 text-center`}>
              <div className={`text-sm font-bold ${textColor}`}>{label}</div>
              <div className="text-xs text-gray-400">{probability.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
      
      <div className="text-xs text-gray-500 text-center">
        Format: Half Time / Full Time (e.g., H/A = Home leading at HT, Away wins)
      </div>
    </div>
  );
}

// ============================================
// MAIN MATCH PREDICTIONS COMPONENT
// ============================================
export default function MatchPredictions({ fixtureId, homeTeam, awayTeam }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch predictions when component mounts or fixtureId changes
  useEffect(() => {
    const fetchPredictions = async () => {
      if (!fixtureId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await dataApi.getPredictions(fixtureId);
        setPredictions(data.predictions || []);
      } catch (err) {
        console.error('Failed to fetch predictions:', err);
        setError(err.message || 'Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [fixtureId]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <img src={aiPredictionsIcon} alt="AI Predictions" className="w-16 h-16 object-contain" />
          <h2 className="text-lg font-semibold text-gray-100">AI Predictions</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <div className="animate-pulse">Loading predictions...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <img src={aiPredictionsIcon} alt="AI Predictions" className="w-16 h-16 object-contain" />
          <h2 className="text-lg font-semibold text-gray-100">AI Predictions</h2>
        </div>
        <div className="text-center py-4 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  // No predictions available
  if (predictions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <img src={aiPredictionsIcon} alt="AI Predictions" className="w-16 h-16 object-contain" />
          <h2 className="text-lg font-semibold text-gray-100">AI Predictions</h2>
        </div>
        <div className="text-center py-4 text-gray-500">
          No predictions available for this fixture yet.
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <img src={aiPredictionsIcon} alt="AI Predictions" className="w-16 h-16 object-contain" />
          <h2 className="text-lg font-semibold text-gray-100">AI Predictions</h2>
          <span className="text-xs text-gray-400 bg-gray-600 px-2 py-0.5 rounded">
            {predictions.length} markets
          </span>
        </div>
      </div>

      {/* AI Predictions Info */}
      <div className="mb-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg text-sm text-blue-300">
        <p className="mb-3">
          AI Predictions are from Sportsmonks'{' '}
          <a
            href="https://www.sportmonks.com/football-api/football-predictions-api/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400 underline font-medium"
          >
            Football Predictions API
          </a>
          , a state-of-the-art AI model that leverages advanced machine learning
          techniques and cutting-edge algorithms to generate probabilistic forecasts
          for football matches.
        </p>
        <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
          <Link
            to="/model-architecture"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 rounded-full text-sm font-medium transition-colors"
          >
            <AppIcon name="brain" size="sm" className="text-blue-300" /> Model Architecture
          </Link>
          <Link
            to="/model-performance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 rounded-full text-sm font-medium transition-colors"
          >
            <AppIcon name="stats" size="sm" className="text-blue-300" /> Model's Prediction Accuracy
          </Link>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-3">
        {/* Match Result - Default Open (most important) */}
        <AccordionSection title="Match Result" icon="soccer-ball" defaultOpen={true}>
          <MatchResultSection predictions={predictions} homeTeam={homeTeam} awayTeam={awayTeam} />
        </AccordionSection>

        {/* Goals */}
        <AccordionSection title="Goals Over/Under" icon="goal" defaultOpen={true}>
          <GoalsSection predictions={predictions} homeTeam={homeTeam} awayTeam={awayTeam} />
        </AccordionSection>

        {/* Team Goals */}
        <AccordionSection title="Team Goals" icon="stats" defaultOpen={false}>
          <TeamGoalsSection predictions={predictions} homeTeam={homeTeam} awayTeam={awayTeam} />
        </AccordionSection>

        {/* Correct Score */}
        <AccordionSection title="Correct Score" icon="target" defaultOpen={false}>
          <CorrectScoreSection predictions={predictions} homeTeam={homeTeam} awayTeam={awayTeam} />
        </AccordionSection>

        {/* Corners */}
        <AccordionSection title="Corners" icon="corner-flag" defaultOpen={false}>
          <CornersSection predictions={predictions} />
        </AccordionSection>

        {/* Half Time / Full Time */}
        <AccordionSection title="Half Time / Full Time" icon="timer" defaultOpen={false}>
          <HalfTimeFullTimeSection predictions={predictions} homeTeam={homeTeam} awayTeam={awayTeam} />
        </AccordionSection>
      </div>
    </div>
  );
}
