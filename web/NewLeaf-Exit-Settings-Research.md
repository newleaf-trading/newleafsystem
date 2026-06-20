# NewLeaf Invest — Evidence-Backed Default Settings (Research Findings)

**Purpose:** Set the two open trading-judgment items (managed-exit rules, BWB thesis) from published evidence and practitioner consensus rather than gut — as **starting defaults** that NewLeaf's own outcome data will later override.

**The honest framing first:** This research tells you what has worked *on average, across broad historical backtests and documented practitioner methodology.* It does **not** tell you what's optimal for NewLeaf's *specific* gated picks. The well-known studies (tastytrade et al.) come from mechanically selling premium at ~45 DTE on high-IV underlyings — overlapping with, but not identical to, what your regime-gated engine selects. So: adopt these as evidence-based defaults, then let Invest's outcome-tracking *measure* whether they hold for your picks and tune from there. Research gives the sensible starting point; your data gives the real answer. This is exactly the "discriminating until validated" discipline applied to the exit rules themselves.

---

## 1. Managed-exit rules — strong consensus for premium-selling structures

Applies to: iron condor, iron butterfly, BWB, bull put, bear call (the credit/premium-selling structures).

| Rule | Evidence-backed default | Source basis |
|------|------------------------|--------------|
| **Profit target** | **50% of max profit** | tastytrade's repeated finding across "dozens of studies": managing short-premium winners at 50% of max profit improves risk-adjusted returns and win-rate stability vs. holding to expiry. The most consistently cited single number in retail options management. |
| **Time stop** | **21 DTE** | tastytrade: ~21 DTE is empirically where a strangle has on average reached ~50% of max profit, AND where **gamma risk begins to dominate** — past 21 DTE, a small adverse move can erase weeks of theta. Closing at 21 DTE showed more consistent win rates and lower return volatility. "50% profit OR 21 DTE, whichever first" is the standard combined rule. |
| **Loss stop** | **2× credit received** (2–3× is the cited range) | tastytrade: taking losers at 2×–3× credit is "a sensible start." The 2× figure pairs with the ~80% win rates these structures target (losses capped at ~4× the profit target keeps expectancy positive). |

**Recommended default rule (uniform for the 5 premium-sellers):**
`close at 50% of max profit, OR at 21 DTE, OR at 2× credit loss — whichever fires first.`

**The gamma-risk rationale matters for NewLeaf specifically:** the 21-DTE rule exists because near expiry, *price* risk (gamma) overwhelms *time* decay (theta) — the edge these structures rely on inverts. This is the same conceptual family as the engine's regime-awareness: it's about exiting before the structure's edge disappears, not a magic number.

---

## 2. Calendar spread — different rule (it's vega-long, not premium-selling)

You've already set the calendar **thesis** (vol expanded = held; price-near-strike = clean-win flag). The **managed-exit** for a calendar differs from the premium-sellers because a calendar is long vega / long theta with a *price-pinning* component:

| Rule | Evidence-backed default | Source basis |
|------|------------------------|--------------|
| **Profit target** | **25–50% of max value** (lean ~50%; some practitioners 25–35%) | Multiple sources: close at 25–50% of theoretical max; "holding for the maximum requires perfect price-pinning that rarely occurs." Calendars realize far below theoretical max in practice. |
| **Time stop** | **close before the final ~7 DTE of the short leg** | Strong consensus: don't hold a calendar into the last week — gamma risk on the short leg explodes. Often phrased as exit 5–10 days before short-leg expiry. |
| **Loss stop** | **debit doubles (≈ 2× initial debit)** | If the spread value falls toward zero / the debit effectively doubles, the thesis (price staying near strike + vol behaving) has failed. Several sources cite the 2× debit / ~30% stop range. |

**Recommended calendar default:**
`close at ~50% of max value, OR at 7 DTE on the short leg, OR if debit ~doubles (loss) — whichever first.`

Note this is consistent with treating the calendar as the engine's one structural exception, which you'd already flagged.

---

## 3. Broken Wing Butterfly — thesis + management (the genuinely nuanced one)

BWB has the least standardized convention because it's asymmetric and used differently by different traders. But the sources converge on points that map directly to **how NewLeaf actually uses BWBs** (pinning on gamma walls — confirmed by the SpotGamma methodology, which is the closest match to your engine's intent).

### Thesis-held definition — recommended

