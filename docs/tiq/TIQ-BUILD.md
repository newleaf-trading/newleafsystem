# TIQ — Trading Intelligence Assessment

Build brief. Source of truth for the `shared/tiq/`, `api/tiq/`, `web/.../tiq/` subsystem.
Read this before making changes to anything under those paths.

---

## What this is

Three related surfaces sharing one deterministic engine:

| surface | route | time | purpose |
|---|---|---|---|
| **Instinct Quiz** | `/instinct` (public, no auth) | 4 min | acquisition front door |
| **TIQ Assessment** | `/workbench/tiq` (auth) | 35 min | 40 items, five categories, percentile + rank |
| **Decision Simulator** | `/workbench/tiq/sim/:scenarioId` (auth) | 8 min | path-dependent scenario, replayable |

Reference implementations live in `docs/tiq/reference/`. They are working prototypes, not
production code — port the logic and the design tokens, rewrite the plumbing.

---

## Non-negotiable constraints

1. **No LLM in the scoring path.** Every number — item score, category score, TQ, percentile,
   rank, calibration gap, simulator P&L — is computed by deterministic code in `shared/tiq/`.
   Models may generate item text and scenario narration only, offline, and only via the
   existing Verification Desk. Same rule as `shared/indicators/`.

2. **`shared/tiq/` is pure.** CommonJS, no network, no Firestore, no DOM, no `Date.now()` inside
   scoring functions (pass timestamps in). Every exported function testable in isolation.

3. **The simulator market path is scripted and never reacts to user choices.** This is deliberate.
   If the tape responded, a good decision could be punished by the engine and the score would
   measure luck. Fixed path, variable user state.

4. **Provenance on every Firestore write**, matching existing NewLeaf convention:
   `bank_version`, `scoring_version`, `norm_version`, `scenario_version`, `code_commit_sha`,
   `created_at`.

5. **No new runtime dependencies** without asking. The engine needs none.

6. **Never show a percentile below the cohort floors.** n≥30 to show any normed comparison,
   n≥500 to show an ordinal rank. Enforced in code, not in the UI.

---

## Repo layout

```
shared/tiq/
  scoring.js          item scoring (5 modes), category rollup, TQ composite, ruin gate
  norms.js            norm tables, mid-rank percentile, Wilson CI, cohort ladder, rank
  calibration.js      confidence gap, pace/impulsivity index, consistency index
  sim.js              scenario state machine, apply(), replay() against alternate scripts
  index.js
  __tests__/          one file per module, node:test or the existing runner
content/tiq/
  bank-v1.json                 40-item assessment bank
  frontdoor-v1.json            12-item quiz bank
  scenarios/the-wednesday.json
api/tiq/                       start / answer / finish / standing endpoints
web/src/.../tiq/               three surfaces
scripts/tiq/
  validate-bank.js             invariant checks, runs in CI
  build-norms.js               nightly frozen norm tables
docs/tiq/                      the five spec documents
docs/tiq/reference/            the two HTML prototypes
```

---

## Firestore collections

**`content/tiq/` is the source of truth; Firestore is a seeded mirror.** `tiqItems`,
`tiqScenarios` and the item text in every collection are populated from the JSON banks
(`scripts/tiq/seed-firestore.js`) and validated by `scripts/tiq/validate-bank.js`. To fix or
add an item, **edit the JSON and re-seed** — never hand-edit a document in the Firebase
console. Console edits are silently overwritten by the next seed and skip the invariant
checks, which is exactly how a bank ships with two defensible best answers.

| collection | doc | notes |
|---|---|---|
| `tiqItems` | one per item | mirrors bank JSON, `active` flag, `bank_version` |
| `tiqSittings` | one per attempt | responses, timings, confidence, computed scores, provenance |
| `tiqNorms` | `{normVersion}/{cohortId}` | frozen, rebuilt nightly, never computed live |
| `tiqScenarios` | one per scenario | scripts + nodes as data |
| `tiqItemStats` | one per item | choice distribution for the consensus bar, abandon rate |

`tiqSittings` is append-only. Never mutate a completed sitting — a retake is a new document.

---

## Scoring contract

```
item modes: weighted_choice | multi_select | ranking | diagnostic_only
category_c = 100 * Σ earned / Σ max
composite  = 0.18·KQ + 0.24·EQ + 0.20·SQ + 0.28·RQ + 0.10·MQ
TQ         = 100 + 15 * z(composite)          # anchor table until n≥500, then empirical
ruin gate  = if RQ < 45 or ruin_flags >= 2 → TQ = min(TQ, 95), banner "Capital preservation risk"
percentile = 100 * (below + 0.5*equal) / n    # mid-rank, clamped to [0.1, 99.9]
```

Front-door score is honest — `round(100 * earned / available)`, no floor. The archetype is the
headline; the number is smaller and sits below it.

---

## Where the details live

| document | covers |
|---|---|
| `docs/tiq/spec-core.md` | item schema, scoring maths, ruin gate, generation pipeline, IRT phase 2 |
| `docs/tiq/spec-norms.md` | percentile maths, cohort ladder, frozen norms, leaderboard integrity, GDPR/FCA flags |
| `docs/tiq/spec-frontdoor.md` | two-tier funnel, archetypes, consensus reveal, question writing rules |
| `docs/tiq/spec-simulator.md` | scripted-path rationale, path-dependent scoring, counterfactual replay, scenario format |

Where this brief and a spec document disagree, this brief wins and the spec should be updated.
