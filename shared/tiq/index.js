'use strict';

/**
 * NewLeaf Trading Intelligence Quotient (TIQ) — deterministic scoring engine.
 *
 * One pure engine behind three surfaces (Instinct Quiz, TIQ Assessment, Decision
 * Simulator). No LLM in the scoring path; models generate item/scenario text
 * offline only. See docs/tiq/TIQ-BUILD.md and docs/tiq/spec-*.md.
 *
 *   const TIQ = require('newleafsystem-shared-tiq');   // Node / API
 *   window.TIQEngine                                   // browser (see sync.js)
 */

const scoring = require('./scoring');
const norms = require('./norms');
const calibration = require('./calibration');
const sim = require('./sim');

const SCORING_VERSION = '1.0.0';

/**
 * Provenance envelope for every Firestore write. Keeps the repo-wide convention
 * verbatim (model_used / verify_verdict / analysis_source / generation_timestamp
 * / code_commit_sha — see api/src/routes/plan.ts) and adds the TIQ version block.
 * The engine is deterministic, so model_used is null and the verdict is the
 * literal 'deterministic'. Timestamps are injected, never read from Date.now().
 */
function provenance(opts = {}) {
  return {
    model_used: null,
    prompt_version: null,
    verify_verdict: 'deterministic',
    analysis_source: 'shared/tiq',
    generation_timestamp: opts.timestamp || null,
    code_commit_sha: opts.commitSha || null,
    versions: {
      bank: opts.bankVersion || null,
      scoring: SCORING_VERSION,
      norm: opts.normVersion || null,
      scenario: opts.scenarioVersion || null
    }
  };
}

module.exports = {
  // namespaced access
  scoring,
  norms,
  calibration,
  sim,
  // flat re-export for convenience (names are unique across modules)
  ...scoring,
  ...norms,
  ...calibration,
  ...sim,
  // engine metadata + provenance
  SCORING_VERSION,
  provenance
};
