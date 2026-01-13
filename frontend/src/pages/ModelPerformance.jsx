// ============================================
// MODEL PERFORMANCE PAGE
// ============================================
// Displays AI prediction model performance/accuracy.
// Users can select a competition (Premier League, FA Cup, Carabao Cup)
// to see how accurate the prediction model is for that league.
//
// The main table shows:
// - Historical Log Loss (baseline using league averages)
// - Model Log Loss (AI's actual performance)
// - Improvement % (how much better AI is vs baseline)
// - Rating (High/Good/Medium/Poor based on improvement)
// - Accuracy (hit ratio)
// - Trend (improving/declining/stable)
// ============================================

import { useState, useEffect } from 'react';
import { dataApi } from '../api/client';

// ============================================
// CONSTANTS
// ============================================

// Available competitions with their SportsMonks league IDs
const COMPETITIONS = [
  { 
    id: 8, 
    name: 'Premier League', 
    fallbackIcon: '🏆',
    imagePath: 'https://cdn.sportmonks.com/images/soccer/leagues/8/8.png',
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-purple-800',
    hoverFrom: 'hover:from-purple-700',
    hoverTo: 'hover:to-purple-900',
  },
  { 
    id: 24, 
    name: 'FA Cup', 
    fallbackIcon: '🏅',
    imagePath: 'https://cdn.sportmonks.com/images/soccer/leagues/24/24.png',
    gradientFrom: 'from-red-600',
    gradientTo: 'to-red-800',
    hoverFrom: 'hover:from-red-700',
    hoverTo: 'hover:to-red-900',
  },
  { 
    id: 27, 
    name: 'Carabao Cup', 
    fallbackIcon: '🥤',
    imagePath: 'https://cdn.sportmonks.com/images/soccer/leagues/27/27.png',
    gradientFrom: 'from-green-600',
    gradientTo: 'to-green-800',
    hoverFrom: 'hover:from-green-700',
    hoverTo: 'hover:to-green-900',
  },
];

// Type IDs from the API response
const TYPE_IDS = {
  HISTORICAL_LOG_LOSS: 241,  // Benchmark: log loss using only historical averages
  ACCURACY: 242,              // Model hit ratio (% of correct predictions)
  RATING: 243,                // Performance rating (poor/medium/good/high)
  TREND: 244,                 // Recent trend (up/down/unchanged)
  MODEL_LOG_LOSS: 245,        // Model's actual log loss (lower = better)
};

// Human-readable names for each market
const MARKET_LABELS = {
  fulltime_result: 'Match Result (1X2)',
  both_teams_to_score: 'Both Teams to Score',
  over_under_1_5: 'Over/Under 1.5 Goals',
  over_under_2_5: 'Over/Under 2.5 Goals',
  over_under_3_5: 'Over/Under 3.5 Goals',
  home_over_under_0_5: 'Home Team O/U 0.5',
  home_over_under_1_5: 'Home Team O/U 1.5',
  away_over_under_0_5: 'Away Team O/U 0.5',
  away_over_under_1_5: 'Away Team O/U 1.5',
  correct_score: 'Correct Score',
  ht_ft: 'Half Time / Full Time',
  team_to_score_first: 'Team to Score First',
  fulltime_result_1st_half: 'First Half Result',
};

// ============================================
// RANDOM CHANCE BY MARKET (for Additional Analysis section)
// ============================================
const RANDOM_CHANCE = {
  fulltime_result: 0.333,
  both_teams_to_score: 0.50,
  over_under_1_5: 0.50,
  over_under_2_5: 0.50,
  over_under_3_5: 0.50,
  home_over_under_0_5: 0.50,
  home_over_under_1_5: 0.50,
  away_over_under_0_5: 0.50,
  away_over_under_1_5: 0.50,
  correct_score: 0.05,
  ht_ft: 0.111,
  team_to_score_first: 0.333,
  fulltime_result_1st_half: 0.333,
};

