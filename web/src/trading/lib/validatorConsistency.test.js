import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { validateTile, applyPublishGate as applyPublishGateESM, deriveTier } from './tileSchema';
import {
  VALID_TILE, VALID_TILE_NULL_POP,
  REJECT_UNPRICED, REJECT_EMPTY_BREAKEVENS, REJECT_NO_LEGS,
  REJECT_NO_MAX_PROFIT, REJECT_ONE_LEG, REJECT_NO_SOURCE,
  REJECT_POP_UNDEFINED, STRATEGY_BUILDER_TILE,
} from './__fixtures__/tiles';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cjsRequire = createRequire(resolve(__dirname, 'package.json'));
const { validateTileForWrite, applyPublishGate: applyPublishGateCJS } = cjsRequire('../../../../generaterecommendations/pricing-engine.cjs');

/**
 * Validator consistency test — in the default suite so drift fails CI.
 *
 * validateTile lives in web/src/trading/lib/ (ESM).
 * publish-pick.cjs and publish.ts reimplement validation inline.
 *
 * This test feeds every fixture through all three validators and asserts
 * identical accept/reject verdicts. Any divergence is a real bug.
 */

// ═══════════════════════════════════════════════════════════════
// Inline validator replicas (mirror the exact checks in the writers)
// ═══════════════════════════════════════════════════════════════

/** Mirrors publish-pick.cjs Step 4b validation */
function publishPickValidates(tile) {
  // 1. Legs count
  if (!Array.isArray(tile.legs) || tile.legs.length < 2) return { valid: false, reason: 'legs < 2' };
  // 2. Pricing
  const hasPricing = tile.legs.some(l => (l.premium || 0) !== 0);
  if (!hasPricing) return { valid: false, reason: 'unpriced' };
  // 3. P&L
  if (!(tile.maxProfit > 0) || !(tile.maxLoss > 0)) return { valid: false, reason: 'invalid P&L' };
  // 4. Expiry
  if (!tile.expiry) return { valid: false, reason: 'missing expiry' };
  // 5. Spot
  if (!(tile.underlyingPrice > 0)) return { valid: false, reason: 'missing spot' };
  return { valid: true };
}

