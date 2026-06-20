# NewLeaf System — Core Architecture Spec

**Status:** Verified against code (extraction pass, 2026-05-26). Every value below was pulled from source, not described from intent. Where the code and prior assumptions diverged, the code wins and the divergence is noted.

**Scope:** The recommendation algorithm and how the three surfaces (scanner / discover / invest) are linked. Data infrastructure (R2 manifest, daily-run timing) is summarized, not exhaustively specified — see the Infrastructure appendix.

---

## 1. The three systems

| System | URL | Role | Holds state? | Uses LLM? |
|--------|-----|------|--------------|-----------|
| **Scanner** | `/workbench/all-stocks.html` | Bulk-screens the universe (~111 symbols), one recommendation per symbol. Free tier. | No — stateless, pre-computed to R2 | **No** — pure data + math |
| **Discover** | `/workbench/discover.html` | Deep-dive on one symbol. Engine picks the strategy; LLM explains it. Premium. | No — computed per request | **Yes** — explain-only |
| **Invest** | (Invest surface) | Holds recommendations as positions over time; tracks outcomes. | **Yes** — position lifecycle | (planned) |

**The linkage in one sentence:** Scanner and discover run the *same deterministic engine* (`strategy-engine.js`) to decide *what* to recommend; discover adds an LLM layer that *explains* the decision without changing it; Invest (next build) takes those recommendations and tracks what *happened* to them.

---

## 2. One shared engine — the source of truth

**File:** `pipeline/strategy-engine.js` — pure functions, no I/O.

**Exports:** `calcSMA, calcBB, calcRSI, calcADX, calcRealizedVol, calcATRPct, analyzeTechnicals, calcScore, getDirection, selectStrategy, reconcileDirection, STRATEGIES, roundToStrike, calculateBWBStrikes, scoreBWB`

**How both surfaces use it:**
- Scanner: `pipeline/newleaf-pipeline.js` → `require('./strategy-engine')`
- Discover: `api/src/tools/strategy-engine.ts` → `createRequire` bridge loads the same CJS file → re-exported as TS → consumed by `api/src/routes/ai.ts`

**Same file, confirmed.** The strategy *logic* (`selectStrategy`, `calcScore`, `getDirection`) is genuinely shared — there is no parallel implementation of the decision logic.

**Data-layer caveat (important):** the engine is shared, but the *data fed into it* is fetched by surface-specific paths that are parallel, not shared:
- OI fetch: scanner uses `getNasdaqOIMap`/`getYahooOIMap`; API uses `fetchNasdaqOI`.
- IV rank: computed by scanner only; API does not compute it.
- **OI delta: currently DARK on both sides** (see §5) — so this does not cause divergence today.
These paths are believed to converge in output, but are not the same code. Treated as a known item.

**Dead code noted:** `newleaf-pipeline.js:409–469` `analyzeGamma()` is never called (superseded by `gamma-analyzer-enhanced.js`). Flagged for removal.

---

## 3. What we analyse — four signals, two data sources

| Signal | What it measures | Source | Key fields |
|--------|------------------|--------|-----------|
| **Gamma / GEX** | Where dealers hedge — the walls price tends to stay between | Alpaca OPRA feed (greeks) + Open Interest from Nasdaq public API (fallback: Yahoo Cloud Function) | gamma, delta, iv per contract; `c_Openinterest`/`p_Openinterest` |
| **IV** | How expensive options are | Alpaca option snapshots (midIV) | ATM IV = avg of contracts within 5% of spot, in % form |
| **Technicals** | Trend, momentum, volatility regime | Alpaca daily stock bars (400-day window) | RSI14, SMA 20/50/100/200, ADX14, Bollinger width, ATR, RealizedVol30d |
| **Volume** | Whether strikes are actually trading | Alpaca stock + option snapshots | stock + per-contract volume |

**Bar window:** 400 calendar days — enables SMA200 (needs 200 bars), ADX14, RSI14, BB20, RealizedVol30d. (This fixed the earlier silent-null SMA200 bug where only ~172 bars were fetched.)

