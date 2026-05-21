# HeyGen Video Script — Strategy Selection & Adjustment
**Page:** https://newleafsystem.com/strategy-selection
**Duration:** ~3:00–3:30
**Tone:** Practical, systematic, confident
**Avatar:** Professional presenter, business casual
**Background:** Clean office / trading terminal subtle backdrop

---

## SCENE 1 — Hook (0:00–0:15)

**[Avatar on screen, page hero visible behind]**

> Picking the right stock is only half the job. The other half — the half most traders get wrong — is picking the right *structure*.

> Should you sell an Iron Condor? A Broken Wing Butterfly? A directional spread? At NewLeaf, this decision isn't a judgement call. It's a decision tree.

---

## SCENE 2 — The Selection Pipeline (0:15–0:40)

**[Show the Strategy Selection Pipeline: Scored Stock → Band Width → Trend Direction → IV Regime → Strategy]**

> Once a stock passes our scoring filters, it enters the strategy selection pipeline. Five steps. Fully automated.

> We start with a scored stock — typically seventy-five or above. Then we measure the gamma band width — the gap between the put wall and call wall. We assess the trend direction — bullish, bearish, or neutral. We check the IV regime — is it in the sweet spot? And from those inputs, the engine selects the optimal strategy.

**[Show the Decision Flowchart: root node branching to Iron Condor, BWB, Iron Butterfly, Vertical Spread]**

> Here's the decision flowchart. One root question — what's the band width and confidence? — branches into four possible strategies.

---

## SCENE 3 — The Strategies (0:40–1:25)

**[Show the strategy detail cards, zooming into each]**

> Let me walk you through each one.

**[Highlight Iron Condor]**

> **Iron Condor** — our primary strategy. Requires a band width between three and fifteen percent, confidence above sixty percent, and at least fifty contracts of liquidity. It sells both a put spread and call spread, defining a range where the stock needs to stay. When gamma walls are clear and tight — this is the trade.

**[Highlight Broken Wing Butterfly]**

> **Broken Wing Butterfly** — our secondary strategy. Used when the band is wider — ten to forty percent — and we detect a directional bias. The body is anchored to the gamma wall, with asymmetric wings that provide credit entry. It's more aggressive, but the directional tilt means higher reward when the thesis is right.

**[Highlight Iron Butterfly]**

> **Iron Butterfly** — the fallback for tight bands. When put and call walls converge near the same price, we sell the ATM straddle with protective wings. Higher max profit but a narrow profit zone — which is why our take-profit target drops to twenty-five percent.

**[Highlight Vertical Spreads]**

> And **Vertical Spreads** — Bull Put or Bear Call — when the trend engine shows strong directional conviction. We sell at the gamma wall and buy deeper out-of-the-money protection. Simple, directional, defined risk.

---

## SCENE 4 — BWB Strike Calculation (1:25–1:50)

**[Show the BWB Strike Calculation section with Put BWB and Call BWB formulas]**

> Let me show you how Broken Wing Butterfly strikes are calculated — because this is where the gamma walls really matter.

> For a Put BWB — bullish bias — the body sits at the put wall. The upper wing extends sixty percent of the distance between the body and current price. And the lower wing extends one-point-seven times the upper width — that's the "broken" part that creates the credit entry.

> For a Call BWB — bearish bias — it's the mirror image, anchored to the call wall.

> The system also applies a score bonus: plus five if confidence is above sixty percent, plus five if the body aligns tightly with the gamma wall, plus five if IV is in the thirty-to-fifty sweet spot. Minus five if IV exceeds sixty.

---

## SCENE 5 — The Verdict Engine (1:50–2:25)

**[Show the verdict engine vertical flow: Open Position → Monitor → Evaluate Verdict → Action or Hold]**

> Once a trade is open, a completely different engine takes over — the Verdict Engine. It evaluates every position every fifteen minutes and assigns one of five states.

**[Show the five verdict rows: EXIT, TAKE PROFIT, ACTION NEEDED, MONITOR, ON TRACK]**

> Priority one — **EXIT**. For an Iron Condor, that means loss exceeding one-and-a-half times the credit received, or a strike breached for two or more sessions.

> Priority two — **TAKE PROFIT**. Fifty percent profit captured for condors and put spreads. Twenty-five percent for butterflies.

> Priority three — **ACTION NEEDED**. The short delta has hit zero-point-three-five, or a strike is being tested. Time to consider adjustments.

> Priority four — **MONITOR**. Short delta at zero-point-two-five, or inside twenty-one days to expiry. Eyes open, no action yet.

> And priority five — **ON TRACK**. Everything is healthy. The position is performing within expected parameters.

**[Show the Universal Overrides section]**

> On top of that, three universal overrides can escalate any verdict. The twenty-one-DTE rule. Earnings proximity. And a vol regime shift of more than thirty IV rank points. These override everything — because the game changes when these conditions appear.

---

## SCENE 6 — Adjustment Catalogue (2:25–2:50)

**[Show the Adjustment Catalogue section with the improvement ratio formula and strategy-specific adjustments]**

> When a position reaches Action Needed or Exit, we don't just close it. We evaluate adjustments first.

> Every adjustment is scored by its improvement ratio: the probability improvement divided by the net cost. A Smart Roll needs at least a zero-point-three improvement with probability above fifty-five percent. Marginal adjustments need zero-point-one-five with probability above fifty.

> Iron Condors have five possible adjustments — from rolling the tested side to closing entirely. Bull Put Spreads have three. Bear Call Spreads have three. And Iron Butterflies? Close entire. Mid-trade adjustments on butterflies rarely pay.

> The system ranks the options and recommends the best one. You decide.

---

## SCENE 7 — Close (2:50–3:15)

**[Avatar back on screen]**

> From strategy selection to entry. From monitoring to adjustment. From take-profit to exit. Every step is systematic. Every decision follows a rule.

> That's not to say there's no room for judgement — there is. But the rules are the foundation. They remove emotion, prevent second-guessing, and ensure every trade gets the same disciplined treatment.

> That's NewLeaf Strategy Selection and Adjustment. The right structure for the right market — every time.

**[Text overlay: "Explore the full documentation at newleafsystem.com/strategy-selection"]**

---

## PRODUCTION NOTES

**Visual cues for HeyGen:**
- The decision flowchart (root → 4 branches) is the signature visual — hold it for 5 seconds
- Strategy pipeline diagram sets the scene — show early
- Zoom into each strategy card as it's discussed (Scene 3) — spend ~10s on each
- The BWB formulas are technical — scroll slowly, let the viewer absorb
- The five verdict rows are colour-coded and visually satisfying — show the full list
- The adjustment catalogue grid is the final "completeness" visual

**Avatar settings:**
- Eye contact: Direct to camera
- Gestures: Active — pointing at strategies, counting verdicts
- Speed: Normal pace for strategies, slightly slower for BWB maths and verdict rules

**Music:**
- Purposeful, structured feel — think "systems at work"
- Low under narration, slight shift in energy when moving from selection to monitoring
- Brief swell at the close
