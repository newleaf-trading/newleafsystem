/**
 * Projection engine — pure, deterministic simulation for the Projection dashboard.
 *
 * Architecture rule: CODE COMPUTES EVERY NUMBER. No LLM, no DOM, no React here.
 * All randomness flows through a SEEDED PRNG keyed off the input state, so:
 *   (a) identical inputs always yield identical projections (reproducible/testable), and
 *   (b) the Monte-Carlo band does not flicker while a slider is dragged.
 *
 * State shape (human units, fractions for rates):
 *   { cap:Number($), yrs:Int, tpy:Int, wr:0..1, aw:0..1, al:0..1, capPct:0..1 }
 */

/** Seeded PRNG. Returns a function producing floats in [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round4 = (x) => Math.round(x * 1e4) / 1e4;

/** Deterministic 32-bit hash (FNV-1a) of the inputs → MC seed. */
export function seedFromState(s) {
  const str = [s.cap, s.yrs, s.tpy, round4(s.wr), round4(s.aw), round4(s.al), round4(s.capPct)].join('|');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Loss magnitude actually applied: the average loss, hard-capped by the max-loss ceiling. */
export function cappedLoss(s) {
  return Math.min(s.al, s.capPct);
}

/** Expected value (edge) per trade = win rate × avg win − loss rate × capped loss. */
export function evPerTrade(s) {
  return s.wr * s.aw - (1 - s.wr) * cappedLoss(s);
}

/** Deterministic expected compounding curve, length total+1 (index 0 = starting capital). */
export function expectedCurve(s) {
  const total = s.tpy * s.yrs;
  const ev = evPerTrade(s);
  const arr = new Array(total + 1);
  arr[0] = s.cap;
  for (let i = 1; i <= total; i++) arr[i] = arr[i - 1] * (1 + ev);
  return arr;
}

/**
 * Monte-Carlo band over `runs` seeded paths. Each trade applies a magnitude jitter
 * (0.65–1.35); losses still respect the hard cap. Returns percentile band at sampled
 * x-positions plus final-value percentiles, worst path, and losing-path probability.
 */
export function monteCarlo(s, { runs = 240 } = {}) {
  const total = s.tpy * s.yrs;
  const rand = mulberry32(seedFromState(s));
  const paths = [];
  for (let p = 0; p < runs; p++) {
    let v = s.cap;
    const arr = new Array(total + 1);
    arr[0] = v;
    for (let i = 1; i <= total; i++) {
      const jit = 0.65 + rand() * 0.7; // 0.65–1.35 magnitude jitter
      if (rand() < s.wr) v *= 1 + s.aw * jit;
      else v *= 1 - Math.min(s.al * jit, s.capPct); // loss respects the hard cap
      arr[i] = v;
    }
    paths.push(arr);
  }

  const SAMPLES = Math.max(1, Math.min(120, total));
  const band = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const idx = Math.round((k / SAMPLES) * total);
    const col = paths.map((pp) => pp[idx]).sort((a, b) => a - b);
    band.push({
      x: idx,
      p10: col[Math.floor(runs * 0.1)],
      p50: col[Math.floor(runs * 0.5)],
      p90: col[Math.floor(runs * 0.9)],
    });
  }

  const finals = paths.map((pp) => pp[total]).sort((a, b) => a - b);
  const below = finals.filter((f) => f < s.cap).length;
  return {
    p10: finals[Math.floor(runs * 0.1)],
    p50: finals[Math.floor(runs * 0.5)],
    p90: finals[Math.floor(runs * 0.9)],
    worst: finals[0],
    losingRisk: below / runs,
    band,
  };
}

/**
 * Percentile band {p10,p50,p90} at a SINGLE trade index, from the same seeded MC
 * as monteCarlo(). Used by the adherence tracker to place actual equity within the
 * plan's expected band at the elapsed point. `tradeIndex` is clamped to [0, total].
 */
