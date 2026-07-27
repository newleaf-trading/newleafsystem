# shared/tiq

Deterministic scoring engine behind the **Trading Intelligence Quotient (TIQ)** — the public
Instinct Quiz (`/instinct`), the TIQ Assessment (`/workbench/tiq`) and the Decision Simulator.

**Principle (non-negotiable, same as `shared/plan` and `shared/indicators`): deterministic code
computes every number.** Item scores, category scores, TQ, percentiles, rank, calibration gap and
simulator P&L are all pure functions here. LLMs only write item text and scenario narration,
offline, via the Verification Desk — never in the scoring path. No network, no Firestore, no DOM,
no `Date.now()` (timestamps are injected).

Source of truth: `docs/tiq/TIQ-BUILD.md` and the four `docs/tiq/spec-*.md` documents.

## Modules

| module | covers |
|---|---|
| `scoring.js` | item scoring (weighted_choice · multi_select · ranking · diagnostic_only), category rollup, composite, anchor/empirical TQ, ruin gate, trait profile, front-door score |
| `norms.js` | mid-rank percentile, Wilson CI, measurement-error band, cohort ladder, rank, display-precision ladder, `describeStanding`. Ported verbatim from `docs/tiq/reference/tiq-percentile.js` |
| `calibration.js` | confidence gap (Brier), impulsivity / pace index, framing-pair consistency index |
| `sim.js` | scripted-path state machine, `applyAction`, `replay` counterfactual, `scoreRun` |
| `index.js` | barrel + `provenance()` envelope + `SCORING_VERSION` |

`forced_choice_vector` is named in the brief but defined in no spec and used by no bank item, so it
is intentionally not implemented — adding it would be a guess.

## Scoring contract (spec-core §3)

```
category_c = 100 × Σ earned / Σ max
composite  = 0.18·KQ + 0.24·EQ + 0.20·SQ + 0.28·RQ + 0.10·MQ
TQ         = 100 + 15·z(composite)        # anchor table until n≥500, then empirical
ruin gate  = if RQ < 45 or ruin_flags ≥ 2 → TQ = min(TQ, 95), banner "Capital preservation risk"
```

TQ before a real cohort uses a piecewise-linear interpolation of the published anchor table
(`anchorTQ`); `computeTQ` switches to empirical z-scoring once `norm.n ≥ 500`.

## Simulator

The market path is **scripted and never reacts to the user** (spec-simulator §5.1). `replay(scenario,
log, script)` re-runs the identical decision log against an alternate script — the counterfactual.
The P&L oracle in spec-simulator §5.3 is reproduced exactly by `content/tiq/scenarios/the-wednesday.json`.

## Tests

No Jest in this monorepo — plain `node:assert` self-tests, one file per module (same as
`shared/plan`, `shared/indicators`).

```bash
cd shared/tiq && npm test          # runs all four
node scoring.test.js               # or one at a time
```

## Browser copy / drift guard

The static Workbench has no bundler, so it loads a generated copy. This is a **release blocker**:
browser scoring drifting from Node scoring would defeat the determinism guarantee.

```bash
node sync.js          # write web/workbench/public/js/tiqEngine.js  (window.TIQEngine)
node sync.js --check  # exit 1 if stale
```

Edit the module sources only; never hand-edit the generated `tiqEngine.js`.

## Provenance

Every Firestore write stamps `provenance({ timestamp, commitSha, bankVersion, normVersion,
scenarioVersion })` — the repo-wide envelope (`model_used:null`, `verify_verdict:'deterministic'`,
`analysis_source:'shared/tiq'`, …) plus a `versions` block. See `api/src/routes/plan.ts` for the
convention this matches.
