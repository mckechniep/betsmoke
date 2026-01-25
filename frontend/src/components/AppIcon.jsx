// ============================================
// APP ICON COMPONENT
// ============================================
// Centralized icon component that:
// - Maps semantic names to Iconify icons
// - Handles light/dark theme colors
// - Provides consistent sizing
// - Makes it easy to swap icons later
//
// Usage:
//   <AppIcon name="corner-flag" />
//   <AppIcon name="stadium" size="lg" />
//   <AppIcon name="substitution" className="text-green-500" />
// ============================================

import { Icon } from '@iconify/react';

// ============================================
// ICON MAPPING
// ============================================
// Maps semantic names to Iconify icon identifiers.
// Browse icons at: https://icon-sets.iconify.design/
//
// To add a new icon:
// 1. Find the icon at icon-sets.iconify.design
// 2. Add it here with a semantic name
// 3. Use it: <AppIcon name="your-name" />
const ICONS = {
  // Sports / Match
  'corner-flag': 'game-icons:corner-flag',
  'soccer-ball': 'mdi:soccer',
  'soccer-field': 'mdi:soccer-field',
  'stadium': 'mdi:stadium',
  'whistle': 'game-icons:whistle',
  'goal': 'mdi:goal',

  // Cards
  'yellow-card': 'mdi:card',
  'red-card': 'mdi:card',
  'card': 'mdi:card-outline',

  // Player actions
  'substitution': 'mdi:swap-vertical',
  'substitution-in': 'mdi:arrow-up-bold',
  'substitution-out': 'mdi:arrow-down-bold',
  'injury': 'mdi:bandage',

  // Team / Players
  'team': 'mdi:shield-outline',
  'player': 'mdi:account',
  'players': 'mdi:account-group',
  'formation': 'mdi:strategy',
  'jersey': 'mdi:tshirt-crew',

  // Stats
  'stats': 'mdi:chart-bar',
  'trophy': 'mdi:trophy',
  'medal': 'mdi:medal',
  'ranking': 'mdi:podium',

  // Match info
  'clock': 'mdi:clock-outline',
  'calendar': 'mdi:calendar',
  'location': 'mdi:map-marker',
  'venue': 'mdi:stadium-variant',

  // Weather
  'weather-sunny': 'mdi:weather-sunny',
  'weather-cloudy': 'mdi:weather-cloudy',
  'weather-rainy': 'mdi:weather-rainy',
  'weather-snowy': 'mdi:weather-snowy',
  'temperature': 'mdi:thermometer',

  // UI / Actions
  'search': 'mdi:magnify',
  'filter': 'mdi:filter-variant',
  'sort': 'mdi:sort',
  'settings': 'mdi:cog',
  'close': 'mdi:close',
  'menu': 'mdi:menu',
  'chevron-down': 'mdi:chevron-down',
  'chevron-up': 'mdi:chevron-up',
  'chevron-left': 'mdi:chevron-left',
  'chevron-right': 'mdi:chevron-right',
  'arrow-left': 'mdi:arrow-left',
  'arrow-right': 'mdi:arrow-right',
  'refresh': 'mdi:refresh',
  'info': 'mdi:information-outline',
  'warning': 'mdi:alert-outline',
  'error': 'mdi:alert-circle-outline',
  'success': 'mdi:check-circle-outline',

  // Theme
  'sun': 'mdi:weather-sunny',
  'moon': 'mdi:weather-night',

  // Betting / Odds
  'odds': 'mdi:chart-timeline-variant',
  'bookmaker': 'mdi:book-open-variant',
  'money': 'mdi:currency-usd',
  'trend-up': 'mdi:trending-up',
  'trend-down': 'mdi:trending-down',
};

// ============================================
// SIZE PRESETS
// ============================================
const SIZES = {
  xs: 'w-3 h-3',   // 12px
  sm: 'w-4 h-4',   // 16px
  md: 'w-5 h-5',   // 20px
  lg: 'w-6 h-6',   // 24px
  xl: 'w-8 h-8',   // 32px
  '2xl': 'w-10 h-10', // 40px
  '3xl': 'w-12 h-12', // 48px
};

// ============================================
// DEFAULT THEME COLORS
// ============================================
// These are applied when no custom className with text color is provided.
// Uses Tailwind's dark: variant for automatic theme switching.
const DEFAULT_COLOR = 'text-gray-600 dark:text-gray-300';

// ============================================
// APP ICON COMPONENT
// ============================================
const AppIcon = ({
  name,
  size = 'md',
  className = '',
  ...props
}) => {
  // Get the Iconify icon identifier
  const iconName = ICONS[name];

  // Warn if icon not found (development aid)
  if (!iconName) {
    console.warn(`[AppIcon] Unknown icon name: "${name}". Add it to ICONS mapping.`);
    return <span className="text-red-500">?</span>;
  }

  // Get size classes
  const sizeClasses = SIZES[size] || SIZES.md;

  // Check if className includes a text color (to avoid overriding custom colors)
  const hasCustomColor = className.includes('text-');

  // Build final className
  const finalClassName = [
    sizeClasses,
    hasCustomColor ? '' : DEFAULT_COLOR,
    className
  ].filter(Boolean).join(' ');

  return (
    <Icon
      icon={iconName}
      className={finalClassName}
      {...props}
    />
  );
};

// ============================================
// EXPORTS
// ============================================
export default AppIcon;

// Export the icon mapping for reference
export { ICONS, SIZES };
