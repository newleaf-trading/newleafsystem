# NewLeaf TIQ — Decision Simulator (spec addendum v1.3)

Response to review. Demo: `newleaf-decision-sim.html`.

---

## 1. Conceded: the 50-point floor goes

The reviewer is right and their alternative is better. My reasoning was that a generous scale is honest as long as it carries no percentile claim — that holds, but it solves the wrong problem. The floor throws away real information to buy a feeling that framing can supply for free.

Replace it:

```
score = round(100 × points_earned / points_available)     // honest
headline = archetype                                       // flattering
body = "strongest instinct" + "growth edge"                // encouraging
```

"Trading Instinct: 67 — you have already built decent emotional discipline; risk management is the next piece" does everything the floor did, without altering the scale. One safeguard worth keeping: the *number* should never be the largest element on the screen. Archetype above it, score below. The feeling comes from the identity, not the arithmetic.

## 2. Conceded: confidence should be core, not optional

I listed confidence capture in v1.0 as "optional, worth building". That was the wrong call — it is the single highest-value signal in the instrument and it is now implemented in the simulator, gated *between* the decision and the outcome so it cannot be revised after the fact.

```
calibration_gap = mean(stated_confidence − decision_quality)
  gap >  0.22  → Overconfident
  gap < −0.22  → Underconfident
  otherwise    → Well calibrated
```

Overconfidence is the result worth building the product around: being surest on the decisions that scored worst is the pattern most associated with large drawdowns, because certainty is what removes the brake before size goes on. It is also nearly impossible to fake, since the user must commit to confidence before learning whether they were right.

One tension to design around: confidence prompts add a click per item, which fights retention. Put them on every item in the assessment and the simulator; in the 12-question front door, use them on three items only, or skip them and rely on response time.

## 3. Adaptive difficulty — agreed, with a sequencing caveat

Real IRT-based adaptation needs ~200 responses per item before difficulty and discrimination parameters mean anything, so the version in v1.0 stands as phase 2. But there is a cheap rule-based version worth shipping first:

```
start at intermediate
two consecutive items ≥ 8/10  → step up one band
two consecutive items ≤ 3/10  → step down one band
never step below beginner or above professional
```

That gets most of the engagement benefit immediately. Swap in the calibrated version once the data exists. Two constraints carry over: framing pairs must be served as a unit or the consistency index breaks, and each category needs a minimum item count or the composite becomes unstable.

## 4. Realistic scenarios — this is what the simulator is for

The reviewer's example — Thursday afternoon, earnings after the close, IV rank 92, covered call at 70%, CNBC bullish, system says close at 50% — is a good question and it is still a question. Making it feel like a real trading decision is not a writing problem; isolated items cannot represent a trading day because a trading day is *one situation that keeps changing*. That is the argument for the simulator, and I think it is stronger than the argument for better-written questions.

---

## 5. The simulator: four design decisions that do the work

### 5.1 The market path is scripted and does not react to the user

This is the most important decision in the build and it is counter-intuitive. The obvious design has the market respond to your choices. Don't do it. If the tape reacts, a good decision can be punished by the engine and a bad one rewarded, and the score becomes a measure of luck inside a system you wrote.

Fixed path, variable user state. Everyone in a given scenario faces the same Wednesday. What differs is the position they are in when it arrives.

### 5.2 Scoring is path-dependent, which is what makes it ungameable

The same action scores differently depending on history. In the demo, "hold" scores 2/10 at 09:34 because the profit rule already fired, and 10/10 at 09:31 the next morning because the stop has *not* fired at 1.88× against a 2× rule. A user cannot pattern-match "the disciplined answer" because the disciplined answer depends on the position they actually built.

Branches diverge on state, not on score: closing early leads to a node about re-entry temptation, holding leads to a node about drawdown. Different questions, same clock.

### 5.3 Decision score and P&L are computed separately, then shown to diverge

The end screen shows both. When they disagree, it says so.

Verified across every path in the demo:

| path | Script A (what happened) | Script B (the other Wednesday) |
|---|---|---|
| Close at 09:34, stay flat | **+£135** | **+£135** |
| Hold all three, never break a rule after | +£180 | −£900 |
| Panic close Thursday morning | −£210 | −£210 |
| Double the position inside the drawdown | **+£570** | **−£1,590** |
| Flat, then re-enter at 6 lots | +£645 | −£1,515 |

Two things fall out of that table. The worst decision sequence produces the best outcome on the script that happened — which is exactly the lesson, delivered as an experience rather than an explanation. And the best decision sequence produces *the same result on both scripts*: good decisions buy path-independence. That is a more useful definition of edge than most people carry around, and the table teaches it without a paragraph.

### 5.4 Counterfactual replay is the feature

The same decision log is re-run against an alternate script. Deterministic, costs nothing, and it is the only honest way to tell someone they got away with something. `replay(log, script)` is eight lines.

This is also the answer to "how do we stop people learning the wrong lesson". A user who doubles down and makes £570 would otherwise leave having learned that doubling down works. The right-hand column removes that option.

In production, run the log against 200 scripts rather than two and show the distribution — median, worst decile, and the share of paths where the account survives. Same eight lines, same determinism.

---

## 6. Scenario format

A scenario is data, not code:

```js
{
  id: 'the-wednesday',
  account: 50000,
  rules: { takeProfit: 0.50, stopMultiple: 2.0, maxRiskPct: 0.02 },
  opening_position: [{ n:3, credit:0.80, width:5 }],
  scripts: {                                   // mark tables, one per path
    A: { t0:0.35, t1:1.05, t2:1.50, t3:0.55, t4:0.20 },
    B: { t0:0.35, t1:1.05, t2:1.50, t3:2.30, t4:3.80 }
  },
  nodes: [{ id, t, clock, beat(state), q(state), opts(state) }]
}
```

`beat`, `q` and `opts` take state, which is what produces branching. Everything else is a table.

Scenario families to build next, each a different stress axis:

| scenario | what it isolates |
|---|---|
| The Wednesday | event risk and rule integrity under drawdown |
| The Grind | six flat sessions — boredom, over-trading, action bias |
| The Gap | an overnight move straight through a short strike — revenge trading |
| The Streak | five straight winners — overconfidence and sizing creep |
| The Assignment | an ex-dividend early assignment — operational composure |

The Grind is the one competitors will not build, because nothing happens in it and it is therefore hard to make. It is also where most real money is lost.

---

## 7. Where the simulator sits

Three tiers now, and they escalate in commitment:

| | Instinct Quiz | TIQ Assessment | Decision Simulator |
|---|---|---|---|
| Time | 4 min | 35 min | 8 min per scenario |
| Measures | instinct | knowledge and bias | judgement over time |
| Repeatable | no | no | yes, unlimited |
| Purpose | acquisition | self-knowledge | retention |

The simulator is the one that keeps people coming back, because it has no correct answer to memorise and every scenario is a new session. It is also the natural home for the War Room video content — each scenario is a scripted day, which is already the shape of an episode.

## 8. Generation

Scenarios are cheaper to generate than they look. The market scripts come from real historical windows via FMP — pick any FOMC day, any gap, any six-session grind, and the mark tables are computed deterministically from the actual chain. The written beats are the only part a model produces, and they are narration over numbers that are already fixed, which is the same division of labour the rest of NewLeaf runs on: deterministic code computes, the model describes.

Route generated scenarios through the Verification Desk with one extra invariant: **for at least one decision path, the best-scoring sequence must produce a worse outcome than a worse-scoring one.** A scenario where good decisions always win teaches the wrong thing.
