'use strict';

/**
 * firestore-helpers.cjs — Provenance-stamped Firestore writes.
 *
 * Every write to tiles, analyses, weeklyPicks, and pick_outcomes must carry
 * provenance fields: model_used, prompt_version, analysis_source, verify_job_id,
 * generation_timestamp, code_commit_sha. This module enforces that contract.
 *
 * ARCHITECTURE.md requires provenance on all Firestore writes from genrecs.
 */

const { execSync } = require('child_process');
const crypto = require('crypto');

// ── Cached git SHA ──────────────────────────────────────────────────────────

let _commitSha = undefined; // undefined = not yet initialized

/**
 * Read the current git commit SHA and cache it.
 * Call once at module load or start of main(). Safe to call multiple times.
 */
function initProvenance() {
  if (_commitSha !== undefined) return;
  try {
    _commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
  } catch {
    console.warn('Provenance: code_commit_sha unavailable; running outside git context');
    _commitSha = null;
  }
}

/**
 * Returns the cached commit SHA (string or null).
 */
function getCodeCommitSha() {
  if (_commitSha === undefined) initProvenance();
  return _commitSha;
}

// ── Prompt version ──────────────────────────────────────────────────────────

/**
 * Compute a versioned prompt fingerprint.
 * @param {string} semverTag — e.g. 'publish-pick-v3.2'
 * @param {string} promptText — the full prompt string
 * @returns {string} e.g. 'publish-pick-v3.2-a1b2c3d4'
 */
function computePromptVersion(semverTag, promptText) {
  const hash = crypto.createHash('sha256').update(promptText).digest('hex').slice(0, 8);
  return `${semverTag}-${hash}`;
}

// ── Provenance builder ──────────────────────────────────────────────────────

/**
 * Build the provenance object stamped on every Firestore write.
 * @param {object} opts
 * @param {string} opts.modelUsed — required
 * @param {string} opts.promptVersion — required
 * @param {string} opts.analysisSource — required
 * @param {string|null} [opts.verifyJobId] — optional
 * @param {string|null} [opts.verifyVerdict] — optional
 * @param {number|null} [opts.verifyConfidence] — optional
 * @returns {object}
 */
function buildProvenance(opts) {
  if (!opts.modelUsed) throw new Error('Provenance: modelUsed is required');
  if (!opts.promptVersion) throw new Error('Provenance: promptVersion is required');
  if (!opts.analysisSource) throw new Error('Provenance: analysisSource is required');

  return {
    model_used: opts.modelUsed,
    prompt_version: opts.promptVersion,
    analysis_source: opts.analysisSource,
    verify_job_id: opts.verifyJobId ?? null,
    verify_verdict: opts.verifyVerdict ?? null,
    verify_confidence: opts.verifyConfidence ?? null,
    generation_timestamp: new Date().toISOString(),
    code_commit_sha: getCodeCommitSha(),
  };
}

// ── Write helpers ───────────────────────────────────────────────────────────

/**
 * Write to analyses/{tileId} with provenance fields merged.
 * @param {object} db — Firestore instance
 * @param {string} tileId
 * @param {object} analysis
 * @param {object} opts — provenance opts
 * @returns {Promise<object>} the merged document
 */
async function writeAnalysisWithProvenance(db, tileId, analysis, opts) {
  const provenance = buildProvenance(opts);
  const merged = { ...analysis, ...provenance };
  await db.collection('analyses').doc(tileId).set(merged);
  return merged;
}

/**
 * Write to tiles/{tileId} with provenance fields merged.
 * @param {object} db — Firestore instance
 * @param {string} tileId
 * @param {object} tileData
 * @param {object} opts — provenance opts
 * @returns {Promise<object>} the merged document
 */
async function writeTileWithProvenance(db, tileId, tileData, opts) {
  const provenance = buildProvenance(opts);
  const merged = { ...tileData, ...provenance };
  await db.collection('tiles').doc(tileId).set(merged);
  return merged;
}

/**
 * Write/update weeklyPicks/{weekId} with provenance fields.
 * Handles both create (set) and append (update) cases.
 * @param {object} db — Firestore instance
 * @param {string} weekId
 * @param {object} data — the document data (for set) or update fields
 * @param {object} opts — provenance opts
 * @param {'set'|'update'} mode — 'set' for new week, 'update' for append
 * @returns {Promise<void>}
 */
async function writeWeeklyPicksWithProvenance(db, weekId, data, opts, mode) {
  const provenance = buildProvenance(opts);
  const ref = db.collection('weeklyPicks').doc(weekId);
  if (mode === 'update') {
    await ref.update({ ...data, ...provenance });
  } else {
    await ref.set({ ...data, ...provenance });
  }
}

/**
 * Write to pick_outcomes/{docId} with provenance fields merged.
 * @param {object} db — Firestore instance
 * @param {string} docId
 * @param {object} outcomeData
 * @param {object} opts — provenance opts
 * @returns {Promise<object>} the merged document
 */
async function writePickOutcomeWithProvenance(db, docId, outcomeData, opts) {
  const provenance = buildProvenance(opts);
  const merged = { ...outcomeData, ...provenance };
  await db.collection('pick_outcomes').doc(docId).set(merged);
  return merged;
}

module.exports = {
  initProvenance,
  getCodeCommitSha,
  computePromptVersion,
  buildProvenance,
  writeAnalysisWithProvenance,
  writeTileWithProvenance,
  writeWeeklyPicksWithProvenance,
  writePickOutcomeWithProvenance,
};
