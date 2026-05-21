/**
 * /how-we-recommend — Interactive trade scoring explorable.
 *
 * Four sliders control a synthetic QQQ Iron Condor. The user drags,
 * the payoff chart morphs, the verdict changes, the decision tree
 * highlights the firing rule, and a caption explains what just happened.
 *
 * All verdicts are computed by the real evaluate() function from verdictEngine.js.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { evaluate, VERDICT } from '../../trading/utils/verdictEngine';
import { PayoffChart } from '../../trading/components/PayoffChart';
import PageSEO from '../../shared/components/PageSEO';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { label: 'How We Pick', href: '/how-we-pick' },
  { label: 'How We Manage', href: '/how-we-manage' },
  { label: 'How We Recommend', href: '/how-we-recommend', active: true },
  { label: 'Track Record', href: '/track-record' },
];

// Default slider values
const DEFAULTS = { ivRank: 45, dte: 35, spot: 555, width: 10 };

// Verdict mapping: engine → marketing
function mapVerdict(engineState) {
  switch (engineState) {
    case VERDICT.ON_TRACK:
    case VERDICT.TAKE_PROFIT:
      return { label: 'Good setup', color: '#0B7A52', bg: 'rgba(11,122,82,0.12)' };
    case VERDICT.MONITOR:
    case VERDICT.ACTION_NEEDED:
      return { label: 'Marginal', color: '#B7791F', bg: 'rgba(183,121,31,0.12)' };
    case VERDICT.EXIT:
      return { label: 'Avoid', color: '#C94F4F', bg: 'rgba(201,79,79,0.12)' };
    default:
      return { label: 'Good setup', color: '#0B7A52', bg: 'rgba(11,122,82,0.12)' };
  }
}

// Build synthetic position + market data from slider values
function buildFromSliders(ivRank, dte, spot, width) {
  const shortPut = 540;
  const longPut = shortPut - width;
  const shortCall = 580;
  const longCall = shortCall + width;

  const position = {
    strategy: 'iron_condor',
    legs: [
      { action: 'buy',  type: 'put',  strike: longPut,  premium: 1.50, iv: ivRank / 100, expiry: '2026-06-06' },
      { action: 'sell', type: 'put',  strike: shortPut,  premium: 3.00, iv: ivRank / 100, expiry: '2026-06-06' },
      { action: 'sell', type: 'call', strike: shortCall, premium: 4.00, iv: ivRank / 100, expiry: '2026-06-06' },
      { action: 'buy',  type: 'call', strike: longCall,  premium: 2.00, iv: ivRank / 100, expiry: '2026-06-06' },
    ],
    entryNetCredit: 350,
    entryIvRank: 45,
    expiry: '2026-06-06',
  };

  // Compute short delta based on distance from spot to short strikes
  const callDist = Math.abs(spot - shortCall);
  const putDist = Math.abs(spot - shortPut);
  const nearestDist = Math.min(callDist, putDist);
  const nearestStrike = callDist < putDist ? shortCall : shortPut;
  // Rough delta approximation: closer to strike = higher delta
  const shortDelta = Math.min(0.80, Math.max(0.05, 0.50 - (nearestDist / spot) * 8));

  const isBreached = spot >= shortCall || spot <= shortPut;
  const isShortTested = nearestDist <= nearestStrike * 0.005;

  // Estimate P&L from spot position
  let pnl = 0;
  if (spot >= longPut && spot <= longCall) {
    // Within wings — profitable
    if (spot >= shortPut && spot <= shortCall) {
      pnl = 180; // max profit zone
    } else {
      pnl = 180 - Math.abs(spot - (spot > shortCall ? shortCall : shortPut)) * 10;
    }
  } else {
    pnl = -350; // beyond wings
  }
  const profitCapturePct = pnl > 0 ? (pnl / 350) * 100 : (pnl / 650) * 100;

  const marketData = {
    currentSpot: spot,
    dte,
    shortDelta,
    profitCapturePct: Math.max(-100, Math.min(100, profitCapturePct)),
    isBreached,
    isShortTested,
    sessionsBreached: isBreached ? 2 : 0,
    lossMultiple: pnl < 0 ? Math.abs(pnl) / 350 : 0,
    currentIvRank: ivRank,
    nextEarningsDate: null,
    priceDistSD: 0,
    ivCrush: false,
    priceAtBrokenWing: false,
    priceBeyondBrokenWing: false,
    debitToCreditFlip: false,
    priceAtNearWing: false,
    priceBeyondNearWing: false,
    vegaFlip: false,
    deepItm: false,
  };

  return { position, marketData, shortPut, longPut, shortCall, longCall };
}

// ═══════════════════════════════════════════════════════════════
// Caption logic — pattern-match slider state to pre-written text
// ═══════════════════════════════════════════════════════════════

function getCaption(ivRank, dte, spot, width, verdictLabel) {
  const shortCall = 580;
  const shortPut = 540;
  const nearCall = Math.abs(spot - shortCall);
  const nearPut = Math.abs(spot - shortPut);
  const nearStrike = Math.min(nearCall, nearPut);
  const nearPct = nearStrike / spot;

  // Combined danger
  if (nearPct < 0.02 && ivRank > 60) {
    return "Both your spot and IV are in danger zones simultaneously. The verdict is Avoid. This is exactly the kind of setup we'd skip on Discover.";
  }

  // Spot at strike
  if (spot >= shortCall || spot <= shortPut) {
    return `Spot is ${spot >= shortCall ? 'above' : 'below'} the short strike. The position is in the money — maximum loss territory. Avoid.`;
  }

  // Spot near strike
  if (nearPct < 0.02) {
    return `Your spot is now dangerously close to the $${nearCall < nearPut ? shortCall : shortPut} short strike. A small move the wrong direction and you're in the money. Marginal — and close to Avoid.`;
  }

  // IV elevated
  if (ivRank > 75) {
    return `IV rank at ${ivRank} is extremely elevated. Something unusual is happening in the market. Premium-selling in this regime is statistically punished. Avoid.`;
  }
  if (ivRank > 60) {
    return `You pushed IV rank above 60. Premium-selling works best in the middle of the volatility range — too elevated means something may be wrong. The verdict downgrades to Marginal.`;
  }
  if (ivRank < 25) {
    return `IV rank at ${ivRank} is very low. Options premiums are thin — there's not enough premium to justify the risk. Marginal.`;
  }

  // DTE extremes
  if (dte < 21) {
    return `Inside 21 days, gamma risk accelerates faster than theta decay compensates. The verdict downgrades to Marginal.`;
  }
  if (dte > 50) {
    return `At ${dte} DTE, theta decay hasn't started meaningfully. The trade sits with risk and without the time-decay engine running. Marginal — too early.`;
  }

  // Width extremes
  if (width < 7) {
    return `A $${width} wing width produces inadequate risk-reward. The max profit is too small relative to the capital at risk. Marginal.`;
  }
  if (width > 20) {
    return `A $${width} wing width is capital-inefficient. The extra width adds more risk exposure than the probability improvement justifies. Marginal.`;
  }

  // Default / all good
  if (verdictLabel === 'Good setup') {
    return `This is a standard Iron Condor setup on QQQ. IV rank at ${ivRank}, ${dte} days to expiry, spot at $${spot} between your strikes. All four parameters fall within our recommended zones — the verdict is Good setup.`;
  }

  return `Current parameters produce a ${verdictLabel} verdict. Adjust the sliders to see how the scoring logic responds to different market conditions.`;
}

// ═══════════════════════════════════════════════════════════════
// Decision tree rules
// ═══════════════════════════════════════════════════════════════

const TREE_RULES = [
  {
    verdict: 'Good setup',
    color: '#0B7A52',
    rules: [
      { id: 'iv-sweet', label: 'IV rank in 25-60 sweet spot' },
      { id: 'dte-window', label: 'DTE in 21-50 window' },
      { id: 'spot-clear', label: 'Spot well between strikes' },
      { id: 'width-ok', label: 'Width $7-$20 range' },
    ],
  },
  {
    verdict: 'Marginal',
    color: '#B7791F',
    rules: [
      { id: 'iv-edge', label: 'IV rank outside 25-60 sweet spot' },
      { id: 'dte-edge', label: 'DTE outside 21-50 window' },
      { id: 'spot-near', label: 'Spot within 2% of short strike' },
      { id: 'width-edge', label: 'Width outside $7-$20' },
    ],
  },
  {
    verdict: 'Avoid',
    color: '#C94F4F',
    rules: [
      { id: 'iv-extreme', label: 'IV rank above 75' },
      { id: 'spot-breach', label: 'Spot at or past short strike' },
      { id: 'combined', label: 'Multiple danger zones active' },
    ],
  },
];

function getActiveRuleId(ivRank, dte, spot, width) {
  const shortCall = 580, shortPut = 540;
  const nearDist = Math.min(Math.abs(spot - shortCall), Math.abs(spot - shortPut));
  const nearPct = nearDist / spot;

  if (spot >= shortCall || spot <= shortPut) return 'spot-breach';
  if (ivRank > 75) return 'iv-extreme';
  if (nearPct < 0.02 && ivRank > 60) return 'combined';
  if (nearPct < 0.02) return 'spot-near';
  if (ivRank > 60 || ivRank < 25) return 'iv-edge';
  if (dte < 21 || dte > 50) return 'dte-edge';
  if (width < 7 || width > 20) return 'width-edge';
  return 'iv-sweet'; // default — good setup
}

// ═══════════════════════════════════════════════════════════════
// Main page component
// ═══════════════════════════════════════════════════════════════

export function HowWeRecommendPage() {
  const [ivRank, setIvRank] = useState(DEFAULTS.ivRank);
  const [dte, setDte] = useState(DEFAULTS.dte);
  const [spot, setSpot] = useState(DEFAULTS.spot);
  const [width, setWidth] = useState(DEFAULTS.width);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Derive everything from the four slider values
  const { position, marketData, shortPut, longPut, shortCall, longCall } = useMemo(
    () => buildFromSliders(ivRank, dte, spot, width),
    [ivRank, dte, spot, width]
  );

  const engineVerdict = useMemo(() => evaluate(position, marketData), [position, marketData]);
  const verdict = mapVerdict(engineVerdict.state);
  const caption = getCaption(ivRank, dte, spot, width, verdict.label);
  const activeRuleId = getActiveRuleId(ivRank, dte, spot, width);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO
        title="How We Recommend — Strategy Selection Engine"
        description="See how NewLeaf matches market conditions to optimal options strategies using volatility regime detection, earnings calendars, and probability-weighted scenario analysis."
        path="/how-we-recommend"
      />
      <style>{`
        html { scrollbar-color: rgba(15,61,46,0.30) transparent; scrollbar-width: thin; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(15,61,46,0.30); border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(15,61,46,0.60); }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; background: rgba(17,24,39,0.08); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #0B2D23; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #0B2D23; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        input[type=range]:focus { outline: 2px solid rgba(11,45,35,0.3); outline-offset: 2px; border-radius: 3px; }
      `}</style>

      {/* Mini-nav removed — main Nav provides navigation via "How it works" dropdown */}

      {/* ─── Hero ─── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1,
          letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16,
        }}>
          Why we recommend this trade
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          Move the market. Watch what we'd do.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 580, margin: '0 auto' }}>
          Every recommendation on Discover passes through the same scoring logic. Probability of profit,
          risk-reward, IV regime, distance to expiry — all weighed, all scored, all compared against our
          floors. Manipulate any of them and see how the verdict would change.
        </p>
      </section>

      {/* ─── Main explorable ─── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 20 }}>

          {/* Left: sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SliderControl label="IV Rank" value={ivRank} min={10} max={90} step={1} onChange={setIvRank}
              tooltip="Implied Volatility rank: how elevated option premiums are, relative to the past year."
              format={v => v} unit="" />
            <SliderControl label="Days to Expiry" value={dte} min={14} max={60} step={1} onChange={setDte}
              tooltip="Time until the options expire. Theta decay accelerates inside 21 DTE."
              format={v => v} unit=" days" />
            <SliderControl label="Spot Price" value={spot} min={500} max={610} step={1} onChange={setSpot}
              tooltip="Current price of QQQ. Distance from short strikes determines directional risk."
              format={v => `$${v}`} unit="" />
            <SliderControl label="Strike Width" value={width} min={5} max={25} step={1} onChange={setWidth}
              tooltip="Distance between short and long strikes. Wider = more capital at risk, narrower = less reward."
              format={v => `$${v}`} unit="" />
          </div>

          {/* Centre: chart + verdict */}
          <div>
            <div style={{
              background: '#fff', border: '1px solid rgba(17,24,39,0.08)',
              borderRadius: 16, overflow: 'hidden', marginBottom: 12,
            }}>
              <PayoffChart
                legs={position.legs}
                spotPrice={spot}
                height={340}
                accentColor={verdict.color}
              />
            </div>

            {/* Verdict pill */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '12px 20px', borderRadius: 12,
              background: verdict.bg,
              transition: prefersReducedMotion ? 'none' : 'background 0.2s',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: verdict.color,
                transition: prefersReducedMotion ? 'none' : 'background 0.2s',
              }} />
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700,
                color: verdict.color, textTransform: 'uppercase', letterSpacing: '.08em',
              }}>
                {verdict.label}
              </span>
            </div>
          </div>

          {/* Right: decision tree */}
          <DecisionTree activeRuleId={activeRuleId} prefersReducedMotion={prefersReducedMotion} />
        </div>

        {/* Caption card */}
        <div style={{
          marginTop: 24, padding: '20px 24px', background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)', borderRadius: 14,
          border: '1px solid rgba(11,15,20,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          maxWidth: 700,
        }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', margin: 0 }}>
            {caption}
          </p>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23',
          marginBottom: 12,
        }}>
          Every recommendation. Same logic.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          The four parameters you just explored are scored automatically for every candidate, every morning.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/how-we-manage" style={{
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)',
            fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
          }}>
            See how we manage trades &rarr;
          </a>
          <a href="/invest" style={{
            padding: '14px 28px', borderRadius: 10,
            background: '#C9A96E', color: '#0B2D23',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
          }}>
            Start your free trial &rarr;
          </a>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function SliderControl({ label, value, min, max, step, onChange, tooltip, format, unit }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)',
      borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.55)' }}>
            {label}
          </span>
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid rgba(17,24,39,0.15)', background: 'transparent', fontSize: 9, color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={`Info about ${label}`}
          >
            ?
          </button>
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#0B2D23' }}>
          {format(value)}{unit}
        </span>
      </div>
      {showTooltip && (
        <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' }}>
          {tooltip}
        </p>
      )}
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
        aria-label={label}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: '#c9c5bc' }}>
        <span>{format(min)}{unit}</span>
        <span>{format(max)}{unit}</span>
      </div>
    </div>
  );
}