---

## 4. How a recommendation is built — the algorithm

### Step A — Blended confidence (how trustworthy is the gamma wall?)
File: `gamma-analyzer-enhanced.js:162`
```
confidence = 0.40 × OI_conf  +  0.35 × GEX_conf  +  0.15 × delta_conf  +  0.10 × volume_conf
```
*(delta term currently forced to 0 — see §5)*

Each component, from code:
- **OI_conf** — strike coverage: ≥80% coverage → 0.85+, ≥50% → 0.65+, else coverage×1.3
- **GEX_conf** — `wallStrength = (maxCallGex+maxPutGex)/totalGex`; `bandBonus = max(0, 1−bandWidth/20)`; `base = wallStrength×0.7 + bandBonus×0.3`; `final = min(1, base×0.6 + multiFactorBonus×0.4)`
- **delta_conf** — `coverage×0.6 + magnitude×0.4` (OI-change based)
- **volume_conf** — `min(avgVolume/500, 1)`

> **Weights are intuition-based, NOT outcome-validated.** No accuracy claim until outcome tracking validates them.

### Step B — Trend (direction + strength + vol regime)
File: `strategy-engine.js:86–109`
- **Direction** (discrete trendScore): bullish if spot>SMA50>SMA100 (0.8); bearish if reverse (0.2); else neutral (0.5). Label: >0.6 bullish, <0.4 bearish, else neutral.
- **Strength** (ADX14): >30 strong, ≥20 moderate, <20 weak. (null → moderate)
- **Volatility regime** (Bollinger width): <5% squeeze, >15% expansion, else normal.
- **Momentum flag** (RSI14, warning only): >75 overbought, <25 oversold. Not a gate.

> **Note:** direction is *discrete* (5 values); ADX *attenuates* it in scoring but does not make direction itself continuous. "ADX-attenuated, not ADX-native."

### Step C — Composite score /100
File: `strategy-engine.js:124`
```
score = gammaPillar(/40) + ivPillar(/35) + trendPillar(/25)
```
- **Gamma /40** — wall quality × 0.6 + band quality × 0.4 (degrades to /28 OI-only, /22 technical-proxy)
- **IV /35** — peaks for ATM IV in 20–50% range
- **Trend /25** — `(0.5 + |trendScore−0.5| × strengthMult) × 25`, where strengthMult = **1.0 strong / 0.7 moderate / 0.3 weak**. *This is the ADX-aware pillar — confirmed shipped.*

### Step D — Strategy cascade (first gate that opens wins)
File: `strategy-engine.js:227`

| # | Strategy | Gate condition (from code) |
|---|----------|---------------------------|
| 1 | **Iron Condor** | blended conf ≥ 0.60 AND band 3–15% AND contracts ≥ 50 |
| 2 | **Broken Wing Butterfly** | (band >15–40% AND conf ≥0.15) OR (band >10–35% AND conf ≥0.30 AND ATM IV ≥25%) |
| 3 | **Bull Put / Bear Call** | direction bullish/bearish AND conf >0.4 AND **trendStrength ≠ weak** (ADX ≥20) |
| 4 | **Calendar Spread** | neutral AND ATM IV <25% AND **IV/RV < 1.0** (cheap vol) — with null guard |
| 5 | ~~Diagonal~~ | **DEFERRED** — defined in `STRATEGIES` but gate is a comment only. Needs ADX 15–25 + IV/RV<1.0 population. |
| 6 | **Iron Butterfly** | fallback — "no strong signal in any direction" (honest default, not a failure) |

**6 active strategies.** Diagonal is present-but-inactive (deferred after its first gate was reverted for buying rich vol).

> **IV measurement principle (hard-won):** vega-LONG structures (calendar, diagonal) gate on **IV/RV** (want cheap vol); vega-SHORT structures (BWB, condor, butterfly, IV pillar) use **absolute IV** (want rich vol). They are opposite. Audited and confirmed correct.

---

## 5. The LLM boundary (discover only)