The strongest evidence-aligned definition for a **credit BWB used as a pinning structure** (NewLeaf's case):

- **Primary (thesis held):** the **broken/free side never went ITM** AND the position **retained its credit** (i.e. the wide-wing risk side was never breached). This is the structural promise of the broken wing — one side is de-risked; "thesis held" = that de-risking held.
- **Bonus / "clean win" flag:** price **migrated toward the body (short strikes)** — the max-profit pin zone — by evaluation. This is the same two-tier shape you chose for the calendar (core test + clean-win flag), which keeps the scoring consistent across structures.

Why this over the alternatives:
- *"Credit held"* alone is too weak — it can be true transiently without the thesis really holding.
- *"Body reached"* alone is too strict — sources stress you rarely pin the body exactly, and chasing it is "greedy"; the structure can be a clear success without a perfect pin.
- *Free-side-safe + body-as-bonus* captures both the de-risking promise (core) and the ideal outcome (bonus) — and matches the SpotGamma framing that BWBs are placed to pin near a wall with the long wing protecting the directional-drift side.

### Management — recommended defaults

| Rule | Evidence-backed default | Source basis |
|------|------------------------|--------------|
| **Profit target** | **50–75% of max profit** (lean 50%) | Repeated across sources: "take 50–75% of max profit early, don't be greedy." Credit-BWB variant sometimes framed as 30–60% of initial credit. |
| **Time stop** | **close ~5–7 DTE** (do not hold into final week) | Strong consensus: gamma risk explodes near expiry on the short strikes; "close 3–5 (or 5–7) days before expiration." |
| **Loss stop** | **2–2.5× the credit/risk on the broken side**, OR price breaches the body / short-strike delta exceeds ~0.30 | Sources cite 2–3× initial credit on the broken side, or a delta-based trigger (~0.30–0.40 on the shorts), or "price breaches the body early." |

**Recommended BWB default:**
`close at 50–75% of max profit, OR ~7 DTE, OR if the broken side is breached / delta on shorts > ~0.35 — whichever first.`

**Important caveat for NewLeaf:** several sources note BWBs are *less suited to high-IV / highly volatile underlyings* (gap risk on the undefined-ish broken side becomes hard to manage). Your engine's BWB gate fires partly on wide band / high IV — so this is a place where **your outcome data may diverge from the generic backtests**, and worth watching specifically once Invest is logging.

---

## 4. How to use these in Invest

1. **Set these as the parameterized defaults** in the managed-exit evaluator and the thesis-scoring rules — NOT hard-coded constants. Config values Manish can change.
2. **They are starting points, not proven-optimal-for-NewLeaf.** The whole reason Invest exists is to measure whether they hold for the engine's specific picks.
3. **Once enough outcomes accrue,** compare actual results under these defaults vs. alternatives (e.g. 50% vs 25% profit target on the calendars, free-side vs body-reached for BWB). That comparison — on NewLeaf's own picks — is the real optimization, and it's the thing that eventually earns a performance claim.
4. **Don't overfit early.** Tune on aggregate patterns across many closed trades, never react to individual outcomes.

### Summary of recommended defaults

| Structure | Profit target | Time stop | Loss stop |
|-----------|--------------|-----------|-----------|
| Condor / Butterfly / Bull Put / Bear Call | 50% of max | 21 DTE | 2× credit |
| Calendar | ~50% of max value | 7 DTE (short leg) | debit ~doubles |
| Broken Wing Butterfly | 50–75% of max | ~7 DTE | broken-side breach / shorts delta >~0.35 (≈2–2.5× credit) |

| Structure | Thesis held |
|-----------|-------------|
| Iron Condor | spot between short strikes at eval |
| Iron Butterfly | spot within the wings |
| Bull Put | direction held + short put OTM |
| Bear Call | direction held + short call OTM |
| Calendar | **vol expanded** (price-near-strike = clean-win flag) — *Manish-confirmed* |
| Broken Wing Butterfly | **broken side never ITM + credit retained** (body reached = clean-win flag) — *research default, Manish to confirm* |

*Sources: tastytrade/tastylive market-measures research (50% / 21 DTE / 2× credit; gamma-risk rationale), SpotGamma BWB methodology (pinning on walls), multiple options-education backtests (BWB 50–75% / 7 DTE; calendar 25–50% / 7 DTE / 2× debit). All are broad/historical — NewLeaf's own outcome data is the intended source of truth.*
