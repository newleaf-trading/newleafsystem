// deploy marker: unify-v11 (Step 2 + debit verticals — bull_call_spread/bear_put_spread now buildable)
import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { LLMRouter, type ModelTier } from '../llm/router.js';
import { getStockSnapshot, getOptionsSnapshot, getHistoricalBars } from '../tools/alpaca.js';
import { computeIndicators } from '../tools/indicators.js';
import { analyzeTechnicals, calcScore, getDirection, selectStrategy, reconcileDirection, analyzeGammaEnhanced, premiumRiskPenalty } from '../tools/strategy-engine.js';
import { fetchNasdaqOI, fetchYahooContracts, findGammaWalls } from '../tools/nasdaq-oi.js';
import { buildDecision } from '../tools/decision-engine.js';
import { computeReactionGate, applyReactionGate, type ReactionGate } from '../tools/reaction-features.js';
import { isMegaCap } from '../tools/quality-names.js';
import { buildLegs } from '../tools/leg-builder.js';
import { aiReadCache, recommendCache } from '../lib/cache.js';
import { createHash } from 'crypto';

export function registerAIRoutes(fastify: FastifyInstance, llm: LLMRouter) {

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
    let enrichedContracts = contracts.map(c => ({
      ...c, dte, expiry, openInterest: (c as any).openInterest ?? 0,
    }));

    // Alpaca's indicative feed can return an empty/sparse chain (e.g. holiday-boundary expiries),
    // and carries no OI/IV regardless. When that happens, source the full chain from Yahoo, which
    // has strikes, bid/ask/mid, IV, and OI — everything the gamma engine + leg builder need.
    if (enrichedContracts.length < 10) {
      const yahooContracts = await fetchYahooContracts(tk, expiry, dte).catch((e: any) => {
        console.warn(`[Recommend] Yahoo chain fallback failed for ${tk}/${expiry}: ${e.message}`);
        return [] as typeof enrichedContracts;
      });
      if (yahooContracts.length) {
        console.log(`[Recommend] Alpaca returned ${enrichedContracts.length} contracts for ${tk}; using ${yahooContracts.length} from Yahoo chain.`);
        enrichedContracts = yahooContracts;
      }
    }

    // Merge OI + IV into contracts. Alpaca's indicative feed returns no OI/greeks/IV, so
    // openInterest and iv come from the Yahoo OI service — without this, gamma walls (OI/GEX)
    // and atmIv are structurally 0 for every ticker.
    if (oiChain?.strikes) {
      for (const c of enrichedContracts) {
        const oiStrike = oiChain.strikes.find((s: any) => Math.abs(s.strike - c.strike) < 0.01);
        if (oiStrike) {
          c.openInterest = c.type === 'call' ? oiStrike.callOI : oiStrike.putOI;
          const iv = c.type === 'call' ? oiStrike.callIv : oiStrike.putIv;
          if ((c.iv == null || c.iv === 0) && iv != null && iv > 0) c.iv = iv;
        }
      }
    }

    const gammaData = analyzeGammaEnhanced(enrichedContracts, snapshot.price, 0, 60, null);
    const { total: score, pillars, hasOptions } = calcScore(gammaData, technicalData);
    const trendDirection = getDirection(gammaData, technicalData);
    const strategy = selectStrategy(gammaData, trendDirection, snapshot.price, technicalData);
    const direction = reconcileDirection(trendDirection, strategy.code);

    // ── Step 2 (engine unification): the SHARED reaction gate (same as movement-range + pipeline).
    //    Runs the full S/R pipeline + mapBias with the falling-knife veto, then either vetoes
    //    (trend into a zone), promotes a NEUTRAL gamma pick to the aligned directional spread, or
    //    keeps the gamma pick. Distance (testing vs approaching) drives the decision tier.
    let effStrategy = strategy.code;
    let effDirection: 'bullish' | 'bearish' | 'neutral' = direction as any;
    let reactionGate: ReactionGate | null = null;
    let reactionNote: string | null = null;
    let reactionFlag: string | null = null;
    let reactionChanged = false;
    let reactionVeto = false;
    let reactionApproaching = false;
    try {
      const atmIvR = gammaData.ivData?.atmIv || 0;
      const rvR = technicalData.realizedVol30d ? technicalData.realizedVol30d * 100 : null;
      reactionGate = computeReactionGate({
        spot: snapshot.price, bars,
        putWall: gammaData.analysis.put_wall ?? null, callWall: gammaData.analysis.call_wall ?? null,
        sma50: technicalData.sma50 ?? null, sma100: technicalData.sma100 ?? null, sma200: technicalData.sma200 ?? null,
        bbLower: (technicalData as any).bb?.lower ?? null, bbUpper: (technicalData as any).bb?.upper ?? null,
        atrPct: (technicalData as any).atrPct ?? null, adx: technicalData.adx14 ?? null,
        ivRv: (rvR && rvR > 0 && atmIvR > 0) ? atmIvR / rvR : null,
        gammaConfidence: gammaData.analysis.confidence_score ?? 0,
        rsi: technicalData.rsi ?? null, isQualityName: isMegaCap(tk),
      });
      const act = applyReactionGate(strategy.code, reactionGate);
      if (act) {
        reactionNote = act.note;
        if (act.veto) {
          reactionVeto = true;
          reactionFlag = act.flag || null;
          console.log(`[Recommend] Reaction VETO (${tk}) [${act.flag}]: ${act.note}`);
        } else if (act.strategy) {
          reactionChanged = true;
          reactionFlag = act.flag || null;
          effStrategy = act.strategy;
          effDirection = act.direction as 'bullish' | 'bearish';
          reactionApproaching = !act.testing;
          console.log(`[Recommend] Reaction gate (${tk}) [${act.flag}]: ${strategy.code} → ${effStrategy} — ${act.note}`);
        }
      }
    } catch (e: any) { console.warn(`[Recommend] reaction gate failed for ${tk}: ${e.message}`); }

    // Deterministic leg construction — replaces LLM strike picking
    const gammaWallsForLegs = {
      putWall: gammaData.analysis.put_wall ?? null,
      callWall: gammaData.analysis.call_wall ?? null,
    };
    let builtLegsResult = buildLegs({
      strategy: effStrategy,
      contracts: enrichedContracts,
      spot: snapshot.price,
      gammaWalls: gammaWallsForLegs,
      direction: effDirection,
      dte,
      bwbStrikes: strategy.strikes,
    });

    // Fallback: if the reaction overlay re-routed the pick (e.g. iron_condor → bull_call_spread)
    // but that strategy can't be constructed for this chain, DON'T throw the whole trade away —
    // fall back to the original gamma pick, which already passed its gates. Otherwise a valid
    // structure is discarded and the user sees a misleading "can't build" NO_TRADE.
    if (reactionChanged && builtLegsResult.legs.length < 2 && effStrategy !== strategy.code) {
      console.log(`[Recommend] Reaction re-route ${effStrategy} failed to build for ${tk} — falling back to gamma pick ${strategy.code}`);
      effStrategy = strategy.code;
      effDirection = direction as any;
      reactionChanged = false;
      reactionApproaching = false;
      reactionNote = null;
      builtLegsResult = buildLegs({
        strategy: effStrategy,
        contracts: enrichedContracts,
        spot: snapshot.price,
        gammaWalls: gammaWallsForLegs,
        direction: effDirection,
        dte,
        bwbStrikes: strategy.strikes,
      });
    }

    if (builtLegsResult.meta.warnings.length) {
      console.log(`[Recommend] Leg builder warnings for ${tk}: ${builtLegsResult.meta.warnings.join('; ')}`);
    }

    // Down-score a credit structure when premium is thin (IV/RV < 1) — same
    // penalty the scanner applies, so discover and scanner agree on the number.
    const { penalty: premPenalty, reasons: premReasons } = premiumRiskPenalty(effStrategy, gammaData, technicalData);
    const baseScore = (!reactionChanged && strategy.bwbBonus) ? score + strategy.bwbBonus : score;
    let enginePick: {
      strategy: string; direction: string; score: number;
      pillars: typeof pillars; reasoningOverride?: any; premiumPenalty?: number; premiumReasons?: string[];
    } = {
      strategy: effStrategy,
      direction: effDirection,
      score: Math.max(0, baseScore + premPenalty),
      pillars,
      premiumPenalty: premPenalty,
      premiumReasons: premReasons,
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

    // 2b. Deterministic decision (replaces the LLM strategy-selection step).
    //     The engine already SELECTED + SCORED the strategy; here we classify the regime,
    //     decide go/no-go from score + gates + data sufficiency, and build a risk plan — all
    //     deterministically. An LLM is used only to NARRATE (eval page), never to decide.
    const useReasoning = true; // a decision is always produced now
    let strategyPrompt = '';

    const ind0 = computeIndicators(bars, snapshot.price);
    const sma20d = technicalData.sma20 ?? ind0.sma20 ?? null;
    const sma50d = technicalData.sma50 ?? ind0.sma50 ?? null;
    const atrDollar = (technicalData as any).atr14 ?? ind0.atr14 ?? null;
    const ivRvRatioNum = (rvPct && rvPct > 0 && atmIvGate > 0) ? +(atmIvGate / rvPct).toFixed(2) : null;
    void atrDollar; // (retained for indicators; IV/RV absence — not ATR — is what gates premium selling)
    const noVolData = ivRvRatioNum === null; // no implied-vol read → can't justify selling premium
    const gammaReliable = conf >= 0.30;
    const passedGates = gateTrace.filter(g => g.gate !== 'iron_butterfly (fallback)' && g.passed).length;
    const hasOI = enrichedContracts.some(c => ((c as any).openInterest ?? 0) > 0);
    const missingInputs = [ivRvRatioNum === null, !gammaReliable, !hasOI].filter(Boolean).length;
    const pwall = gammaData.analysis.put_wall ?? null;
    const cwall = gammaData.analysis.call_wall ?? null;
    const spotInBand = pwall != null && cwall != null && snapshot.price > pwall && snapshot.price < cwall;

    // Legs are built from the engine's chosen strategy by the fail-closed builder above.
    const detLegs = builtLegsResult.legs.map(l => ({
      side: l.side, type: l.type, strike: l.strike, action: l.side === 'short' ? 'SELL' : 'BUY', qty: l.qty,
    }));

    // Price the structure from chain mids so the DECISION ENGINE (not just the client) knows
    // whether a credit structure actually collects a credit. Honors per-leg qty (e.g. a 1-2-1
    // broken-wing butterfly's ×2 body). null if any leg has no usable quote.
    let netCreditPriced: number | null = 0;
    for (const l of builtLegsResult.legs) {
      const c = enrichedContracts.find(ec => (ec as any).type === l.type && Math.abs((ec as any).strike - l.strike) < 0.5);
      const bid = (c as any)?.bid, ask = (c as any)?.ask, midRaw = (c as any)?.mid;
      const mid = (typeof bid === 'number' && typeof ask === 'number' && bid > 0 && ask > 0)
        ? (bid + ask) / 2
        : (typeof midRaw === 'number' && midRaw > 0 ? midRaw : null);
      if (mid == null) { netCreditPriced = null; break; }
      netCreditPriced += (l.side === 'short' ? mid : -mid) * (l.qty ?? 1);
    }

    const det = buildDecision({
      spot: snapshot.price, dte,
      strategy: effStrategy, direction: effDirection,
      score: enginePick.score, passedGates,
      adx: technicalData.adx14 ?? null, rsi: technicalData.rsi ?? null,
      sma20: sma20d, sma50: sma50d, gammaReliable, spotInBand,
      ivRvRatio: ivRvRatioNum, noVolData, missingInputs,
      netCredit: netCreditPriced,
      legsBuilt: detLegs.length >= 2,
      putWall: pwall, callWall: cwall,
      gammaConfidencePct: Math.round(conf * 100), bandWidthPct: bw,
      reactionVeto, reactionApproaching, reactionNote, reactionFlag,
    });
    const detNoTrade = det.decision === 'NO_TRADE' || det.decision === 'DATA_ERROR';
    if (reactionChanged && !detNoTrade) det.dataFlags.push('reaction_promoted');

    // Fully deterministic — the rationale is the engine's template. No LLM is called anywhere
    // in the recommendation path. (sm is accepted only to vary the cache key on the eval page.)
    void sm;
    const rationale = det.rationale + (reactionNote && !detNoTrade ? ` ${reactionNote}.` : '');

    strategyPrompt = `DETERMINISTIC DECISION\n${det.decision} - ${effStrategy} (${det.direction})\nRegime: ${det.regime}\nScore: ${enginePick.score}/100 | gates passed: ${passedGates}${reactionNote ? `\nReaction: ${reactionNote}` : ''}\nFlags: ${det.dataFlags.join(', ') || 'none'}`;

    const override: Record<string, any> = {
      model: 'deterministic-engine',
      decision: det.decision,
      strategy: detNoTrade ? 'NO_TRADE' : effStrategy,
      direction: enginePick.direction,
      regime: det.regime,
      reasoning: rationale,
      confidence: detNoTrade ? 0 : Math.round(enginePick.score / 10),
      suggestedLegs: detNoTrade ? [] : detLegs,
      noTrade: detNoTrade || undefined,
      noTradeReason: detNoTrade ? rationale : undefined,
      rejectedAlternatives: det.rejectedAlternatives.length ? det.rejectedAlternatives : null,
      killSwitch: det.riskPlan.kill || null,
      profitTarget: det.riskPlan.target || null,
      stopLoss: det.riskPlan.stop || null,
      timeExit: det.riskPlan.time || null,
      dataFlags: det.dataFlags.length ? det.dataFlags : undefined,
    };
    enginePick.reasoningOverride = override;
    gateTrace.push({
      gate: 'deterministic_decision',
      passed: !detNoTrade,
      reason: `${det.decision}: ${detNoTrade ? 'NO_TRADE' : effStrategy} (${det.direction}) score ${enginePick.score}/100 - ${det.regime}${reactionChanged ? ' [reaction→' + effStrategy + ']' : ''}${det.dataFlags.length ? ' [' + det.dataFlags.join(',') + ']' : ''}`,
    });

    // 3. Build the recommendation deterministically — NO LLM. Rationale is the engine template;
    //    legs come from the fail-closed leg builder. The whole path is now model-free.
    const indicators = computeIndicators(bars, snapshot.price);
    const range = snapshot.price * 0.15;
    llm.resetUsage();  // no model calls — cost reports as $0

    const finalLegs = enginePick.reasoningOverride?.suggestedLegs?.length >= 2
      ? enginePick.reasoningOverride.suggestedLegs
      : builtLegsResult.legs;

    const ratioText = enginePick.reasoningOverride?.reasoning || '';
    const isNoTrade = enginePick.reasoningOverride?.noTrade === true;
    let recommendation: { strategies: any[]; marketRead: string };
    if (isNoTrade || finalLegs.length < 2) {
      recommendation = {
        strategies: [],
        marketRead: ratioText || (isNoTrade ? 'No trade recommended.' : 'Could not construct legs for this setup.'),
      };
    } else {
      recommendation = {
        strategies: [{
          strategy: enginePick.strategy,
          direction: enginePick.direction,
          legs: finalLegs.map((l: any) => ({ type: l.type, side: l.side, strike: l.strike, qty: l.qty ?? 1 })),
          rationale: ratioText,
          score: enginePick.score,
        }],
        marketRead: ratioText,
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

    // Step 5 (outcome tracking, Layer 1): persist a deterministic recommendation snapshot so the
    // engine score can later be correlated to realized P&L. Fire-and-forget, non-blocking, and
    // skipped for the eval page's per-model fanout (which passes strategyModel) to avoid dupes.
    // Awaited (not fire-and-forget): Cloud Run can freeze the instance after the response
    // returns, which would silently drop a backgrounded write. A Firestore add is ~50ms.
    if (!sm) {
      const ro = enginePick.reasoningOverride || {};
      try {
        const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
        await getFirestore('newleafdb').collection('recommendation_snapshots').add({
          ticker: tk, expiry, dte,
          spot: snapshot.price,
          decision: ro.decision ?? null,
          strategy: ro.noTrade ? null : enginePick.strategy,
          direction: enginePick.direction,
          regime: ro.regime ?? null,
          score: enginePick.score,
          confidence: ro.confidence ?? null,
          pillars,
          gateValues: engineSnapshot.gateValues,
          legs: ro.suggestedLegs ?? [],
          dataFlags: ro.dataFlags ?? [],
          riskPlan: { target: ro.profitTarget ?? null, stop: ro.stopLoss ?? null, kill: ro.killSwitch ?? null, time: ro.timeExit ?? null },
          createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`[Recommend] snapshot persisted: ${tk} ${ro.decision} ${ro.noTrade ? '' : enginePick.strategy}`);
      } catch (e: any) {
        console.warn(`[Recommend] Snapshot persist failed for ${tk}: ${e.message}`);
      }
    }

    const response = {
      recommendation,
      enginePick,  // expose deterministic pick for transparency
      engineSnapshot,  // full gate values for Invest position logging
      reactionFeatures: reactionGate,  // Step 2: shared S/R reaction gate result (advisory)
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
