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
// - Differential % (how much better/worse AI is vs baseline)
// - Rating (High/Good/Medium/Poor based on differential)
// - Accuracy (hit ratio)
// - Trend (improving/declining/stable)
// ============================================

import { useState, useEffect } from 'react';
import { dataApi } from '../api/client';
import AppIcon from '../components/AppIcon';

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
    good: 'bg-blue-900/30 text-blue-400 border-gray-600',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    poor: 'bg-red-100 text-red-800 border-red-200',
  };
  
  const style = styles[rating] || 'bg-gray-700 text-gray-100 border-gray-700';
  
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
 * Differential Badge - Shows differential percentage with color coding
 * Color is based on the actual rating from the API, not our own thresholds
 */
const DifferentialBadge = ({ differential, rating }) => {
  // Round to 1 decimal place for display
  const roundedDifferential = Math.round(differential * 10) / 10;
  
  // Color based on the ACTUAL rating from SportsMonks (so they always match)
  const colorByRating = {
    high: 'bg-green-100 text-green-700',
    good: 'bg-blue-900/30 text-blue-400',
    medium: 'bg-yellow-100 text-yellow-700',
    poor: 'bg-red-100 text-red-700',
  };
  
  const colorClass = colorByRating[rating] || 'bg-gray-700 text-gray-300';
  const formatted = roundedDifferential >= 0 ? `+${roundedDifferential.toFixed(1)}%` : `${roundedDifferential.toFixed(1)}%`;
  
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
      className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-700 transition-colors select-none ${className}`}
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        <span className="text-gray-400">
          {isActive ? (
            <AppIcon name={currentDirection === 'desc' ? 'chevron-down' : 'chevron-up'} size="xs" className="text-amber-500" />
          ) : (
            <AppIcon name="chevron-down" size="xs" className="text-gray-500 opacity-30" />
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
 * AccordionItem - Collapsible section with title and expandable content
 * Used in the "Understanding AI Prediction Model Performance" section
 * 
 * Props:
 *   - title: The clickable header text
 *   - children: Content shown when expanded
 *   - defaultOpen: Whether to start expanded (default: false)
 */
const AccordionItem = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-gray-600 last:border-b-0">
      {/* Clickable Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-gray-700/50 transition-colors rounded"
      >
        <span className="font-medium text-amber-400">{title}</span>
        {/* Chevron that rotates when open */}
        <span
          className={`text-amber-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <AppIcon name="chevron-down" size="sm" className="text-amber-500" />
        </span>
      </button>
      
      {/* Collapsible Content - only renders when open */}
      {isOpen && (
        <div className="pb-4 px-1 text-sm text-gray-300 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
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
    colorClass = 'bg-blue-900/30 text-blue-400';
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
  
  // Sorting state for the Edge table (separate from main table)
  const [edgeSortColumn, setEdgeSortColumn] = useState('edge');
  const [edgeSortDirection, setEdgeSortDirection] = useState('desc');

  // ============================================
  // FETCH DATA WHEN COMPETITION CHANGES
  // ============================================
  
  useEffect(() => {
    // Define fetch function inside useEffect to avoid dependency warning
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

    // Reset sort when competition changes (both tables)
    setSortColumn('rating');
    setSortDirection('desc');
    setEdgeSortColumn('edge');
    setEdgeSortDirection('desc');
    
    // Fetch the data
    fetchPredictability();
  }, [selectedLeagueId]);

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
  
  // Calculate differential: how much better/worse model is vs historical baseline
  // Formula: (|historical| - |model|) / |historical| * 100
  const calculateDifferential = (marketKey) => {
    if (!historicalLogLoss || !modelLogLoss) return null;
    const historical = historicalLogLoss[marketKey];
    const model = modelLogLoss[marketKey];
    if (historical === undefined || model === undefined) return null;
    
    const differential = (Math.abs(historical) - Math.abs(model)) / Math.abs(historical) * 100;
    return differential;
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
        case 'differential':
          aValue = calculateDifferential(a) || 0;
          bValue = calculateDifferential(b) || 0;
          break;
        case 'rating':
          // Primary sort: rating (High > Good > Medium > Poor)
          aValue = ratingToNumber(ratingData?.[a]);
          bValue = ratingToNumber(ratingData?.[b]);
          
          // Secondary sort: if ratings are equal, sort by differential
          if (aValue === bValue) {
            const aDiff = calculateDifferential(a) || 0;
            const bDiff = calculateDifferential(b) || 0;
            // Apply same sort direction to the tiebreaker
            if (sortDirection === 'desc') {
              return bDiff - aDiff;
            } else {
              return aDiff - bDiff;
            }
          }
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
  // EDGE TABLE SORTING LOGIC
  // ============================================
  
  // Handle sort for Edge table (separate from main table)
  const handleEdgeSort = (column) => {
    if (edgeSortColumn === column) {
      // Toggle direction if clicking same column
      setEdgeSortDirection(edgeSortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column - default to descending
      setEdgeSortColumn(column);
      setEdgeSortDirection('desc');
    }
  };
  
  // Get sorted market keys for the Edge table
  const getSortedEdgeMarkets = () => {
    // Only include markets that have accuracy data
    const validMarkets = MARKET_ORDER.filter(key => 
      accuracyData?.[key] !== undefined
    );
    
    // If no sort column, return in default order
    if (!edgeSortColumn) return validMarkets;
    
    const sortable = [...validMarkets];
    
    sortable.sort((a, b) => {
      let aValue, bValue;
      
      switch (edgeSortColumn) {
        case 'edgeAccuracy':
          // Model accuracy (higher = better)
          aValue = accuracyData[a] || 0;
          bValue = accuracyData[b] || 0;
          break;
        case 'edgeRandom':
          // Random chance baseline
          aValue = RANDOM_CHANCE[a] || 0.5;
          bValue = RANDOM_CHANCE[b] || 0.5;
          break;
        case 'edge':
          // Edge = accuracy - random chance (can be negative)
          aValue = calculateEdge(a, accuracyData[a]);
          bValue = calculateEdge(b, accuracyData[b]);
          break;
        default:
          return 0;
      }
      
      // Apply sort direction
      if (edgeSortDirection === 'desc') {
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
        <h1 className="text-2xl font-bold text-gray-100 mb-4">AI Prediction Model Performance</h1>
        <p className="text-sm text-gray-400 font-semibold">
          See how accurate the AI predictions are for each competition and market.
        </p>
        <p className="text-sm text-gray-400 mt-3 max-w-3xl">
          The performance of our AI Prediction Model is continuously monitored by tracking 
          historical outcomes and objective quality metrics over the last 100 matches.
        </p>
      </div>

      {/* ============================================ */}
      {/* COMPETITION SELECTOR */}
      {/* ============================================ */}
      <div className="bg-gray-800 rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
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
        <div className="bg-red-900/30 text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* ============================================ */}
      {/* LOADING STATE */}
      {/* ============================================ */}
      {loading && (
        <div className="text-center py-12 text-gray-400">
          <div className="inline-block w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p>Loading prediction model data...</p>
        </div>
      )}

      {/* ============================================ */}
      {/* MAIN UNIFIED TABLE */}
      {/* ============================================ */}
      {!loading && !error && historicalLogLoss && modelLogLoss && (
        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
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
              <thead className="bg-gray-700 border-b border-gray-700">
                <tr>
                  {/* Market - not sortable */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                  
                  {/* Differential */}
                  <SortableHeader
                    label="Differential"
                    column="differential"
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
                  const differential = calculateDifferential(marketKey);
                  const rating = ratingData?.[marketKey];
                  const accuracy = accuracyData?.[marketKey];
                  const trend = trendData?.[marketKey];
                  
                  return (
                    <tr key={marketKey} className="hover:bg-gray-700 transition-colors">
                      {/* Market Name */}
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-100">
                          {MARKET_LABELS[marketKey] || marketKey}
                        </span>
                      </td>
                      
                      {/* Historical Log Loss (rounded to 2 decimals) */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-400 font-mono">
                          {historical.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Model Log Loss (rounded to 2 decimals) */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-100 font-mono font-semibold">
                          {model.toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Differential Badge */}
                      <td className="px-4 py-4 text-center">
                        {differential !== null && rating && (
                          <DifferentialBadge differential={differential} rating={rating} />
                        )}
                      </td>
                      
                      {/* Rating Badge */}
                      <td className="px-4 py-4 text-center">
                        {rating && <RatingBadge rating={rating} />}
                      </td>
                      
                      {/* Accuracy */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-300">
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
        <div className="bg-blue-900/30 border border-gray-600 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
            <AppIcon name="stats" size="lg" className="text-gray-400" />
            <span>Understanding AI Prediction Model Performance</span>
          </h3>
          
          {/* Intro paragraph */}
          <div className="text-sm text-gray-300 space-y-3 mb-4">
            <p>
              This section details how we evaluate the AI Prediction Model's performance.
            </p>
            <p>
              It introduces the Log‑Loss metric (also known as Logarithmic Loss or Cross‑Entropy Loss) and explains 
              how it works alongside additional performance measures to assess how reliable, well‑calibrated, 
              and consistent the model is across different competitions and betting markets.
            </p>
            <p className="text-amber-500 italic">
              Click any topic below to learn more.
            </p>
          </div>
          
          {/* Accordion sections */}
          <div className="space-y-0">
            
            {/* 1. What is Log Loss? */}
            <AccordionItem title="What is Log Loss?">
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Log loss measures <strong>how confident</strong> the model was, and whether that confidence was <strong>justified</strong></li>
                <li>It <strong>punishes the model for being confidently wrong</strong></li>
                <li>Values are always negative, and <strong>closer to 0 is better</strong></li>
              </ul>
            </AccordionItem>
            
            {/* 2. Historical Log Loss */}
            <AccordionItem title="Historical Log Loss">
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Historical log loss is calculated using only <strong>league-wide historical averages</strong> — no AI, no machine learning algorithms, no unique data inputs</li>
                <li>It's the <strong>baseline</strong> we compare Model Log Loss against</li>
                <li>Calculated over the <strong>last 100 matches</strong> in the competition</li>
              </ul>
            </AccordionItem>
            
            {/* 3. Model Log Loss */}
            <AccordionItem title="Model Log Loss">
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Model log loss is the AI's <strong>actual performance</strong> using machine learning algorithms and unique data inputs</li>
                <li>If Model Log Loss is <strong>closer to 0</strong> than Historical Log Loss, the AI is adding value</li>
                <li>Calculated over the <strong>same 100 matches</strong> as Historical Log Loss</li>
              </ul>
            </AccordionItem>
            
            {/* 4. Differential */}
            <AccordionItem title="Differential">
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>This shows <strong>how much better or worse</strong> the AI is compared to the baseline, expressed as a percentage</li>
                <li>A positive value (e.g. +8%) means the AI is performing <strong>better</strong> than the baseline; a negative value means it's performing <strong>worse</strong></li>
              </ul>
            </AccordionItem>
            
            {/* 5. Rating */}
            <AccordionItem title="Rating">
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>SportsMonks assigns a <strong>rating</strong> based on the difference (Differential) between the Model Log Loss and the Historical Log Loss</li>
                <li>Essentially SportsMonks is grading the model's actual performance versus the baseline</li>
              </ul>
              <div className="bg-gray-700 p-3 rounded mt-2 w-fit">
                <ul className="list-none space-y-1 text-gray-300">
                  <li><span className="text-green-400 font-semibold">High</span> — 8% or more</li>
                  <li><span className="text-blue-400 font-semibold">Good</span> — 5% to 8%</li>
                  <li><span className="text-yellow-400 font-semibold">Medium</span> — 3% to 5%</li>
                  <li><span className="text-red-400 font-semibold">Poor</span> — Under 3%</li>
                </ul>
              </div>
              <p className="bg-blue-900/30 p-2 rounded mt-2">
                <strong>Note:</strong> A Medium rating doesn't mean the model is performing poorly, it 
                simply means the model's prediction accuracy is only slightly better than the baseline
              </p>
            </AccordionItem>
            
            {/* 6. Accuracy */}
            <AccordionItem title="Accuracy">
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>Accuracy</strong>, also sometimes referred to as the hit ratio, evaluates "what percentage of the model's predictions were correct?"</li>
                <li>It's a simple metric that tells us the number of times the model predicted the particular market correctly for the <strong>last 100 matches</strong> of the league (or competition)</li>
              </ul>
            </AccordionItem>
            
            {/* 7. Trend */}
            <AccordionItem title="Trend">
              <p>
                The trend shows whether the model's performance is <strong>improving, declining, or stable</strong> over the most recent 50 matches
              </p>
              <div className="bg-gray-700 p-3 rounded mt-2 w-fit">
                <ul className="list-none space-y-1 text-gray-300">
                  <li><span className="text-green-400 font-bold text-xl">↑</span> — Improving</li>
                  <li><span className="text-red-400 font-bold text-xl">↓</span> — Declining</li>
                  <li><span className="text-gray-400 font-bold text-xl">→</span> — Stable</li>
                </ul>
              </div>
              <p className="bg-blue-900/30 p-2 rounded mt-2">
                <strong>Note:</strong> An upward trend suggests the model is adapting well to 
                current conditions; a downward trend might indicate changing patterns the model hasn't 
                caught up with yet
              </p>
            </AccordionItem>
            
          </div>
          
          {/* Putting It All Together - Standalone callout box */}
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <AppIcon name="lightbulb" size="md" className="text-gray-400" />
              <span>Putting It All Together</span>
            </h4>
            <ul className="list-disc list-inside space-y-2 ml-1 text-sm text-gray-200">
              <li><strong className="text-gray-100">Rating</strong> gives you a quick-glance assessment of model quality for each market — start here to identify the strongest predictions</li>
              <li><strong className="text-gray-100">Differential</strong> shows the actual percentage improvement — useful when comparing markets with the same rating</li>
              <li><strong className="text-gray-100">Accuracy</strong> is easy to understand (% correct), but remember: a model can have high accuracy and still be poorly calibrated</li>
              <li><strong className="text-gray-100">Trend</strong> tells you if the model is improving or declining — a "High" rating with a declining trend may warrant caution</li>
            </ul>
            <div className="bg-gray-800 p-3 rounded mt-3">
              <p className="text-sm text-gray-300">
                <strong>In practice:</strong> Focus on markets with <span className="text-green-400 font-semibold">High</span> or <span className="text-amber-400 font-semibold">Good</span> ratings
                and stable or improving trends for the most reliable predictions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TECHNICAL DEEP DIVE (For the nerds!) */}
      {/* ============================================ */}
      {!loading && !error && historicalLogLoss && modelLogLoss && (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AppIcon name="microscope" size="lg" className="text-gray-400" />
            <span>Technical Deep Dive</span>
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            For those who want the full statistical picture. Here's the math and theory behind the metrics.
          </p>
          
          {/* Log Loss Formula */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Log Loss (Cross-Entropy Loss)</h4>
            <div className="bg-gray-800 p-4 rounded-lg font-mono text-sm mb-3">
              <p className="text-yellow-300">Log Loss = -1/N × Σ [y × log(p) + (1-y) × log(1-p)]</p>
              <p className="text-gray-400 mt-2">Where:</p>
              <ul className="text-gray-400 ml-4 space-y-1">
                <li>N = number of predictions</li>
                <li>y = actual outcome (1 if event occurred, 0 if not)</li>
                <li>p = predicted probability of the event</li>
              </ul>
            </div>
            <p className="text-gray-300 text-sm">
              Log Loss quantifies the <strong className="text-white">distance</strong> between predicted probability distributions and actual outcomes. Unlike accuracy (which only cares about right/wrong), log loss penalizes predictions based on how far off the probability was.
            </p>
            <p className="text-gray-300 text-sm mt-2">
              A prediction of 0.99 for an event that doesn't happen incurs a much larger penalty than 
              a prediction of 0.51 for the same wrong outcome. This makes log loss ideal for evaluating <strong className="text-white">calibration</strong> — whether a model's confidence levels are trustworthy.
            </p>
          </div>
          
          {/* Why Negative Values */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Why Are the Values Negative?</h4>
            <p className="text-gray-300 text-sm">
              The logarithm of any probability (0 &lt; p &lt; 1) is always negative. For example:
            </p>
            <div className="bg-gray-800 p-3 rounded-lg font-mono text-sm my-2">
              <p>log(0.5) = -0.693</p>
              <p>log(0.8) = -0.223</p>
              <p>log(0.99) = -0.010</p>
            </div>
            <p className="text-gray-300 text-sm">
              When we sum these and multiply by -1/N, we get a negative value. <strong className="text-white">Less negative = better</strong> because it means higher probabilities were assigned to correct outcomes.
            </p>
          </div>
          
          {/* Historical Log Loss Calculation */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Historical Log Loss Calculation</h4>
            <p className="text-gray-300 text-sm mb-2">
              The historical log loss represents a <strong className="text-white">naive baseline</strong> using only league-wide frequencies. For a 1X2 market:
            </p>
            <div className="bg-gray-800 p-4 rounded-lg font-mono text-sm mb-3">
              <p className="text-gray-400">// Example: Premier League historical frequencies</p>
              <p>P(Home Win) ≈ 0.45</p>
              <p>P(Draw) ≈ 0.26</p>
              <p>P(Away Win) ≈ 0.29</p>
              <p className="text-gray-400 mt-2">// Baseline predicts these same probabilities for EVERY match</p>
            </div>
            <p className="text-gray-300 text-sm">
              This baseline ignores all context — team form, home/away records, injuries, head-to-head. If the AI model can't beat this baseline, it's not adding value.
            </p>
          </div>
          
          {/* Differential Formula */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Differential Percentage</h4>
            <div className="bg-gray-800 p-4 rounded-lg font-mono text-sm mb-3">
              <p className="text-yellow-300">Differential % = (|Historical LL| - |Model LL|) / |Historical LL| × 100</p>
              <p className="text-gray-400 mt-2">Example:</p>
              <p className="text-gray-400">Historical LL = -0.65</p>
              <p className="text-gray-400">Model LL = -0.60</p>
              <p className="text-green-400">Differential = (0.65 - 0.60) / 0.65 × 100 = +7.7%</p>
            </div>
            <p className="text-gray-300 text-sm">
              We use absolute values because both numbers are negative. A positive differential means the model's log loss is closer to zero (better) than the historical baseline. A negative differential means the model is underperforming the baseline.
            </p>
          </div>
          
          {/* Rating Thresholds */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Rating Threshold Breakdown</h4>
            <p className="text-gray-300 text-sm mb-2">
              SportsMonks assigns ratings based on how much the model's log loss improves over the historical baseline. These thresholds reflect how difficult it is to consistently beat the baseline:
            </p>
            <div className="bg-gray-800 p-4 rounded-lg text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">Rating</th>
                    <th className="text-left py-2">Differential</th>
                    <th className="text-left py-2">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-green-400 font-semibold">High</td>
                    <td className="py-2">≥ 8%</td>
                    <td className="py-2">Excellent predictive edge; model adds significant value</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-blue-400 font-semibold">Good</td>
                    <td className="py-2">5% – 8%</td>
                    <td className="py-2">Solid performance; meaningful improvement over baseline</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 text-yellow-400 font-semibold">Medium</td>
                    <td className="py-2">3% – 5%</td>
                    <td className="py-2">Modest edge; model helps but baseline is competitive</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-red-400 font-semibold">Poor</td>
                    <td className="py-2">&lt; 3%</td>
                    <td className="py-2">Minimal advantage; consider relying on other factors</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Why Log Loss Over Accuracy */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Why Log Loss Instead of Just Accuracy?</h4>
            <p className="text-gray-300 text-sm mb-2">
              Consider two models predicting 100 coin flips:
            </p>
            <div className="bg-gray-800 p-4 rounded-lg text-sm mb-3">
              <p className="text-gray-400 mb-2"><strong className="text-white">Model A:</strong> Always predicts 51% heads</p>
              <p className="text-gray-400 mb-2"><strong className="text-white">Model B:</strong> Predicts 90% heads when confident, 10% when not</p>
              <p className="text-gray-400 mt-3">Both might achieve ~50% accuracy on a fair coin, but:</p>
              <p className="text-green-400">Model A: Lower log loss (well-calibrated uncertainty)</p>
              <p className="text-red-400">Model B: Higher log loss (overconfident and wrong)</p>
            </div>
            <p className="text-gray-300 text-sm">
              For betting, calibration matters enormously. A model that says "60% confident" should be right about 60% of the time at that confidence level. Log loss captures this; raw accuracy doesn't.
            </p>
          </div>
          
          {/* Trend Calculation */}
          <div>
            <h4 className="text-lg font-semibold text-blue-400 mb-2">Trend Calculation</h4>
            <p className="text-gray-300 text-sm">
              The trend compares the model's log loss over the <strong className="text-white">most recent 50 matches</strong> against the prior period. If the recent log loss is meaningfully lower (better), the trend is <span className="text-green-400">↑ Up</span>. If higher (worse), it's <span className="text-red-400">↓ Down</span>. If within a small threshold, it's <span className="text-gray-400">→ Stable</span>.
            </p>
            <p className="text-gray-300 text-sm mt-2">
              This helps identify whether the model is adapting to current league conditions or if patterns are shifting in ways the model hasn't captured yet.
            </p>
          </div>
          
        </div>
      )}

      {/* ============================================ */}
      {/* ADDITIONAL ANALYSIS (Random & Edge) */}
      {/* ============================================ */}
      {!loading && !error && accuracyData && (
        <div className="bg-gray-700 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <AppIcon name="target" size="lg" className="text-gray-400" />
            <span>Additional Analysis: Edge vs Random Chance</span>
          </h3>
          <div className="text-sm text-gray-400 mb-4 space-y-2">
            <p>
              This section compares the model's accuracy against pure random guessing.
            </p>
            <p>
              <strong>Random</strong> is the probability of guessing correctly by chance alone. For example, 
              Team to Score First has a "Random Chance" of 33% as the Home Team could score, the Away Team 
              could score, or nobody could score.
            </p>
            <p>
              <strong>Accuracy</strong> is our model's accuracy, defined earlier as the percentage of correct 
              predictions for the last 100 matches.
            </p>
            <p>
              <strong>Edge</strong> shows the difference in percentage points — positive means the model beats 
              random chance, negative means it underperforms.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  {/* Market - not sortable */}
                  <th className="text-left py-2 pr-4 text-gray-300 font-semibold">Market</th>
                  
                  {/* Accuracy - sortable */}
                  <SortableHeader
                    label="Accuracy"
                    column="edgeAccuracy"
                    currentSort={edgeSortColumn}
                    currentDirection={edgeSortDirection}
                    onSort={handleEdgeSort}
                    className="text-center py-2 px-4"
                  />
                  
                  {/* Random Chance - sortable */}
                  <SortableHeader
                    label="Random Chance"
                    column="edgeRandom"
                    currentSort={edgeSortColumn}
                    currentDirection={edgeSortDirection}
                    onSort={handleEdgeSort}
                    className="text-center py-2 px-4"
                  />
                  
                  {/* Edge - sortable */}
                  <SortableHeader
                    label="Edge"
                    column="edge"
                    currentSort={edgeSortColumn}
                    currentDirection={edgeSortDirection}
                    onSort={handleEdgeSort}
                    className="text-center py-2 pl-4"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedEdgeMarkets().map((marketKey) => {
                  const accuracy = accuracyData[marketKey];
                  if (accuracy === undefined) return null;
                  
                  const randomChance = RANDOM_CHANCE[marketKey] || 0.5;
                  const edge = calculateEdge(marketKey, accuracy);
                  
                  return (
                    <tr key={marketKey} className="hover:bg-gray-700">
                      <td className="py-2 pr-4 text-gray-100">
                        {MARKET_LABELS[marketKey] || marketKey}
                      </td>
                      <td className="py-2 px-4 text-center font-semibold text-gray-300">
                        {Math.round(accuracy * 100)}%
                      </td>
                      <td className="py-2 px-4 text-center text-gray-400">
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
        <div className="text-center py-12 bg-gray-800 rounded-lg shadow-md">
          <p className="text-gray-400 text-lg">No prediction data available</p>
          <p className="text-gray-400 text-sm mt-1">
            Try selecting a different competition
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelPerformance;