// Order markets by category for better display
const MARKET_ORDER = [
  'fulltime_result',
  'both_teams_to_score',
  'over_under_1_5',
  'over_under_2_5',
  'over_under_3_5',
  'home_over_under_0_5',
  'home_over_under_1_5',
  'away_over_under_0_5',
  'away_over_under_1_5',
  'team_to_score_first',
  'fulltime_result_1st_half',
  'ht_ft',
  'correct_score',
];

// ============================================
// HELPER COMPONENTS
// ============================================

/**
 * Rating Badge - Shows performance rating with color coding
 */
const RatingBadge = ({ rating }) => {
  const styles = {
    high: 'bg-green-100 text-green-800 border-green-200',
    good: 'bg-blue-100 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    poor: 'bg-red-100 text-red-800 border-red-200',
  };
  
  const style = styles[rating] || 'bg-gray-100 text-gray-800 border-gray-200';
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${style} capitalize`}>
      {rating}
    </span>
  );
};

/**
 * Trend Arrow - Shows trend direction with colored arrow
 */
const TrendArrow = ({ trend }) => {
  if (trend === 'up') {
    return <span className="text-green-600 font-bold" title="Improving">↑</span>;
  }
  if (trend === 'down') {
    return <span className="text-red-600 font-bold" title="Declining">↓</span>;
  }
  return <span className="text-gray-400 font-bold" title="Unchanged">→</span>;
};

/**
 * Improvement Badge - Shows improvement percentage with color coding
 * Color is based on the actual rating from the API, not our own thresholds
 */
const ImprovementBadge = ({ improvement, rating }) => {
  // Round to 1 decimal place for display
  const roundedImprovement = Math.round(improvement * 10) / 10;
  
  // Color based on the ACTUAL rating from SportsMonks (so they always match)
  const colorByRating = {
    high: 'bg-green-100 text-green-700',
    good: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    poor: 'bg-red-100 text-red-700',
  };
  
  const colorClass = colorByRating[rating] || 'bg-gray-100 text-gray-700';
  const formatted = roundedImprovement >= 0 ? `+${roundedImprovement.toFixed(1)}%` : `${roundedImprovement.toFixed(1)}%`;
  
  return (
    <span className={`px-2 py-1 text-xs font-bold rounded ${colorClass}`}>
      {formatted}
    </span>
  );
};

/**
 * Sortable Header - Clickable column header with sort indicator
 */
const SortableHeader = ({ label, column, currentSort, currentDirection, onSort, className = '' }) => {
  const isActive = currentSort === column;
  
  return (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        <span className="text-gray-400">
          {isActive ? (
            currentDirection === 'desc' ? '▼' : '▲'
          ) : (
            <span className="opacity-30">▼</span>
          )}
        </span>
      </div>
    </th>
  );
};

/**
 * Competition Logo - Displays official league logo with emoji fallback
 */
const CompetitionLogo = ({ competition, size = 'md', withBackground = false }) => {
  const [imageError, setImageError] = useState(false);
  
  const imageSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
  };
  
  const containerSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
  };
  
  const imageClass = imageSizeClasses[size] || imageSizeClasses.md;
  const containerClass = containerSizeClasses[size] || containerSizeClasses.md;
  
  let logoElement;
  
  if (imageError || !competition.imagePath) {
    logoElement = <span className="text-xl">{competition.fallbackIcon}</span>;
  } else {
    logoElement = (
      <img
        src={competition.imagePath}
        alt={`${competition.name} logo`}
        className={`${imageClass} object-contain`}
        onError={() => setImageError(true)}
      />
    );
  }
  
  if (withBackground) {
    return (
      <div className={`${containerClass} bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1`}>
        {logoElement}
      </div>
    );
  }
  
  return logoElement;
};

/**
 * Edge Badge - Shows edge over random chance (for Additional Analysis)
 */
const EdgeBadge = ({ edge }) => {
  const edgePercent = Math.round(edge * 100);
  
  let colorClass = 'bg-red-100 text-red-700';
  if (edgePercent >= 15) {
    colorClass = 'bg-green-100 text-green-700';
  } else if (edgePercent >= 10) {
    colorClass = 'bg-blue-100 text-blue-700';
  } else if (edgePercent >= 5) {
    colorClass = 'bg-yellow-100 text-yellow-700';
  }
  
  const formatted = edgePercent >= 0 ? `+${edgePercent}%` : `${edgePercent}%`;
  
  return (
    <span className={`px-2 py-1 text-xs font-bold rounded ${colorClass}`}>
      {formatted}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const ModelPerformance = () => {
  // ============================================
  // STATE
  // ============================================
  
  const [selectedLeagueId, setSelectedLeagueId] = useState(8);
  const [predictabilityData, setPredictabilityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorting state - default to rating descending (High first)
  const [sortColumn, setSortColumn] = useState('rating');
  const [sortDirection, setSortDirection] = useState('desc');

  // ============================================
  // FETCH DATA WHEN COMPETITION CHANGES
  // ============================================
  
  useEffect(() => {
    // Reset sort when competition changes
    setSortColumn('rating');
    setSortDirection('desc');
    fetchPredictability();
  }, [selectedLeagueId]);

  const fetchPredictability = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await dataApi.getPredictability(selectedLeagueId);
      console.log('Predictability response:', result);
      setPredictabilityData(result.data);
    } catch (err) {
      console.error('Failed to fetch predictability:', err);
      setError(err.message || 'Failed to load prediction model performance');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // PARSE DATA BY TYPE
  // ============================================
  
  const getDataByType = (typeId) => {
    if (!predictabilityData) return null;
    const item = predictabilityData.find(d => d.type_id === typeId);
    return item?.data || null;
  };
  
  const accuracyData = getDataByType(TYPE_IDS.ACCURACY);
  const ratingData = getDataByType(TYPE_IDS.RATING);
  const trendData = getDataByType(TYPE_IDS.TREND);
  const historicalLogLoss = getDataByType(TYPE_IDS.HISTORICAL_LOG_LOSS);
  const modelLogLoss = getDataByType(TYPE_IDS.MODEL_LOG_LOSS);

  // ============================================
  // HELPERS
  // ============================================
  
  const getCompetitionName = (leagueId) => {
    const competition = COMPETITIONS.find(c => c.id === leagueId);
    return competition?.name || 'Unknown';
  };
  
  // Calculate improvement: how much better model is vs historical baseline
  // Formula: (|historical| - |model|) / |historical| * 100
  const calculateImprovement = (marketKey) => {
    if (!historicalLogLoss || !modelLogLoss) return null;
    const historical = historicalLogLoss[marketKey];
    const model = modelLogLoss[marketKey];
    if (historical === undefined || model === undefined) return null;
    
    const improvement = (Math.abs(historical) - Math.abs(model)) / Math.abs(historical) * 100;
    return improvement;
  };
  
  // Calculate edge over random chance (for Additional Analysis section)
  const calculateEdge = (marketKey, accuracy) => {
    const randomChance = RANDOM_CHANCE[marketKey] || 0.5;
    return accuracy - randomChance;
  };
  
  // ============================================
  // SORTING LOGIC
  // ============================================
  
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };
  
  // Convert rating string to number for sorting
  const ratingToNumber = (rating) => {
    const values = { high: 4, good: 3, medium: 2, poor: 1 };
    return values[rating] || 0;
  };
  
  // Convert trend string to number for sorting
  const trendToNumber = (trend) => {
    const values = { up: 3, unchanged: 2, down: 1 };
    return values[trend] || 0;
  };
  
  // Get sorted market keys based on current sort settings
  const getSortedMarkets = () => {
    // Only include markets that have all required data
    const validMarkets = MARKET_ORDER.filter(key => 
      historicalLogLoss?.[key] !== undefined && 
      modelLogLoss?.[key] !== undefined &&
      accuracyData?.[key] !== undefined
    );
    
    // If no sort column, return valid markets in default order
    if (!sortColumn) return validMarkets;
    
    const sortable = [...validMarkets];
    
    sortable.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'historical':
          // Less negative = better, so sort by raw value
          aValue = historicalLogLoss[a] || 0;
          bValue = historicalLogLoss[b] || 0;
          break;
        case 'model':
          // Less negative = better, so sort by raw value
          aValue = modelLogLoss[a] || 0;
          bValue = modelLogLoss[b] || 0;
          break;
        case 'improvement':
          aValue = calculateImprovement(a) || 0;
          bValue = calculateImprovement(b) || 0;
          break;
        case 'rating':
          aValue = ratingToNumber(ratingData?.[a]);
          bValue = ratingToNumber(ratingData?.[b]);
          break;
        case 'accuracy':
          aValue = accuracyData[a] || 0;
          bValue = accuracyData[b] || 0;
          break;
        case 'trend':
          aValue = trendToNumber(trendData?.[a]);
          bValue = trendToNumber(trendData?.[b]);
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
    
    return sortable;
  };

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Prediction Model Performance</h1>
        <p className="text-sm text-gray-500 mt-1 font-semibold">
          See how accurate the AI predictions are for each competition and market.
        </p>
        <p className="text-sm text-gray-600 mt-3 max-w-3xl">
          The performance of our AI Prediction Model is continuously monitored by tracking 
          historical outcomes and objective quality metrics over the last 100 matches.
        </p>
      </div>

      {/* ============================================ */}
      {/* COMPETITION SELECTOR */}
      {/* ============================================ */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Competition
        </label>
        <div className="flex flex-wrap gap-3">
          {COMPETITIONS.map((competition) => {
            const isSelected = selectedLeagueId === competition.id;
            
            return (
              <button
                key={competition.id}
                onClick={() => setSelectedLeagueId(competition.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200
                  bg-gradient-to-r ${competition.gradientFrom} ${competition.gradientTo} 
                  ${competition.hoverFrom} ${competition.hoverTo}
                  text-white shadow-md hover:shadow-lg
                  ${isSelected
                    ? 'ring-2 ring-offset-2 ring-gray-400'
                    : 'opacity-90 hover:opacity-100'
                  }`}
              >
                <CompetitionLogo 
                  competition={competition} 
                  size="sm" 
                  withBackground={true}
                />
                {competition.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================ */}
      {/* ERROR MESSAGE */}
      {/* ============================================ */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* ============================================ */}
      {/* LOADING STATE */}
      {/* ============================================ */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p>Loading prediction model data...</p>
        </div>
      )}

      {/* ============================================ */}
      {/* MAIN UNIFIED TABLE */}
      {/* ============================================ */}
      {!loading && !error && historicalLogLoss && modelLogLoss && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 text-white px-6 py-4">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <CompetitionLogo 
                competition={COMPETITIONS.find(c => c.id === selectedLeagueId)} 
                size="md" 
                withBackground={true}
              />
              {getCompetitionName(selectedLeagueId)} - Model Performance
            </h2>
          </div>
          

          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {/* Market - not sortable */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Market
                  </th>
                  
                  {/* Historical Log Loss */}
                  <SortableHeader
                    label="Historical Log Loss"
                    column="historical"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center whitespace-nowrap pl-8"
                  />
                  
                  {/* Model Log Loss */}
                  <SortableHeader
                    label="Model Log Loss"
                    column="model"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center whitespace-nowrap"
                  />
                  
                  {/* Improvement */}
                  <SortableHeader
                    label="Improvement"
                    column="improvement"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-28"
                  />
                  
                  {/* Rating */}
                  <SortableHeader
                    label="Rating"
                    column="rating"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-20"
                  />
                  
                  {/* Accuracy */}
                  <SortableHeader
                    label="Accuracy"
                    column="accuracy"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-24"
                  />
                  
                  {/* Trend */}
                  <SortableHeader
                    label="Trend"
                    column="trend"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-16"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedMarkets().map((marketKey) => {
                  const historical = historicalLogLoss[marketKey];
                  const model = modelLogLoss[marketKey];
                  const improvement = calculateImprovement(marketKey);
                  const rating = ratingData?.[marketKey];
                  const accuracy = accuracyData?.[marketKey];
                  const trend = trendData?.[marketKey];
                  
                  return (
                    <tr key={marketKey} className="hover:bg-gray-50 transition-colors">
                      {/* Market Name */}
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900">
                          {MARKET_LABELS[marketKey] || marketKey}
                        </span>
                      </td>
                      
                      {/* Historical Log Loss (rounded to 2 decimals) */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-600 font-mono">
                          {historical.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Model Log Loss (rounded to 2 decimals) */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-900 font-mono font-semibold">
                          {model.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Improvement Badge */}
                      <td className="px-4 py-4 text-center">
                        {improvement !== null && rating && (
                          <ImprovementBadge improvement={improvement} rating={rating} />
                        )}
                      </td>
                      
                      {/* Rating Badge */}
                      <td className="px-4 py-4 text-center">
                        {rating && <RatingBadge rating={rating} />}
                      </td>
                      
                      {/* Accuracy */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-700">
                          {Math.round(accuracy * 100)}%
                        </span>
                      </td>
                      
                      {/* Trend Arrow */}
                      <td className="px-4 py-4 text-center text-xl">
                        {trend && <TrendArrow trend={trend} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* UNDERSTANDING AI PREDICTION MODEL PERFORMANCE */}
      {/* ============================================ */}
      {!loading && !error && historicalLogLoss && modelLogLoss && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📊 Understanding AI Prediction Model Performance</h3>
          <div className="text-sm text-blue-800 space-y-3">
            <p>
              This section details how we evaluate the AI Prediction Model's performance. It introduces 
              the Log‑Loss metric (also known as Logarithmic Loss or Cross‑Entropy Loss) and explains 
              how it works alongside additional performance measures to assess how reliable, well‑calibrated, 
              and consistent the model is across different competitions and betting markets.
            </p>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ADDITIONAL ANALYSIS (Random & Edge) */}
      {/* ============================================ */}
      {!loading && !error && accuracyData && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">🎯 Additional Analysis: Edge Over Random Chance</h3>
          <p className="text-sm text-gray-600 mb-4">
            This section shows how much better the model performs compared to pure random guessing. 
            "Random" is the probability of guessing correctly by chance alone, while "Edge" shows 
            how many percentage points better the model's accuracy is.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 pr-4 text-gray-700 font-semibold">Market</th>
                  <th className="text-center py-2 px-4 text-gray-700 font-semibold">Model Accuracy</th>
                  <th className="text-center py-2 px-4 text-gray-700 font-semibold">Random Chance</th>
                  <th className="text-center py-2 pl-4 text-gray-700 font-semibold">Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {MARKET_ORDER.map((marketKey) => {
                  const accuracy = accuracyData[marketKey];
                  if (accuracy === undefined) return null;
                  
                  const randomChance = RANDOM_CHANCE[marketKey] || 0.5;
                  const edge = calculateEdge(marketKey, accuracy);
                  
                  return (
                    <tr key={marketKey} className="hover:bg-gray-100">
                      <td className="py-2 pr-4 text-gray-800">
                        {MARKET_LABELS[marketKey] || marketKey}
                      </td>
                      <td className="py-2 px-4 text-center font-semibold text-gray-700">
                        {Math.round(accuracy * 100)}%
                      </td>
                      <td className="py-2 px-4 text-center text-gray-500">
                        {Math.round(randomChance * 100)}%
                      </td>
                      <td className="py-2 pl-4 text-center">
                        <EdgeBadge edge={edge} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* NO DATA STATE */}
      {/* ============================================ */}
      {!loading && !error && !historicalLogLoss && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500 text-lg">No prediction data available</p>
          <p className="text-gray-400 text-sm mt-1">
            Try selecting a different competition
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelPerformance;
