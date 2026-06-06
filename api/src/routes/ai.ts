import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { LLMRouter, type ModelTier } from '../llm/router.js';
import { StrategyAdvisor } from '../agents/advisor.js';
import { getStockSnapshot, getOptionsSnapshot, getHistoricalBars } from '../tools/alpaca.js';
import { computeIndicators } from '../tools/indicators.js';
import { analyzeTechnicals, calcScore, getDirection, selectStrategy, reconcileDirection, analyzeGammaEnhanced } from '../tools/strategy-engine.js';
import { fetchNasdaqOI, findGammaWalls } from '../tools/nasdaq-oi.js';
import { buildLegs } from '../tools/leg-builder.js';
import { aiReadCache, recommendCache } from '../lib/cache.js';
import { createHash } from 'crypto';

export function registerAIRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  const advisor = new StrategyAdvisor(llm);

  // POST /api/ai-read — premium tier (cached 5 min by ticker — same market state)
  fastify.post('/api/ai-read', { preHandler: [requireTier('premium')] }, async (req) => {
    const body = req.body as Record<string, any>;
    const { ticker, spot, ivRank, atr14, rsi, adx, trend, putWall, callWall, earningsDaysOut, engineDirection, engineStrategy } = body;
    if (!ticker || !spot) return { error: 'ticker and spot required' };

    const tk = (ticker as string).toUpperCase();
    const cacheKey = engineDirection ? `${tk}:${engineDirection}` : tk;
    const cached = aiReadCache.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    // If engine direction is provided, constrain the market read to be consistent
    let directionHint = '';
    if (engineDirection && engineStrategy) {
      directionHint = `\nIMPORTANT: The engine has selected a ${engineDirection} ${(engineStrategy as string).replace(/_/g, ' ')}. Your market read MUST be consistent with this ${engineDirection} bias. Do NOT suggest a strategy that contradicts the ${engineDirection} direction.`;
    }

    const prompt = `Given ${tk} at $${spot}, IV rank ${ivRank ?? 'N/A'}, RSI ${rsi ?? 'N/A'}, ADX ${adx ?? 'N/A'}, trend ${trend ?? 'unknown'}, ATR14 ${atr14 ?? 'N/A'}, put wall $${putWall ?? 'N/A'}, call wall $${callWall ?? 'N/A'}, earnings in ${earningsDaysOut ?? 'N/A'} days: produce one sentence market read. Format: "{Directional bias} ({key indicators}) with {premium environment} and {gamma context}. Setup favors {strategy class}." Be specific, cite real numbers. No hedging language.${directionHint}`;

    llm.resetUsage();
    const { getModel: gm } = await import('../llm/model-assignments.js');
    const result = await llm.call(gm('ai-read'), {
      system: 'You are a concise market analyst. Respond with exactly one sentence.',
      user: prompt,
      maxTokens: 200,
    });
    const response = { read: result, cost: llm.getUsage() };
    aiReadCache.set(cacheKey, response);
    return response;
  });

  // POST /api/recommend — premium tier (cached 10 min by ticker+expiry)
  // Phase 3: Engine decides, LLM explains. Uses shared strategy-engine.js (same as scanner).
  fastify.post('/api/recommend', { preHandler: [requireTier('premium')] }, async (req) => {
    const { ticker, expiry, modelMode: rm } = req.body as { ticker: string; expiry: string; modelMode?: string };
    if (!ticker || !expiry) return { error: 'ticker and expiry required' };
    const tk = ticker.toUpperCase();
    const { strategyModel: sm, noCache: nc } = req.body as { strategyModel?: string; noCache?: boolean };
    const cacheKey = sm ? `${tk}:${expiry}:${sm}` : `${tk}:${expiry}`;
    if (!nc) {
      const cached = recommendCache.get(cacheKey);
      if (cached) return { ...cached, cached: true };
    }

    // 1. Fetch market data
    const [snapshot, bars, contracts, oiChain] = await Promise.all([
      getStockSnapshot(tk),
      getHistoricalBars(tk, 400),  // 400 days for SMA200
      getOptionsSnapshot(tk, expiry),
      fetchNasdaqOI(tk, expiry).catch(() => null),
    ]);

    // 2. Run the SHARED deterministic engine (same code as scanner)
    const technicalData = analyzeTechnicals(bars, snapshot.price);

    // Prepare contracts for gamma analysis (merge OI from Nasdaq)
    const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));
    const enrichedContracts = contracts.map(c => ({
      ...c, dte, expiry, openInterest: (c as any).openInterest ?? 0,
    }));

    // Merge Nasdaq OI into contracts
    if (oiChain?.strikes) {
      for (const c of enrichedContracts) {
        const oiStrike = oiChain.strikes.find((s: any) => Math.abs(s.strike - c.strike) < 0.01);
        if (oiStrike) {
          c.openInterest = c.type === 'call' ? oiStrike.callOI : oiStrike.putOI;
        }
      }
    }

    const gammaData = analyzeGammaEnhanced(enrichedContracts, snapshot.price, 0, 60, null);
    const { total: score, pillars, hasOptions } = calcScore(gammaData, technicalData);
    const trendDirection = getDirection(gammaData, technicalData);
    const strategy = selectStrategy(gammaData, trendDirection, snapshot.price, technicalData);
    const direction = reconcileDirection(trendDirection, strategy.code);

    // Deterministic leg construction — replaces LLM strike picking
    const builtLegsResult = buildLegs({
      strategy: strategy.code,
      contracts: enrichedContracts,
      spot: snapshot.price,
      gammaWalls: {
        putWall: gammaData.analysis.put_wall ?? null,
        callWall: gammaData.analysis.call_wall ?? null,
      },
      direction: direction as 'bullish' | 'bearish' | 'neutral',
      dte,
      bwbStrikes: strategy.strikes,
    });
    if (builtLegsResult.meta.warnings.length) {
      console.log(`[Recommend] Leg builder warnings for ${tk}: ${builtLegsResult.meta.warnings.join('; ')}`);
    }

    let enginePick: {
      strategy: string; direction: string; score: number;
      pillars: typeof pillars; reasoningOverride?: any;
    } = {
      strategy: strategy.code,
      direction,
      score: strategy.bwbBonus ? score + strategy.bwbBonus : score,
      pillars,
    };

    // Gate trace: show exactly why each gate passed/failed (for debugging)
    const bw = gammaData.analysis.band_width_pct || 0;
    const conf = gammaData.analysis.confidence_score || 0;
    const atmIvGate = gammaData.ivData?.atmIv || 0;
    const rvPct = technicalData.realizedVol30d ? technicalData.realizedVol30d * 100 : null;
    const ivRvGate = (rvPct && rvPct > 0 && atmIvGate > 0) ? atmIvGate / rvPct : null;
    const gateTrace = [
      { gate: 'iron_condor', passed: gammaData.condorGate.condorAllowed,
        reason: `conf=${conf.toFixed(3)} (need≥0.60), band=${bw.toFixed(1)}% (need 3-15%), contracts=${enrichedContracts.length} (need≥50)` },
      { gate: 'broken_wing_butterfly', passed: (bw > 15 && bw <= 40 && conf >= 0.15) || (bw > 10 && bw <= 35 && conf >= 0.30 && atmIvGate >= 25),
        reason: `band=${bw.toFixed(1)}%, conf=${conf.toFixed(3)}, atmIv=${atmIvGate ? atmIvGate.toFixed(1) : 'null'}` },
      { gate: 'directional (bull_put/bear_call)', passed: trendDirection === 'bullish' || trendDirection === 'bearish',
        reason: `direction=${trendDirection}, trendScore=${technicalData.trendEngine?.score?.toFixed(2)}, conf=${conf.toFixed(3)}, strength=${technicalData.trendEngine?.strength}` },
      { gate: 'calendar_spread', passed: trendDirection === 'neutral' && atmIvGate > 0 && atmIvGate < 25 && ivRvGate !== null && ivRvGate < 1.0,
        reason: `direction=${trendDirection}, atmIv=${atmIvGate ? atmIvGate.toFixed(1) : 'null'}, ivRv=${ivRvGate?.toFixed(3) ?? 'null'}` },
      { gate: 'iron_butterfly (fallback)', passed: strategy.code === 'iron_butterfly',
        reason: 'fallback — no earlier gate fired' },
    ];

    // 2b. Reasoning LLM strategy selection
    //     Triggers when: (a) engine hit fallback, OR (b) user toggled "AI Strategy Selection"
    const { useLLMStrategy, strategyModel } = req.body as { useLLMStrategy?: boolean; strategyModel?: string; ticker: string; expiry: string; modelMode?: string };
    const isFallback = strategy.code === 'iron_butterfly' && !gammaData.condorGate.condorAllowed;
    const useReasoning = isFallback || useLLMStrategy;
    let strategyPrompt = '';
    if (useReasoning) {
      const { getModel: gm } = await import('../llm/model-assignments.js');
      const validModels = ['qwen-plus','qwen-max','qwen3-max','claude-sonnet','claude-haiku','gpt-4','gpt-5.5','grok','deepseek','deepseek-r1','gemini-pro','gemini-flash'] as const;
      const requestedModel = strategyModel && validModels.includes(strategyModel as any) ? strategyModel as any : null;
      const reasoningModel = requestedModel || gm('reasoning-thesis');
      console.log(`[Recommend] ${useLLMStrategy ? 'AI Strategy Selection' : 'Engine fallback'} for ${tk}. Model: ${reasoningModel}`);
      try {
        // Compute indicators for LLM context (strategy selection only, no strike picking)
        const ind = computeIndicators(bars, snapshot.price);
        const sma20 = technicalData.sma20 ?? ind.sma20 ?? null;
        const sma50 = technicalData.sma50 ?? ind.sma50 ?? null;
        const ivRvRatio = (rvPct && rvPct > 0 && atmIvGate > 0) ? (atmIvGate / rvPct).toFixed(2) : 'N/A';
        const expectedMove = technicalData.atr14 ? (technicalData.atr14 * Math.sqrt(dte)).toFixed(2) : 'N/A';

        // Count how many deterministic gates passed
        const passedGates = gateTrace.filter(g => g.gate !== 'iron_butterfly (fallback)' && g.passed).length;

        // Build OI summary for prompt
        const strikeRange = snapshot.price * 0.10;
        const oiStrikes = new Map<number, { strike: number; callOI: number; putOI: number }>();
        for (const c of enrichedContracts) {
          if (c.strike < snapshot.price - strikeRange || c.strike > snapshot.price + strikeRange) continue;
          if (!oiStrikes.has(c.strike)) oiStrikes.set(c.strike, { strike: c.strike, callOI: 0, putOI: 0 });
          const e = oiStrikes.get(c.strike)!;
          if (c.type === 'call') e.callOI = (c as any).openInterest ?? 0;
          else e.putOI = (c as any).openInterest ?? 0;
        }
        const sortedOI = [...oiStrikes.values()].sort((a, b) => a.strike - b.strike);
        const oiSummary = sortedOI.slice(0, 10).map(s =>
          `$${s.strike}: C-OI=${s.callOI} P-OI=${s.putOI}`
        ).join(', ') || 'N/A';

        // Engine candidate string
        const engineCandidate = `${strategy.code} (${direction}), score ${score}/100. Gates: ${gateTrace.filter(g => g.gate !== 'iron_butterfly (fallback)').map(g => `${g.gate}=${g.passed ? 'PASS' : 'FAIL'}`).join(', ')}`;

        strategyPrompt = `You are a senior options strategist evaluating whether a defined-risk options trade is warranted. You choose the strategy type — legs are constructed deterministically downstream. Do NOT output strikes or legs.

MARKET DATA (authoritative — use exactly as given):
- Ticker: ${tk}
- Spot: ${snapshot.price.toFixed(2)}
- DTE: ${dte} ${dte <= 3 ? '(very short — gamma risk extreme)' : dte <= 7 ? '(short — gamma risk high)' : dte <= 21 ? '(medium)' : '(longer)'}
- Regime indicators: ADX ${technicalData.adx14?.toFixed(1) ?? 'N/A'}, RSI ${technicalData.rsi?.toFixed(1) ?? 'N/A'}, IV/RV ${ivRvRatio}, SMA20 ${sma20 ? sma20.toFixed(2) : 'N/A'}, SMA50 ${sma50 ? sma50.toFixed(2) : 'N/A'}
- Key levels: put wall ${gammaData.analysis.put_wall ?? 'N/A'}, call wall ${gammaData.analysis.call_wall ?? 'N/A'}, gamma band ${gammaData.analysis.put_wall ?? '?'}–${gammaData.analysis.call_wall ?? '?'}, expected move ±${expectedMove}
- Gamma confidence: ${(conf * 100).toFixed(0)}%, band width: ${bw.toFixed(1)}%
- Liquidity / open interest: ${oiSummary}
- Engine candidate: ${engineCandidate}

DECISION (return exactly one):
- APPROVED_TRADE — strong setup, risk acceptable. Requires confidence >= 65.
- WATCHLIST_TRADE — valid candidate but elevated risk. Confidence 40–64, or >=65 with one major risk flag.
- NO_TRADE — no valid candidate (confidence < 40, or no coherent thesis).
- DATA_ERROR — inputs missing/inconsistent.

Do NOT default to NO_TRADE merely because deterministic gates failed. If a reasonable trade exists with elevated risk, return WATCHLIST_TRADE.
${passedGates === 0 ? 'All deterministic gates FAILED. APPROVED_TRADE requires explicit gate override justification.' : `${passedGates} gate(s) passed.`}
${dte <= 3 && passedGates === 0 ? 'DTE <= 3 with all gates failed: APPROVED_TRADE is NOT allowed.' : ''}

STEP 1 — Regime (choose exactly one):
Range-bound premium selling | Overbought mean-reversion | Oversold mean-reversion | Bullish trend continuation | Bearish trend continuation | No-trade / wait
If regime = "No-trade / wait", decision MUST be NO_TRADE.

STEP 2 — Strategy (choose one, do NOT specify strikes):
iron_condor | iron_butterfly | broken_wing_butterfly | bull_put_spread | bear_call_spread | long_straddle | long_strangle

STEP 3 — Risk plan:
Provide target, stop, kill, and time-exit rules. Express as % of credit or price levels — NO dollar P&L figures.

OUTPUT — return ONLY this JSON object (no markdown fences, no prose before or after):
{"decision":"APPROVED_TRADE|WATCHLIST_TRADE|NO_TRADE|DATA_ERROR","regime":"<Step 1 label>","strategy":"iron_condor|iron_butterfly|broken_wing_butterfly|bull_put_spread|bear_call_spread|long_straddle|long_strangle|null","direction":"bullish|bearish|neutral","confidence":0,"rationale":"<= 80 words","risk_plan":{"target":"","stop":"","kill":"","time":""},"rejected_alternatives":[{"strategy":"","reason":""}],"data_flags":[]}

HARD CONSTRAINTS:
1. Do NOT include legs, strikes, anchors, max_profit, max_loss, breakevens, or net_credit.
2. Use DTE = ${dte} exactly. If you cannot reconcile inputs, return DATA_ERROR.
3. confidence is integer 0–100 (>=65 = approved gate).
4. For NO_TRADE or DATA_ERROR, set strategy to null.`;

        const raw = await llm.call(reasoningModel, {
          system: 'You are a senior options strategist and risk manager. Provide independent judgment on whether a defined-risk options trade is warranted. Return JSON only — no prose, no markdown fences.',
          user: strategyPrompt,
          maxTokens: 1000,
        });

        // Parse JSON response
        let cleaned = raw.trim();
        const fm = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (fm) cleaned = fm[1].trim();
        if (!cleaned.startsWith('{')) {
          const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
          if (s !== -1 && e !== -1) cleaned = cleaned.slice(s, e + 1);
        }
        const llmPick = JSON.parse(cleaned);

        // Normalize v2 response to internal format
        const decision = llmPick.decision || 'NO_TRADE';
        const confRaw = llmPick.confidence ?? 0;
        // Convert 0-100 confidence to 0-10 for internal use (v2 uses 0-100)
        const conf10 = confRaw > 10 ? Math.round(confRaw / 10) : confRaw;
        const rp = llmPick.risk_plan || {};

        // Build legs deterministically from the LLM's strategy choice
        let v2Legs: any[] = [];
        let validationErrors: string[] = [];
        if (llmPick.strategy && llmPick.strategy !== 'null' && llmPick.strategy !== null) {
          const reasoningLegs = buildLegs({
            strategy: llmPick.strategy,
            contracts: enrichedContracts,
            spot: snapshot.price,
            gammaWalls: {
              putWall: gammaData.analysis.put_wall ?? null,
              callWall: gammaData.analysis.call_wall ?? null,
            },
            direction: (llmPick.direction || 'neutral') as 'bullish' | 'bearish' | 'neutral',
            dte,
            bwbStrikes: strategy.strikes,
          });
          if (reasoningLegs.meta.warnings.length) {
            console.log(`[Recommend] Reasoning leg builder warnings: ${reasoningLegs.meta.warnings.join('; ')}`);
          }
          v2Legs = reasoningLegs.legs.map(l => ({
            side: l.side,
            type: l.type,
            strike: l.strike,
            action: l.side === 'short' ? 'SELL' : 'BUY',
            qty: l.qty,
          }));

          // Self-validate deterministic legs
          if (v2Legs.length > 0) {
            try {
              const { validateStrategy } = await import('../shared/validate.js');
              const v = validateStrategy(llmPick.strategy, v2Legs.map(l => ({
                action: l.action, type: l.type.toUpperCase(), strike: l.strike, qty: l.qty,
              })));
              if (!v.valid) {
                validationErrors = v.errors;
                console.warn(`[Recommend] Deterministic leg validation failed for ${llmPick.strategy}: ${v.errors.join('; ')}`);
              }
            } catch (ve) { console.warn('[Recommend] Validate import failed:', ve); }
          }
        }

        // Server-side enforcement: regime consistency
        if (llmPick.regime === 'No-trade / wait' && decision !== 'NO_TRADE') {
          console.log(`[Recommend] Forcing NO_TRADE: regime "No-trade / wait" but decision was ${decision}`);
          llmPick.decision = 'NO_TRADE';
        }

        // Server-side enforcement: confidence cap when all gates failed (65 -> 64 max in 0-100 scale)
        if (passedGates === 0 && decision !== 'NO_TRADE' && confRaw >= 65) {
          console.log(`[Recommend] Capping confidence from ${confRaw} to 64 (all gates failed)`);
          llmPick.confidence = 64;
        }

        // Server-side enforcement: block APPROVED_TRADE when all gates failed
        if (passedGates === 0 && decision === 'APPROVED_TRADE') {
          console.log(`[Recommend] Downgrading APPROVED_TRADE to WATCHLIST_TRADE (all gates failed)`);
          llmPick.decision = 'WATCHLIST_TRADE';
        }

        const finalDecision = llmPick.decision || decision;
        const isNoTrade = finalDecision === 'NO_TRADE' || finalDecision === 'DATA_ERROR';

        // Build unified reasoningOverride
        const override: Record<string, any> = {
          model: reasoningModel,
          decision: finalDecision,
          strategy: isNoTrade ? 'NO_TRADE' : (llmPick.strategy || null),
          regime: llmPick.regime || null,
          reasoning: llmPick.rationale || '',
          confidence: isNoTrade ? 0 : conf10,
          suggestedLegs: isNoTrade ? [] : v2Legs,
          noTrade: isNoTrade || undefined,
          noTradeReason: isNoTrade ? (llmPick.rationale || null) : undefined,
          rejectedAlternatives: llmPick.rejected_alternatives || null,
          validationErrors: validationErrors.length ? validationErrors : undefined,
          killSwitch: rp.kill || null,
          profitTarget: rp.target || null,
          stopLoss: rp.stop || null,
          timeExit: rp.time || null,
          dataFlags: llmPick.data_flags?.length ? llmPick.data_flags : undefined,
        };

        if (!isNoTrade && override.strategy) {
          console.log(`[Recommend] ${finalDecision}: ${override.strategy} (${llmPick.direction}) conf ${confRaw}/100 via ${reasoningModel}${validationErrors.length ? ' [VALIDATION FAILED: ' + validationErrors.join('; ') + ']' : ''}`);
          enginePick = {
            strategy: override.strategy,
            direction: llmPick.direction || 'neutral',
            score: Math.max(enginePick.score, conf10 * 10),
            pillars,
            reasoningOverride: override,
          };
          gateTrace.push({
            gate: 'reasoning_override',
            passed: !validationErrors.length,
            reason: `[${reasoningModel}] ${finalDecision}: ${override.strategy} (${llmPick.direction}) conf ${confRaw}/100${validationErrors.length ? ' INVALID: ' + validationErrors[0] : ''}: ${(llmPick.rationale || '').slice(0, 200)}`,
          });
        } else {
          console.log(`[Recommend] ${finalDecision}: ${llmPick.rationale || 'no reason'}`);
          enginePick.reasoningOverride = override;
          gateTrace.push({
            gate: 'reasoning_override',
            passed: false,
            reason: `${finalDecision}: ${(llmPick.rationale || 'conditions unsuitable').slice(0, 200)}`,
          });
        }
      } catch (err: any) {
        console.warn('[Recommend] Reasoning strategy selection failed:', err.message);
        gateTrace.push({ gate: 'reasoning_override', passed: false, reason: `LLM error: ${err.message}` });
      }
    }

    // 3. Build summaries for LLM
    const indicators = computeIndicators(bars, snapshot.price);
    const technicalSummary = `RSI(14): ${indicators.rsi14} | ADX(14): ${indicators.adx14}\nSMA trend: ${indicators.smaTrend} | Price vs SMAs: ${indicators.priceVsSma}\nBollinger width: ${indicators.bollingerWidth}% | ATR(14): $${indicators.atr14}\nTrend strength: ${technicalData.trendEngine?.strength} | Vol regime: ${technicalData.volatilityEngine?.regime}`;

    const range = snapshot.price * 0.15;

    let gammaSummary = '';
    if (gammaData.analysis.walls_found !== false) {
      gammaSummary = `\n## GAMMA WALLS\nPut wall: $${gammaData.analysis.put_wall} | Call wall: $${gammaData.analysis.call_wall}\nBand width: ${gammaData.analysis.band_width_pct?.toFixed(1)}% | Confidence: ${(gammaData.analysis.confidence_score * 100).toFixed(0)}%`;
    }

    // 4. LLM explains the engine's pick — legs are already built deterministically
    llm.resetUsage();
    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const modelMode = validModes.includes(rm as any) ? rm as typeof validModes[number] : 'budget-qwq';

    // Resolve which legs to use: reasoning override may have rebuilt for a different strategy
    const finalLegs = enginePick.reasoningOverride?.suggestedLegs?.length >= 2
      ? enginePick.reasoningOverride.suggestedLegs
      : builtLegsResult.legs;

    let recommendation;
    const isNoTrade = enginePick.reasoningOverride?.noTrade === true;
    if (isNoTrade) {
      // NO_TRADE — skip advisor entirely
      console.log(`[Recommend] NO_TRADE — skipping advisor`);
      recommendation = {
        strategies: [],
        marketRead: enginePick.reasoningOverride?.reasoning || 'No trade recommended.',
      };
    } else if (finalLegs.length >= 2) {
      // Deterministic legs available — advisor only writes rationale
      recommendation = await advisor.recommend({
        ticker: tk, expiry, snapshot,
        enginePick,
        preBuiltLegs: finalLegs,
        technicalSummary, gammaSummary,
        modelMode,
      });
    } else {
      // Edge case: leg builder returned empty — use reasoning override text if available
      console.warn(`[Recommend] No deterministic legs for ${tk} — returning reasoning text only`);
      recommendation = {
        strategies: [],
        marketRead: enginePick.reasoningOverride?.reasoning || 'Could not construct legs for this setup.',
      };
    }

    // Build legacy gammaAnalysis for response (discover.html UI expects this)
    let gammaAnalysis;
    if (oiChain) {
      const analysis = findGammaWalls(oiChain, snapshot.price);
      gammaAnalysis = {
        walls: analysis.walls,
        putWallStrike: analysis.putWallStrike,
        callWallStrike: analysis.callWallStrike,
        spotInsideBand: analysis.spotInsideBand,
        oiByStrike: oiChain.strikes
          .filter((s: any) => s.strike >= snapshot.price - range && s.strike <= snapshot.price + range)
          .map((s: any) => ({ strike: s.strike, callOI: s.callOI, putOI: s.putOI })),
      };
    }

    // Engine snapshot: full gate values for Invest position logging (Layer 1)
    const rv = technicalData.realizedVol30d ? technicalData.realizedVol30d * 100 : null;
    const atmIvVal = gammaData.ivData?.atmIv ?? null;
    const engineSnapshot = {
      gateTrace,  // which gates fired and why
      gateValues: {
        blendedConfidence: gammaData.analysis.confidence_score,
        oiConfidence: gammaData.analysis.oi_confidence ?? null,
        gexConfidence: gammaData.analysis.gex_confidence ?? null,
        deltaConfidence: gammaData.analysis.delta_confidence ?? null,
        volumeConfidence: gammaData.analysis.volume_confidence ?? null,
        bandWidthPct: gammaData.analysis.band_width_pct ?? null,
        adx: technicalData.adx14 ?? null,
        trendStrength: technicalData.trendEngine?.strength ?? null,
        volatilityRegime: technicalData.volatilityEngine?.regime ?? null,
        atmIv: atmIvVal,
        ivRvRatio: (rv && rv > 0 && atmIvVal && atmIvVal > 0) ? +(atmIvVal / rv).toFixed(3) : null,
        compositeScore: enginePick.score,
        scorePillars: pillars,
        callWall: gammaData.analysis.call_wall ?? null,
        putWall: gammaData.analysis.put_wall ?? null,
      },
    };

    // 5. Enrich recommendation legs with real mid prices from the chain
    //    contracts is already filtered to the requested expiry (getOptionsSnapshot returns one expiry)
    if (recommendation.strategies) {
      for (const strat of recommendation.strategies) {
        if (strat.legs) {
          for (const leg of strat.legs) {
            // Match on strike + type (contracts are pre-filtered to this expiry)
            const match = contracts.find(c => c.strike === leg.strike && c.type === leg.type);
            if (match) {
              // Only compute mid when BOTH bid and ask exist; otherwise mark as estimated
              const hasBoth = typeof match.bid === 'number' && typeof match.ask === 'number'
                && match.bid > 0 && match.ask > 0;
              (leg as any).mid = hasBoth ? (match.bid + match.ask) / 2 : (match.mid ?? null);
              (leg as any).bid = match.bid ?? null;
              (leg as any).ask = match.ask ?? null;
              (leg as any).iv = match.iv ?? null;
              (leg as any).estimated = !hasBoth;
            }
          }
        }
      }
    }

    const response = {
      recommendation,
      enginePick,  // expose deterministic pick for transparency
      engineSnapshot,  // full gate values for Invest position logging
      snapshot,
      indicators,
      gammaAnalysis,
      cost: llm.getUsage(),
      ...(useReasoning && { strategyPrompt: strategyPrompt }),
    };
    recommendCache.set(cacheKey, response);
    return response;
  });

  // POST /api/chat — premium tier
  fastify.post('/api/chat', { preHandler: [requireTier('premium')] }, async (req) => {
    const { message, context } = req.body as { message: string; context?: Record<string, unknown>; modelMode?: string };
    const body = req.body as Record<string, unknown>;
    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-v3';
    const modeModelMap: Record<string, ModelTier> = {
      'premium': 'qwen-max', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwen-max',
    };
    const chatModel = modeModelMap[mode] ?? 'deepseek';

    const system = `You are a helpful options trading assistant on the NewLeaf Verification Desk. You have access to the full verification result for the current trade. Answer questions concisely and specifically, referencing the data you have. If the user asks about adjustments, suggest specific strikes and strategies. Keep answers under 150 words.`;

    const contextStr = context ? `\n\nCurrent verification context:\n${JSON.stringify(context, null, 2).slice(0, 4000)}` : '';

    llm.resetUsage();
    const response = await llm.call(chatModel, {
      system,
      user: message + contextStr,
      maxTokens: 500,
    });
    return { response, cost: llm.getUsage() };
  });

  // POST /api/llm/call — generic LLM call for internal services (genrecs, pipeline)
  fastify.post('/api/llm/call', { preHandler: [requireTier('basic')] }, async (req, reply) => {
    const { model, system, user, maxTokens } = req.body as {
      model?: ModelTier; system?: string; user?: string; maxTokens?: number;
    };
    if (!model || !system || !user) {
      return reply.code(400).send({ error: 'model, system, and user are required' });
    }
    llm.resetUsage();
    const response = await llm.call(model, { system, user, maxTokens: maxTokens ?? 4000 });
    return { response, model, cost: llm.getUsage() };
  });
}
