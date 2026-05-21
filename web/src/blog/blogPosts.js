export const blogPosts = [
  {
    slug: 'iron-condor-strategy-explained',
    title: 'Iron Condor Strategy Explained: The Complete Beginner\'s Guide',
    description: 'Learn how the iron condor options strategy works, when to use it, how to set it up, and common mistakes to avoid. A complete guide for beginners.',
    date: '2026-05-06',
    readTime: '12 min',
    category: 'Strategies',
    tags: ['iron condor', 'options strategies', 'income trading', 'premium selling'],
    component: () => import('./posts/IronCondorGuide'),
  },
  {
    slug: 'options-greeks-explained',
    title: 'Options Greeks Explained: Delta, Gamma, Theta, and Vega Made Simple',
    description: 'Understand the four options Greeks and how they affect your trades. A plain-language guide to delta, gamma, theta, and vega for every options trader.',
    date: '2026-05-06',
    readTime: '14 min',
    category: 'Fundamentals',
    tags: ['options greeks', 'delta', 'gamma', 'theta', 'vega', 'options basics'],
    component: () => import('./posts/OptionsGreeksExplained'),
  },
  {
    slug: 'selling-options-for-income',
    title: 'How to Sell Options for Income: A Complete Premium Selling Guide',
    description: 'Master premium selling with this complete guide to generating consistent income through options. Covers cash-secured puts, covered calls, and credit spreads.',
    date: '2026-05-06',
    readTime: '13 min',
    category: 'Income Trading',
    tags: ['premium selling', 'options income', 'cash secured puts', 'credit spreads'],
    component: () => import('./posts/SellingOptionsForIncome'),
  },
  {
    slug: 'position-sizing-framework',
    title: 'Options Position Sizing: How Much to Risk Per Trade',
    description: 'Learn a practical position sizing framework for options trading. Covers the 1-2% rule, portfolio heat, and how to size credit spreads and iron condors.',
    date: '2026-05-06',
    readTime: '10 min',
    category: 'Risk Management',
    tags: ['position sizing', 'risk management', 'portfolio management', 'trade sizing'],
    component: () => import('./posts/PositionSizingFramework'),
  },
  {
    slug: 'implied-volatility-rank-explained',
    title: 'Implied Volatility Rank Explained: When to Sell Premium',
    description: 'Understand IV Rank and IV Percentile — the key metrics that tell you when options are expensive and when to sell premium for maximum edge.',
    date: '2026-05-06',
    readTime: '11 min',
    category: 'Fundamentals',
    tags: ['implied volatility', 'IV rank', 'volatility', 'premium selling'],
    component: () => import('./posts/ImpliedVolatilityRank'),
  },
  {
    slug: 'covered-call-vs-cash-secured-put',
    title: 'Covered Call vs. Cash-Secured Put: Which Income Strategy Is Right for You?',
    description: 'Compare covered calls and cash-secured puts side by side. Learn when to use each income strategy, risk profiles, and how to combine them in the wheel strategy.',
    date: '2026-05-06',
    readTime: '11 min',
    category: 'Strategies',
    tags: ['covered call', 'cash secured put', 'wheel strategy', 'options income'],
    component: () => import('./posts/CoveredCallVsCashSecuredPut'),
  },
  {
    slug: 'common-options-trading-mistakes',
    title: '7 Common Options Trading Mistakes (and How to Avoid Them)',
    description: 'Avoid the most costly options trading mistakes. From over-sizing positions to ignoring the Greeks, learn what trips up most traders and how to fix it.',
    date: '2026-05-06',
    readTime: '10 min',
    category: 'Risk Management',
    tags: ['options mistakes', 'trading psychology', 'risk management', 'beginner options'],
    component: () => import('./posts/CommonOptionsMistakes'),
  },
  {
    slug: 'weekly-options-income-plan',
    title: 'Weekly Options Income Strategy: A Step-by-Step Trading Plan',
    description: 'Build a repeatable weekly options income plan. From Sunday market review to Friday expiration management — a complete framework for consistent income.',
    date: '2026-05-06',
    readTime: '12 min',
    category: 'Income Trading',
    tags: ['weekly options', 'income strategy', 'trading plan', 'premium selling'],
    component: () => import('./posts/WeeklyOptionsIncomePlan'),
  },
];

export const blogCategories = [
  { id: 'all', label: 'All Posts' },
  { id: 'Strategies', label: 'Strategies' },
  { id: 'Fundamentals', label: 'Fundamentals' },
  { id: 'Risk Management', label: 'Risk Management' },
  { id: 'Income Trading', label: 'Income Trading' },
];

export function getPostBySlug(slug) {
  return blogPosts.find(p => p.slug === slug);
}

export function getRelatedPosts(currentSlug, count = 3) {
  const current = getPostBySlug(currentSlug);
  if (!current) return blogPosts.slice(0, count);
  return blogPosts
    .filter(p => p.slug !== currentSlug)
    .sort((a, b) => {
      const aMatch = a.category === current.category ? 1 : 0;
      const bMatch = b.category === current.category ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, count);
}
