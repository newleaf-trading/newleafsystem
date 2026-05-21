/**
 * navConfig.js — Centralised navigation configuration
 *
 * Consumed by BrandBar (React) and referenced when updating
 * nav-component.html (Workbench static pages).
 *
 * NavItem types:
 *   { kind: 'link',     label, href }
 *   { kind: 'dropdown', label, items, dark? }
 *
 * DropdownItem types:
 *   { label, href }                  — regular link
 *   { label, href, accent: true }    — accented / highlighted link
 *   { divider: true }                — horizontal rule
 *   { heading: string }              — category heading (non-clickable)
 */

// ─── Shared dropdown item lists ──────────────────────────────

export const HOW_IT_WORKS_ITEMS = [
  { label: 'How we pick trades', href: '/how-we-pick' },
  { label: 'Why we recommend them', href: '/how-we-recommend' },
  { label: 'How we manage them', href: '/how-we-manage' },
  { label: 'Track record', href: '/track-record' },
  { divider: true },
  { label: 'Scoring algorithm', href: '/how-we-score' },
  { label: 'Probability engine', href: '/probability-engine' },
  { label: 'Strategy selection', href: '/strategy-selection' },
  { label: 'Technical analysis', href: '/technical-analysis' },
  { label: 'Gamma wall analysis', href: '/gamma-analysis' },
  { label: 'AI sentiment analysis', href: '/ai-sentiment' },
  { label: 'NewLeaf Invest AI', href: '/ai-portfolio' },
  { divider: true },
  { label: 'Verification Desk', href: '/verification-desk' },
];

export const WORKBENCH_STRATEGIES = [
  { heading: 'Income Strategies' },
  { label: 'Cash-Secured Puts', href: '/workbench/sell-puts.html' },
  { label: 'The Wheel', href: '/workbench/wheel.html' },
  { label: 'Iron Condor', href: '/workbench/condor-scanner.html' },
  { label: 'Broken Wing Butterfly', href: '/workbench/broken-wing.html' },
  { divider: true },
  { heading: 'Spread Strategies' },
  { label: 'Bull Put Spread', href: '/workbench/bull-put.html' },
  { label: 'Bear Call Spread', href: '/workbench/bear-call.html' },
  { label: 'Bull Call Spread', href: '/workbench/bull-call.html' },
  { label: 'Bear Put Spread', href: '/workbench/bear-put.html' },
  { label: 'Calendar Spread', href: '/workbench/calendar.html' },
  { divider: true },
  { label: '\u2699 Strategy Builder \u2192', href: '/workbench/strategy-builder.html', accent: true },
];

// ─── Surface configuration ───────────────────────────────────

export const surfaceConfig = {
  root: {
    sections: [
      { kind: 'link', label: 'Picks', href: '/picks' },
      { kind: 'link', label: 'Workbench', href: '/workbench/' },
      { kind: 'link', label: 'Invest', href: '/invest' },
      { kind: 'link', label: 'Blog', href: '/blog' },
      { kind: 'dropdown', label: 'How it works', items: HOW_IT_WORKS_ITEMS, dark: true },
    ],
    showSwitcher: true,
    builderCta: true,
  },

  picks: {
    sections: [
      { kind: 'link', label: 'Picks', href: '/picks' },
      { kind: 'link', label: 'Performance', href: '/picks/recap' },
      { kind: 'dropdown', label: 'How it works', items: HOW_IT_WORKS_ITEMS, dark: true },
    ],
    showSwitcher: true,
  },

  workbench: {
    sections: [
      { kind: 'link', label: 'Hub', href: '/workbench/' },
      { kind: 'link', label: 'Scanner', href: '/workbench/all-stocks.html' },
      { kind: 'dropdown', label: 'Strategies', items: WORKBENCH_STRATEGIES, dark: true },
      { kind: 'link', label: 'Watchlist', href: '/workbench/watchlist.html' },
      { kind: 'link', label: 'Analysis', href: '/workbench/analysis' },
      { kind: 'link', label: 'Projection', href: '/workbench/projection.html' },
    ],
    showSwitcher: true,
    statusType: 'live',
  },

  invest: {
    sections: [
      { kind: 'link', label: 'Home', href: '/invest' },
      { kind: 'link', label: 'Discover', href: '/invest/discover' },
      { kind: 'link', label: 'Build', href: '/invest/build' },
      { kind: 'link', label: 'Positions', href: '/invest/positions' },
      { kind: 'link', label: 'Performance', href: '/invest/performance' },
    ],
    // Logged-out: cross-product links until marketing routes (Overview / Pricing) exist
    sectionsOut: [
      { kind: 'link', label: 'Picks', href: '/picks' },
      { kind: 'link', label: 'Workbench', href: '/workbench/' },
      { kind: 'link', label: 'Invest', href: '/invest' },
      { kind: 'dropdown', label: 'How it works', items: HOW_IT_WORKS_ITEMS, dark: true },
    ],
    showSwitcher: true,
    statusType: 'market',
  },
};

// ─── Product switcher entries ────────────────────────────────

export const switcherProducts = [
  { key: 'picks', label: 'Picks', description: 'Weekly trade recommendations', href: '/picks' },
  { key: 'workbench', label: 'Workbench', description: 'Strategy scanner & analysis', href: '/workbench/' },
  { key: 'invest', label: 'Invest', description: 'Portfolio management & execution', href: '/invest' },
  { key: 'quant', label: 'Quant', description: 'AI research & scoring engine', href: '/quant' },
  { key: 'desk', label: 'Desk', description: 'Execution & order management', href: '/desk' },
];
