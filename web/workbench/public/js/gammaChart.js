/**
 * Shared Gamma Wall Analysis renderer.
 * Renders the full gamma analysis panel (walls, confidence, IV, GEX chart, top strikes)
 * and a fallback OI chart when R2 data is unavailable.
 *
 * Used by discover.html Stage 1.
 */

/**
 * Render the full gamma analysis HTML into a container element.
 * @param {HTMLElement} el - target container
 * @param {Object} ga - API gamma response { putWallStrike, callWallStrike, spotInsideBand, oiByStrike, walls }
 * @param {Object|null} r2 - R2 latest.json response (null if unavailable)
 * @param {number} spot - current spot price
 * @returns {{ oiWalls, gexWalls }} the dual-wall readings
 */
export function renderGammaAnalysis(el, ga, r2, spot) {
  if ((!ga.oiByStrike || !ga.oiByStrike.length) && !r2) return null;

  const a = r2?.gammaData?.analysis || {};
  const iv = r2?.gammaData?.ivData || {};
  const hasR2 = a.contracts_analyzed > 0;
  const topStrikes = (a.topStrikes || []).slice(0, 6);
  const maxGex = Math.max(...topStrikes.map(s => Math.abs(s.gamma_exposure || 0)), 1);

  // Compute dual walls
  const oiWalls = { putStrike: ga.putWallStrike || null, callStrike: ga.callWallStrike || null };
  let gexWalls = { putStrike: null, callStrike: null };
  if (hasR2 && a.topStrikes?.length) {
    const sorted = [...a.topStrikes].sort((a, b) => a.strike - b.strike);
    const putSide = sorted.filter(s => s.strike < spot && (s.put_oi || 0) > (s.call_oi || 0));
    const callSide = sorted.filter(s => s.strike > spot && (s.call_oi || 0) > (s.put_oi || 0));
    if (putSide.length) gexWalls.putStrike = putSide.reduce((a, b) => Math.abs(a.gamma_exposure) > Math.abs(b.gamma_exposure) ? a : b).strike;
    if (callSide.length) gexWalls.callStrike = callSide.reduce((a, b) => Math.abs(a.gamma_exposure) > Math.abs(b.gamma_exposure) ? a : b).strike;
  }
  // Fallback GEX walls to OI walls
  if (!gexWalls.putStrike) gexWalls.putStrike = oiWalls.putStrike;
  if (!gexWalls.callStrike) gexWalls.callStrike = oiWalls.callStrike;

  const conf = (v, lbl) => `<div class="ip-cell"><span class="ip-cell-lbl">${lbl}</span><span class="ip-cell-val">${Math.round((v||0)*100)}%</span><div class="ip-bar"><div class="ip-bar-fill" style="width:${Math.round((v||0)*100)}%;background:${v>=0.6?'#2d7d4f':v>=0.3?'#a0620c':'#c0392b'}"></div></div></div>`;

  el.innerHTML = `
    <div class="ip-section">
      <div class="ip-section-title">Gamma Walls</div>
      <div class="ip-section-desc">Where market makers hold their largest hedging positions. The stock tends to stay between these walls.</div>
      <div class="ip-grid cols-4">
        <div class="ip-cell"><span class="ip-cell-lbl">Put Wall</span><span class="ip-cell-val green">$${hasR2 && a.put_wall != null ? Number(a.put_wall).toFixed(2) : ga.putWallStrike || '\u2014'}</span></div>
        <div class="ip-cell"><span class="ip-cell-lbl">Call Wall</span><span class="ip-cell-val red">$${hasR2 && a.call_wall != null ? Number(a.call_wall).toFixed(2) : ga.callWallStrike || '\u2014'}</span></div>
        <div class="ip-cell"><span class="ip-cell-lbl">Band Width</span><span class="ip-cell-val">${hasR2 ? (a.band_width_pct||0).toFixed(1) + '%' : '\u2014'}</span></div>
        <div class="ip-cell"><span class="ip-cell-lbl">Position in Band</span><span class="ip-cell-val">${hasR2 ? (a.position_in_band_pct ?? '\u2014') + '%' : '\u2014'}</span></div>
      </div>
    </div>
    ${hasR2 ? `<div class="ip-section">
      <div class="ip-section-title">Confidence Breakdown</div>
      <div class="ip-section-desc">How reliable is this gamma wall reading?</div>
      <div class="ip-grid cols-4">
        ${conf(a.confidence_score, 'Overall')}
        ${conf(a.oi_confidence, 'Open Interest')}
        ${conf(a.delta_confidence, 'Delta')}
        ${conf(a.volume_confidence, 'Volume')}
      </div>
    </div>` : ''}
    ${iv.atmIv ? `<div class="ip-section">
      <div class="ip-section-title">IV Data</div>
      <div class="ip-section-desc">Implied volatility reflects how expensive options are right now.</div>
      <div class="ip-grid">
        <div class="ip-cell"><span class="ip-cell-lbl">ATM IV</span><span class="ip-cell-val gold">${iv.atmIv.toFixed(1)}%</span></div>
        <div class="ip-cell"><span class="ip-cell-lbl">IV Level</span><span class="ip-cell-val">${iv.ivLevel || '\u2014'}</span></div>
        <div class="ip-cell"><span class="ip-cell-lbl">Contracts Analyzed</span><span class="ip-cell-val">${a.contracts_analyzed ?? '\u2014'}</span></div>
      </div>
    </div>` : ''}
    <div class="ip-section">
      <div class="ip-section-title">Gamma Exposure by Strike</div>
      <div class="ip-section-desc">Each bar shows gamma exposure (GEX) at a strike. Green = call-dominant, Red = put-dominant.</div>
      <canvas id="gamma-canvas" style="width:100%;height:240px;display:block"></canvas>
      <div style="display:flex;gap:16px;margin-top:8px;justify-content:center">
        <span style="font-size:10px;color:#2d7d4f">&#9632; Call-dominant</span>
        <span style="font-size:10px;color:#c0392b">&#9632; Put-dominant</span>
        <span style="font-size:10px;color:#C9A96E">&#9482; Spot</span>
        <span style="font-size:10px;color:#0d6e56">| Put wall</span>
        <span style="font-size:10px;color:#b03030">| Call wall</span>
      </div>
    </div>
    ${topStrikes.length ? `<div class="ip-section">
      <div class="ip-section-title">Top Gamma Strikes</div>
      ${topStrikes.map(s => `<div class="ip-strike-row">
        <span class="ip-strike-lbl">$${s.strike}</span>
        <div class="ip-strike-bar"><div class="ip-strike-fill" style="width:${Math.round(Math.abs(s.gamma_exposure)/maxGex*100)}%"></div></div>
        <span style="font-size:10px;color:#666">C:${(s.call_oi/1000).toFixed(0)}k</span>
        <span style="font-size:10px;color:#666">P:${(s.put_oi/1000).toFixed(0)}k</span>
      </div>`).join('')}
    </div>` : ''}
    <div class="wall-summary" style="margin-top:8px">
      ${ga.putWallStrike ? '<span class="wall-tag put">Put Wall: $' + ga.putWallStrike + '</span>' : ''}
      ${ga.callWallStrike ? '<span class="wall-tag call">Call Wall: $' + ga.callWallStrike + '</span>' : ''}
      <span class="wall-tag band">${ga.spotInsideBand ? 'Spot Inside Band' : 'Spot Outside Band'}</span>
    </div>
  `;

  // Draw chart after DOM update
  requestAnimationFrame(() => {
    const strikes = hasR2 ? [...(a.topStrikes || [])].sort((x, y) => x.strike - y.strike) : null;
    if (strikes && strikes.length) {
      drawGexChart(document.getElementById('gamma-canvas'), strikes, a, spot);
    } else if (ga.oiByStrike && ga.oiByStrike.length) {
      drawOIChart(document.getElementById('gamma-canvas'), ga, spot);
    }
  });

  return { oiWalls, gexWalls };
}

