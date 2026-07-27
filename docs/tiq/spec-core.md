# NewLeaf Trading Intelligence Quotient (TIQ) — Engine Specification v1.0

Companion to `newleaf-tiq-bank-v1.json` (40 calibration items).

Design principle carried over from the rest of NewLeaf: **deterministic code computes every number.** The LLM writes and reviews items; it never scores a response and never decides a verdict.

---

## 1. The central problem: EQ items are gameable

Knowledge items have a defensible right answer, so they measure knowledge honestly. Behavioural items do not. If you ask "you've lost four in a row, do you (a) follow your rules or (b) double up", everyone picks (a), the item measures nothing, and the report tells the user they're a disciplined trader who then blows up an account.

Four mechanisms in this bank address that. All four are already encoded in the JSON.

### 1.1 No free wrong answers
Every distractor is written to be defensible by a real trader. Scoring is **graded, not binary** — `choice_points` carries values like `{A:10, B:6, C:0, D:3}`. `SQ-E-ADV-0021` gives 6/10 to "move the expiry before earnings" because it is a genuine structural fix that happens not to address the binding gate. A user who reasons well but lands short still scores above a user who guesses.

### 1.2 Framing pairs (`pair_id`)
`EQ-F-INT-0011` and `EQ-F-INT-0012` are the same dilemma — *do you obey your written exit rule when the chart still looks good?* — presented once in a gain frame and once in a loss frame, on different underlyings, separated in the sitting. The correct answer is "obey the rule" in both. Loss aversion produces obedience in the gain frame and defection in the loss frame.

The user cannot see the pair. The engine can:

```
consistency_penalty = Σ over pairs |normalised_score(gain) − normalised_score(loss)|
```

This is the most valuable signal in the whole assessment and it is invisible to the person taking it. Ship at least 4 pairs in production, ideally 6.

### 1.3 Trait-loading vectors independent of points
`trait_loadings` fires on the chosen key regardless of whether the choice scored well. Choosing B on `EQ-F-INT-0010` (cut size after a losing streak) scores 6/10 *and* loads `loss_aversion: 2`. You can be disciplined and loss-averse at once, and the report should say so. Traits are z-scored across the trait vocabulary, not summed into the point score.

### 1.4 Ruin flags
`ruin_flag_choices` marks answers that are not merely suboptimal but account-ending: sizing up after losses, naked short into a binary, full Kelly, "defined risk means nothing can go wrong". These are scored 0 **and** counted separately. See §3.4.

---

## 2. Item schema

```
id                  {CAT}-{TYPE}-{DIFF}-{NNNN}
category            KQ | EQ | SQ | RQ | MQ
subskill            free string, the leaf node of your skill tree
difficulty          beginner | intermediate | advanced | professional
type                A..F
scenario            { symbol?, spot?, chain?, gates?, text }   optional
stem                the question
choices             [{ key, text }]
scoring             see §3
explanation         { correct, distractors: { key: why } }
bias                dominant bias probed, or null
learning_objective  one sentence, shown on the results screen
est_seconds         used for the impulsivity index (§3.5)
tags                []
generator           { template_id, bindings[] }
pair_id             optional, links framing pairs
pair_role           gain_frame | loss_frame
```

### Scoring modes

| mode | fields | computation |
|---|---|---|
| `weighted_choice` | `choice_points` | direct lookup |
| `multi_select` | `correct_keys`, `per_correct`, `per_incorrect`, `floor` | sum, clamp at floor |
| `ranking` | `correct_order`, `method`, `critical_constraints` | Kendall tau (§3.2) |
| `diagnostic_only` | `trait_loadings` only | `max_points: 0`, feeds trait profile |

---

## 3. Scoring maths

### 3.1 Category score

```
raw_c        = Σ earned_i  for i in category c
max_c        = Σ max_points_i
category_c   = 100 × raw_c / max_c        # 0–100
```

Weight items by difficulty if you want harder items to count more: multiply `max_points` by `{beginner:0.8, intermediate:1.0, advanced:1.3, professional:1.6}` at bank-build time, not at scoring time, so the ratio stays clean.

### 3.2 Ranking items

```
tau     = Kendall tau-b(user_order, correct_order)     # −1..1
base    = max_points × (tau + 1) / 2
score   = max(0, base − Σ penalties for violated critical_constraints)
```

Critical constraints exist because some orderings are not merely suboptimal. In `SQ-C-ADV-0026`, submitting the order before writing the exit plan is a hard failure worth −4 no matter how good the rest of the sequence is.

### 3.3 Composite TQ

```
composite = 0.18·KQ + 0.24·EQ + 0.20·SQ + 0.28·RQ + 0.10·MQ
TQ_raw    = 100 + 15 × z(composite)
```

RQ carries the largest weight and KQ the second-smallest on purpose. Knowledge is the cheapest of the five to acquire and the least predictive of survival.

