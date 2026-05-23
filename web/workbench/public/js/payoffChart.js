/**
 * Shared payoff chart renderer (HTML5 Canvas).
 * Draws the P&L at expiration diagram with profit/loss zones,
 * breakeven markers, spot line, and strike markers.
 *
 * Used by both discover.html (Stage 3 + Stage 5) and strategy-builder.html.
 */
import { pnlAt, computeNetCredit, computeBreakevens } from './legMath.js';

/**
 * Draw a P&L payoff chart on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} opts
 * @param {Array} opts.legs - array of { side, type, strike, mid }
 * @param {number} opts.qty - number of contracts
 * @param {number} opts.spot - current spot price
 * @param {number} [opts.height=220] - canvas height in CSS pixels
 */
export function drawPayoffChart(canvas, opts) {
  const { legs, qty, spot, height = 220 } = opts;
  if (!canvas || !legs.length) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width - 32;
  const H = height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const strikes = legs.map(l => l.strike);
  const minS = Math.min(...strikes), maxS = Math.max(...strikes);
  const width = maxS - minS;
  const pad = Math.max(width * 0.6, 10);
  const lo = minS - pad, hi = maxS + pad;
  const steps = 200;
  const nc = computeNetCredit(legs);

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const price = lo + (hi - lo) * i / steps;
    points.push({ price, pnl: pnlAt(price, legs, qty, nc) });
  }

  const maxPnl = Math.max(...points.map(p => p.pnl));
  const minPnl = Math.min(...points.map(p => p.pnl));
  const pnlRange = Math.max(maxPnl - minPnl, 1);

  const ml = 55, mr = 20, mt = 20, mb = 30;
  const cw = W - ml - mr, ch = H - mt - mb;
  const x = (price) => ml + (price - lo) / (hi - lo) * cw;
  const y = (pnl) => mt + (1 - (pnl - minPnl) / pnlRange) * ch;

  // Profit zone fill
  ctx.beginPath();
  ctx.moveTo(x(points[0].price), y(0));
  points.forEach(p => ctx.lineTo(x(p.price), p.pnl >= 0 ? y(p.pnl) : y(0)));
  ctx.lineTo(x(points[points.length - 1].price), y(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(59,109,17,0.18)';
  ctx.fill();

  // Loss zone fill
  ctx.beginPath();
  ctx.moveTo(x(points[0].price), y(0));
  points.forEach(p => ctx.lineTo(x(p.price), p.pnl <= 0 ? y(p.pnl) : y(0)));
  ctx.lineTo(x(points[points.length - 1].price), y(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(163,45,45,0.14)';
  ctx.fill();

  // Zero line
  if (minPnl < 0 && maxPnl > 0) {
    ctx.beginPath();
    ctx.moveTo(ml, y(0)); ctx.lineTo(W - mr, y(0));
    ctx.strokeStyle = 'rgba(15,61,46,0.15)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#6b6b60'; ctx.font = '10px "Inter", system-ui';
    ctx.fillText('$0', ml - 20, y(0) + 3);
  }

  // P&L line
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(x(p.price), y(p.pnl)) : ctx.lineTo(x(p.price), y(p.pnl)));
  ctx.strokeStyle = '#185FA5'; ctx.lineWidth = 2; ctx.stroke();

  // Spot price line
  if (spot >= lo && spot <= hi) {
    ctx.beginPath();
    ctx.moveTo(x(spot), mt); ctx.lineTo(x(spot), H - mb);
    ctx.strokeStyle = '#0d6e56'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#0d6e56'; ctx.font = 'bold 11px "Inter", system-ui';
    ctx.fillText('$' + spot.toFixed(0), x(spot) - 15, mt - 5);
  }

  // Breakevens
  const breakevens = computeBreakevens(legs, qty);
  breakevens.forEach(be => {
    const bx = x(be);
    ctx.beginPath();
    ctx.moveTo(bx, mt); ctx.lineTo(bx, H - mb);
    ctx.strokeStyle = '#9b9b8e'; ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
    const label = 'BE $' + be.toFixed(0);
    ctx.font = 'bold 10px "Inter", system-ui';
    const tw = ctx.measureText(label).width;
    const lx = bx - tw / 2;
    const ly = H - mb + 26;
    ctx.fillStyle = '#0B2D23';
    ctx.fillRect(lx - 3, ly - 10, tw + 6, 13);
    ctx.fillStyle = '#F7F5F0';
    ctx.fillText(label, lx, ly);
  });

  // Strike markers
  legs.forEach(l => {
    if (l.strike >= lo && l.strike <= hi) {
      ctx.beginPath();
      ctx.moveTo(x(l.strike), H - mb - 8); ctx.lineTo(x(l.strike), H - mb);
      ctx.strokeStyle = '#BA7517'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#BA7517'; ctx.font = 'bold 9px "Inter", system-ui';
      ctx.fillText(l.strike, x(l.strike) - 8, H - mb - 10);
    }
  });

  // X-axis price labels
  ctx.fillStyle = '#6b6b60'; ctx.font = '10px "Inter", system-ui';
  for (let i = 0; i <= 6; i++) {
    const price = lo + (hi - lo) * i / 6;
    const tooClose = breakevens.some(be => Math.abs(x(price) - x(be)) < 40);
    if (tooClose) continue;
    ctx.fillText('$' + price.toFixed(0), x(price) - 12, H - mb + 15);
  }

  // Y-axis P&L labels
  for (let i = 0; i <= 4; i++) {
    const pnl = minPnl + pnlRange * i / 4;
    ctx.fillText((pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(0), 2, y(pnl) + 3);
  }
}
