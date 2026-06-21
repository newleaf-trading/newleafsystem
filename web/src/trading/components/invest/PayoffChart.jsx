/**
 * PayoffChart — SVG condor tent with breakevens + spot line.
 * "Now" line shown only when status is open.
 *
 * Props:
 *   legs: Leg[]                — for computing payoff shape
 *   maxProfitPerContract: number
 *   maxLossPerContract: number
 *   breakevens?: [number, number]
 *   spot?: number              — current underlying price
 *   status: PositionStatus     — "now" line only when 'open'
 */

import styles from './invest.module.css';

const W = 700;
const H = 320;
const PAD = 40;
const TOP = 40;
const BOT = 300;
const MID = 156; // zero-line y

export function PayoffChart({
  maxProfitPerContract,
  maxLossPerContract,
  breakevens,
  spot,
  status,
}) {
  if (!breakevens || breakevens.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--inv-muted)', fontSize: 13 }}>
        Payoff chart requires breakeven data
      </div>
    );
  }

  const [beLow, beHigh] = breakevens;
  const mp = Math.abs(maxProfitPerContract);
  const ml = Math.abs(maxLossPerContract);

  // Map price range: 10% padding beyond breakevens
  const range = beHigh - beLow;
  const pMin = beLow - range * 0.3;
  const pMax = beHigh + range * 0.3;

  const px = (price) => PAD + ((price - pMin) / (pMax - pMin)) * (W - 2 * PAD);
  const beLowX = px(beLow);
  const beHighX = px(beHigh);
  const spotX = spot ? px(spot) : null;

  // Condor tent: flat loss left, ramp up to BE low, flat profit, ramp down to BE high, flat loss right
  const points = [
    `${PAD},${BOT}`,
    `${beLowX},${BOT}`,
    `${beLowX + (beHighX - beLowX) * 0.05},${TOP}`,
    `${beHighX - (beHighX - beLowX) * 0.05},${TOP}`,
    `${beHighX},${BOT}`,
    `${W - PAD},${BOT}`,
  ].join(' ');

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible' }}
    >
      {/* Loss zones */}
      <rect x={PAD} y={MID} width={beLowX - PAD} height={BOT - MID} fill="rgba(217,79,79,.10)" />
      <rect x={beHighX} y={MID} width={W - PAD - beHighX} height={BOT - MID} fill="rgba(217,79,79,.10)" />

      {/* Profit zone */}
      <rect x={beLowX} y={TOP} width={beHighX - beLowX} height={MID - TOP} fill="rgba(22,131,95,.12)" />

      {/* Zero line */}
      <line x1={PAD} y1={MID} x2={W - PAD} y2={MID} stroke="var(--inv-line)" strokeDasharray="4 5" />

      {/* Y-axis labels */}
      <text x={PAD - 4} y={TOP + 4} textAnchor="end" fontFamily="Space Mono" fontSize="11" fill="var(--inv-muted)">
        +${mp}
      </text>
      <text x={PAD - 4} y={MID + 4} textAnchor="end" fontFamily="Space Mono" fontSize="11" fill="var(--inv-muted)">
        $0
      </text>
      <text x={PAD - 4} y={BOT + 4} textAnchor="end" fontFamily="Space Mono" fontSize="11" fill="var(--inv-muted)">
        −${ml}
      </text>

      {/* Payoff line */}
      <polyline points={points} fill="none" stroke="var(--inv-profit)" strokeWidth="2.4" />

      {/* Spot line (open only) */}
      {status !== 'candidate' && spotX != null && (
        <>
          <line x1={spotX} y1={20} x2={spotX} y2={BOT + 10} stroke="var(--inv-gold)" strokeDasharray="3 4" />
          <text x={spotX} y={16} textAnchor="middle" fontFamily="Space Mono" fontSize="11" fill="var(--inv-amber)">
            now ${spot?.toFixed(0)}
          </text>
        </>
      )}

      {/* Breakeven labels */}
      <text x={beLowX} y={BOT + 18} textAnchor="middle" fontFamily="Space Mono" fontSize="10" fill="var(--inv-muted)">
        BE {beLow.toFixed(2)}
      </text>
      <text x={beHighX} y={BOT + 18} textAnchor="middle" fontFamily="Space Mono" fontSize="10" fill="var(--inv-muted)">
        BE {beHigh.toFixed(2)}
      </text>
    </svg>
  );
}