/**
 * Draw GEX (gamma exposure) chart on canvas.
 */
export function drawGexChart(canvas, strikes, analysis, spot) {
  if (!canvas || !strikes.length) return;
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 600;
  const H = 240;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, W, H);

  const PAD_L = 50, PAD_R = 16, PAD_T = 16, PAD_B = 36;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxGex = Math.max(...strikes.map(s => Math.abs(s.gamma_exposure || 0)), 1);
  const minStrike = strikes[0].strike;
  const maxStrike = strikes[strikes.length - 1].strike;
  const strikeRange = maxStrike - minStrike || 1;
  const barW = Math.max(4, Math.min(18, (chartW / strikes.length) * 0.7));
  const xPos = s => PAD_L + ((s - minStrike) / strikeRange) * chartW;

  // Grid
  ctx.strokeStyle = '#f0ece0'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = PAD_T + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
  }
  // Y labels
  ctx.fillStyle = '#999'; ctx.font = '500 9px Inter, sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = PAD_T + (chartH / 4) * i;
    const val = maxGex * (1 - i / 4);
    ctx.fillText(val >= 1e6 ? (val/1e6).toFixed(0)+'M' : val >= 1e3 ? (val/1e3).toFixed(0)+'K' : val.toFixed(0), PAD_L - 6, y + 3);
  }
  // Baseline
  ctx.strokeStyle = '#d9d4c0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T + chartH); ctx.lineTo(W - PAD_R, PAD_T + chartH); ctx.stroke();

  // Bars
  strikes.forEach(s => {
    const x = xPos(s.strike);
    const barH = (Math.abs(s.gamma_exposure || 0) / maxGex) * chartH;
    ctx.fillStyle = (s.call_oi || 0) >= (s.put_oi || 0) ? 'rgba(45,125,79,0.75)' : 'rgba(192,57,43,0.75)';
    ctx.fillRect(x - barW/2, PAD_T + chartH - barH, barW, barH);
    ctx.fillStyle = '#666'; ctx.font = '600 9px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$' + s.strike, x, PAD_T + chartH + 14);
  });

  // Put wall line
  if (analysis.put_wall) {
    const x = xPos(analysis.put_wall);
    if (x >= PAD_L && x <= W - PAD_R) {
      ctx.strokeStyle = '#0d6e56'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + chartH); ctx.stroke();
      ctx.fillStyle = '#0d6e56'; ctx.font = '700 10px Inter'; ctx.textAlign = 'center';
      ctx.fillText('PUT $' + analysis.put_wall, x, PAD_T + chartH + 28);
    }
  }
  // Call wall line
  if (analysis.call_wall) {
    const x = xPos(analysis.call_wall);
    if (x >= PAD_L && x <= W - PAD_R) {
      ctx.strokeStyle = '#b03030'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + chartH); ctx.stroke();
      ctx.fillStyle = '#b03030'; ctx.font = '700 10px Inter'; ctx.textAlign = 'center';
      ctx.fillText('CALL $' + analysis.call_wall, x, PAD_T + chartH + 28);
    }
  }
  // Spot line
  if (spot && spot >= minStrike && spot <= maxStrike) {
    const x = xPos(spot);
    ctx.strokeStyle = '#C9A96E'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + chartH); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#C9A96E'; ctx.font = '700 10px Inter'; ctx.textAlign = 'center';
    ctx.fillText('$' + spot.toFixed(0), x, PAD_T - 4);
  }
}

