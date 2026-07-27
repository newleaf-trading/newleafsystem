# NewLeaf TIQ — Front Door (spec addendum v1.2)

Demo: `newleaf-instinct-quiz.html` — working, single file, no dependencies.

---

## 1. Split the product rather than soften it

Your read on drop-out is right, and it is a funnel problem, not an instrument problem. A 40-item assessment with 150-second scenario items is a good product and a terrible first impression. But if you simplify the 40-item version until it retains people, you end up with something that neither retains *nor* measures.

Two artefacts instead:

| | **Trading Instinct** (front door) | **TIQ Assessment** (product) |
|---|---|---|
| Length | 12 questions, ~4 min | 40 questions, ~35 min |
| Access | Free, no signup | After signup |
| Output | Archetype + Instinct Score | TQ, five percentiles, bias profile |
| Purpose | Acquisition | Retention and self-knowledge |
| Question types | A, B, F only | All six |
| Ranking | None | Percentile and regional rank |

This is the OptionStrat pattern you already identified — the free interactive tool as the acquisition front door — applied to assessment rather than payoff diagrams. The quiz sells the assessment; the assessment sells NewLeaf.

---

## 2. How to make the score feel good without lying

Four mechanisms, all in the demo. None of them require a dishonest question.

**Never report a deficit.** The results screen shows your strongest axis, named and explained. It never shows your weakest. Everybody has a strongest axis by construction, so everybody gets a true, flattering headline. The weakest axis appears only as a "growth edge" attached to the archetype, phrased as the natural cost of a strength rather than a failing.

**Archetypes, not grades.** Six archetypes — Architect, Sniper, Scholar, Guardian, Diplomat, Storm Chaser — assigned from the dominant trait rather than the score. Every one has a genuine edge written for it, including Storm Chaser, which is the profile that would score worst on the 40-item version. That is the point: the impulsive trader gets told their decisiveness is real and their sizing needs a rule, which is both true and something they will read to the end.

**A generous scale, stated honestly.** `score = 50 + 50 × (points earned / points available)`. Floor of 50, typical result lands around 75–85. This is scale positioning, not score inflation — the underlying ranking is untouched, and the front-door score deliberately carries no percentile claim, so there is nothing to be inflated relative to. Keep it that way: the moment you attach "top 12% of traders" to a curve you chose to be generous, it stops being presentation and starts being a false claim.

**No red anywhere.** Weaker picks shade neutral. There is no cross, no "incorrect", no score penalty animation. The best answer highlights in teal; everything else simply is.

---

## 3. The signature mechanic: consensus reveal

After each answer, a bar slides in behind every option showing what share of traders chose it, with your pick tagged.

This is the single highest-leverage element in the design and it is worth more than the score. It does three things at once:

- **Normalises being wrong.** Picking the option 31% of traders picked feels like company, not failure. This is the main lever on drop-out — people quit quizzes when they feel stupid, not when they feel challenged.
- **Teaches.** "Most traders size down here. The stronger move is to skip" is a more memorable lesson than any explanation paragraph, because it arrives attached to a social fact.
- **Creates the share.** "62% of traders got this wrong" is the screenshot that travels.

Consensus values in the demo are placeholders. Replace with real telemetry as soon as n > 500 per item, and recompute weekly. Do not fabricate them long-term — if someone compares their result across two sittings and the percentages have not moved, the mechanic loses its credibility permanently.

---

## 4. Writing rules for simple questions

The 12 demo items follow these, and any generated front-door item should be validated against them:

1. **Stem under 25 words.** Setup under 35.
2. **No tables, no option chains, no Greek names.** Question 5 tests theta without using the word.
3. **Arithmetic only where a person can do it in their head.** £20,000 × 2% ÷ £200 is fine; Kendall tau is not.
4. **Three or four options.** Never five.
5. **One decision per question.** No "rank these", no "select all".
6. **The insight line must contain something the reader did not know.** If it only restates the correct answer, cut the question.
7. **No option is stupid.** Every distractor is something a real person would do, which is also what makes the consensus numbers plausible.

Rule 6 is the one that matters for retention. People finish quizzes that are teaching them things.

---

## 5. What this costs, stated plainly

The front door is not a measurement and the demo says so in its own footer. Three things it gives up:

- **No framing pairs**, so no consistency index. Whether someone's rules survive losing as well as winning cannot be detected in 12 items.
- **No ruin gate.** A user who would size up after four losses can score 78 here. That is acceptable for a marketing artefact and would not be acceptable in the assessment.
- **No percentile.** Deliberately. A generous curve and a percentile claim cannot coexist honestly.

Keep those three in the 40-item version and let the front door do its actual job, which is to make someone curious enough to sign up. The handoff line is already written into the demo footer: the full assessment checks whether your rules hold up when you are losing, not just when you are winning. That is a real difference, it is worth paying attention to, and it gives the paid product something to be.

---

## 6. Suggested instrumentation

Track per item: impressions, completions, time-to-answer, choice distribution, and abandon rate. Any item with an abandon rate above ~4% is either too long or too hard for this tier — rewrite or drop it. Target overall completion above 70%; below 55% the quiz is not doing its job regardless of how good the questions are.
