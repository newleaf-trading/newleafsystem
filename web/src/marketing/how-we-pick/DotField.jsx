/**
 * DotField — Canvas-based dot particle system.
 *
 * Renders thousands of dots on a <canvas> element.
 * D3 scales compute positions. Canvas 2D renders.
 * Each stage transition is a target-state update + animation loop.
 *
 * Mobile: reduces to ~3000 dots for performance. Counter still shows full numbers.
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';

const COL_DEFAULT = '#c4c0b6';
const COL_HIGHLIGHT = '#0B2D23';
const COL_GOLD = '#C9A96E';
const COL_FADE = 'rgba(196,192,182,0.10)';
const COL_RED = '#b03030';
const COL_GREEN = '#0F6E56';

const LERP_SPEED = 0.08; // per-frame interpolation (0-1)

// Colour progression — survivors earn distinction as they pass stages
const STAGE_COLOURS = [
  '#0F3D2E', // Stage 1: Forest Green
  '#0F3D2E', // Stage 2: Forest Green
  '#1D5A42', // Stage 3: brighter green
  '#2A6B4A', // Stage 4: hint of warmth
  '#3D7A4F', // Stage 5: green-gold
  '#6B8C3E', // Stage 6: transitional
  '#C8A85A', // Stage 7: Soft Gold
  '#C8A85A', // Stage 8: Soft Gold
];

// Dot size scaling — sqrt-based, survivors become more distinct
function dotSizeForStage(count, isLabelled, isMobile) {
  if (isLabelled) return Math.max(4, 120 / Math.sqrt(count));
  if (isMobile) return Math.max(1.5, 60 / Math.sqrt(count));
  return Math.max(3, 100 / Math.sqrt(count));
}

export function DotField({ stage = 0, stages = [], labelledSymbols = [] }) {
  const canvasRef = useRef(null);
  const dotsRef = useRef(null);
  const rafRef = useRef(null);
  const prevStageRef = useRef(-1);
  const [size, setSize] = useState({ width: 800, height: 500 });

  // Responsive sizing
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth - 40, 900);
      const h = Math.min(window.innerHeight * 0.6, 520);
      setSize({ width: w, height: h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isMobile = size.width < 600;
  const totalDots = isMobile ? 3000 : 11342;
  const stageCount = (stageIdx) => {
    if (!stages[stageIdx]) return totalDots;
    // Scale count proportionally if using fewer dots on mobile
    const ratio = totalDots / 11342;
    return Math.round(stages[stageIdx].count * ratio);
  };

  // ─── Initialise dots ───
  useEffect(() => {
    const cols = Math.ceil(Math.sqrt(totalDots * (size.width / size.height)));
    const rows = Math.ceil(totalDots / cols);
    const cellW = size.width / cols;
    const cellH = size.height / rows;

    // Compute which dot indices get labels — space them evenly across the grid
    const labelledIndices = new Set();
    const labelCount = labelledSymbols.length;
    const stride = Math.floor(totalDots / (labelCount + 1));
    for (let li = 0; li < labelCount; li++) {
      labelledIndices.add(stride * (li + 1));
    }

    const dots = [];
    let labelIdx = 0;
    for (let i = 0; i < totalDots; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isLabelled = labelledIndices.has(i) && labelIdx < labelCount;
      const label = isLabelled ? labelledSymbols[labelIdx++] : null;
      const baseX = col * cellW + cellW / 2;
      const baseY = row * cellH + cellH / 2;
      const jitterX = (Math.random() - 0.5) * cellW * 0.4;
      const jitterY = (Math.random() - 0.5) * cellH * 0.4;

      dots.push({
        x: baseX + jitterX,
        y: baseY + jitterY,
        tx: baseX + jitterX,
        ty: baseY + jitterY,
        r: isLabelled ? 3.5 : isMobile ? 1 : 1.5,
        tr: isLabelled ? 3.5 : isMobile ? 1 : 1.5,
        opacity: 1,
        to: 1,
        active: true,
        label,
        color: isLabelled ? COL_HIGHLIGHT : COL_DEFAULT,
        stageDeactivated: -1,
        delay: Math.random() * 15,
      });
    }

    dotsRef.current = dots;
    prevStageRef.current = -1;
  }, [totalDots, size, labelledSymbols]);

  // ─── Stage transition: compute target positions ───
  useEffect(() => {
    if (!dotsRef.current || prevStageRef.current === stage) return;
    prevStageRef.current = stage;

    const dots = dotsRef.current;
    const W = size.width;
    const H = size.height;
    const survivorCount = stageCount(stage);

    // Compute dot size and colour for this stage
    const stageColor = STAGE_COLOURS[Math.min(stage, STAGE_COLOURS.length - 1)];
    const stageSize = dotSizeForStage(survivorCount, false, isMobile);
    const stageSizeLabelled = dotSizeForStage(survivorCount, true, isMobile);

    // Assign deactivation, size, and colour
    dots.forEach((d, i) => {
      if (i < survivorCount) {
        d.active = true;
        d.to = 1;
        d.tr = d.label ? stageSizeLabelled : stageSize;
        d.color = d.label ? stageColor : stageColor;
      } else {
        if (d.stageDeactivated < 0) d.stageDeactivated = stage;
        d.active = false;
        d.to = 0.06;
        d.tr = d.label ? 1.5 : 0.5;
        d.color = COL_DEFAULT;
      }
    });

    // Reset stagger delays for this transition
    dots.forEach((d, i) => { d.delay = Math.random() * 15; });
    // Reset the animation frame counter so stagger applies to this transition
    if (rafRef.current) { rafRef._frameReset = true; }

    // Compute target positions based on stage layout
    const survivors = dots.filter(d => d.active);
    layoutSurvivors(survivors, stage, W, H);

    // Deactivated dots drift down slightly
    dots.filter(d => !d.active).forEach(d => {
      d.ty = d.y + 20 + Math.random() * 30;
    });
  }, [stage, size]);

  // ─── Animation loop ───
  useEffect(() => {
    let frameCount = 0;
    const animate = () => {
      const dots = dotsRef.current;
      if (!dots) { rafRef.current = requestAnimationFrame(animate); return; }

      // Reset frame counter when a new stage transition starts (re-enables stagger)
      if (rafRef._frameReset) { frameCount = 0; rafRef._frameReset = false; }

      let needsRedraw = false;
      frameCount++;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        // Stagger: only start moving after delay frames
        if (frameCount < d.delay) continue;

        const dx = d.tx - d.x;
        const dy = d.ty - d.y;
        const dr = d.tr - d.r;
        const dop = d.to - d.opacity;

        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || Math.abs(dr) > 0.01 || Math.abs(dop) > 0.005) {
          d.x += dx * LERP_SPEED;
          d.y += dy * LERP_SPEED;
          d.r += dr * LERP_SPEED;
          d.opacity += dop * LERP_SPEED;
          needsRedraw = true;
        } else {
          d.x = d.tx;
          d.y = d.ty;
          d.r = d.tr;
          d.opacity = d.to;
        }
      }

      if (needsRedraw || frameCount < 5) {
        draw();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [size]);

  // ─── Canvas draw ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dotsRef.current) return;

    const DPR = window.devicePixelRatio || 1;
    const W = size.width;
    const H = size.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, W, H);

    const dots = dotsRef.current;

    // Draw inactive dots first (behind)
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (d.active || d.opacity < 0.01) continue;
      ctx.globalAlpha = d.opacity;
      ctx.fillStyle = COL_DEFAULT;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw active dots on top
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (!d.active) continue;
      ctx.globalAlpha = d.opacity;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();

      if (d.label && d.opacity > 0.5) {
        ctx.fillStyle = '#0B0F14';
        ctx.font = `600 ${isMobile ? 7 : 9}px 'Space Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(d.label, d.x, d.y - d.r - 5);
      }
    }

    ctx.globalAlpha = 1;
  }, [size, isMobile]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: size.width, height: size.height }}
      aria-hidden="true"
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Layout functions — compute target positions per stage
// ═══════════════════════════════════════════════════════════════

function layoutSurvivors(survivors, stage, W, H) {
  const N = survivors.length;
  if (N === 0) return;

  // Scale layout area proportionally — fewer dots = tighter cluster
  const densityScale = Math.max(0.3, Math.sqrt(N / 11342));
  const sW = W * densityScale;
  const sH = H * densityScale;
  const oX = (W - sW) / 2; // center offset
  const oY = (H - sH) / 2;

  switch (stage) {
    case 0: // Universe — full grid
      layoutGrid(survivors, W, H);
      break;
    case 1: // Liquidity — survivors re-grid, tighter
      layoutGrid(survivors, W * 0.7, H * 0.7, W * 0.15, H * 0.15);
      break;
    case 2: // Volatility — histogram by IV rank
      layoutHistogram(survivors, sW, sH, oX, oY);
      break;
    case 3: // Events — calendar grid
      layoutCalendarGrid(survivors, sW, sH, oX, oY);
      break;
    case 4: // Technicals — scattered around a price line
      layoutPriceLine(survivors, sW, sH, oX, oY);
      break;
    case 5: // Strikes — vertical strike ladder
      layoutStrikeLadder(survivors, sW, sH, oX, oY);
      break;
    case 6: // Scoring — funnel shape
      layoutFunnel(survivors, sW, sH, oX, oY);
      break;
    case 7: // Final three — three card positions
      layoutCards(survivors, W, H);
      break;
    default:
      layoutGrid(survivors, W, H);
  }
}

function layoutGrid(dots, W, H, offsetX = 0, offsetY = 0) {
  const N = dots.length;
  const cols = Math.ceil(Math.sqrt(N * (W / H)));
  const rows = Math.ceil(N / cols);
  const cellW = W / cols;
  const cellH = H / rows;

  dots.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    d.tx = offsetX + col * cellW + cellW / 2;
    d.ty = offsetY + row * cellH + cellH / 2;
  });
}

function layoutHistogram(dots, W, H, oX = 0, oY = 0) {
  const N = dots.length;
  const bins = 20;
  const binWidth = W / bins;

  dots.forEach((d, i) => {
    const ivRank = 45 + (Math.random() - 0.5) * 60 + (Math.random() - 0.5) * 20;
    const bin = Math.floor(Math.max(0, Math.min(bins - 1, (ivRank / 100) * bins)));
    const x = bin * binWidth + binWidth / 2 + (Math.random() - 0.5) * binWidth * 0.6;

    d.tx = oX + x;
    d.ty = oY + H - 40 - (i % Math.ceil(N / bins)) * 3;
  });
}

function layoutCalendarGrid(dots, W, H, oX = 0, oY = 0) {
  const cols = 7;
  const rows = Math.ceil(dots.length / cols);
  const cellW = Math.min(W / cols, 80);
  const cellH = Math.min(H / rows, 20);
  const padX = (W - cols * cellW) / 2;

  dots.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    d.tx = oX + padX + col * cellW + cellW / 2 + (Math.random() - 0.5) * 8;
    d.ty = oY + 40 + row * cellH + cellH / 2;
  });
}

function layoutPriceLine(dots, W, H, oX = 0, oY = 0) {
  const midY = H / 2;
  dots.forEach((d, i) => {
    const progress = i / dots.length;
    d.tx = oX + W * 0.1 + progress * W * 0.8;
    d.ty = oY + midY - 50 + progress * 100 + (Math.random() - 0.5) * 80;
  });
}

function layoutStrikeLadder(dots, W, H, oX = 0, oY = 0) {
  const levels = 10;
  const levelH = H / levels;

  dots.forEach((d, i) => {
    const level = i % levels;
    d.tx = oX + W * 0.3 + (Math.random() - 0.5) * W * 0.4;
    d.ty = oY + level * levelH + levelH / 2 + (Math.random() - 0.5) * levelH * 0.5;
  });
}

function layoutFunnel(dots, W, H, oX = 0, oY = 0) {
  dots.forEach((d, i) => {
    const progress = i / dots.length;
    const funnelWidth = W * (1 - progress * 0.7);
    d.tx = oX + W / 2 + (Math.random() - 0.5) * funnelWidth;
    d.ty = oY + H * 0.1 + progress * H * 0.8;
  });
}

function layoutCards(dots, W, H) {
  // For 3 dots: three positions centered
  // For 12 dots (stage 7): packed bubble arrangement
  if (dots.length <= 3) {
    const cardW = Math.min(200, W / 4);
    const positions = [
      { x: W / 2 - cardW * 1.3, y: H / 2 },
      { x: W / 2, y: H / 2 },
      { x: W / 2 + cardW * 1.3, y: H / 2 },
    ];
    dots.forEach((d, i) => {
      const pos = positions[i % 3];
      d.tx = pos.x;
      d.ty = pos.y;
    });
  } else {
    // Packed bubble layout for 12 dots — arrange in a loose cluster
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.25;
    dots.forEach((d, i) => {
      const angle = (i / dots.length) * Math.PI * 2 + Math.random() * 0.3;
      const r = radius * (0.3 + Math.random() * 0.7);
      d.tx = cx + Math.cos(angle) * r;
      d.ty = cy + Math.sin(angle) * r;
    });
  }
}