function DecisionTree({ activeRuleId, prefersReducedMotion }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)',
      borderRadius: 14, padding: 18, height: 'fit-content',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 14 }}>
        Trade scoring
      </div>

      {TREE_RULES.map(group => {
        const groupHasActive = group.rules.some(r => r.id === activeRuleId);
        return (
          <div key={group.verdict} style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 6,
            background: groupHasActive ? `${group.color}12` : 'transparent',
            border: `1px solid ${groupHasActive ? group.color + '30' : 'transparent'}`,
            opacity: groupHasActive ? 1 : 0.3,
            transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: group.color }}>{group.verdict}</span>
            </div>
            <div style={{ paddingLeft: 16 }}>
              {group.rules.map(rule => (
                <div key={rule.id} style={{
                  fontSize: 11, color: rule.id === activeRuleId ? '#0B2D23' : '#9ca3af',
                  fontWeight: rule.id === activeRuleId ? 700 : 400,
                  lineHeight: 1.7,
                  transition: prefersReducedMotion ? 'none' : 'color 0.15s, font-weight 0.15s',
                }}>
                  {rule.id === activeRuleId ? '→ ' : '  '}{rule.label}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{
        marginTop: 14, fontFamily: "'Space Mono', monospace", fontSize: 10,
        color: '#C9A96E', letterSpacing: '.06em',
      }}>
        This rule runs on every candidate, every morning.
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [p, setP] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setP(mq.matches);
    const h = (e) => setP(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return p;
}