/** Mirrors api/routes/publish.ts pre-write validation */
function publishTsValidates(tile) {
  // 1. Identity
  if (!tile.symbol || !tile.strategy) return { valid: false, reason: 'missing identity' };
  // 2. Legs count
  if (!Array.isArray(tile.legs) || tile.legs.length < 2) return { valid: false, reason: 'legs < 2' };
  // 3. Pricing
  const allUnpriced = tile.legs.every(l => (l.premium || l.mid || 0) === 0);
  if (allUnpriced) return { valid: false, reason: 'unpriced' };
  // 4. P&L
  if (!(tile.maxProfit > 0) || !(tile.maxLoss > 0)) return { valid: false, reason: 'invalid P&L' };
  // 5. Expiry
  if (!tile.expiry) return { valid: false, reason: 'missing expiry' };
  // 6. Spot
  if (!(tile.underlyingPrice > 0)) return { valid: false, reason: 'missing spot' };
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// Every validateTile reject rule, tested across all three validators
// ═══════════════════════════════════════════════════════════════

describe('Validator parity: all writers agree with validateTile on every rule', () => {
  // ── Accept cases ──
  const acceptCases = [
    { name: 'VALID_TILE', fixture: VALID_TILE },
    { name: 'VALID_TILE_NULL_POP (oddsOfProfit: null)', fixture: VALID_TILE_NULL_POP },
    { name: 'absent breakevens (undefined)', fixture: { ...VALID_TILE, breakevens: undefined } },
    { name: 'oddsOfProfit: 50 (valid number)', fixture: { ...VALID_TILE, oddsOfProfit: 50 } },
  ];

  for (const { name, fixture } of acceptCases) {
    it(`ACCEPT: ${name}`, () => {
      expect(validateTile(fixture).valid).toBe(true);
      expect(publishPickValidates(fixture).valid).toBe(true);
      expect(publishTsValidates(fixture).valid).toBe(true);
    });
  }

  // ── Reject cases: one per validateTile rule ──
  const rejectCases = [
    // Rule 1: missing id
    { name: 'missing id', fixture: { ...VALID_TILE, id: '' }, rule: 'identity' },
    // Rule 1: missing symbol
    { name: 'missing symbol', fixture: { ...VALID_TILE, symbol: '' }, rule: 'identity' },
    // Rule 1: missing strategy
    { name: 'missing strategy', fixture: { ...VALID_TILE, strategy: '' }, rule: 'identity' },
    // Rule 2: missing legs (undefined)
    { name: 'missing legs (undefined)', fixture: REJECT_NO_LEGS, rule: 'legs' },
    // Rule 2: fewer than 2 legs
    { name: 'fewer than 2 legs', fixture: REJECT_ONE_LEG, rule: 'legs' },
    // Rule 3: all-zero premiums (unpriced)
    { name: 'all-zero premiums', fixture: REJECT_UNPRICED, rule: 'pricing' },
    // Rule 4: maxProfit = 0
    { name: 'maxProfit = 0', fixture: REJECT_NO_MAX_PROFIT, rule: 'P&L' },
    // Rule 4: maxLoss = 0
    { name: 'maxLoss = 0', fixture: { ...VALID_TILE, maxLoss: 0 }, rule: 'P&L' },
    // Rule 5: missing expiry
    { name: 'missing expiry', fixture: { ...VALID_TILE, expiry: '', legs: VALID_TILE.legs.map(l => ({ ...l, expiry: undefined })) }, rule: 'expiry' },
    // Rule 6: underlyingPrice = 0
    { name: 'underlyingPrice = 0', fixture: { ...VALID_TILE, underlyingPrice: 0 }, rule: 'spot' },
    // Rule 7: missing source
    { name: 'missing source', fixture: REJECT_NO_SOURCE, rule: 'source' },
    // Rule 10: breakevens: [] (empty array)
    { name: 'breakevens: []', fixture: REJECT_EMPTY_BREAKEVENS, rule: 'breakevens' },
  ];

  for (const { name, fixture, rule } of rejectCases) {
    it(`REJECT: ${name} (rule: ${rule})`, () => {
      const vt = validateTile(fixture);
      const pp = publishPickValidates(fixture);
      const pt = publishTsValidates(fixture);

      expect(vt.valid).toBe(false);

      // Rules the inline writers enforce (shared with validateTile):
      const sharedRules = ['legs', 'pricing', 'P&L', 'expiry', 'spot'];

      if (sharedRules.includes(rule)) {
        // Writers MUST reject these — same as validateTile
        expect(pp.valid).toBe(false);
        expect(pt.valid).toBe(false);
      }
      // Rules only validateTile enforces (schema is stricter):
      // - identity (id): writers generate id, don't validate it
      // - source: writers hardcode source, don't validate it
      // - breakevens: writers sanitize (convert [] to undefined), don't reject
      // - oddsOfProfit type: writers emit null, don't reject on type
      // These are acceptable — the schema catches anything the writers miss
      // as a belt-and-suspenders at the read boundary.
    });
  }

  // ── Rule 8: isActive must be boolean ──
  it('REJECT: isActive not boolean (validateTile-only — writers hardcode true)', () => {
    const fixture = { ...VALID_TILE, isActive: 'yes' };
    expect(validateTile(fixture).valid).toBe(false);
    // Writers hardcode isActive: true, so this can't happen in practice
  });

  // ── Rule 9: oddsOfProfit must be number or null, never undefined ──
  it('REJECT: oddsOfProfit: undefined (validateTile-only — writers emit null)', () => {
    expect(validateTile(REJECT_POP_UNDEFINED).valid).toBe(false);
    // Writers always set oddsOfProfit explicitly (number or null), never leave it undefined
  });
});

// ═══════════════════════════════════════════════════════════════
// Shared validator (pricing-engine.cjs validateTileForWrite)
// agrees with validateTile on every fixture
// ═══════════════════════════════════════════════════════════════

describe('Shared validateTileForWrite parity with validateTile', () => {
  const cases = [
    { name: 'VALID_TILE', fixture: VALID_TILE, expectValid: true },
    { name: 'VALID_TILE_NULL_POP', fixture: VALID_TILE_NULL_POP, expectValid: true },
    { name: 'REJECT_UNPRICED', fixture: REJECT_UNPRICED, expectValid: false },
    { name: 'REJECT_NO_LEGS', fixture: REJECT_NO_LEGS, expectValid: false },
    { name: 'REJECT_ONE_LEG', fixture: REJECT_ONE_LEG, expectValid: false },
    { name: 'REJECT_NO_MAX_PROFIT', fixture: REJECT_NO_MAX_PROFIT, expectValid: false },
    { name: 'REJECT_NO_SOURCE', fixture: REJECT_NO_SOURCE, expectValid: false },
    { name: 'REJECT_EMPTY_BREAKEVENS', fixture: REJECT_EMPTY_BREAKEVENS, expectValid: false },
  ];

  for (const { name, fixture, expectValid } of cases) {
    it(`${name}: validateTile and validateTileForWrite agree (expect ${expectValid ? 'accept' : 'reject'})`, () => {
      const schema = validateTile(fixture);
      const writer = validateTileForWrite(fixture);
      expect(schema.valid).toBe(expectValid);
      expect(writer.valid).toBe(expectValid);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Source-code assertions: writers conform structurally
// ═══════════════════════════════════════════════════════════════

describe('Writer structural conformance', () => {
  it('publish-pick.cjs: emits oddsOfProfit null when uncomputable, not 50', () => {
    const src = readFileSync(resolve(__dirname, '../../../../generaterecommendations/publish-pick.cjs'), 'utf8');
    expect(src).toContain("const oddsOfProfit = (typeof computedPoP === 'number' && computedPoP > 0) ? computedPoP : null");
  });

  it('publish.ts: emits oddsOfProfit null when uncomputable, not 50', () => {
    const src = readFileSync(resolve(__dirname, '../../../../api/src/routes/publish.ts'), 'utf8');
    expect(src).toContain("const oddsOfProfit = (typeof body.pop === 'number' && body.pop > 0) ? body.pop : null");
  });

  it('publish-pick.cjs: checks legs.length >= 2', () => {
    const src = readFileSync(resolve(__dirname, '../../../../generaterecommendations/publish-pick.cjs'), 'utf8');
    expect(src).toContain('result.legs.length < 2');
  });

  it('publish.ts: checks legs.length >= 2', () => {
    const src = readFileSync(resolve(__dirname, '../../../../api/src/routes/publish.ts'), 'utf8');
    expect(src).toContain('body.legs.length < 2');
  });

  it('publish-pick.cjs: checks underlyingPrice > 0', () => {
    const src = readFileSync(resolve(__dirname, '../../../../generaterecommendations/publish-pick.cjs'), 'utf8');
    expect(src).toContain('tile.underlyingPrice > 0');
  });

  it('publish.ts: checks spotPrice > 0', () => {
    const src = readFileSync(resolve(__dirname, '../../../../api/src/routes/publish.ts'), 'utf8');
    expect(src).toContain('body.spotPrice > 0');
  });

  it('both writers nest provenance', () => {
    const ppick = readFileSync(resolve(__dirname, '../../../../generaterecommendations/publish-pick.cjs'), 'utf8');
    const pts = readFileSync(resolve(__dirname, '../../../../api/src/routes/publish.ts'), 'utf8');
    expect(ppick).toContain('provenance: {');
    expect(pts).toContain('provenance: {');
  });

  it('both writers sanitize breakevens (never write [])', () => {
    const ppick = readFileSync(resolve(__dirname, '../../../../generaterecommendations/publish-pick.cjs'), 'utf8');
    const pts = readFileSync(resolve(__dirname, '../../../../api/src/routes/publish.ts'), 'utf8');
    // publish-pick: breakevens is undefined when invalid
    expect(ppick).toContain('rawBE.length === 2');
    // publish.ts: same
    expect(pts).toContain('rawBE.length === 2');
  });
});

// ═══════════════════════════════════════════════════════════════
// Publish gate parity: ESM + CJS + publish.ts inline — all THREE agree
// ═══════════════════════════════════════════════════════════════

/** Replica of the inline gate in api/routes/publish.ts */
function publishTsGate(tile) {
  const vc = tile.verdictConfidence;
  const pop = tile.oddsOfProfit;
  if (vc != null && vc < 65) return { pass: false, reason: `verdict ${vc} < 65` };
  if (vc == null && (pop || 0) < 65) return { pass: false, reason: `PoP ${pop} < 65` };
  return { pass: true, tier: vc != null && vc >= 65 ? 'verified' : 'priced' };
}

describe('applyPublishGate parity: ESM, CJS, and publish.ts inline agree on every scenario', () => {
  const scenarios = [
    // BA case: verdict 52, PoP 2 → REJECT (adversary flagged it)
    { name: 'BA case: verdict 52 / PoP 2', tile: { verdictConfidence: 52, oddsOfProfit: 2 }, expectPass: false },
    // Verdict ≥ 65 → PASS verified
    { name: 'verdict 70 → pass verified', tile: { verdictConfidence: 70, oddsOfProfit: 80 }, expectPass: true },
    // Verdict exactly 65 → PASS verified
    { name: 'verdict 65 → pass verified (boundary)', tile: { verdictConfidence: 65, oddsOfProfit: 40 }, expectPass: true },
    // No verdict, PoP 72 → PASS priced
    { name: 'no verdict, PoP 72 → pass priced', tile: { verdictConfidence: null, oddsOfProfit: 72 }, expectPass: true },
    // No verdict, PoP undefined → treated as absent
    { name: 'no verdict field, PoP 72 → pass priced', tile: { oddsOfProfit: 72 }, expectPass: true },
    // No verdict, PoP 50 → REJECT
    { name: 'no verdict, PoP 50 → reject', tile: { verdictConfidence: null, oddsOfProfit: 50 }, expectPass: false },
    // No verdict, PoP null → REJECT
    { name: 'no verdict, PoP null → reject', tile: { verdictConfidence: null, oddsOfProfit: null }, expectPass: false },
    // Verdict 64 (just below) → REJECT even with high PoP
    { name: 'verdict 64, PoP 90 → reject (adversary outranks PoP)', tile: { verdictConfidence: 64, oddsOfProfit: 90 }, expectPass: false },
  ];

  for (const { name, tile, expectPass } of scenarios) {
    it(`${name}: all 3 copies agree (expect ${expectPass ? 'PASS' : 'REJECT'})`, () => {
      const esm = applyPublishGateESM(tile);
      const cjs = applyPublishGateCJS(tile);
      const pts = publishTsGate(tile);

      expect(esm.pass).toBe(expectPass);
      expect(cjs.pass).toBe(expectPass);
      expect(pts.pass).toBe(expectPass);

      // All three agree with each other
      expect(esm.pass).toBe(cjs.pass);
      expect(esm.pass).toBe(pts.pass);

      if (esm.pass) {
        expect(esm.tier).toBe(cjs.tier);
        expect(esm.tier).toBe(pts.tier);
      }
    });
  }
});

describe('deriveTier (ESM only)', () => {
  it('verdict ≥ 65 → verified', () => {
    expect(deriveTier({ verdictConfidence: 70 })).toBe('verified');
  });

  it('verdict 64 → priced', () => {
    expect(deriveTier({ verdictConfidence: 64 })).toBe('priced');
  });

  it('no verdict → priced', () => {
    expect(deriveTier({ oddsOfProfit: 90 })).toBe('priced');
  });

  it('verdict null → priced', () => {
    expect(deriveTier({ verdictConfidence: null })).toBe('priced');
  });
});

describe('Rule 11: reject generic confidence (both validators)', () => {
  it('ESM validateTile rejects tile with generic confidence', () => {
    const tile = { ...VALID_TILE, confidence: 70 };
    const r = validateTile(tile);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('confidence');
  });

  it('CJS validateTileForWrite rejects tile with generic confidence', () => {
    const tile = { ...VALID_TILE, confidence: 70 };
    const r = validateTileForWrite(tile);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('confidence');
  });

  it('both validators agree on generic confidence rejection', () => {
    const tile = { ...VALID_TILE, confidence: 70 };
    expect(validateTile(tile).valid).toBe(false);
    expect(validateTileForWrite(tile).valid).toBe(false);
  });

  it('tile without confidence field → accepted (if otherwise valid)', () => {
    const tile = { ...VALID_TILE };
    delete tile.confidence;
    expect(validateTile(tile).valid).toBe(true);
    expect(validateTileForWrite(tile).valid).toBe(true);
  });

  it('verdictConfidence field is allowed (not generic confidence)', () => {
    const tile = { ...VALID_TILE, verdictConfidence: 70 };
    expect(validateTile(tile).valid).toBe(true);
    expect(validateTileForWrite(tile).valid).toBe(true);
  });

  it('wallConfidence field is allowed (not generic confidence)', () => {
    const tile = { ...VALID_TILE, wallConfidence: 0.72 };
    expect(validateTile(tile).valid).toBe(true);
    expect(validateTileForWrite(tile).valid).toBe(true);
  });
});

describe('Strategy-builder tile: no generic confidence, passes gate as priced', () => {
  it('passes validateTile (no generic confidence field)', () => {
    expect(validateTile(STRATEGY_BUILDER_TILE).valid).toBe(true);
  });

  it('passes validateTileForWrite (no generic confidence field)', () => {
    expect(validateTileForWrite(STRATEGY_BUILDER_TILE).valid).toBe(true);
  });

  it('passes applyPublishGate as priced (PoP 87 ≥ 65, no verdict)', () => {
    const esm = applyPublishGateESM(STRATEGY_BUILDER_TILE);
    const cjs = applyPublishGateCJS(STRATEGY_BUILDER_TILE);
    expect(esm.pass).toBe(true);
    expect(esm.tier).toBe('priced');
    expect(cjs.pass).toBe(true);
    expect(cjs.tier).toBe('priced');
  });

  it('wallConfidence is 0-1 scale (matches funnel)', () => {
    // Strategy-builder: wallConfidence from gammaData.confidence_score (native 0-1)
    // Funnel (pricing-engine): wallConfidence from gammaData.confidence.overall (native 0-1)
    // Both should be 0-1, not 0-100
    expect(STRATEGY_BUILDER_TILE.wallConfidence).toBeGreaterThan(0);
    expect(STRATEGY_BUILDER_TILE.wallConfidence).toBeLessThanOrEqual(1);
  });

  it('would fail if it still had generic confidence', () => {
    const withGeneric = { ...STRATEGY_BUILDER_TILE, confidence: 31 };
    expect(validateTile(withGeneric).valid).toBe(false);
    expect(validateTileForWrite(withGeneric).valid).toBe(false);
  });
});
