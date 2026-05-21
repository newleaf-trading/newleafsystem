# HeyGen Video Script — Probability Engine
**Page:** https://newleafsystem.com/probability-engine
**Duration:** ~2:30–3:00
**Tone:** Precise, trustworthy, mathematical but approachable
**Avatar:** Professional presenter, business casual
**Background:** Clean office / subtle financial charts backdrop

---

## SCENE 1 — Hook (0:00–0:12)

**[Avatar on screen, page hero visible behind]**

> Every options trade is a bet on probability. So the question isn't *will this stock go up?* — it's *what are the odds this trade makes money?*

> At NewLeaf, we don't guess. We calculate. Here's the maths behind it.

---

## SCENE 2 — The Pricing Pipeline (0:12–0:35)

**[Show the Option Pricing Pipeline diagram: Spot Price → Options Chain → Black-Scholes → Greeks → P&L → Verdict]**

> Our probability engine follows a six-step pipeline. It starts with a live spot price and the full options chain. From there, Black-Scholes pricing produces theoretical option values. Those feed into Greeks — Delta, Gamma, Theta, Vega. The Greeks drive real-time P&L calculations. And the P&L drives the verdict — the system's recommendation on what to do with the position.

> Every step is automated. Every step runs every fifteen minutes.

---

## SCENE 3 — Black-Scholes (0:35–1:05)

**[Show the Black-Scholes formula section with d1, d2, Call and Put equations]**

> At the core is the Black-Scholes model — the same mathematical framework used by institutional trading desks worldwide.

> It takes five inputs: the current stock price, the strike price, time to expiry, implied volatility, and the risk-free rate. From these, it calculates two intermediate values — d-one and d-two — and produces a theoretical price for any call or put option.

**[Show the parameter cards: S, K, T, sigma, r, N(x)]**

> We default the risk-free rate to four-and-a-half percent, matching current Treasury yields. Everything else comes from live market data. The model runs for every leg of every position, every time we refresh.

---

## SCENE 4 — The Greeks (1:05–1:35)

**[Show the four Greek cards: Delta, Gamma, Theta, Vega]**

> Black-Scholes doesn't just give us prices — it gives us the Greeks. And the Greeks are how we monitor risk in real time.

> **Delta** tells us how much the option moves per dollar change in the stock. Our verdict engine triggers an alert when a short delta hits zero-point-three-five.

> **Gamma** measures how fast delta changes. Inside twenty-one days to expiry, gamma accelerates — which is why we apply the twenty-one-DTE escalation rule.

> **Theta** is the premium seller's best friend — time decay. Our strategies are specifically designed to maximise theta capture.

> And **Vega** tracks sensitivity to volatility changes. When IV rank shifts more than thirty points from entry, we escalate the position to at least Monitor status.

---

## SCENE 5 — Three-Tier Pricing (1:35–2:00)

**[Show the three-tier cascade diagram: Tier 1 R2 Match → Tier 2 Black-Scholes → Tier 3 Intrinsic]**

> For live P&L tracking, we use a cascading pricing system.

> **Tier One** — the most accurate. We match the exact mid-price from our latest fifteen-minute scan stored in R2. Real bid-ask data from the Alpaca options feed.

> **Tier Two** — when market data is stale or unavailable, we estimate using Black-Scholes with the current spot price and the IV we observed at entry.

> **Tier Three** — the fallback. At or near expiry, we use intrinsic value. Simple but correct when time value is gone.

> The system cascades automatically. You always get the best available price — no manual intervention needed.

---

## SCENE 6 — Profit Capture (2:00–2:20)

**[Show the Profit Capture section with the formula]**

> Every open position tracks one key metric — profit capture percentage. How much of the maximum possible profit has been realised so far?

> The formula is simple: current net value divided by maximum profit, times one hundred.

> This drives our take-profit alerts. For Iron Condors — we recommend closing at fifty percent captured. For Iron Butterflies — twenty-five percent, because their profit zone is narrower. The system watches it for you, continuously.

---

## SCENE 7 — Close (2:20–2:45)

**[Avatar back on screen]**

> Black-Scholes. Four Greeks. Three pricing tiers. Continuous profit tracking. This is the maths behind every recommendation NewLeaf makes.

> It's the same framework institutional desks use — applied automatically, to every trade, every day.

> No spreadsheets. No manual calculations. Just probabilities you can trust.

**[Text overlay: "Explore the full documentation at newleafsystem.com/probability-engine"]**

---

## PRODUCTION NOTES

**Visual cues for HeyGen:**
- The pricing pipeline diagram is the anchor visual — show it early and hold 4 seconds
- When discussing Black-Scholes, slowly scroll through the formula — let it breathe
- The Greek cards are visually strong — zoom into each one as it's named
- The cascade diagram (Tier 1/2/3 with "miss" arrows) is compelling — hold 3 seconds
- Profit capture formula is a clean single visual — display while narrating

**Avatar settings:**
- Eye contact: Direct to camera
- Gestures: Precise hand movements (counting Greeks, showing tiers)
- Speed: Slightly slower than other scripts — mathematical content needs breathing room

**Music:**
- Minimal, almost academic
- Very low under narration, brief swell at "probabilities you can trust"
