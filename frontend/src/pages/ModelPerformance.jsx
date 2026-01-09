// ============================================
// MODEL PERFORMANCE PAGE
// ============================================
// Displays SportsMonks AI prediction model performance/accuracy.
// Users can select a competition (Premier League, FA Cup, Carabao Cup)
// to see how accurate the prediction model is for that league.
// ============================================

import { useState, useEffect } from 'react';
import { dataApi } from '../api/client';

// ============================================
// CONSTANTS
// ============================================

// Available competitions with their SportsMonks league IDs
// Image URLs follow pattern: https://cdn.sportmonks.com/images/soccer/leagues/{id}/{id}.png
// Colors match the Competitions page for consistency across the app
const COMPETITIONS = [
  { 
    id: 8, 
    name: 'Premier League', 
    // TODO: Replace fallback emoji with better fallback (e.g., text initials like 'PL')
    fallbackIcon: '🏆',
    imagePath: 'https://cdn.sportmonks.com/images/soccer/leagues/8/8.png',
    // Gradient colors for selector button (matches Competitions page)
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-purple-800',
    hoverFrom: 'hover:from-purple-700',
    hoverTo: 'hover:to-purple-900',
  },
  { 
    id: 24, 
    name: 'FA Cup', 
    // TODO: Replace fallback emoji with better fallback (e.g., text initials like 'FA')
    fallbackIcon: '🏅',
    imagePath: 'https://cdn.sportmonks.com/images/soccer/leagues/24/24.png',
    // Gradient colors for selector button (matches Competitions page)
    gradientFrom: 'from-red-600',
    gradientTo: 'to-red-800',
    hoverFrom: 'hover:from-red-700',
    hoverTo: 'hover:to-red-900',
  },
  { 
    id: 27, 
    name: 'Carabao Cup', 
    // TODO: Replace fallback emoji with better fallback (e.g., text initials like 'CC')
    fallbackIcon: '🥤',
    imagePath: 'https://cdn.sportmonks.com/images/soccer/leagues/27/27.png',
    // Gradient colors for selector button (matches Competitions page)
    gradientFrom: 'from-green-600',
    gradientTo: 'to-green-800',
    hoverFrom: 'hover:from-green-700',
    hoverTo: 'hover:to-green-900',
  },
];

// Type IDs from the API response
// These correspond to different metrics SportsMonks provides
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
// RANDOM CHANCE BY MARKET
// ============================================
// This is the probability of guessing correctly by pure chance.
// It depends on how many possible outcomes each market has.
//
// Formula: Random Chance = 1 / Number of Outcomes
// ============================================

const RANDOM_CHANCE = {
  // 3 outcomes: Home Win, Draw, Away Win → 1/3 = 33.3%
  fulltime_result: 0.333,
  
  // 2 outcomes: Yes or No → 1/2 = 50%
  both_teams_to_score: 0.50,
  
  // 2 outcomes: Over or Under → 1/2 = 50%
  over_under_1_5: 0.50,
  over_under_2_5: 0.50,
  over_under_3_5: 0.50,
  home_over_under_0_5: 0.50,
  home_over_under_1_5: 0.50,
  away_over_under_0_5: 0.50,
  away_over_under_1_5: 0.50,
  
  // ~20+ possible scorelines (0-0, 1-0, 0-1, 1-1, 2-0, 2-1, etc.) → ~5%
  correct_score: 0.05,
  
  // 9 outcomes: HH, HD, HA, DH, DD, DA, AH, AD, AA → 1/9 = 11.1%
  ht_ft: 0.111,
  
  // 3 outcomes: Home First, Away First, No Goals → 1/3 = 33.3%
  team_to_score_first: 0.333,
  
  // 3 outcomes: Home Win, Draw, Away Win (at half time) → 1/3 = 33.3%
  fulltime_result_1st_half: 0.333,
};

