// ============================================
// FORMATTERS - Centralized Formatting Utilities
// ============================================
// All display formatting functions that respect user preferences.
// Used across the app for consistent date, time, temperature, and odds display.
// ============================================

// ============================================
// PARSE UTC DATETIME
// ============================================
// SportsMonks returns times in UTC format: "2024-12-26 15:00:00"
// We need to explicitly tell JavaScript this is UTC for proper conversion.
export function parseUTCDateTime(dateString) {
  if (!dateString) return null;
  // "2024-12-26 15:00:00" -> "2024-12-26T15:00:00Z" (ISO format with Z = UTC)
  const isoString = dateString.replace(' ', 'T') + 'Z';
  return new Date(isoString);
}

// ============================================
// PARSE DATE STRING (without timezone shift)
// ============================================
// When JS parses "2024-12-26", it treats it as UTC midnight.
// In EST (UTC-5), that becomes Dec 25th at 7pm - wrong day!
// This function parses the date parts manually to avoid timezone issues.
export function parseDateString(dateString) {
  if (!dateString) return null;
  // Handle both "2024-12-26" and "2024-12-26 15:00:00" formats
  const datePart = dateString.split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  // Create date in LOCAL timezone (month is 0-indexed)
  return new Date(year, month - 1, day);
}

// ============================================
// FORMAT TIME (timezone-aware)
// ============================================
// Formats time in user's timezone with timezone abbreviation.
// Example: "7:30 PM ET" or "00:30 GMT"
export function formatTime(dateString, timezone = 'America/New_York') {
  const date = parseUTCDateTime(dateString);
  if (!date) return '';

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone
  });

  // Get timezone abbreviation
  const tzAbbr = getTimezoneAbbreviation(date, timezone);
  return `${timeStr} ${tzAbbr}`;
}

// ============================================
// FORMAT DATE (respects user preferences)
// ============================================
// Formats a full date with weekday.
// dateFormat: 'US' = "Friday, January 25, 2026"
// dateFormat: 'EU' = "Friday, 25 January 2026"
export function formatDate(dateString, timezone = 'America/New_York', dateFormat = 'US') {
  const date = parseUTCDateTime(dateString);
  if (!date) return '';

  // Use locale based on preference
  const locale = dateFormat === 'EU' ? 'en-GB' : 'en-US';

  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });
}

// ============================================
// FORMAT SHORT DATE (respects user preferences)
// ============================================
// Formats a short date for compact displays.
// dateFormat: 'US' = "Jan 25, 2026"
// dateFormat: 'EU' = "25 Jan 2026"
export function formatShortDate(dateString, timezone = 'America/New_York', dateFormat = 'US') {
  const date = parseUTCDateTime(dateString);
  if (!date) return '';

  const locale = dateFormat === 'EU' ? 'en-GB' : 'en-US';

  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone
  });
}

