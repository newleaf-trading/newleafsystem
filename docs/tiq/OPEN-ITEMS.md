# TIQ — Open items

Deliberately unfinished work. Each entry: **what unblocks it**, and **what breaks if it ships
without**. Recorded here so it isn't only in session memory.

---

## 1. Workbench → API browser auth — RESOLVED

`authMiddleware` now accepts a Firebase ID token (`Authorization: Bearer`) in addition to
`X-API-Key`; a signed-in user maps to their custom-claim role or `free`. The workbench nav
exposes the session's ID token (`window.__nlGetIdToken` / `window.__nlAuthReady`) — one hook
that serves every workbench page — and `tiq.html` / `tiq-sim.html` send it, falling back to a
manual key only if there is no session. Verified live against the deployed API (Firebase Bearer
→ 200 with no API key; invalid/absent → 401). No manual `localStorage` step needed.

## 2. Consensus percentages (front door)

The Instinct Quiz shows a consensus bar from the bank's **static illustrative** values,
labelled as such. `GET /api/tiq/items/:id/consensus` is stubbed behind `TIQ_CONSENSUS_LIVE`
and returns `available:false` until `tiqItemStats` holds real telemetry.

- **Unblocks it:** enough real answers to populate `tiqItemStats` (spec-frontdoor §3 suggests
  n>500 per item), a job to aggregate them, then `TIQ_CONSENSUS_LIVE=1`. The endpoint is also
  currently auth-gated; the public quiz needs a public read path before it can call it live.
- **Ships without → breaks:** nothing — the static values are honest because they are labelled
  illustrative. The failure mode to avoid is flipping the label to "live" while the numbers are
  still fabricated; do not present placeholder percentages as telemetry.

## 3. Frozen norms (`build-norms.js`) and empirical TQ

TQ uses the anchor table (capped at 130) and `describeStanding` returns a criterion band with
`anchorBased: true`. There are no `tiqNorms`, so no percentiles or ranks. `scripts/tiq/build-norms.js`
(the nightly frozen-norm job) is not written.

- **Unblocks it:** a real cohort. Empirical z-scoring switches on at **n ≥ 500** per cohort
  (`computeTQ`); percentiles need **n ≥ 30**, ranks **n ≥ 500** (enforced in `norms.js`). Then
  write `build-norms.js` as a launchd/pipeline job (no CI) that freezes `tiqNorms/{normVersion}`.
- **Ships without → breaks:** publishing a percentile against a tiny cohort is a fabrication the
  code already refuses — it degrades to the criterion band. Turning norms on before the cohort
  (or before reliability, item 5) exists would attach false precision to a noisy score.

## 4. Adaptive delivery / IRT (spec phase 2)

The assessment serves all 40 items in a fixed sequence. Adaptive stepping and 2-PL IRT item
parameters (`spec-core.md §5`) are not built.

- **Unblocks it:** ~200 responses per item to fit difficulty/discrimination, then the rule-based
  stepper first (`spec-simulator.md §3`), IRT after. Constraints carry over: framing pairs must
  be served as a unit, and each category needs a minimum item count.
- **Ships without → breaks:** nothing. The fixed 40-item form is the correct, complete instrument;
  adaptive is an engagement/length optimisation, not a correctness requirement.

---

## Gate before items 3 and 4: bank reliability

`scripts/tiq/reliability.js` (pure maths in `shared/tiq/reliability.js`) reports Cronbach's alpha
per category and the corrected item-total correlation per item, from completed `tiqSittings`.

**Alpha below 0.70 in any category means that category needs more items before empirical norms —
a content decision, not a code change.** Run this before turning on norms (item 3); a low alpha
there is the signal to write more items rather than to touch the engine.
