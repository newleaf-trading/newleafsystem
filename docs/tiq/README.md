# TIQ — Trading Intelligence Quotient

Three surfaces on one deterministic scoring engine. **No LLM in the scoring path** — every
number is computed by pure code in `shared/tiq/`; models only write item/scenario text offline.

**`content/tiq/` is the source of truth. Firestore is a seeded mirror** — to change an item or
scenario, edit the JSON and re-seed; never hand-edit a Firestore document.

## The three surfaces

| surface | route | auth | what it measures |
|---|---|---|---|
| **Instinct Quiz** | `/instinct` (React SPA, PublicLayout) | none | instinct — acquisition front door, 12 items, archetype + score |
| **TIQ Assessment** | `/workbench/tiq` (static) | free tier | knowledge & bias — 40 items, TQ, five percentiles, ruin gate |
| **Decision Simulator** | `/workbench/tiq-sim.html?scenario=the-wednesday` (static) | free tier | judgement over time — scripted path, counterfactual replay, repeatable |

The two static Workbench surfaces load `web/workbench/public/js/tiqEngine.js`, the generated
browser copy of `shared/tiq` (drift-guarded — see below). The React quiz imports the scorer via
the `@tiq-scoring` alias.

## Layout

```
shared/tiq/            pure engine (scoring, norms, calibration, sim) + sync.js + tests
content/tiq/           bank-v1.json, frontdoor-v1.json, scenarios/*.json   ← source of truth
api/src/routes/tiq.ts  registerTIQRoutes: sittings + sim sessions, all scoring server-side
web/workbench/tiq.html, tiq-sim.html        static surfaces
web/src/instinct/                            React front door
scripts/tiq/           validate-bank.js, seed-firestore.js, install-hooks.js
web/firestore.rules    client rules — tiq collections are server-authoritative
```

## Seeding Firestore

`content/tiq/` → `tiqBanks`, `tiqItems` (+ stripped `tiqItemsPublic`), `tiqScenarios`. Idempotent.

```bash
# production (newleafdb)
node scripts/tiq/seed-firestore.js
# emulator
FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=demo-newleaf \
  TIQ_FIRESTORE_DB='(default)' node scripts/tiq/seed-firestore.js
```

## Running the tests

```bash
# engine — pure, no infra (82 tests)
cd shared/tiq && npm test
node sync.js --check            # browser copy is in sync (release blocker)

# content invariants (10 rules)
node scripts/tiq/validate-bank.js

# API + rules, against the Firestore emulator (from api/)
npm run test:tiq                # assessment: start → responses → finish → standing
npm run test:tiq:sim            # simulator: sessions → decisions → finish (path-independence)
npm run test:tiq:rules          # security rules: client writes denied, keys server-only
```

### JDK 24 note
The firebase-tools emulator needs **JDK 21+**; the system default here is Java 11. Point
`JAVA_HOME` at the installed JDK before running any emulator test:

```bash
export JAVA_HOME="/Users/manish/Library/Java/JavaVirtualMachines/openjdk-24.0.1/Contents/Home"
```

## Git hooks (no CI)

A pre-commit hook runs `validate-bank.js` and `sync.js --check`. It is committed under
`scripts/git-hooks/` and activated per clone via `core.hooksPath` — the `web` package's
`postinstall` sets this automatically, or do it by hand:

```bash
git config core.hooksPath scripts/git-hooks
```

The real guarantee is the `predeploy` chain (`sync --check` + `validate-bank`); the hook is
convenience.

## Specs

`docs/tiq/TIQ-BUILD.md` is the brief. Detail lives in `spec-core.md` (scoring, ruin gate),
`spec-norms.md` (percentiles, cohort ladder, frozen norms), `spec-frontdoor.md` (the quiz),
`spec-simulator.md` (scripted path, counterfactual). Reference prototypes are in `reference/`.
