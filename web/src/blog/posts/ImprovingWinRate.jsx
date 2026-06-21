import { Link } from 'react-router-dom';

export default function ImprovingWinRate() {
  return (
    <>
      <p>
        Win rate is the highest-leverage number in your whole plan. As we showed in the{' '}
        <Link to="/blog/compounding-small-edge-3x-five-years">compounding article</Link>, nudging it from
        58% to 64% changes the five-year curve dramatically — because every extra winner compounds. The
        catch is that you do not raise win rate by <em>predicting</em> better. You raise it by being more
        <strong> selective</strong>: trading only the setups where the odds are genuinely tilted, and
        passing on everything else.
      </p>
      <p>
        Three filters do most of that work, in order: score the technicals, read the sentiment, and skip
        the earnings. Each one removes a category of trade the edge cannot survive.
      </p>

      {/* ── Funnel visual ── */}
      <figure style={{ margin: '26px 0 30px', padding: '20px 18px 12px', background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14 }}>
        <svg viewBox="0 0 600 214" width="100%" role="img" aria-label="A selectivity funnel: candidates narrow through a setup-score gate, a sentiment gate, and an earnings gate to a small tradeable set">
          <rect x="30" y="12" width="540" height="38" rx="6" fill="#D9D5C8" />
          <text x="300" y="36" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#5a564a" fontFamily="'Inter', sans-serif">All candidates</text>
          <rect x="120" y="60" width="360" height="38" rx="6" fill="#6FA287" />
          <text x="300" y="84" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff" fontFamily="'Inter', sans-serif">Pass the setup score</text>
          <rect x="185" y="108" width="230" height="38" rx="6" fill="#2E7D5B" />
          <text x="300" y="132" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="'Inter', sans-serif">Sentiment clear</text>
          <rect x="240" y="156" width="120" height="38" rx="6" fill="#C9A96E" />
          <text x="300" y="180" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0B2D23" fontFamily="'Inter', sans-serif">No earnings → trade</text>
        </svg>
        <figcaption style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: '#6b6b60', textAlign: 'center', marginTop: 6 }}>
          Selectivity, not prediction: each gate removes trades the edge can&apos;t survive (illustrative).
        </figcaption>
      </figure>

      {/* ── Section 1 ── */}
      <h2 id="score-the-setup">Filter 1: score the technical setup — don&apos;t eyeball it</h2>
      <p>
        Eyeballing a chart is where win rate quietly leaks away, because a discretionary read is
        inconsistent. The fix is to <strong>score every setup the same way</strong> and only trade the
        high-quality ones. Our 0–100 opportunity score blends three pillars — gamma corridor, IV regime,
        and trend conviction — and maps to a decision tier:{' '}
        <strong>APPROVED at 65+</strong>, watchlist from 40–64, no-trade below 40. (The full mechanism is
        in <Link to="/blog/automating-technical-analysis-into-a-score">how we automate technical analysis into a score</Link>.)
      </p>
      <p>
        The win-rate lever here is simple: only take APPROVED setups, and let the conditions choose the{' '}
        <Link to="/blog/choosing-an-options-strategy-by-iv-and-regime">structure</Link>. Most candidates
        will not clear the bar on any given day — and that is the point. Fewer, cleaner trades win more
        often than more, sloppier ones.
      </p>

      {/* ── Section 2 ── */}
      <h2 id="read-the-sentiment">Filter 2: read the sentiment — the fundamental overlay</h2>
      <p>
        A setup can be technically clean and still sit on top of a fundamental landmine. A sentiment layer
        catches what price has not yet reflected. Our composite blends four independent reads —
        news and analyst coverage, X / social chatter, sector and macro narratives, and retail forums —
        into a single <strong>0–100 sentiment score</strong> (bullish 70+, neutral 40–69, bearish below 40),
        each with its own confidence weight.
      </p>
      <p>
        Crucially, sentiment is an <strong>overlay, not the thesis</strong>. It acts in three ways:
      </p>
      <ul>
        <li><strong>Confirm (boost):</strong> when sentiment is strong (≈75+) and agrees with the technical direction, the setup gets a small score bump.</li>
        <li><strong>Diverge (caution):</strong> when sentiment contradicts the technicals — bearish chatter under a bullish chart — the setup is flagged and marked down, not blindly traded.</li>
        <li><strong>Suppress (veto):</strong> when a hard catalyst is detected — earnings, M&amp;A, a regulatory or FDA event — the name is pulled from consideration entirely until it clears.</li>
      </ul>
      <div className="blog-callout tip">
        <strong>The most valuable sentiment output is an empty one.</strong>
        For a premium seller, &quot;no material events between now and expiry&quot; is the ideal reading —
        it means the technical edge can play out without a fundamental shock overriding it.
      </div>

      {/* ── Section 3 ── */}
      <h2 id="skip-earnings">Filter 3: skip the earnings — the single biggest win-rate killer</h2>
      <p>
        No technical edge survives an earnings report. A stock can gap 5–15% on a surprise, blowing
        straight through short strikes that looked perfectly safe the day before — and the post-earnings IV
        crush punishes long-volatility positions just as hard. It is <strong>binary gap risk</strong>: a
        coin flip glued to the front of your trade.
      </p>
      <p>
        So the rule is not &quot;be careful around earnings&quot; — it is a <strong>hard exclusion</strong>.
        If an earnings date falls inside the trade&apos;s window (a ~21-day default), the name is removed
        from the pool. Not downgraded, not sized smaller — removed. A related rule handles ex-dividend dates
        for any structure with a short call, where early-assignment risk spikes.
      </p>
      <table>
        <thead>
          <tr><th>Event in the expiry window</th><th>Action</th></tr>
        </thead>
        <tbody>
          <tr><td>Earnings report</td><td>Excluded — no trade until it passes</td></tr>
          <tr><td>Ex-dividend (short-call structures)</td><td>Excluded — early-assignment risk</td></tr>
          <tr><td>No binary events</td><td>Eligible — the edge can play out</td></tr>
        </tbody>
      </table>
      <p>
        This one filter does more for realized win rate than almost anything else, because it deletes the
        trades most likely to produce a large, sudden loss.
      </p>

      {/* ── Section 4 ── */}
      <h2 id="stacking">Stacking the filters: fewer trades, higher hit rate</h2>
      <p>
        Run all three gates and the candidate list collapses — by design. What survives is a small set of
        trades that are technically scored, sentiment-clear, and free of binary events before expiry. That
        is how a defined-risk premium-selling plan realistically targets a <strong>60–70% win rate</strong>:
        not by being clairvoyant, but by refusing the trades that drag the average down.
      </p>
      <p>
        And remember why this matters so much. A few points of win rate, applied across hundreds of
        compounding trades, is the difference between a curve that drifts and one that triples. Selectivity
        is not caution for its own sake — it is the cheapest edge you can buy.
      </p>

      {/* ── FAQ ── */}
      <h2 id="faq">Frequently asked questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Doesn&apos;t skipping earnings mean missing big moves?</div>
          <div className="blog-faq-a">
            For a premium seller, the &quot;big move&quot; is the risk, not the reward. Earnings convert a
            high-probability income trade into a coin flip. Sitting out the binary event and trading the
            other ~48 weeks of the year is what keeps the win rate — and the account — intact.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Is sentiment a reason to enter a trade?</div>
          <div className="blog-faq-a">
            No — it is a filter, not a thesis. Strong sentiment can confirm a technically sound setup or veto
            one, but it should not be the reason you put a trade on by itself. The technical score and risk
            structure lead; sentiment refines.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">How much can I realistically raise my win rate?</div>
          <div className="blog-faq-a">
            There is no fixed number — it depends on your starting discipline. But moving from
            &quot;trade what looks good&quot; to &quot;trade only scored, sentiment-clear, earnings-free
            setups&quot; is exactly the shift that pushes a premium-selling plan toward the 60–70% range
            instead of below it.
          </div>
        </div>
      </div>

      <div className="blog-callout warning">
        <strong>Educational disclaimer.</strong>
        This article is for educational purposes only and is not investment advice. Win rates and
        thresholds are illustrative of one systematic approach and do not guarantee any outcome. Options
        involve substantial risk and are not suitable for all investors.
      </div>
    </>
  );
}