// ============================================
// FORMAT DATE ONLY (for date headers, no time conversion)
// ============================================
// Formats a date string without UTC conversion (for grouping headers).
// dateFormat: 'US' = "Friday, January 25, 2026"
// dateFormat: 'EU' = "Friday, 25 January 2026"
export function formatDateOnly(dateString, dateFormat = 'US') {
  const date = parseDateString(dateString);
  if (!date) return '';

  const locale = dateFormat === 'EU' ? 'en-GB' : 'en-US';

  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ============================================
// FORMAT SHORT DATE ONLY (for date headers, no time conversion)
// ============================================
// Formats a short date without UTC conversion.
export function formatShortDateOnly(dateString, dateFormat = 'US') {
  const date = parseDateString(dateString);
  if (!date) return '';

  const locale = dateFormat === 'EU' ? 'en-GB' : 'en-US';

  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// ============================================
// GET TIMEZONE DATE STRING
// ============================================
// Converts UTC datetime to user's timezone and returns YYYY-MM-DD format.
// Used for grouping fixtures by date in the user's timezone.
export function getTimezoneDateString(dateString, timezone = 'America/New_York') {
  const date = parseUTCDateTime(dateString);
  if (!date) return '';

  // Format as YYYY-MM-DD in user's timezone
  // en-CA gives YYYY-MM-DD format
  return date.toLocaleDateString('en-CA', {
    timeZone: timezone
  });
}

// ============================================
// FORMAT TEMPERATURE
// ============================================
// Converts and formats temperature based on user preference.
// SportsMonks provides temperature in Celsius.
// unit: 'FAHRENHEIT' = "72°F"
// unit: 'CELSIUS' = "22°C"
export function formatTemperature(celsiusValue, unit = 'FAHRENHEIT') {
  if (celsiusValue === null || celsiusValue === undefined) return '';

  if (unit === 'CELSIUS') {
    return `${Math.round(celsiusValue)}°C`;
  }

  // Convert Celsius to Fahrenheit
  const fahrenheit = Math.round((celsiusValue * 9 / 5) + 32);
  return `${fahrenheit}°F`;
}

// ============================================
// GET ODDS VALUE
// ============================================
// SportsMonks returns odds in all formats:
// - value (decimal): "1.78"
// - fractional: "39/50"
// - american: "+150" or "-110"
// This function returns the appropriate value based on user preference.
export function getOddsValue(odd, format = 'AMERICAN') {
  if (!odd) return null;

  switch (format) {
    case 'DECIMAL':
      return odd.value || odd.decimal || null;
    case 'FRACTIONAL':
      return odd.fractional || null;
    case 'AMERICAN':
    default:
      return odd.american || null;
  }
}

// ============================================
// FORMAT ODDS
// ============================================
// Formats odds value for display based on user preference.
// Handles null values and adds + sign for positive American odds.
// For fractional odds, adds "/1" when SportsMonks omits it.
export function formatOdds(odd, format = 'AMERICAN') {
  const value = getOddsValue(odd, format);
  if (value === null || value === undefined) return '-';

  // For American odds, ensure positive values have + sign
  if (format === 'AMERICAN') {
    const oddStr = String(value);
    const num = parseInt(oddStr);
    if (!isNaN(num) && num > 0 && !oddStr.startsWith('+')) {
      return `+${num}`;
    }
    return oddStr;
  }

  // For fractional odds, add "/1" if missing (SportsMonks omits it for whole numbers)
  if (format === 'FRACTIONAL') {
    const oddStr = String(value);
    // If it's just a number without a slash, add "/1"
    if (!oddStr.includes('/')) {
      return `${oddStr}/1`;
    }
    return oddStr;
  }

  // For decimal, return as-is
  return String(value);
}

// ============================================
// FORMAT AMERICAN ODDS
// ============================================
// Legacy helper for formatting American odds specifically.
// Ensures positive values have + sign.
export function formatAmericanOdds(americanOdd) {
  if (americanOdd === null || americanOdd === undefined) return '-';

  const oddStr = String(americanOdd);
  const num = parseInt(oddStr);
  if (isNaN(num)) return oddStr;

  if (num > 0 && !oddStr.startsWith('+')) {
    return `+${num}`;
  }

  return oddStr;
}

// ============================================
// GET ODDS FORMAT LABEL
// ============================================
// Returns a user-friendly label for the odds format.
export function getOddsFormatLabel(format) {
  switch (format) {
    case 'DECIMAL':
      return 'Decimal';
    case 'FRACTIONAL':
      return 'Fractional';
    case 'AMERICAN':
    default:
      return 'American';
  }
}

// ============================================
// HELPER: Get timezone abbreviation
// ============================================
// Returns the timezone abbreviation (e.g., "ET", "PT", "GMT")
function getTimezoneAbbreviation(date, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart?.value || '';
  } catch {
    // Fallback for unsupported timezones
    return '';
  }
}

// ============================================
// DEFAULT EXPORT: All formatters
// ============================================
export default {
  parseUTCDateTime,
  parseDateString,
  formatTime,
  formatDate,
  formatShortDate,
  formatDateOnly,
  formatShortDateOnly,
  getTimezoneDateString,
  formatTemperature,
  getOddsValue,
  formatOdds,
  formatAmericanOdds,
  getOddsFormatLabel
};
