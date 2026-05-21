/**
 * dataLoader.js
 *
 * Shared R2 data loader for all NewLeaf Pro scanner pages
 *
 * Phase 4A of STRATEGY_ENGINE_BUILD.md
 * Date: 2026-04-03
 *
 * Usage:
 *   const loader = new DataLoader();
 *   const results = await loader.loadStrategyData('CSP');
 *   // returns array of {symbol, score, setup, ...}
 */

class DataLoader {
  constructor() {
    // Use /r2 proxy for local dev, direct R2 URL for production
    this.R2_BASE = window.location.hostname === 'localhost'
      ? '/r2'
      : 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev';
    this.manifestUrl = `${this.R2_BASE}/reports/manifest.json`;
    this.reportsCache = new Map();
    this.manifestCache = null;
    this.adapterLoaded = false;
    this.engineLoaded = false;
  }

  /**
   * Load manifest from R2
   * @returns {Promise<Object>} - Manifest with symbols array
   */
  async loadManifest() {
    if (this.manifestCache) return this.manifestCache;

    try {
      const response = await fetch(this.manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }

      const manifest = await response.json();
      this.manifestCache = manifest;
      return manifest;
    } catch (error) {
      console.error('Error loading manifest:', error);
      throw error;
    }
  }

  /**
   * Load single report from R2
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} - Report data
   */
  async loadReport(symbol) {
    if (this.reportsCache.has(symbol)) {
      return this.reportsCache.get(symbol);
    }

    try {
      const url = `${this.R2_BASE}/reports/${symbol}/latest.json`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`Report not found for ${symbol}: ${response.status}`);
        return null;
      }

      const report = await response.json();
      this.reportsCache.set(symbol, report);
      return report;
    } catch (error) {
      console.error(`Error loading ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Load multiple reports in parallel
   * @param {Array<string>} symbols - Array of symbols
   * @param {number} batchSize - Batch size for parallel loading (default 10)
   * @returns {Promise<Map>} - Map of symbol → report
   */
  async loadReports(symbols, batchSize = 10) {
    const results = new Map();

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(sym => this.loadReport(sym));
      const batchResults = await Promise.all(promises);

      batchResults.forEach((report, idx) => {
        const symbol = batch[idx];
        if (report) {
          results.set(symbol, report);
        }
      });

      // Progress callback
      if (window.onLoadProgress) {
        const progress = Math.min(100, ((i + batchSize) / symbols.length) * 100);
        window.onLoadProgress(progress, `Loaded ${Math.min(i + batchSize, symbols.length)}/${symbols.length} reports`);
      }
    }

    return results;
  }

  /**
   * Load all reports from manifest
   * @returns {Promise<Map>} - Map of symbol → report
   */
  async loadAllReports() {
    const manifest = await this.loadManifest();
    // Prefer manifest.reports[] (richer, kept up-to-date by upsertManifest).
    // Fall back to manifest.symbols[] (legacy schema) only if reports is empty.
    let symbols;
    if (Array.isArray(manifest.reports) && manifest.reports.length > 0) {
      symbols = manifest.reports
        .map(r => (typeof r === 'string' ? r : r && r.symbol))
        .filter(Boolean);
    } else {
      symbols = manifest.symbols || [];
    }

    console.log(`Loading ${symbols.length} reports from R2...`);
    const reports = await this.loadReports(symbols);
    console.log(`Loaded ${reports.size} reports successfully`);

    return reports;
  }

  /**
   * Load strategy-specific data
   *
   * @param {string} strategyName - Strategy name (WHEEL, CSP, IRON_CONDOR, etc.)
   * @param {Object} options - Options {minScore: 50, limit: 50}
   * @returns {Promise<Array>} - Array of opportunities sorted by score
   */
  async loadStrategyData(strategyName, options = {}) {
    const {
      minScore = 30,
      limit = 50
    } = options;

    // Ensure pipelineAdapter and strategyEngine are loaded
    if (!this.adapterLoaded || !this.engineLoaded) {
      await this.loadEngineModules();
    }

    // Load all reports
    const reports = await this.loadAllReports();

    // Adapt all reports
    const inputs = [];
    reports.forEach((report, symbol) => {
      try {
        const input = window.pipelineAdapter.adaptReportToEngineInput(report);
        inputs.push(input);
      } catch (error) {
        console.warn(`Failed to adapt ${symbol}:`, error.message);
      }
    });

    console.log(`Adapted ${inputs.length} reports for analysis`);

    // Run strategy engine
    const results = window.strategyEngine.runEngine(inputs);

    // Extract strategy-specific results
    const strategyResults = results.byStrategy[strategyName] || [];

    // Filter and limit
    const filtered = strategyResults
      .filter(opp => opp.score >= minScore)
      .slice(0, limit);

    console.log(`${strategyName}: ${filtered.length} opportunities (score >= ${minScore})`);

    return filtered;
  }

  /**
   * Load all strategies data
   * @returns {Promise<Object>} - Object with all strategies {WHEEL: [...], CSP: [...], ...}
   */
  async loadAllStrategies(options = {}) {
    const {
      minScore = 30
    } = options;

    // Ensure modules loaded
    if (!this.adapterLoaded || !this.engineLoaded) {
      await this.loadEngineModules();
    }

    // Load all reports
    const reports = await this.loadAllReports();

    // Adapt all reports
    const inputs = [];
    reports.forEach((report, symbol) => {
      try {
        const input = window.pipelineAdapter.adaptReportToEngineInput(report);
        inputs.push(input);
      } catch (error) {
        console.warn(`Failed to adapt ${symbol}:`, error.message);
      }
    });

    // Run strategy engine
    const results = window.strategyEngine.runEngine(inputs);

    // Filter by minScore
    const filtered = {};
    Object.entries(results.byStrategy).forEach(([strategyName, opps]) => {
      filtered[strategyName] = opps.filter(opp => opp.score >= minScore);
    });

    return {
      byStrategy: filtered,
      bySymbol: results.bySymbol
    };
  }

  /**
   * Load adapter and engine modules (browser versions)
   * @returns {Promise<void>}
   */
  async loadEngineModules() {
    if (this.adapterLoaded && this.engineLoaded) return;

    // Check if modules are already loaded globally
    if (window.pipelineAdapter && window.strategyEngine) {
      this.adapterLoaded = true;
      this.engineLoaded = true;
      return;
    }

    // Load scripts dynamically
    await this.loadScript('public/js/pipelineAdapter.browser.js');
    await this.loadScript('public/js/strategyEngine.browser.js');

    this.adapterLoaded = true;
    this.engineLoaded = true;

    console.log('✓ Engine modules loaded');
  }

  /**
   * Load script dynamically
   * @param {string} src - Script source
   * @returns {Promise<void>}
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.reportsCache.clear();
    this.manifestCache = null;
    console.log('Cache cleared');
  }
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.DataLoader = DataLoader;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataLoader;
}