Until you have a real cohort, `z()` has no distribution to draw on. Use a fixed anchor table for the first ~500 sittings and switch to empirical z-scoring after that:

| composite | TQ |
|---|---|
| 90–100 | 130+ |
| 80–89 | 115–129 |
| 68–79 | 100–114 |
| 55–67 | 85–99 |
| < 55 | < 85 |

Be explicit in the UI that early scores are anchor-based, not norm-referenced. Publishing a "TQ 132, 98th percentile" against a cohort of eleven people is the kind of claim that damages the product's credibility permanently.

### 3.4 The Ruin Gate

```
if RQ < 45 or ruin_flag_count >= 2:
    TQ = min(TQ_raw, 95)
    banner = "Capital preservation risk"
```

A trader who scores 88 on knowledge and picks "increase size after four losses" should not receive a flattering number. The gate is the difference between an assessment and a compliment.

### 3.5 Secondary indices

**Consistency Index** — §1.2, reported 0–100 where 100 is perfect symmetry across framing pairs.

**Impulsivity Index** — `z(response_time_i / est_seconds_i)` averaged across the sitting, with the tails trimmed. Consistently answering advanced scenario items in under a third of the estimated time is a signal in its own right; so is a bimodal profile (fast on EQ items, slow on KQ items), which usually means the user is pattern-matching to the socially correct answer on the behavioural ones.

**Confidence calibration (optional)** — add a 1–5 confidence slider per item and compute a Brier score. Overconfidence shows up as high confidence on wrong answers, and it is a better predictor of trading outcomes than the raw score is. This is worth building.

### 3.6 Report structure

- TQ, with the anchor-based caveat while the cohort is small
- Five category bars
- Trait profile: top 3 elevated biases, each with the specific item that revealed it and what the better answer was
- Consistency and impulsivity indices
- Learning path: ordered `learning_objective` strings from missed items, deduplicated by `subskill`, capped at 7 so it is actionable

---

## 4. Generation pipeline

Every item carries a `generator` block naming its template and its bindings. That is what turns 40 items into thousands.

```
FMP / IBKR  →  binder  →  template  →  invariant checks  →  Verification Desk  →  bank
```

**Binder.** Pull live values into slots. FMP for chains, IV rank, earnings dates, historical earnings moves; IBKR for term structure and real bid-ask. `T-EARN-STRUCT-01` alone regenerates across every liquid name every quarter — several hundred distinct items per cycle from one template.

**Invariant checks (deterministic, must pass).**
1. Arithmetic in stem and explanation agrees with the bound data
2. Exactly one choice holds the maximum `choice_points`
3. The gap between best and second-best is ≥ 3 points, otherwise the item is ambiguous
4. No distractor is factually true as written
5. Bound market data is internally coherent — front IV > back IV when the template asserts an event, IV rank ∈ [0,100], implied move consistent with the quoted straddle
6. Answer key position is randomised

**Verification Desk.** Route generated items through a reduced jury from the existing 9-agent system — Technical, IV-Skew, Risk Manager, plus Bull/Bear on whether a distractor is defensible, plus Judge. Verdict `Pass` publishes, `Marginal` queues for your review, `Fail` discards. Reuse the constraint you already have: the Judge must not share a model family with the debaters. At roughly the cost you've measured on trade verification this is a few pence per item, which is cheap relative to shipping an item with two defensible best answers.

**Human sample.** Review 5% by hand regardless of verdict. Generated behavioural items drift toward the obvious far more readily than knowledge items do.

---

## 5. Adaptive delivery (phase 2)

Once you have ~200 responses per item, fit a 2-parameter logistic IRT model to get difficulty `b` and discrimination `a` per item. Then:

- Drop items with `a < 0.5` — they don't separate anyone
- Serve adaptively: start at intermediate, step difficulty on the running ability estimate
- Stop when the standard error on theta drops below 0.3, typically 18–25 items instead of 40

Two constraints on the adaptive engine: framing pairs must be served as a unit or the consistency index breaks, and each category needs a minimum item count or the composite becomes unstable.

---

## 6. Known limitations, worth stating in the product

1. **Stated behaviour is not revealed behaviour.** A written assessment measures what someone believes they would do. The framing pairs and impulsivity index narrow the gap but do not close it. The real instrument is the comparison between TQ and the user's actual trade log once NewLeaf has one — retaking after 50 logged trades, with the delta shown, is the version of this product with genuine predictive value.
2. **First-sitting scores only.** Retakes on the same item pool inflate. Serve a disjoint pool on retake.
3. **The bank has a house view.** Systematic premium selling with defined risk and mechanical exits is treated as correct. That matches NewLeaf, and it should be said out loud rather than presented as neutral truth. A competent discretionary trader will score lower than they deserve on SQ.
