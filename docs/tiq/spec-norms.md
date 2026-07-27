# NewLeaf TIQ — Norms, Percentiles and Regional Rank (spec addendum v1.1)

Companion to `newleaf-tiq-spec.md`. Reference implementation: `tiq-percentile.js` (25 passing tests).

---

## 1. Two problems to settle before building

### 1.1 The cold-start problem is not solvable by cleverness

A percentile is a claim about a population. Until you have one, you don't have percentiles — you have a number computed against eleven early users, most of whom are you and your friends. Showing "82nd percentile" against n=11 is a fabrication, and users find out because their percentile lurches every time someone new signs up.

The module handles this with a **display precision ladder** rather than an on/off switch, so the results screen always shows something:

| cohort n | display | rank shown |
|---|---|---|
| ≥ 1000 | integer percentile | yes (≥ 500) |
| 200–999 | decile | no |
| 30–199 | quartile band | no |
| < 30 | criterion band only ("Strong") | no |

Criterion bands come from the fixed anchor table already in v1.0. They are honest from day one because they make no population claim.

### 1.2 Single-sitting rank is noisier than it looks

With 40 items and a Cronbach alpha around 0.82, the standard error of measurement is **6.4 TQ points**, so the 95% band is roughly ±13. That maps to a percentile band 25–30 points wide near the median. A user at "68th percentile" is somewhere in the low 50s to low 80s.

`percentileBand()` returns that band. Show it. A single point estimate on a 40-item instrument is false precision, and the fix is presentational, not statistical: display the point estimate prominently and the band underneath in smaller type, the way test score reports do.

Compute alpha from the response matrix once you have data and update the `reliability` argument. If it comes in below 0.70, the bank needs more items per category before percentiles are worth publishing at all.

---

## 2. Percentile maths

**Mid-rank percentile** (the "modified percentile rank" used by standardised tests):

```
PR = 100 × (count_below + 0.5 × count_equal) / n
```

The half-tie term matters. Without it, everyone tied at the median lands at either 40th or 60th depending on which way you break ties, and the results screen shows two users with identical scores in different deciles.

The reported value is clamped to [0.1, 99.9]. Nobody beats everyone, including themselves.

**Uncertainty from sampling** uses a Wilson interval rather than the normal approximation — it stays inside [0,100] and behaves at the tails, which is exactly where percentile claims get made. Same smoothing you already use for touch rates in the Movement & Range scanner.

**Uncertainty from measurement** is separate and larger:

```
SEM = sd × sqrt(1 − reliability)
band = percentileOf(TQ ± 1.96 × SEM)
```

Both belong in the payload; only the measurement band needs to be visible.

---

## 3. Cohort ladder — and why region is the weaker axis

`buildLadder()` produces, most specific first:

```
exp:{band}|country:{cc}  →  exp:{band}  →  country:{cc}  →  subregion  →  continent  →  global
```

`resolveCohort()` walks outward to the first cohort with n ≥ 30 and returns a `fellBack` flag so the UI can say *"compared with traders across Europe — not enough UK results yet"* rather than silently switching the comparison group.

**Experience band sits above country deliberately.** "You rank 340th in the United Kingdom" is a fun number and a weak one — nationality has no mechanism connecting it to options decision quality, so a UK cohort is just a random subsample of the global one. "You rank in the 40th percentile among traders with 1–3 years' experience" is a comparison with an actual claim behind it.

Ship both. Lead with experience, and treat regional rank as the engagement layer it is.

Regional cohorts also fragment fast. A global n of 2,000 might be 140 in the UK and 3 in Malta, which is what the ladder exists to absorb.

Suggested experience bands (self-declared at sitting, immutable afterwards): `<6m`, `6m_2y`, `2_5y`, `5y+`. Once NewLeaf has trade logs, replace self-declaration with logged trade count — self-reported experience is optimistic and it correlates with exactly the overconfidence trait the EQ items measure.

---

## 4. Frozen norms, versioned

Do **not** compute percentiles live against the sittings table. Build norm tables nightly and freeze them:

```
tiq_norms/{normVersion}/{cohortId}   →  buildNormTable() output
```