- **Scanner: zero LLM calls.** No model imports, no AI references. Pure data + math + R2 upload.
- **Discover: LLM explains, does not decide.** `advisor.ts` system prompt: *"Do NOT change the strategy selection or re-rank. The engine decided; you explain."*
- **Consistency check:** regex-based (`advisor.ts:45`) — flags CONTRADICTION (directional words against opposite pick) and TENSION (directional language on a neutral strategy). Currently logged to console, **not surfaced to the user.** *(Known limitation: regex catches crude contradictions, not subtle ones where vocabulary is consistent but reasoning undermines the pick. Phase 4 validated 0/15 disagreements favored the LLM, confirming engine-decides.)*

---

## 6. Delta — currently DARK (consistency safeguard)

File: `gamma-analyzer-enhanced.js:171` — `const DELTA_DARK = true;`

- delta_confidence is **computed and output** (for Wednesday's diagnostic) but **forced to 0 in the blend** that drives gates, on **both** surfaces.
- **Why:** discover's API server cannot read OI history (it lives on the scanner's local filesystem), so discover structurally gets null delta. If the scanner used live delta and discover didn't, the *same ticker could get different strategies* — re-introducing the divergence the unification killed. DARK keeps both surfaces identical.
- **Single reversible switch:** one flag, one file; both surfaces flip together (shared import).
- **The real fix (committed, next after Invest Layer 1):** scanner publishes OI history to a shared store (R2/Firestore); API reads it; shape-match verified; end-to-end proof that delta_confidence is *identical* on both surfaces; *then* flip DELTA_DARK off.

---

## 7. Honest status

**The engine DISCRIMINATES (validated):** six strategies, healthy distribution, ADX-aware trend, vol-correct gates, consistent across both surfaces. Verified live (GOOG matched scanner=discover).

**The engine is NOT OUTCOME-VALIDATED (the gap):** every weight (confidence blend, score pillars, ADX multiplier, 0.60 gate) is informed intuition. No real trade outcomes have tuned them. **No accuracy / win-rate / hit-rate claim in any UI or marketing until outcome tracking (Invest) feeds back real results.**

---

## 8. What's linked to what (summary diagram)

```
        Alpaca (greeks, bars, IV, volume)   Nasdaq/Yahoo (OI)
                          │
                          ▼
              ┌───────────────────────┐
              │  strategy-engine.js   │   ← ONE shared engine
              │  analyzeTechnicals    │
              │  calcScore            │
              │  getDirection         │
              │  selectStrategy       │
              └───────────┬───────────┘
                ┌─────────┴─────────┐
                ▼                   ▼
         ┌────────────┐      ┌────────────┐
         │  SCANNER   │      │  DISCOVER  │
         │ all-stocks │      │  +  LLM    │ ← explains the pick, can't change it
         │ → R2       │      │  (premium) │
         └─────┬──────┘      └─────┬──────┘
               └────────┬──────────┘
                        ▼
                  ┌──────────┐
                  │  INVEST  │ ← (next) holds picks as positions,
                  │          │    tracks outcomes → tunes weights
                  └──────────┘
```

---

## Appendix — Infrastructure (summary)
- Scanner runs daily (~9:32 ET), computes all symbols, writes per-symbol reports + a manifest to **Cloudflare R2**.
- Discover computes per-request via the API (Alpaca + Nasdaq fetched live).
- OI history (for delta) currently local FS on the scanner; to move to shared store as part of the delta (a) fix.
- Stack: Firebase/Firestore (auth, usage), R2 (reports), Alpaca (market data), Claude API (discover LLM).

## Appendix — Known debt (verified current)
1. **Delta DARK** — intentional; real fix committed (§6).
2. **Diagonal deferred** — structure defined, gate is a comment; needs ADX 15–25 + cheap-vol population.
3. **Dead `analyzeGamma()`** in pipeline — remove.
4. **Parallel data paths** (OI fetch, IV rank) scanner vs API — believed convergent, not verified identical.
5. **Outcome validation absent** — the one gap between "discriminating" and "accurate."