export function percentilesAtTrade(s, tradeIndex, { runs = 240 } = {}) {
  const total = s.tpy * s.yrs;
  const idx = Math.max(0, Math.min(total, Math.round(tradeIndex)));
  const rand = mulberry32(seedFromState(s));
  const col = new Array(runs);
  for (let p = 0; p < runs; p++) {
    let v = s.cap;
    for (let i = 1; i <= idx; i++) {
      const jit = 0.65 + rand() * 0.7; // 0.65–1.35 magnitude jitter (matches monteCarlo)
      if (rand() < s.wr) v *= 1 + s.aw * jit;
      else v *= 1 - Math.min(s.al * jit, s.capPct);
    }
    col[p] = v;
  }
  col.sort((a, b) => a - b);
  return {
    p10: col[Math.floor(runs * 0.1)],
    p50: col[Math.floor(runs * 0.5)],
    p90: col[Math.floor(runs * 0.9)],
  };
}

/** Per-trade translation into real dollars at the current portfolio size. */
export function dollarTranslation(s) {
  return {
    riskPerTrade: s.capPct * s.cap,
    typicalWin: s.aw * s.cap,
    typicalLoss: cappedLoss(s) * s.cap,
  };
}

/**
 * Pick the payoff structure that fits the current reward:risk.
 *
 * DOCUMENTED FALLBACK PATH: the shared engine's selectStrategy() needs real
 * gamma/spot/technical inputs that this simulator does not have, so we cannot
 * call it without fabricating market data. The R:R heuristic below is used
 * instead; structure `key`s are aligned to the shared STRATEGIES naming.
 * Returns a normalized (0..1 x-axis) schematic payoff shape for illustration.
 */
export function pickStructure(rr) {
  if (rr < 1.4)
    return {
      key: 'IRON_CONDOR',
      name: 'Iron Condor',
      now: 0.5,
      points: [[0, -1], [0.13, -1], [0.30, rr], [0.70, rr], [0.87, -1], [1, -1]],
      desc: 'Range-bound. Profit if price holds between the strikes; both tails capped.',
    };
  if (rr < 1.9)
    return {
      key: 'IRON_BUTTERFLY',
      name: 'Iron Butterfly',
      now: 0.5,
      points: [[0, -1], [0.17, -1], [0.5, rr], [0.83, -1], [1, -1]],
      desc: 'Tighter range, bigger payoff at the centre. More reward, narrower win zone.',
    };
  return {
    key: 'BULL_CALL',
    name: 'Bull-Call Spread',
    now: 0.40,
    points: [[0, -1], [0.33, -1], [0.67, rr], [1, rr]],
    desc: 'Lean bullish, capped both ways. Larger reward if price drifts up.',
  };
}

/** Compose the full projection result the dashboard renders. */
export function simulate(s) {
  const total = s.tpy * s.yrs;
  const ev = evPerTrade(s);
  const expected = expectedCurve(s);
  const mc = monteCarlo(s);
  const dollars = dollarTranslation(s);
  const lossMag = cappedLoss(s);
  const rr = lossMag > 0 ? s.aw / lossMag : 0;
  const structure = pickStructure(rr);

  return {
    total,
    ev,
    expected,
    finalExpected: expected[total],
    band: mc.band,
    p10: mc.p10,
    p50: mc.p50,
    p90: mc.p90,
    worst: mc.worst,
    losingRisk: mc.losingRisk,
    lossMag,
    rr,
    structure,
    dollars,
  };
}

/** Canonical presets (fractions for rates), matching the prototype. */
export const PRESETS = {
  cons: { tpy: 100, wr: 0.60, aw: 0.010, al: 0.010, capPct: 0.010 },
  base: { tpy: 120, wr: 0.62, aw: 0.012, al: 0.010, capPct: 0.010 },
  high: { tpy: 200, wr: 0.65, aw: 0.012, al: 0.010, capPct: 0.010 },
};

export const BASE_STATE = { cap: 100000, yrs: 1, ...PRESETS.base };
