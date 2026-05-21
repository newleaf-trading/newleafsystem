import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, query, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const R2_BASE = 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev';
const mono = "'Space Mono', monospace";
const serif = "'Playfair Display', serif";
const forest = '#0B2D23';
const gold = '#C9A96E';
const muted = '#6b6b60';
const ink = '#3d3d35';

export default function PickAnalysisPage() {
  const { symbol } = useParams();
  const sym = symbol?.toUpperCase();
  const [pick, setPick] = useState(null);
  const [tile, setTile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const weekSnap = await getDocs(
          query(collection(db, 'weeklyPicks'), orderBy('weekId', 'desc'), limit(1))
        );
        if (weekSnap.empty) return;

        const week = weekSnap.docs[0].data();
        const pickData = (week.picks || []).find(p => p.symbol?.toUpperCase() === sym);
        if (!pickData) return;
        setPick({ ...pickData, weekId: week.weekId, dateRange: week.dateRange, theme: week.theme });

        if (pickData.tileId) {
          const [analysisDoc, tileDoc] = await Promise.all([
            getDoc(doc(db, 'analyses', pickData.tileId)),
            getDoc(doc(db, 'tiles', pickData.tileId)),
          ]);
          if (analysisDoc.exists()) setAnalysis(analysisDoc.data());
          if (tileDoc.exists()) setTile(tileDoc.data());
        }
      } catch (err) {
        console.error('Error loading analysis:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [sym]);

  // Build payoff data from legs
  const payoffData = useMemo(() => {
    const legs = tile?.legs || [];
    if (legs.length === 0) return [];
    const spot = pick?.price || tile?.underlyingPrice || 100;
    const lo = spot * 0.8, hi = spot * 1.2;
    const points = [];
    for (let price = lo; price <= hi; price += (hi - lo) / 80) {
      let pnl = 0;
      for (const leg of legs) {
        const mult = leg.action === 'BUY' ? 1 : -1;
        const intrinsic = leg.type === 'CALL'
          ? Math.max(0, price - leg.strike)
          : Math.max(0, leg.strike - price);
        pnl += (intrinsic - leg.premium) * mult * 100;
      }
      const val = Math.round(pnl * 100) / 100;
      points.push({
        price: Math.round(price * 100) / 100,
        pnl: val,
        profit: val > 0 ? val : 0,
        loss: val < 0 ? val : 0,
      });
    }
    return points;
  }, [tile, pick]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: muted, fontFamily: mono }}>Loading analysis...</div>
      </div>
    );
  }

  if (!pick) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: serif, color: forest }}>Analysis not found</h2>
        <p style={{ color: muted, marginTop: 8 }}>No analysis available for {sym}.</p>
        <Link to="/picks" style={{ color: forest, marginTop: 16, display: 'inline-block' }}>← Back to picks</Link>
      </div>
    );
  }

  const a = analysis || {};
  const rationale = a.strategyRationale || {};
  const tech = a.technicalIndicators || {};
  const risk = a.riskAnalysis || {};
  const theta = a.thetaDecaySchedule || {};
  const iv = tech.impliedVolatility || {};
  const sr = tech.supportResistance || {};
  const legs = tile?.legs || [];
  const greeks = tile?.greeks || {};
  const pdfSlug = `${sym}-${(pick.strategy || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '')}`;
  const pdfUrl = `${R2_BASE}/reports/pdf/${sym}/${pdfSlug}-latest.pdf`;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 2rem 60px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/picks" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.06em', color: muted, textDecoration: 'none' }}>
          ← Back to picks
        </Link>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{
          fontFamily: mono, fontSize: 10, letterSpacing: '.06em', fontWeight: 700,
          padding: '8px 16px', background: forest, color: '#fff', borderRadius: 6,
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          ↓ Download PDF Report
        </a>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: gold, marginBottom: 8 }}>
          Full Analysis · {pick.weekId}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontFamily: serif, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, color: forest, lineHeight: 1.15 }}>
            {sym}
          </h1>
          {pick.price != null && (
            <span style={{ fontFamily: mono, fontSize: 18, color: muted }}>${typeof pick.price === 'number' ? pick.price.toFixed(2) : pick.price}</span>
          )}
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '3px 10px', border: '1px solid', borderRadius: 20, fontWeight: 700,
            color: pick.direction === 'BULLISH' || pick.direction === 'bullish' ? '#1D9E75' : pick.direction === 'BEARISH' || pick.direction === 'bearish' ? '#E24B4A' : gold,
          }}>
            {pick.direction?.toUpperCase()}
          </span>
        </div>
        <div style={{ fontFamily: serif, fontSize: 22, color: forest, marginBottom: 8 }}>{pick.strategy}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: muted }}>
          <span>{pick.dateRange}</span>
          {pick.expiry && <span>· Expiry: {pick.expiry}</span>}
          {pick.dte != null && <span>· {pick.dte} DTE</span>}
        </div>
      </div>

      {/* Key metrics strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <MetricCard label="Max Profit" value={`$${typeof pick.maxProfit === 'number' ? pick.maxProfit.toFixed(2).replace(/\.00$/, '') : pick.maxProfit}`} valueColor="#1D9E75" />
        <MetricCard label="Max Loss" value={`$${typeof pick.maxLoss === 'number' ? pick.maxLoss.toFixed(2).replace(/\.00$/, '') : pick.maxLoss}`} valueColor="#E24B4A" />
        <MetricCard label="Reward : Risk" value={`${typeof pick.rewardRisk === 'number' ? pick.rewardRisk.toFixed(2) : pick.rewardRisk}×`} />
        <MetricCard label="Win Probability" value={pick.oddsOfProfit != null ? `${pick.oddsOfProfit}%` : '-'} valueColor="#1D9E75" />
      </div>

      {/* Strategy Rationale */}
      {(rationale.whyThisStrategy || rationale.whyTheseStrikes || rationale.whyThisExpiration) && (
        <Section title="Strategy Rationale">
          {rationale.whyThisStrategy && (
            <div style={{ marginBottom: 16 }}>
              <Label>Why this strategy</Label>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: ink }}>{rationale.whyThisStrategy}</p>
            </div>
          )}
          {rationale.whyTheseStrikes && (
            <div style={{ marginBottom: 16 }}>
              <Label>Why these strikes</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{rationale.whyTheseStrikes}</p>
            </div>
          )}
          {rationale.whyThisExpiration && (
            <div style={{ marginBottom: 16 }}>
              <Label>Why this expiration</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{rationale.whyThisExpiration}</p>
            </div>
          )}
          {rationale.marketOutlook && (
            <div>
              <Label>Market Outlook</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{rationale.marketOutlook}</p>
            </div>
          )}
        </Section>
      )}

      {/* Trade Structure — Legs Table */}
      {legs.length > 0 && (
        <Section title="Trade Structure">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <InfoChip label="Expiry" value={pick.expiry} />
            <InfoChip label="DTE" value={`${pick.dte} days`} />
            {iv.currentIV && <InfoChip label="IV" value={`${(iv.currentIV * 100).toFixed(0)}%`} />}
            {iv.ivRank != null && <InfoChip label="IV Rank" value={iv.ivRank} />}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(15,61,46,.12)' }}>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Strike</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Premium</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Delta</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Theta</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Vega</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(15,61,46,.06)' }}>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                      background: leg.action === 'BUY' ? '#E1F5EE' : '#FEE2E2',
                      color: leg.action === 'BUY' ? '#0F6E56' : '#B91C1C',
                    }}>{leg.action}</span>
                  </td>
                  <td style={tdStyle}>{leg.type}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>${leg.strike}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>${typeof leg.premium === 'number' ? leg.premium.toFixed(2) : leg.premium}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{leg.delta?.toFixed(4)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{leg.theta?.toFixed(4)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{leg.vega?.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Greeks Dashboard */}
      {(greeks.netDelta != null || greeks.netTheta != null) && (
        <Section title="Net Greeks">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <GreekCard label="Delta" value={greeks.netDelta} desc="Directional exposure" />
            <GreekCard label="Theta" value={greeks.netTheta} desc="Daily time decay" />
            <GreekCard label="Vega" value={greeks.netVega} desc="Volatility sensitivity" />
            <GreekCard label="Gamma" value={greeks.netGamma} desc="Delta acceleration" />
          </div>
        </Section>
      )}

      {/* Payoff Diagram */}
      {payoffData.length > 0 && (
        <Section title="P&L at Expiry">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={payoffData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#1D9E75" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E24B4A" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#E24B4A" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <XAxis dataKey="price" tick={{ fontSize: 10, fontFamily: mono }} tickFormatter={v => `$${v}`} />
              <YAxis tick={{ fontSize: 10, fontFamily: mono }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ fontFamily: mono, fontSize: 11, border: '1px solid rgba(15,61,46,.12)', borderRadius: 8, background: '#fff' }}
                formatter={(v, name) => [`$${v}`, name === 'profit' ? 'Profit' : name === 'loss' ? 'Loss' : 'P&L']}
                labelFormatter={(v) => `Price: $${v}`}
              />
              <ReferenceLine y={0} stroke="#ccc" strokeWidth={1} />
              {pick.price && <ReferenceLine x={pick.price} stroke={gold} strokeDasharray="3 3" label={{ value: 'Spot', fontSize: 10, fill: gold }} />}
              <Area type="monotone" dataKey="profit" stroke="none" fill="url(#profitFill)" baseLine={0} />
              <Area type="monotone" dataKey="loss" stroke="none" fill="url(#lossFill)" baseLine={0} />
              <Line type="monotone" dataKey="pnl" stroke={forest} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* IV Analysis */}
      {iv.description && (
        <Section title="Implied Volatility">
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            {iv.currentIV && <MetricCardSmall label="Current IV" value={`${(iv.currentIV * 100).toFixed(0)}%`} />}
            {iv.ivRank != null && <MetricCardSmall label="IV Rank" value={iv.ivRank} />}
            {iv.ivPercentile != null && <MetricCardSmall label="IV Percentile" value={`${iv.ivPercentile}%`} />}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{iv.description}</p>
        </Section>
      )}

      {/* Support / Resistance */}
      {(sr.support?.length > 0 || sr.resistance?.length > 0) && (
        <Section title="Key Levels">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {sr.support?.length > 0 && (
              <div>
                <Label>Support</Label>
                {sr.support.map((s, i) => (
                  <div key={i} style={{ fontFamily: mono, fontSize: 13, marginBottom: 6 }}>
                    <strong style={{ color: '#1D9E75' }}>${s.level}</strong>
                    {s.description && <span style={{ color: muted, fontSize: 11 }}> — {s.description}</span>}
                  </div>
                ))}
              </div>
            )}
            {sr.resistance?.length > 0 && (
              <div>
                <Label>Resistance</Label>
                {sr.resistance.map((r, i) => (
                  <div key={i} style={{ fontFamily: mono, fontSize: 13, marginBottom: 6 }}>
                    <strong style={{ color: '#E24B4A' }}>${r.level}</strong>
                    {r.description && <span style={{ color: muted, fontSize: 11 }}> — {r.description}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Risk Analysis */}
      {(risk.maxPainScenario || risk.managementPlan || risk.earningsRisk || risk.eventRisk) && (
        <Section title="Risk Analysis">
          {risk.maxPainScenario && (
            <div style={{ marginBottom: 16 }}>
              <Label>Worst-Case Scenario</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{risk.maxPainScenario}</p>
            </div>
          )}
          {risk.earningsRisk && (
            <div style={{ marginBottom: 16 }}>
              <Label>Earnings Risk</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{risk.earningsRisk}</p>
            </div>
          )}
          {risk.eventRisk && (
            <div style={{ marginBottom: 16 }}>
              <Label>Event Risk</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{risk.eventRisk}</p>
            </div>
          )}
          {risk.managementPlan && (
            <div>
              <Label>Management Plan</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{risk.managementPlan}</p>
            </div>
          )}
        </Section>
      )}

      {/* Market Sentiment (4-engine AI analysis) */}
      {(tile?.sentiment || analysis?._sentiment) && (() => {
        const s = tile?.sentiment || analysis?._sentiment;
        const score = s.composite?.score ?? s.score;
        const label = (s.composite?.label ?? s.label ?? 'neutral');
        const confidence = s.composite?.confidence ?? s.confidence;
        const engines = s.engines ? Object.keys(s.engines) : [];
        const clr = label === 'bullish' ? '#1D9E75' : label === 'bearish' ? '#E24B4A' : '#6b7280';
        const engineColors = { claude: '#D97706', grok: '#1DA1F2', gemini: '#4285F4', reddit: '#7C3AED' };
        const engineLabels = { claude: 'Claude', grok: 'Grok / X', gemini: 'Gemini', reddit: 'Reddit' };
        return (
          <Section title="Market Sentiment">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: mono, fontSize: 36, fontWeight: 700, color: clr }}>{score}</div>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', background: `${clr}15`, color: clr, border: `1px solid ${clr}30` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: clr }} />
                  {label}
                </span>
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                  Confidence: {Math.round((confidence || 0) * 100)}% &middot; {engines.length > 0 ? `${engines.length} AI engines (${engines.join(', ')})` : s.source || 'Claude'}
                </div>
              </div>
            </div>
            {s.summary && <p style={{ fontSize: 13, lineHeight: 1.7, color: ink, marginBottom: 16, padding: '12px 16px', background: 'rgba(15,61,46,.03)', borderRadius: 8, border: '1px solid rgba(15,61,46,.06)' }}>{s.summary}</p>}
            {(s.keyDrivers?.length > 0) && (
              <div style={{ marginBottom: 16 }}>
                <Label>Key Drivers</Label>
                {s.keyDrivers.slice(0, 6).map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 12, color: ink }}>
                    <span style={{ color: d.impact === 'positive' ? '#1D9E75' : d.impact === 'negative' ? '#E24B4A' : '#d97706', flexShrink: 0 }}>
                      {d.impact === 'positive' ? '\u25B2' : d.impact === 'negative' ? '\u25BC' : '\u25CF'}
                    </span>
                    <span>{d.factor}</span>
                    {d.source && <span style={{ fontSize: 10, color: muted }}>({d.source})</span>}
                  </div>
                ))}
              </div>
            )}
            {(s.socialSentiment || s.sectorContext) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {s.socialSentiment && <div style={{ padding: '10px 14px', background: 'rgba(15,61,46,.03)', borderRadius: 8, border: '1px solid rgba(15,61,46,.06)' }}><Label>Social Sentiment</Label><p style={{ fontSize: 12, color: ink, lineHeight: 1.5 }}>{s.socialSentiment}</p></div>}
                {s.sectorContext && <div style={{ padding: '10px 14px', background: 'rgba(15,61,46,.03)', borderRadius: 8, border: '1px solid rgba(15,61,46,.06)' }}><Label>Sector Context</Label><p style={{ fontSize: 12, color: ink, lineHeight: 1.5 }}>{s.sectorContext}</p></div>}
              </div>
            )}
            {s.materialEvents?.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(226,75,74,.04)', borderRadius: 8, border: '1px solid rgba(226,75,74,.12)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#C94F4F', marginBottom: 6 }}>Material Events Detected</div>
                {s.materialEvents.map((evt, i) => <div key={i} style={{ fontSize: 12, color: '#7a2020', display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: '#C94F4F' }}>{'\u25CF'}</span>{evt}</div>)}
              </div>
            )}
            {engines.length > 1 && s.engines && (
              <div>
                <Label>Engine Breakdown ({engines.length} sources)</Label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(engines.length, 4)}, 1fr)`, gap: 8, marginTop: 8 }}>
                  {engines.map(name => {
                    const eng = s.engines[name];
                    const ec = engineColors[name] || '#6b7280';
                    return (
                      <div key={name} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 8, background: `${ec}08`, border: `1px solid ${ec}15` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: ec }}>{engineLabels[name] || name}</div>
                        <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: ec, margin: '4px 0' }}>{eng.score}</div>
                        <div style={{ fontSize: 9, color: muted }}>{Math.round((eng.weight || 0) * 100)}% weight</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        );
      })()}

      {/* Theta Decay / Exit Strategy */}
      {(theta.earlyCloseRecommendation || theta.schedule) && (
        <Section title="Exit Strategy">
          {theta.earlyCloseRecommendation && (
            <div style={{ marginBottom: 12 }}>
              <Label>Early Close Recommendation</Label>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>{theta.earlyCloseRecommendation}</p>
            </div>
          )}
          {theta.schedule?.length > 0 && (
            <div>
              <Label>Theta Decay Schedule</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
                {theta.schedule.map((s, i) => (
                  <div key={i} style={{ fontFamily: mono, fontSize: 11, padding: '6px 10px', background: 'rgba(15,61,46,.04)', borderRadius: 6 }}>
                    <div style={{ color: muted, fontSize: 9 }}>Day {s.day || i + 1}</div>
                    <div style={{ fontWeight: 700 }}>${s.dailyTheta?.toFixed(2) || s.value?.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Download CTA */}
      <div style={{
        marginTop: 32, padding: '32px', background: `linear-gradient(135deg, ${forest}, #1a5c44)`,
        borderRadius: 12, textAlign: 'center',
      }}>
        <h3 style={{ fontFamily: serif, fontSize: 22, color: gold, marginBottom: 8 }}>Full Report Available</h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 16 }}>
          Download the complete PDF with detailed analysis, risk management rules, and exit triggers.
        </p>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', background: gold, color: forest, padding: '12px 28px',
          fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
          textTransform: 'uppercase', borderRadius: 4, textDecoration: 'none',
        }}>
          Download PDF Report
        </a>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: 'rgba(15,61,46,.04)', borderRadius: 8, fontSize: 11, color: muted, lineHeight: 1.6 }}>
        This analysis is generated by the NewLeaf scoring engine for educational purposes only. Past performance does not guarantee future results. Options involve risk and are not suitable for all investors.
      </div>
    </div>
  );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: muted, fontWeight: 600 };
const tdStyle = { padding: '10px 12px', fontSize: 12 };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28, padding: '20px 24px', background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12 }}>
      <h3 style={{ fontFamily: serif, fontSize: 18, color: forest, marginBottom: 14, fontWeight: 500 }}>{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ label, value, valueColor }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: valueColor || '#0B0F14' }}>{value}</div>
    </div>
  );
}

function MetricCardSmall({ label, value }) {
  return (
    <div style={{ padding: '10px 14px', background: 'rgba(15,61,46,.04)', borderRadius: 8 }}>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: ink }}>{value}</div>
    </div>
  );
}

function GreekCard({ label, value, desc }) {
  if (value == null) return null;
  return (
    <div style={{ background: 'rgba(15,61,46,.04)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: forest }}>{value.toFixed(4)}</div>
      <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{desc}</div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: muted, marginBottom: 6 }}>{children}</div>
  );
}

function InfoChip({ label, value }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 11, padding: '4px 12px',
      background: 'rgba(15,61,46,.06)', borderRadius: 20, color: ink,
    }}>
      <span style={{ color: muted }}>{label}:</span> <strong>{value}</strong>
    </span>
  );
}