/**
 * Fallback OI chart when R2 data is unavailable.
 */
export function drawOIChart(canvas, ga, spot) {
  if (!canvas) return;
  const data = ga.oiByStrike; const n = data.length; if (!n) return;
  const DPR = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 600, H = 240;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  let maxOI = 1;
  data.forEach(s => { maxOI = Math.max(maxOI, s.callOI, s.putOI); });
  const ml=10,mr=10,mt=20,mb=40, cw=W-ml-mr, ch=H-mt-mb;
  const barW = Math.max(2, Math.min(12, (cw/n)*0.35)), gap = cw/n, centerY = mt + ch*0.5;
  ctx.beginPath(); ctx.moveTo(ml, centerY); ctx.lineTo(W-mr, centerY);
  ctx.strokeStyle='rgba(15,61,46,0.15)'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
  data.forEach((s, k) => {
    const x = ml + gap*k + gap*0.5;
    const putH = (s.putOI/maxOI)*(ch*0.45), callH = (s.callOI/maxOI)*(ch*0.45);
    ctx.fillStyle = 'rgba(239,68,68,0.45)'; ctx.fillRect(x-barW/2, centerY+1, barW, putH);
    ctx.fillStyle = 'rgba(16,185,129,0.45)'; ctx.fillRect(x-barW/2, centerY-callH-1, barW, callH);
  });
}
