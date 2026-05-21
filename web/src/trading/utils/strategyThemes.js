/**
 * Strategy Color Theming System
 * Single source of truth for strategy-specific colors across the app.
 */

// Strategy → theme key mapping (lowercase strategy name → theme key)
const STRATEGY_THEME_MAP = {
  'bull call spread': 'bull-call',
  'bull put spread': 'bull-put',
  'iron condor': 'iron-condor',
  'covered call': 'covered-call',
  'covered call protective put': 'covered-call',
  'bear put spread': 'bear-put',
  'bear call spread': 'bear-put',
  'straddle': 'iron-condor',
  'strangle': 'iron-condor',
  'butterfly': 'butterfly',
  'calendar spread': 'calendar',
  'calendar': 'calendar',
  'single calendar': 'calendar',
  'double calendar': 'calendar',
  'diagonal spread': 'diagonal',
  'diagonal': 'diagonal',
  'single diagonal': 'diagonal',
  'double diagonal': 'diagonal',
  'collar': 'collar',
  'protective put': 'covered-call',
  'jade lizard': 'bull-put',
  'big lizard': 'bear-put',
  'ratio spread': 'bull-put',
  'credit spread': 'iron-condor',
  'debit spread': 'bull-call',
};

// Theme key → color definitions
export const STRATEGY_THEMES = {
  'bull-call': {
    key: 'bull-call',
    label: 'Bullish',
    primary: '#2563eb',
    light: '#eff6ff',
    dark: '#1d4ed8',
    gradient: ['#2563eb', '#60a5fa'],
    css: 'theme-bull-call',
  },
  'bull-put': {
    key: 'bull-put',
    label: 'Bullish',
    primary: '#7c3aed',
    light: '#f5f3ff',
    dark: '#6d28d9',
    gradient: ['#7c3aed', '#a78bfa'],
    css: 'theme-bull-put',
  },
  'iron-condor': {
    key: 'iron-condor',
    label: 'Neutral',
    primary: '#ea580c',
    light: '#fff7ed',
    dark: '#c2410c',
    gradient: ['#ea580c', '#fb923c'],
    css: 'theme-iron-condor',
  },
  'covered-call': {
    key: 'covered-call',
    label: 'Income',
    primary: '#0891b2',
    light: '#ecfeff',
    dark: '#0e7490',
    gradient: ['#0891b2', '#22d3ee'],
    css: 'theme-covered-call',
  },
  'bear-put': {
    key: 'bear-put',
    label: 'Bearish',
    primary: '#e11d48',
    light: '#fff1f2',
    dark: '#be123c',
    gradient: ['#e11d48', '#fb7185'],
    css: 'theme-bear-put',
  },
  'calendar': {
    key: 'calendar',
    label: 'Time Decay',
    primary: '#9333ea',
    light: '#faf5ff',
    dark: '#7e22ce',
    gradient: ['#9333ea', '#c084fc'],
    css: 'theme-calendar',
  },
  'diagonal': {
    key: 'diagonal',
    label: 'Time + Direction',
    primary: '#059669',
    light: '#ecfdf5',
    dark: '#047857',
    gradient: ['#059669', '#34d399'],
    css: 'theme-diagonal',
  },
  'collar': {
    key: 'collar',
    label: 'Protective',
    primary: '#0891b2',
    light: '#ecfeff',
    dark: '#0e7490',
    gradient: ['#0891b2', '#22d3ee'],
    css: 'theme-collar',
  },
  'butterfly': {
    key: 'butterfly',
    label: 'Limited Risk',
    primary: '#db2777',
    light: '#fdf2f8',
    dark: '#be185d',
    gradient: ['#db2777', '#f472b6'],
    css: 'theme-butterfly',
  },
};

const DEFAULT_THEME = STRATEGY_THEMES['bull-call'];

/**
 * Get the theme object for a given strategy name
 * @param {string} strategy - e.g. "bull call spread", "iron_condor"
 * @returns {object} theme object with primary, light, dark, gradient, css
 */
export function getStrategyTheme(strategy) {
  if (!strategy) return DEFAULT_THEME;
  const normalised = strategy.toLowerCase().replace(/_/g, ' ');
  const key = STRATEGY_THEME_MAP[normalised];
  return key ? STRATEGY_THEMES[key] : DEFAULT_THEME;
}

/**
 * Get the CSS class name for a given strategy
 * @param {string} strategy
 * @returns {string} e.g. "theme-bull-call"
 */
export function getThemeClass(strategy) {
  return getStrategyTheme(strategy).css;
}

/**
 * Get the primary hex color for a given strategy
 * @param {string} strategy
 * @returns {string} e.g. "#2563eb"
 */
export function getStrategyColor(strategy) {
  return getStrategyTheme(strategy).primary;
}

/**
 * Color map keyed by raw strategy names (with underscores) for charts/pies.
 * Covers common DB-stored strategy names.
 */
export const STRATEGY_COLOR_MAP = {
  'iron_condor': STRATEGY_THEMES['iron-condor'].primary,
  'iron condor': STRATEGY_THEMES['iron-condor'].primary,
  'bull_call_spread': STRATEGY_THEMES['bull-call'].primary,
  'bull call spread': STRATEGY_THEMES['bull-call'].primary,
  'bull_put_spread': STRATEGY_THEMES['bull-put'].primary,
  'bull put spread': STRATEGY_THEMES['bull-put'].primary,
  'bear_put_spread': STRATEGY_THEMES['bear-put'].primary,
  'bear put spread': STRATEGY_THEMES['bear-put'].primary,
  'bear_call_spread': STRATEGY_THEMES['bear-put'].primary,
  'covered_call': STRATEGY_THEMES['covered-call'].primary,
  'covered call': STRATEGY_THEMES['covered-call'].primary,
  'covered_call_protective_put': STRATEGY_THEMES['covered-call'].primary,
  'protective_put': STRATEGY_THEMES['covered-call'].primary,
  'collar': STRATEGY_THEMES['collar'].primary,
  'straddle': STRATEGY_THEMES['iron-condor'].primary,
  'strangle': STRATEGY_THEMES['iron-condor'].primary,
  'butterfly': STRATEGY_THEMES['butterfly'].primary,
  'calendar': STRATEGY_THEMES['calendar'].primary,
  'calendar_spread': STRATEGY_THEMES['calendar'].primary,
  'single_calendar': STRATEGY_THEMES['calendar'].primary,
  'double_calendar': STRATEGY_THEMES['calendar'].primary,
  'diagonal': STRATEGY_THEMES['diagonal'].primary,
  'diagonal_spread': STRATEGY_THEMES['diagonal'].primary,
  'single_diagonal': STRATEGY_THEMES['diagonal'].primary,
  'double_diagonal': STRATEGY_THEMES['diagonal'].primary,
  'credit_spread': STRATEGY_THEMES['iron-condor'].primary,
  'debit_spread': STRATEGY_THEMES['bull-call'].primary,
  'jade_lizard': STRATEGY_THEMES['bull-put'].primary,
  'big_lizard': STRATEGY_THEMES['bear-put'].primary,
  'ratio_spread': STRATEGY_THEMES['bull-put'].primary,
};

/**
 * Get chart color for a strategy (for recharts Cell fill, etc.)
 * Falls back gracefully for unknown strategies.
 */
export function getChartColor(strategyName) {
  if (!strategyName) return '#6b7280';
  const normalised = strategyName.toLowerCase().replace(/ /g, '_');
  return STRATEGY_COLOR_MAP[normalised] || STRATEGY_COLOR_MAP[strategyName] || getStrategyColor(strategyName);
}