// Order markets by category for better display
const MARKET_ORDER = [
  // Main markets
  'fulltime_result',
  'both_teams_to_score',
  // Goals markets
  'over_under_1_5',
  'over_under_2_5',
  'over_under_3_5',
  // Team-specific goals
  'home_over_under_0_5',
  'home_over_under_1_5',
  'away_over_under_0_5',
  'away_over_under_1_5',
  // Other markets
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
 * high = green, good = blue, medium = yellow, poor = red
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
 * up = green ↑, down = red ↓, unchanged = gray →
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
 * Accuracy Bar - Shows accuracy as a percentage with visual progress bar
 */
const AccuracyBar = ({ accuracy }) => {
  const percent = Math.round(accuracy * 100);
  
  // Color based on raw accuracy (for visual reference)
  let barColor = 'bg-gray-400';
  if (percent >= 70) {
    barColor = 'bg-green-500';
  } else if (percent >= 50) {
    barColor = 'bg-blue-500';
  } else if (percent >= 30) {
    barColor = 'bg-yellow-500';
  }
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold w-12 text-right">{percent}%</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Edge Badge - Shows edge over random chance
 * This is the KEY metric that determines the rating!
 */
const EdgeBadge = ({ edge }) => {
  // Edge is in percentage points (e.g., +15 means 15% better than random)
  const edgePercent = Math.round(edge * 100);
  
  // Color based on edge value
  let colorClass = 'bg-red-100 text-red-700';      // Poor edge (< 5%)
  if (edgePercent >= 15) {
    colorClass = 'bg-green-100 text-green-700';     // Excellent edge (15%+)
  } else if (edgePercent >= 10) {
    colorClass = 'bg-blue-100 text-blue-700';       // Good edge (10-14%)
  } else if (edgePercent >= 5) {
    colorClass = 'bg-yellow-100 text-yellow-700';   // Medium edge (5-9%)
  }
  
  // Format with + sign for positive values
  const formatted = edgePercent >= 0 ? `+${edgePercent}%` : `${edgePercent}%`;
  
  return (
    <span className={`px-2 py-1 text-xs font-bold rounded ${colorClass}`}>
      {formatted}
    </span>
  );
};

/**
 * Sortable Header - Clickable column header with sort indicator
 * Shows ▲ or ▼ arrow when actively sorted
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
 * Expandable Section - Click to expand/collapse content
 * Used in the "AI Predictions: How it Works" explanation
 */
const ExpandableSection = ({ title, isExpanded, onToggle, children }) => {
  return (
    <div className="border border-blue-200 rounded-lg overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-white/70 hover:bg-white/90 flex items-center justify-between text-left transition-colors"
      >
        <span className="font-medium text-blue-800">{title}</span>
        <span className="text-blue-600 text-lg">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-4 py-3 bg-white/50 border-t border-blue-200">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Competition Logo - Displays official SportsMonks league logo with emoji fallback
 * 
 * Uses the SportsMonks CDN image URL stored in the competition object.
 * If the image fails to load (network error, 404, etc.), falls back to emoji.
 * 
 * @param {Object} competition - Competition object with imagePath and fallbackIcon
 * @param {string} size - 'sm' (24px) for buttons, 'md' (32px) for headers
 * @param {boolean} withBackground - If true, wraps logo in white circular background (matches Competitions page)
 */
const CompetitionLogo = ({ competition, size = 'md', withBackground = false }) => {
  // Track whether the image failed to load
  const [imageError, setImageError] = useState(false);
  
  // Size classes for the logo image itself
  // sm = selector buttons, md = section headers
  const imageSizeClasses = {
    sm: 'w-6 h-6',   // 24px - compact, for selector buttons
    md: 'w-8 h-8',   // 32px - prominent, for headers
  };
  
  // Size classes for the white circular background container
  // Slightly larger than the image to provide padding
  const containerSizeClasses = {
    sm: 'w-8 h-8',   // 32px container for 24px image
    md: 'w-10 h-10', // 40px container for 32px image
  };
  
  const imageClass = imageSizeClasses[size] || imageSizeClasses.md;
  const containerClass = containerSizeClasses[size] || containerSizeClasses.md;
  
  // Build the logo element (either image or fallback emoji)
  let logoElement;
  
  if (imageError || !competition.imagePath) {
    // Fallback: show emoji
    logoElement = <span className="text-xl">{competition.fallbackIcon}</span>;
  } else {
    // Primary: show SportsMonks CDN image
    logoElement = (
      <img
        src={competition.imagePath}
        alt={`${competition.name} logo`}
        className={`${imageClass} object-contain`}
        // If image fails to load, trigger fallback
        onError={() => setImageError(true)}
      />
    );
  }
  
  // If withBackground is true, wrap in white circular container
  // This matches the style used on the Competitions page
  if (withBackground) {
    return (
      <div className={`${containerClass} bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1`}>
        {logoElement}
      </div>
    );
  }
  
  // Without background, just return the logo element
  return logoElement;
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
  
  // Sorting state for main accuracy table
  // sortColumn: which column to sort by ('accuracy', 'edge', 'rating', 'trend', or null for default)
  // sortDirection: 'asc' (ascending) or 'desc' (descending)
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Sorting state for log loss comparison table (separate from main table)
  const [logLossSortColumn, setLogLossSortColumn] = useState(null);
  const [logLossSortDirection, setLogLossSortDirection] = useState('desc');
  
  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    logLossComparison: false,  // For the log loss comparison table
  });

  // ============================================
  // FETCH DATA WHEN COMPETITION CHANGES
  // ============================================
  
  useEffect(() => {
    // Reset sort when competition changes (both tables)
    setSortColumn(null);
    setSortDirection('desc');
    setLogLossSortColumn(null);
    setLogLossSortDirection('desc');
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
  
  // Note: getCompetitionIcon was removed - now using CompetitionLogo component instead
  
  // Calculate edge over random chance
  const calculateEdge = (marketKey, accuracy) => {
    const randomChance = RANDOM_CHANCE[marketKey] || 0.5;
    return accuracy - randomChance;
  };
  
  // Calculate how much better the model's log loss is vs historical benchmark
  // Lower log loss = better, so we calculate: (|historical| - |model|) / |historical| * 100
  // Returns a percentage (e.g., 10.5 means "10.5% better than historical")
  const calculateLogLossImprovement = (marketKey) => {
    if (!historicalLogLoss || !modelLogLoss) return null;
    const historical = historicalLogLoss[marketKey];
    const model = modelLogLoss[marketKey];
    if (historical === undefined || model === undefined) return null;
    
    // Both values are negative (log loss). Less negative = better.
    // Improvement = how much closer to 0 the model is vs historical
    const improvement = (Math.abs(historical) - Math.abs(model)) / Math.abs(historical) * 100;
    return improvement;
  };
  
  // ============================================
  // SORTING LOGIC
  // ============================================
  
  // Toggle expandable section (for AI Predictions explanation)
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };
  
  // Handle column header click - toggle sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Same column clicked - toggle direction
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column clicked - set to descending (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };
  
  // Handle column header click for log loss table - toggle sort
  const handleLogLossSort = (column) => {
    if (logLossSortColumn === column) {
      // Same column clicked - toggle direction
      setLogLossSortDirection(logLossSortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column clicked - set to descending (highest first)
      setLogLossSortColumn(column);
      setLogLossSortDirection('desc');
    }
  };
  
  // Convert rating string to number for sorting
  // high = 4, good = 3, medium = 2, poor = 1
  const ratingToNumber = (rating) => {
    const values = { high: 4, good: 3, medium: 2, poor: 1 };
    return values[rating] || 0;
  };
  
  // Convert trend string to number for sorting
  // up = 3, unchanged = 2, down = 1
  const trendToNumber = (trend) => {
    const values = { up: 3, unchanged: 2, down: 1 };
    return values[trend] || 0;
  };
  
  // Get sorted market keys based on current sort settings
  const getSortedMarkets = () => {
    // If no sort column selected, return default order
    if (!sortColumn || !accuracyData) return MARKET_ORDER;
    
    // Create a copy to sort
    const sortable = [...MARKET_ORDER].filter(key => accuracyData[key] !== undefined);
    
    sortable.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'accuracy':
          aValue = accuracyData[a] || 0;
          bValue = accuracyData[b] || 0;
          break;
        case 'edge':
          aValue = calculateEdge(a, accuracyData[a] || 0);
          bValue = calculateEdge(b, accuracyData[b] || 0);
          break;
        case 'rating':
          aValue = ratingToNumber(ratingData?.[a]);
          bValue = ratingToNumber(ratingData?.[b]);
          break;
        case 'trend':
          aValue = trendToNumber(trendData?.[a]);
          bValue = trendToNumber(trendData?.[b]);
          break;
        default:
          return 0;
      }
      
      // Sort based on direction
      if (sortDirection === 'desc') {
        return bValue - aValue; // Highest first
      } else {
        return aValue - bValue; // Lowest first
      }
    });
    
    return sortable;
  };
  
  // Get sorted market keys for log loss table based on current sort settings
  const getSortedLogLossMarkets = () => {
    // Only include markets that have both historical and model log loss data
    const validMarkets = MARKET_ORDER.filter(key => 
      historicalLogLoss?.[key] !== undefined && modelLogLoss?.[key] !== undefined
    );
    
    // If no sort column selected, return default order
    if (!logLossSortColumn) return validMarkets;
    
    // Create a copy to sort
    const sortable = [...validMarkets];
    
    sortable.sort((a, b) => {
      let aValue, bValue;
      
      switch (logLossSortColumn) {
        case 'historical':
          // Log loss values are negative, more negative = worse
          aValue = historicalLogLoss[a] || 0;
          bValue = historicalLogLoss[b] || 0;
          break;
        case 'model':
          // Log loss values are negative, more negative = worse
          aValue = modelLogLoss[a] || 0;
          bValue = modelLogLoss[b] || 0;
          break;
        case 'improvement':
          aValue = calculateLogLossImprovement(a) || 0;
          bValue = calculateLogLossImprovement(b) || 0;
          break;
        case 'rating':
          aValue = ratingToNumber(ratingData?.[a]);
          bValue = ratingToNumber(ratingData?.[b]);
          break;
        default:
          return 0;
      }
      
      // Sort based on direction
      if (logLossSortDirection === 'desc') {
        return bValue - aValue; // Highest first
      } else {
        return aValue - bValue; // Lowest first
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
        {/* Page Title */}
        <h1 className="text-2xl font-bold text-gray-900">Prediction Model Performance</h1>
        
        {/* Subtitle - brief one-liner about what this page shows */}
        <p className="text-sm text-gray-500 mt-1 font-semibold">
          See how accurate the AI Predictions Model is for each competition.
        </p>
        
        {/* Intro Paragraph - explains the purpose and what users will find */}
        <p className="text-sm text-gray-600 mt-3 max-w-3xl">
          The performance of our AI Prediction Model is continuously monitored by tracking 
          historical outcomes and objective quality metrics.
        </p>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          On this page, we share prediction history and performance data so you can evaluate 
          the Model's accuracy and consistency by leagues and competitions.
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
            // Check if this competition is currently selected
            const isSelected = selectedLeagueId === competition.id;
            
            return (
              <button
                key={competition.id}
                onClick={() => setSelectedLeagueId(competition.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200
                  bg-gradient-to-r ${competition.gradientFrom} ${competition.gradientTo} 
                  ${competition.hoverFrom} ${competition.hoverTo}
                  text-white shadow-md hover:shadow-lg
                  ${
                    isSelected
                      // Selected: add ring to indicate active state
                      ? 'ring-2 ring-offset-2 ring-gray-400'
                      // Not selected: slightly more transparent
                      : 'opacity-90 hover:opacity-100'
                  }`}
              >
                {/* Official SportsMonks league logo in white circular background */}
                <CompetitionLogo 
                  competition={competition} 
                  size="sm" 
                  withBackground={true}  // Always show white bg for consistency
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
      {/* DATA DISPLAY */}
      {/* ============================================ */}
      {!loading && !error && accuracyData && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 text-white px-6 py-4">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              {/* Official SportsMonks league logo in white circular background */}
              <CompetitionLogo 
                competition={COMPETITIONS.find(c => c.id === selectedLeagueId)} 
                size="md" 
                withBackground={true}  // White bg for visibility on dark header
              />
              {getCompetitionName(selectedLeagueId)} - Model Accuracy
            </h2>
          </div>
          
          {/* Legend */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Trend:</span>
                <span className="flex items-center gap-1"><TrendArrow trend="up" /> Improving</span>
                <span className="flex items-center gap-1"><TrendArrow trend="down" /> Declining</span>
                <span className="flex items-center gap-1"><TrendArrow trend="unchanged" /> Stable</span>
              </div>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Market
                  </th>
                  <SortableHeader
                    label="Model Accuracy"
                    column="accuracy"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-left w-48"
                  />
                  <SortableHeader
                    label="Rating"
                    column="rating"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-20"
                  />
                  <SortableHeader
                    label="Trend"
                    column="trend"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-16"
                  />
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                    Random
                  </th>
                  <SortableHeader
                    label="Edge"
                    column="edge"
                    currentSort={sortColumn}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="text-center w-24"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getSortedMarkets().map((marketKey) => {
                  // Skip if no data for this market
                  if (accuracyData[marketKey] === undefined) return null;
                  
                  const accuracy = accuracyData[marketKey];
                  const randomChance = RANDOM_CHANCE[marketKey] || 0.5;
                  const edge = calculateEdge(marketKey, accuracy);
                  
                  return (
                    <tr key={marketKey} className="hover:bg-gray-50 transition-colors">
                      {/* Market Name */}
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900">
                          {MARKET_LABELS[marketKey] || marketKey}
                        </span>
                      </td>
                      
                      {/* Accuracy Bar */}
                      <td className="px-4 py-4">
                        <AccuracyBar accuracy={accuracy} />
                      </td>
                      
                      {/* Rating Badge */}
                      <td className="px-4 py-4 text-center">
                        {ratingData && ratingData[marketKey] && (
                          <RatingBadge rating={ratingData[marketKey]} />
                        )}
                      </td>
                      
                      {/* Trend Arrow */}
                      <td className="px-4 py-4 text-center text-xl">
                        {trendData && trendData[marketKey] && (
                          <TrendArrow trend={trendData[marketKey]} />
                        )}
                      </td>
                      
                      {/* Random Chance */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-500">
                          {Math.round(randomChance * 100)}%
                        </span>
                      </td>
                      
                      {/* Edge over Random */}
                      <td className="px-4 py-4 text-center">
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
      {/* EVALUATING MODEL PERFORMANCE CARD */}
      {/* ============================================ */}
      {!loading && !error && accuracyData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📊 Understanding SportsMonks AI Predictions</h3>
          <div className="text-sm text-blue-800 space-y-3">
            
            {/* The four metrics explained */}
            <div className="bg-white/50 rounded p-3">
              <p className="font-medium mb-2">SportsMonks provides four key metrics:</p>
              <ul className="list-disc list-inside space-y-2 text-blue-700">
                <li>
                  <strong>Hit Ratio (Accuracy)</strong> — The percentage of correct predictions over the last 100 matches. 
                  Random guessing would score ~33% for match results.
                </li>
                <li>
                  <strong>Log Loss</strong> — Measures prediction confidence and accuracy. 
                  The closer to 0, the better. Random prediction scores about -1.09.
                </li>
                <li>
                  <strong>Rating</strong> — A simple word rating (poor/medium/good/high) based on how well the model's 
                  log loss compares to a historical benchmark.
                </li>
                <li>
                  <strong>Trend</strong> — Shows if the model's log loss has improved (↑), declined (↓), or stayed 
                  the same (→) over the last 50 matches.
                </li>
              </ul>
            </div>
            
            {/* Rating thresholds */}
            <div className="bg-white/50 rounded p-3">
              <p className="font-medium mb-2">Rating thresholds (for Match Result market):</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><strong>High</strong> — Log loss better than -0.98</li>
                <li><strong>Good</strong> — Log loss better than -1.02</li>
                <li><strong>Medium</strong> — Log loss between -1.07 and -1.02</li>
                <li><strong>Poor</strong> — Log loss worse than -1.07 (close to random's -1.09)</li>
              </ul>
              <p className="text-blue-600 text-xs mt-2 italic">
                Note: Thresholds may vary slightly for different markets.
              </p>
            </div>
            
            {/* Callout: Why doesn't higher accuracy mean better rating */}
            <div className="bg-yellow-100 border-l-4 border-yellow-500 rounded p-3 flex gap-3">
              <span className="text-yellow-600 text-xl">⭐</span>
              <div>
                <p className="font-semibold text-yellow-800 mb-1">
                  Why doesn't higher accuracy always mean a better rating?
                </p>
                <p className="text-yellow-700 text-sm">
                  The rating is based on <strong>log loss</strong>, not hit ratio. Log loss measures how confident 
                  and well-calibrated the predictions are, not just whether they're right or wrong. A model that's 
                  60% accurate but very confident when wrong will have worse log loss than one that's 55% accurate 
                  but appropriately uncertain.
                </p>
              </div>
            </div>
            
            {/* Expandable Log Loss Comparison */}
            {historicalLogLoss && modelLogLoss && (
              <div className="mt-3">
                <ExpandableSection
                  title="View Log Loss Comparison Data"
                  isExpanded={expandedSections.logLossComparison}
                  onToggle={() => toggleSection('logLossComparison')}
                >
                  <p className="text-blue-700 text-xs mb-3">
                    <strong>Historical Log Loss</strong> is the benchmark — what you'd expect from predictions based purely on 
                    historical averages. <strong>Model Log Loss</strong> is the AI's actual performance. 
                    Lower values (closer to 0) = better predictions.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-blue-200">
                          {/* Market column - not sortable */}
                          <th className="text-left py-2 pr-2 text-blue-800">Market</th>
                          
                          {/* Historical - sortable */}
                          <th 
                            onClick={() => handleLogLossSort('historical')}
                            className="text-right py-2 px-2 text-blue-800 cursor-pointer hover:bg-blue-100/50 transition-colors select-none"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>Historical</span>
                              <span className="text-blue-400">
                                {logLossSortColumn === 'historical' ? (
                                  logLossSortDirection === 'desc' ? '▼' : '▲'
                                ) : (
                                  <span className="opacity-30">▼</span>
                                )}
                              </span>
                            </div>
                          </th>
                          
                          {/* Model - sortable */}
                          <th 
                            onClick={() => handleLogLossSort('model')}
                            className="text-right py-2 px-2 text-blue-800 cursor-pointer hover:bg-blue-100/50 transition-colors select-none"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>Model</span>
                              <span className="text-blue-400">
                                {logLossSortColumn === 'model' ? (
                                  logLossSortDirection === 'desc' ? '▼' : '▲'
                                ) : (
                                  <span className="opacity-30">▼</span>
                                )}
                              </span>
                            </div>
                          </th>
                          
                          {/* Improvement - sortable */}
                          <th 
                            onClick={() => handleLogLossSort('improvement')}
                            className="text-right py-2 px-2 text-blue-800 cursor-pointer hover:bg-blue-100/50 transition-colors select-none"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>Improvement</span>
                              <span className="text-blue-400">
                                {logLossSortColumn === 'improvement' ? (
                                  logLossSortDirection === 'desc' ? '▼' : '▲'
                                ) : (
                                  <span className="opacity-30">▼</span>
                                )}
                              </span>
                            </div>
                          </th>
                          
                          {/* Rating - sortable */}
                          <th 
                            onClick={() => handleLogLossSort('rating')}
                            className="text-center py-2 pl-2 text-blue-800 cursor-pointer hover:bg-blue-100/50 transition-colors select-none"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Rating</span>
                              <span className="text-blue-400">
                                {logLossSortColumn === 'rating' ? (
                                  logLossSortDirection === 'desc' ? '▼' : '▲'
                                ) : (
                                  <span className="opacity-30">▼</span>
                                )}
                              </span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100">
                        {getSortedLogLossMarkets().map((marketKey) => {
                          const historical = historicalLogLoss[marketKey];
                          const model = modelLogLoss[marketKey];
                          const improvement = calculateLogLossImprovement(marketKey);
                          const rating = ratingData?.[marketKey];
                          
                          return (
                            <tr key={marketKey} className="hover:bg-blue-50/50">
                              <td className="py-1.5 pr-2 text-blue-700">
                                {MARKET_LABELS[marketKey] || marketKey}
                              </td>
                              <td className="py-1.5 px-2 text-right text-blue-600 font-mono">
                                {historical.toFixed(4)}
                              </td>
                              <td className="py-1.5 px-2 text-right text-blue-600 font-mono">
                                {model.toFixed(4)}
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <span className={`font-semibold ${
                                  improvement > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {improvement >= 0 ? '+' : ''}{improvement?.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-1.5 pl-2 text-center">
                                {rating && <RatingBadge rating={rating} />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-blue-600 text-xs mt-3 italic">
                    Note: Improvement shows how much better (closer to 0) the model's log loss is compared to the historical benchmark.
                  </p>
                </ExpandableSection>
              </div>
            )}
            
            <p className="text-blue-600 text-xs mt-2">
              Source: <a href="https://docs.sportmonks.com/football/endpoints-and-entities/endpoints/predictability/get-predictability-by-league-id" 
                target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">
                SportsMonks Predictability API Documentation
              </a>
            </p>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* RANDOM AND EDGE EXPLANATION CARD */}
      {/* ============================================ */}
      {!loading && !error && accuracyData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">🎯 Understanding "Random" and "Edge"</h3>
          <div className="text-sm text-blue-800 space-y-3">
            <p>
              The <strong>Random</strong> and <strong>Edge</strong> columns are our own calculations (not from SportsMonks) 
              to help you understand the model's value:
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>
                <strong>Random</strong> — The probability of guessing correctly by pure chance 
                (e.g., 33% for a 3-way market like Match Result).
              </li>
              <li>
                <strong>Edge</strong> — Model Accuracy minus Random Chance. A +14% edge means the model is 
                14 percentage points more likely to be correct than random guessing.
              </li>
            </ul>
            <p className="text-blue-600 text-xs mt-2 bg-white/50 rounded p-2">
              <strong>Note:</strong> Edge measures improvement over random chance, while SportsMonks' Rating 
              measures log loss performance against a historical benchmark. These are different comparisons!
            </p>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* NO DATA STATE */}
      {/* ============================================ */}
      {!loading && !error && !accuracyData && (
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