`normVersion` on a quarterly cadence, e.g. `2026Q3`. Store `normVersion` on the sitting record. Two consequences that matter:

- A user's percentile is stable between logins. Live computation means their number moves every day for reasons they can't see, which reads as a bug.
- Historical results stay interpretable. When you refresh norms, old sittings keep their original reference group and the report says which one.

Norm tables are small — one row per distinct integer score, so a 5,000-user cohort is roughly 80 rows. Cache them in memory.

Build one table per cohort **per score key**: `TQ` plus each of `KQ`, `EQ`, `SQ`, `RQ`, `MQ`.

---

## 5. The profile is more valuable than the rank

The category percentiles are where the product's actual insight lives, and it comes from shape rather than height:

| profile | reading |
|---|---|
| KQ 88th, RQ 24th | The blowup profile. Knows the mechanics, sizes badly. Most dangerous combination in the dataset. |
| KQ 40th, RQ 85th, SQ 80th | Undertrained but structurally safe. Fastest to improve, and safe to trade while learning. |
| All 60–70th, Consistency 30 | Competent on paper, inconsistent under framing. Rules survive winning and not losing. |
| EQ 90th, SQ 35th | Self-aware without a process. Knows the biases, has no mechanism preventing them. |

A single overall rank collapses all of that into one number and throws away the part that changes behaviour. Give TQ and regional rank the headline for engagement, then lead the body of the report with the five-axis radar and the flagged pattern.

---

## 6. Leaderboard integrity

If a rank is displayed publicly, it will be gamed. Minimum controls:

1. **First-sitting only counts for rank.** Retakes are shown to the user privately and never enter the norm table. Item exposure inflates repeat scores substantially.
2. **Disjoint item pool on retake**, drawn by `subskill` and difficulty to match the original blueprint.
3. **Region from account settings, not IP.** VPN-derived regions produce a leaderboard for a country nobody is in. If region is inferred from IP, that inference is personal data under UK GDPR and needs to be in the privacy notice.
4. **Response-time floor.** Sittings where median response time falls under ~25% of `est_seconds` are excluded from norms and flagged. The impulsivity index already computes this.
5. **Rank suppressed under n=500** in that cohort — enforced in `rankOf()`.
6. **Public leaderboards are opt-in**, with display name rather than real name, and erasure must trigger norm rebuild.

---

## 7. Two things to check with someone qualified

I'm not a lawyer and this isn't legal advice, but both are cheap to check now and expensive to unwind later:

**UK financial promotions.** NewLeaf is a commercial product adjacent to trading, and "you rank in the top 5% of traders" sits close to a claim about likely trading competence. Whether that engages the FCA financial promotion regime depends on how the assessment is positioned relative to the product — an educational self-assessment reads differently from a score used to market a trading service. Worth a short conversation with a compliance solicitor before the leaderboard is public, particularly if TIQ score ever gates a paid tier or appears in marketing.

**Data protection.** Country plus experience band plus score is personal data. In a small regional cohort it is also potentially identifying — one user in Malta with a public rank is identifiable from the leaderboard. The n≥30 cohort floor and the n≥500 rank floor both help here, and they are the same controls a DPIA would ask for.

---

## 8. Payload contract

`describeStanding()` returns:

```js
{
  score: 118,
  band: 'Strong',                    // always present, criterion-referenced
  mode: 'normed' | 'criterion_only',
  precision: 'percentile' | 'decile' | 'quartile' | 'none',
  display: '81st percentile',        // pre-formatted for the results screen
  percentile: 81.2,
  percentileLow: 68.4,               // measurement-error band
  percentileHigh: 90.1,
  sem: 6.4,
  rank: 412,                         // null when suppressed
  rankOf: 2840,
  cohortId: 'exp:2_5y',
  requestedCohort: 'exp:2_5y|country:GB',
  fellBack: true,                    // drives the "not enough UK results yet" line
  cohortN: 2840
}
```

`mode: 'criterion_only'` is the day-one path and needs a designed screen, not a fallback that looks broken. Most users will see it for the first several months.
