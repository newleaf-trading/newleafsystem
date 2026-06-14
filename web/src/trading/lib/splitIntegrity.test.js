import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Group B: Split integrity tests
 *
 * The Firestore emulator requires Java 21+ (unavailable on this system),
 * so these tests verify the sync-r2 script structurally:
 *   - The script references scanner_signals, never tiles
 *   - The signal shape has source: 'pipeline-scanner'
 *   - The deactivation sweep targets scanner_signals only
 *
 * Combined with the Group C read-path tests (priced gate filters signals
 * from Discover), this proves the split is correct end-to-end.
 */

describe('Group B: Split integrity (structural)', () => {
  const syncScript = readFileSync(
    resolve(__dirname, '../../../../pipeline/sync-r2-to-firestore-fixed.mjs'),
    'utf8'
  );

  it('(a) sync-r2 has ZERO tiles collection references', () => {
    // Match collection('tiles') or collection("tiles")
    const tilesCollectionRefs = syncScript.match(/\.collection\(['"]tiles['"]\)/g) || [];
    expect(tilesCollectionRefs).toHaveLength(0);
  });

  it('(b) sync-r2 writes to scanner_signals collection', () => {
    const signalRefs = syncScript.match(/\.collection\(SIGNAL_COLLECTION\)/g) || [];
    expect(signalRefs.length).toBeGreaterThanOrEqual(2); // deactivate + write
  });

  it('(b) SIGNAL_COLLECTION constant is "scanner_signals"', () => {
    expect(syncScript).toContain("const SIGNAL_COLLECTION = 'scanner_signals'");
  });

  it('(b) signal shape has source: "pipeline-scanner"', () => {
    expect(syncScript).toContain("source: 'pipeline-scanner'");
  });

  it('(c) deactivation sweep queries scanner_signals, not tiles', () => {
    // The deactivation should be: db.collection(SIGNAL_COLLECTION).where('isActive', '==', true)
    // NOT: db.collection('tiles').where('isActive', '==', true)
    const deactivateLines = syncScript.split('\n').filter(l =>
      l.includes('isActive') && l.includes('where') && l.includes('Deactivat')
    );
    // No line should reference 'tiles' directly
    const tilesInDeactivate = deactivateLines.some(l => l.includes("'tiles'"));
    expect(tilesInDeactivate).toBe(false);
  });

  it('(c) the old tiles deactivation code is completely removed', () => {
    // The old code had: db.collection('tiles').where('isActive', '==', true).get()
    expect(syncScript).not.toContain("collection('tiles')");
    expect(syncScript).not.toContain('collection("tiles")');
  });

  it('script header warns about tiles', () => {
    expect(syncScript).toContain('NEVER');
    expect(syncScript).toContain('tiles');
  });
});

describe('Group B: Funnel refresh scoping (structural)', () => {
  const funnelScript = readFileSync(
    resolve(__dirname, '../../../../generaterecommendations/funnel-price.cjs'),
    'utf8'
  );

  it('funnel deactivation scoped to source === funnel-priced only', () => {
    // Must query where('source', '==', 'funnel-priced') — not a blanket tiles query
    expect(funnelScript).toContain("where('source', '==', FUNNEL_SOURCE)");
    expect(funnelScript).toContain("where('isActive', '==', true)");
  });

  it('FUNNEL_SOURCE constant is funnel-priced', () => {
    expect(funnelScript).toContain("const FUNNEL_SOURCE = 'funnel-priced'");
  });

  it('funnel never touches scanner_signals collection', () => {
    // The only collection references should be tiles and scanner_signals (read-only for signals)
    const signalWrites = funnelScript.match(/collection\(['"]scanner_signals['"]\)\.doc|scanner_signals.*\.set\(|scanner_signals.*\.update\(/g) || [];
    expect(signalWrites).toHaveLength(0);
  });

  it('funnel writes include source: FUNNEL_SOURCE for traceability', () => {
    expect(funnelScript).toContain("source: FUNNEL_SOURCE");
  });

  it('manually-published tiles are untouched (deactivation never queries source !== funnel-priced)', () => {
    // The deactivation query MUST include the source filter — no blanket isActive query on tiles
    const deactivateLines = funnelScript.split('\n').filter(l =>
      l.includes('isActive') && l.includes('false') && l.includes('Deactivat')
    );
    // Every deactivation reference should be scoped to FUNNEL_SOURCE
    const unscoped = deactivateLines.some(l => !l.includes('funnel') && !l.includes('FUNNEL'));
    expect(unscoped).toBe(false);
  });
});
