#!/usr/bin/env node
/**
 * analyse-tiles.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * NewLeaf Trading — Automated Deep Analysis Generator
 *
 * What it does:
 *   1. Fetches all active tiles from Firestore (tiles collection)
 *   2. Checks which tiles do NOT have an analysis doc (analyses collection)
 *   3. For each unanalyzed tile, calls Claude CLI with a rich prompt
 *   4. Parses Claude's JSON output and pushes to Firestore analyses/{tileId}
 *
 * Usage:
 *   node analyse-tiles.cjs               # analyse all unanalyzed tiles
 *   node analyse-tiles.cjs --all         # re-analyse ALL tiles (overwrite)
 *   node analyse-tiles.cjs --id <tileId> # analyse one specific tile
 *   node analyse-tiles.cjs --dry-run     # show what would be processed
 *
 * Requirements:
 *   - claude CLI installed (`npm install -g @anthropic-ai/claude-code` or `brew`)
 *   - GOOGLE_APPLICATION_CREDENTIALS set, OR serviceAccountKey.json present
 *   - IB Gateway running (for live price context — optional, falls back gracefully)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const admin  = require('firebase-admin');
const { execSync, spawnSync } = require('child_process');
const fs     = require('fs');
const path   = require('path');
const { fetchSentiment, buildSentimentContext, computeModifier } = require('./sentiment-engine.cjs');
const { fetchIndicators, buildIndicatorsContext, validateIndicatorsInResponse } = require('./indicators-fetch.cjs');
const provenance = require('./firestore-helpers.cjs');
const CONFIG = require('./config.cjs');

const PROMPT_SEMVER = 'analyse-tiles-v3.2';

// ── Firebase Init ──────────────────────────────────────────────────────────────

const keyPath = path.resolve(CONFIG.firebase.serviceAccountPath);
if (fs.existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();
db.settings({ databaseId: CONFIG.firebase.databaseId });

// ── CLI Args ───────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const ALL      = args.includes('--all');
const DRY_RUN  = args.includes('--dry-run');
const ID_IDX   = args.indexOf('--id');
const ONLY_ID  = ID_IDX >= 0 ? args[ID_IDX + 1] : null;
const VERBOSE  = args.includes('--verbose') || args.includes('-v');

// ── Helpers ────────────────────────────────────────────────────────────────────

const log  = (...a) => console.log(...a);
const sep  = () => log('─'.repeat(65));

function fmtPrice(n) {
  return n != null ? `$${Number(n).toFixed(2)}` : 'N/A';
}

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Build Claude Prompt for a tile ────────────────────────────────────────────

function buildPrompt(tile, sentimentCtx, indicators) {
  const legs = (tile.legs || []).map(l =>
    `  ${l.action?.toUpperCase()} ${l.type?.toUpperCase()} $${l.strike} @ mid=${fmtPrice(l.mid || l.premium)}` +
    ` | δ=${l.delta ?? 'N/A'}  θ=${l.theta ?? 'N/A'}  ν=${l.vega ?? 'N/A'}`
  ).join('\n');

  const gammaCtx = tile.gammaData ? `
GAMMA WALL CONTEXT:
  Put Wall:        ${fmtPrice(tile.gammaData.put_wall)}
  Call Wall:       ${fmtPrice(tile.gammaData.call_wall)}
  Gamma Flip:      ${fmtPrice(tile.gammaData.gamma_flip)}
  Band Width:      ${tile.gammaData.band_width_pct?.toFixed(1) ?? 'N/A'}%
  Condor Allowed:  ${tile.gammaData.condor_allowed ? 'YES' : 'NO'}
  Confidence:      ${tile.gammaData.confidence_score ? (tile.gammaData.confidence_score * 100).toFixed(0) + '%' : 'N/A'}` : '';

  const greeksCtx = tile.greeks ? `
NET GREEKS:
  Net Delta:  ${tile.greeks.netDelta ?? 'N/A'}
  Net Theta:  ${tile.greeks.netTheta ?? 'N/A'} (per share)
  Net Vega:   ${tile.greeks.netVega ?? 'N/A'}
  Net Gamma:  ${tile.greeks.netGamma ?? 'N/A'}` : '';

  const indicatorsCtx = buildIndicatorsContext(indicators);

  return `You are a professional options analyst for NewLeaf Trading.
Generate a complete deep analysis JSON document for the tile below.

TILE DATA:
  ID:          ${tile.id}
  Symbol:      ${tile.symbol || tile.ticker}
  Strategy:    ${tile.strategy}
  Direction:   ${tile.direction || 'neutral'}
  Spot Price:  ${fmtPrice(tile.underlyingPrice || tile.currentPrice || tile.price)}
  Expiry:      ${tile.expiry || tile.expirationDate}
  DTE:         ${tile.dte || tile.daysToExpiry} days
  Net Credit:  ${fmtPrice(tile.netCredit)} per share (${fmtPrice((tile.netCredit || 0) * 100)}/contract)
  Max Profit:  ${fmtPrice(tile.maxProfit)}
  Max Loss:    ${fmtPrice(tile.maxLoss)}
  R:R:         ${tile.rewardRisk ?? 'N/A'}x
  PoP:         ${tile.oddsOfProfit ?? tile.probOfProfit ?? 'N/A'}%
  Theta/Day:   ${fmtPrice(tile.netTheta)}

LEGS:
${legs}
${gammaCtx}
${greeksCtx}
${indicatorsCtx}
${sentimentCtx || ''}

OUTPUT INSTRUCTIONS:
Return ONLY a valid JSON object (no markdown, no backticks, no explanation).
The JSON must follow this EXACT schema:

{
  "strategyRationale": {
    "whyThisStrategy": "2-3 sentences explaining why this strategy fits current market conditions for this symbol",
    "whyTheseStrikes": "2-3 sentences explaining the strike selection logic relative to spot, walls, and probability",
    "whyThisExpiry": "2-3 sentences explaining DTE choice and theta decay timing",
    "alternativesConsidered": [
      { "strategy": "Name", "reason": "Why it was rejected" },
      { "strategy": "Name", "reason": "Why it was rejected" },
      { "strategy": "Name", "reason": "Why it was rejected" }
    ]
  },
  "technicalIndicators": {
    "rsi": {
      "value": <EXACT rsi14 value from GROUND TRUTH above>,
      "signal": "<bullish|bearish|neutral|bullish_bias|slightly_bearish>",
      "description": "1-2 sentences interpreting RSI for this setup"
    },
    "bollingerBands": {
      "upper": <EXACT upper from GROUND TRUTH above>,
      "middle": <EXACT middle from GROUND TRUTH above>,
      "lower": <EXACT lower from GROUND TRUTH above>,
      "width": <EXACT width from GROUND TRUTH above>,
      "signal": "<neutral|bullish|bearish|wide_bands|low_vol>",
      "description": "1-2 sentences about BB context"
    },
    "macd": {
      "macdLine": <EXACT line from GROUND TRUTH above>,
      "signalLine": <EXACT signal from GROUND TRUTH above>,
      "histogram": <EXACT histogram from GROUND TRUTH above>,
      "signal": "<bullish|bearish|neutral|slightly_bearish|slightly_bullish>",
      "description": "1-2 sentences about MACD momentum"
    },
    "movingAverages": {
      "sma20": <EXACT SMA20 from GROUND TRUTH above>,
      "sma50": <EXACT SMA50 from GROUND TRUTH above>,
      "sma100": <EXACT SMA100 from GROUND TRUTH above>,
      "crossoverDaysAgo": <number or null>,
      "isBullish": <true|false>,
      "signal": "<bullish|bearish|neutral|bullish_bias>",
      "description": "1-2 sentences about MA trend",
      "history": []
    },
    "impliedVolatility": {
      "currentIV": <percent, e.g. 28.5>,
      "ivRank": <0-100>,
      "ivPercentile": <0-100>,
      "historicalVol30": <percent>,
      "description": "1-2 sentences about IV context and edge"
    },
    "supportResistance": {
      "support": [
        { "level": <price>, "strength": "strong", "description": "brief description" },
        { "level": <price>, "strength": "moderate", "description": "brief description" }
      ],
      "resistance": [
        { "level": <price>, "strength": "strong", "description": "brief description" },
        { "level": <price>, "strength": "moderate", "description": "brief description" }
      ]
    }
  },
  "thetaDecaySchedule": {
    "description": "2-3 sentences about how theta decay works for this specific position",
    "dailyDecay": [
      { "daysToExpiry": <dte>, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> },
      { "daysToExpiry": <dte*0.75>, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> },
      { "daysToExpiry": <dte*0.5>, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> },
      { "daysToExpiry": <dte*0.25>, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> },
      { "daysToExpiry": 7, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> },
      { "daysToExpiry": 3, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> },
      { "daysToExpiry": 1, "dailyTheta": <dollars>, "cumulativeTheta": <dollars> }
    ],
    "earlyCloseRecommendation": "Specific advice: at what profit % to close, when to exit, what to watch"
  },
  "riskAnalysis": {
    "maxPainScenario": "Specific scenario that causes max loss for this exact position",
    "earningsRisk": "Is there an earnings event in the DTE window? What's the risk?",
    "dividendRisk": "Dividend risk for this symbol and strategy",
    "eventRisk": "Macro or sector events that could affect this position",
    "managementPlan": "Exact rules: when to adjust, when to close, stop loss levels, profit targets"
  }
}

For rsi, bollingerBands, macd, and movingAverages: use the EXACT numeric values from GROUND TRUTH TECHNICAL INDICATORS above. Write your own signal and description text interpreting those values.
impliedVolatility and supportResistance: generate your best estimates (these are not yet computed server-side — TODO).
Be specific to ${tile.symbol || tile.ticker} and the ${tile.strategy} strategy.
Use the actual spot price (${fmtPrice(tile.underlyingPrice || tile.currentPrice)}), strikes, and metrics from the tile data above.
For theta decay, use netTheta=${fmtPrice(tile.netTheta)}/day as baseline.
Return ONLY the JSON object, nothing else.`;
}

// ── Call Claude CLI ────────────────────────────────────────────────────────────

function callClaude(prompt) {
  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = path.join('/tmp', `nl-prompt-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf8');

  try {
    // claude --print reads from stdin/file and returns just the text output
    const result = spawnSync('claude', ['--print', '--output-format', 'text'], {
      input: prompt,
      encoding: 'utf8',
      timeout: 300000,   // 5 min per tile (web search can be slow)
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.status !== 0) {
      const errMsg = result.stderr || result.error?.message || 'Unknown error';
      throw new Error(`Claude CLI exited ${result.status}: ${errMsg}`);
    }

    return result.stdout?.trim() || '';
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ── Extract JSON from Claude output ───────────────────────────────────────────

function extractJSON(raw) {
  // Strip markdown code fences if present
  let cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  // Find the JSON object
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in Claude output');
  }

  cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

// ── Validate analysis shape ────────────────────────────────────────────────────

function validate(analysis) {
  const required = ['strategyRationale', 'technicalIndicators', 'thetaDecaySchedule', 'riskAnalysis'];
  for (const key of required) {
    if (!analysis[key]) throw new Error(`Missing required field: ${key}`);
  }
  if (!analysis.strategyRationale.whyThisStrategy) throw new Error('Missing whyThisStrategy');
  if (!analysis.technicalIndicators.rsi) throw new Error('Missing RSI');
  if (!Array.isArray(analysis.thetaDecaySchedule.dailyDecay)) throw new Error('Missing dailyDecay array');
  if (!analysis.riskAnalysis.managementPlan) throw new Error('Missing managementPlan');
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  provenance.initProvenance();
  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  🍃 NewLeaf — Automated Deep Analysis Generator');
  log('═══════════════════════════════════════════════════════════════');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${ALL ? ' | OVERWRITE ALL' : ''}${ONLY_ID ? ` | ID: ${ONLY_ID}` : ''}`);
  log('');

  // ── Step 1: Fetch active tiles ─────────────────────────────────────────────

  log('📦 Fetching active tiles from Firestore...');
  let tilesQuery = db.collection('tiles').where('isActive', '==', true);
  if (ONLY_ID) tilesQuery = db.collection('tiles').where(admin.firestore.FieldPath.documentId(), '==', ONLY_ID);

  const tilesSnap = await tilesQuery.get();
  const tiles = tilesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  log(`   Found ${tiles.length} active tile(s)`);

  if (!tiles.length) {
    log('   Nothing to do. Exiting.');
    process.exit(0);
  }

  // ── Step 2: Check which tiles already have analysis ────────────────────────

  log('🔍 Checking analyses collection...');
  const analysesSnap = await db.collection('analyses').get();
  const existingIds  = new Set(analysesSnap.docs.map(d => d.id));
  log(`   Found ${existingIds.size} existing analysis doc(s)`);

  const toProcess = ALL
    ? tiles
    : tiles.filter(t => !existingIds.has(t.id));

  log('');
  if (!toProcess.length) {
    log('✅ All tiles already have analysis. Use --all to re-generate.');
    log('');
    process.exit(0);
  }

  log(`📋 Tiles to analyse: ${toProcess.length}`);
  toProcess.forEach((t, i) => {
    const exists = existingIds.has(t.id) ? ' (overwrite)' : '';
    log(`   ${i + 1}. ${t.id} — ${t.symbol || t.ticker} ${t.strategy}${exists}`);
  });
  sep();

  if (DRY_RUN) {
    log('');
    log('DRY RUN — no changes made. Remove --dry-run to execute.');
    log('');
    process.exit(0);
  }

  // ── Step 3: Process each tile ──────────────────────────────────────────────

  const results = { success: [], failed: [] };

  for (let i = 0; i < toProcess.length; i++) {
    const tile = toProcess[i];
    const symbol = tile.symbol || tile.ticker || 'UNKNOWN';
    log('');
    log(`[${i + 1}/${toProcess.length}] ${symbol} — ${tile.strategy} (${tile.id})`);
    log(`  Spot: ${fmtPrice(tile.underlyingPrice || tile.currentPrice)}  DTE: ${tile.dte || tile.daysToExpiry}  Expiry: ${tile.expiry}`);

    try {
      // Fetch sentiment (cached or live via Claude web search)
      log('  → Fetching sentiment...');
      const sentiment = await fetchSentiment(symbol);

      // Suppress: material events detected → skip tile
      if (sentiment?.materialEvents?.length > 0) {
        log(`  ⚠️  SUPPRESSED — Material event: ${sentiment.materialEvents[0]}`);
        log(`  → Skipping ${symbol} from analysis (binary event risk)`);
        results.failed.push({ id: tile.id, error: `Suppressed: ${sentiment.materialEvents[0]}` });
        continue;
      }

      // Fetch computed indicators from API
      log('  → Fetching computed indicators...');
      const indicators = await fetchIndicators(symbol);
      log(`     RSI=${indicators.rsi14} MACD=${indicators.macdLine.toFixed(3)} SMA20=${indicators.sma20}`);

      // Build prompt with sentiment context and ground-truth indicators
      log('  → Building prompt...');
      const sentimentCtx = buildSentimentContext(sentiment);
      const prompt = buildPrompt(tile, sentimentCtx, indicators);
      if (VERBOSE) {
        log('  ── PROMPT ──');
        log(prompt.slice(0, 500) + '...');
        log('  ────────────');
      }

      // Call Claude
      log('  → Calling Claude CLI (may take 30-60s)...');
      const raw = callClaude(prompt);

      if (VERBOSE) {
        log('  ── RAW OUTPUT ──');
        log(raw.slice(0, 400) + '...');
        log('  ────────────────');
      }

      // Parse JSON
      log('  → Parsing analysis JSON...');
      const analysis = extractJSON(raw);

      // Validate structure
      validate(analysis);
      // Validate LLM echoed back ground-truth indicator values
      validateIndicatorsInResponse(analysis, indicators);
      log('  → Validation passed ✅');

      // Save analysis JSON locally
      const outDir = path.join(__dirname, 'output', 'analyses');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `${tile.id}.json`);
      fs.writeFileSync(outFile, JSON.stringify({ tileId: tile.id, analysis }, null, 2));
      log(`  → Saved analysis to ${outFile}`);

      // Save enriched-pick.json (tile + analysis merged — single source of truth for all outputs)
      const weekId = getISOWeek();
      const enrichedDir = path.join(__dirname, 'output', weekId, 'enriched');
      fs.mkdirSync(enrichedDir, { recursive: true });
      const slug = `${symbol}-${(tile.strategy || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const enrichedFile = path.join(enrichedDir, `${slug}.json`);
      const enrichedPick = {
        tileId: tile.id,
        symbol,
        companyName: tile.companyName || symbol,
        strategy: tile.strategy,
        direction: tile.direction || 'neutral',
        spotPrice: tile.underlyingPrice || tile.currentPrice || tile.price,
        expiry: tile.expiry || tile.expirationDate,
        dte: tile.dte || tile.daysToExpiry,
        legs: tile.legs || [],
        greeks: tile.greeks || {},
        gammaData: tile.gammaData || {},
        maxProfit: tile.maxProfit,
        maxLoss: tile.maxLoss,
        netCredit: tile.netCredit,
        rewardRisk: tile.rewardRisk,
        oddsOfProfit: tile.oddsOfProfit || tile.probOfProfit,
        // Enriched summary fields (for pick JSON / cards)
        thesis: analysis.strategyRationale?.whyThisStrategy || '',
        keyLevels: {
          putWall: tile.gammaData?.put_wall,
          callWall: tile.gammaData?.call_wall,
          support: (analysis.technicalIndicators?.supportResistance?.support || []).map(s => s.level),
          resistance: (analysis.technicalIndicators?.supportResistance?.resistance || []).map(r => r.level),
        },
        ivContext: {
          currentIV: analysis.technicalIndicators?.impliedVolatility?.currentIV,
          ivRank: analysis.technicalIndicators?.impliedVolatility?.ivRank,
          signal: analysis.technicalIndicators?.impliedVolatility?.description,
        },
        riskSummary: analysis.riskAnalysis?.maxPainScenario || '',
        exitPlan: {
          profitTarget: analysis.thetaDecaySchedule?.earlyCloseRecommendation || '',
          managementPlan: analysis.riskAnalysis?.managementPlan || '',
        },
        // Sentiment data
        sentiment: sentiment || null,
        // Full analysis (for PDF, video, and Firestore)
        analysis,
        // Metadata
        weekId,
        generatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(enrichedFile, JSON.stringify(enrichedPick, null, 2));
      log(`  → Saved enriched pick to ${enrichedFile}`);

      // Push to Firestore analyses/ with provenance
      log('  → Pushing to Firestore analyses collection...');
      const analysisOpts = {
        modelUsed: 'claude-cli',
        promptVersion: provenance.computePromptVersion(PROMPT_SEMVER, prompt),
        analysisSource: 'analyse-tiles',
      };
      await provenance.writeAnalysisWithProvenance(db, tile.id, {
        ...analysis,
        _sentiment: sentiment || null,
        _generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        _tileId:      tile.id,
        _symbol:      symbol,
        _strategy:    tile.strategy,
      }, analysisOpts);

      // Tile already has provenance from publish-pick.cjs creation.
      // Don't overwrite with enrichment-time provenance.
      if (sentiment) {
        const sentMod = computeModifier(sentiment, tile.direction || 'neutral');
        await db.collection('tiles').doc(tile.id).update({
          sentiment: {
            score: sentiment.composite?.score ?? sentiment.score,
            label: sentiment.composite?.label ?? sentiment.label,
            confidence: sentiment.composite?.confidence ?? sentiment.confidence,
            summary: sentiment.summary,
            keyDrivers: sentiment.keyDrivers || [],
            socialSentiment: sentiment.socialSentiment || null,
            sectorContext: sentiment.sectorContext || null,
            materialEvents: sentiment.materialEvents || [],
            engines: sentiment.engines || {},
            activeEngines: sentiment.activeEngines || 1,
            source: sentiment.source,
            modifier: sentMod.points,
            flags: sentMod.flags,
            reason: sentMod.reason,
            updatedAt: sentiment.updatedAt,
          }
        });
        log(`  → Updated tiles/${tile.id} with sentiment`);
      }

      log(`  ✅ Done — analyses/${tile.id}`);
      results.success.push(tile.id);

    } catch (err) {
      log(`  ❌ FAILED: ${err.message}`);
      if (VERBOSE) log(err.stack);
      results.failed.push({ id: tile.id, error: err.message });
    }

    // Polite pause between tiles (avoid Claude rate limits)
    if (i < toProcess.length - 1) {
      log('  ⏸  Waiting 3s before next tile...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  log('');
  sep();
  log(`  ✅ Succeeded: ${results.success.length}`);
  results.success.forEach(id => log(`     • ${id}`));

  if (results.failed.length) {
    log(`  ❌ Failed:    ${results.failed.length}`);
    results.failed.forEach(f => log(`     • ${f.id}: ${f.error}`));
  }

  log('');
  log(`  Analysis docs are now in Firestore → newleafdb → analyses`);
  log(`  The 3 detail tabs in newleaf-trading will now populate.`);
  log('═══════════════════════════════════════════════════════════════');
  log('');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
