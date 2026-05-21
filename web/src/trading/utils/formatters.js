/**
 * Format strategy names by removing underscores and capitalizing words
 * @param {string} strategy - Strategy name with underscores (e.g., "iron_condor")
 * @returns {string} Formatted strategy name (e.g., "Iron Condor")
 */
export const formatStrategy = (strategy) => {
  if (!strategy) return '';
  return strategy
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Format currency values
 * @param {number} value - Numeric value
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(Math.abs(value));
};
