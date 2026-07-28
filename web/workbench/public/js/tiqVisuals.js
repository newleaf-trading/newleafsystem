/* TIQ question visuals — deterministic inline SVG, one diagram per question.
 *
 * window.TIQVisuals.render(spec) -> SVG string. Every number in the diagram comes
 * from the question's `visual` spec (authored in content/tiq/bank-v1.json); nothing
 * is fabricated. Pure, no dependencies, responsive (viewBox + width:100%).
 *
 * Spec types: payoff | checklist | gauge | streak | bars | sizing | snapshot | volterm
 */
(function (root) {
  'use strict';

  var C = {
    forest: '#16271C', forest2: '#1E3326', forest3: '#27412F',
    gold: '#B68F3E', goldLt: '#E7D9AE', cream: '#F2ECDD',
    teal: '#3E7C6A', terra: '#BC5B43', mute: '#8FA396'
  };
  var W = 640, H = 300;
  var DISP = "'Fraunces',Georgia,serif", BODY = "'DM Sans',system-ui,sans-serif", MONO = "'Space Mono',monospace";

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(x, u) { u = u || ''; var v = Math.round(x); return (v < 0 ? '−' + u : u) + Math.abs(v).toLocaleString(); }
  function frame(inner, h) {
    h = h || H;
    return '<svg viewBox="0 0 ' + W + ' ' + h + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" style="display:block">' +
      '<rect x="0" y="0" width="' + W + '" height="' + h + '" rx="14" fill="' + C.forest2 + '" stroke="' + C.forest3 + '"/>' +
      inner + '</svg>';
  }
  function eyebrow(t) { return '<text x="28" y="34" font-family="' + MONO + '" font-size="12" letter-spacing="2.5" fill="' + C.gold + '">' + esc((t || '').toUpperCase()) + '</text>'; }

  // ── payoff ────────────────────────────────────────────────────────────────
  function payoff(s) {
    var pts = s.points || [], strikes = s.strikes || [];
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    var yMax = Math.max.apply(null, ys), yMin = Math.min.apply(null, ys);
    var pad = (yMax - yMin) * 0.28 || 1; yMax += pad; yMin -= pad;
    var L = 28, R = 28, T = 56, B = 78, pw = W - L - R, ph = H - T - B;
    var px = function (x) { return L + (xMax === xMin ? 0.5 : (x - xMin) / (xMax - xMin)) * pw; };
    var py = function (y) { return T + (1 - (y - yMin) / (yMax - yMin)) * ph; };
    var z = py(0);
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + px(p.x).toFixed(1) + ' ' + py(p.y).toFixed(1); }).join(' ');
    // breakeven where the line crosses 0
    var be = null;
    for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i]; if ((a.y <= 0 && b.y >= 0) || (a.y >= 0 && b.y <= 0)) { if (b.y !== a.y) be = a.x + (0 - a.y) / (b.y - a.y) * (b.x - a.x); } }
    var maxP = Math.max.apply(null, ys), maxL = Math.min.apply(null, ys);
    var g = '';
    g += eyebrow(s.title || 'Payoff at expiry');
    // fills
    g += '<clipPath id="tvA"><rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + Math.max(0, z - T) + '"/></clipPath>';
    g += '<clipPath id="tvB"><rect x="' + L + '" y="' + z + '" width="' + pw + '" height="' + Math.max(0, T + ph - z) + '"/></clipPath>';
    var area = d + ' L ' + px(xMax) + ' ' + z + ' L ' + px(xMin) + ' ' + z + ' Z';
    g += '<path d="' + area + '" fill="' + C.teal + '" opacity="0.20" clip-path="url(#tvA)"/>';
    g += '<path d="' + area + '" fill="' + C.terra + '" opacity="0.20" clip-path="url(#tvB)"/>';
    g += '<line x1="' + L + '" y1="' + z + '" x2="' + (L + pw) + '" y2="' + z + '" stroke="' + C.goldLt + '" stroke-width="1" stroke-dasharray="4 6" opacity="0.5"/>';
    strikes.forEach(function (k) { g += '<line x1="' + px(k).toFixed(1) + '" y1="' + T + '" x2="' + px(k).toFixed(1) + '" y2="' + (T + ph) + '" stroke="' + C.gold + '" stroke-width="1" stroke-dasharray="2 6" opacity="0.55"/>' + '<text x="' + px(k).toFixed(1) + '" y="' + (T + ph + 20) + '" font-family="' + MONO + '" font-size="12" fill="' + C.mute + '" text-anchor="middle">' + esc(k) + '</text>'; });
    g += '<path d="' + d + '" fill="none" stroke="' + C.gold + '" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>';
    if (be != null) { g += '<circle cx="' + px(be).toFixed(1) + '" cy="' + z + '" r="5" fill="' + C.cream + '"/>' + '<text x="' + px(be).toFixed(1) + '" y="' + (z - 12) + '" font-family="' + MONO + '" font-size="12" fill="' + C.cream + '" text-anchor="middle">BE ' + esc(+be.toFixed(2)) + '</text>'; }
    // metrics
    var u = s.unit || '';
    g += metric(L, H - 46, 'MAX PROFIT', (maxP >= 0 ? '+' : '') + maxP + u, C.teal);
    g += metric(L + 200, H - 46, 'MAX LOSS', maxL + u, C.terra);
    if (maxL !== 0) g += metric(L + 400, H - 46, 'REWARD : RISK', (Math.abs(maxP / maxL)).toFixed(2) + ' : 1', C.gold);
    return frame(g);
  }
  function metric(x, y, label, val, accent) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + MONO + '" font-size="10.5" letter-spacing="1.5" fill="' + C.mute + '">' + esc(label) + '</text>' +
      '<text x="' + x + '" y="' + (y + 26) + '" font-family="' + DISP + '" font-weight="600" font-size="26" fill="' + accent + '">' + esc(val) + '</text>';
  }

  // ── checklist ───────────────────────────────────────────────────────────────
  function checklist(s) {
    var items = s.items || [], pass = items.filter(function (i) { return i.pass; }).length;
    var h = 58 + items.length * 30 + 18;
    var g = eyebrow(s.caption || (pass + ' of ' + items.length + ' rules pass'));
    var y = 58;
    items.forEach(function (it) {
      var ok = it.pass;
      g += '<rect x="24" y="' + y + '" width="' + (W - 48) + '" height="26" rx="7" fill="' + C.forest + '" stroke="' + (ok ? C.forest3 : C.terra) + '"/>';
      g += '<rect x="32" y="' + (y + 5) + '" width="16" height="16" rx="4" fill="' + (ok ? C.teal : 'none') + '" stroke="' + (ok ? 'none' : C.terra) + '" stroke-width="1.5"/>';
      g += '<text x="40" y="' + (y + 17) + '" font-family="' + BODY + '" font-size="12" font-weight="700" fill="' + (ok ? C.forest : C.terra) + '" text-anchor="middle">' + (ok ? '✓' : '✕') + '</text>';
      g += '<text x="58" y="' + (y + 18) + '" font-family="' + BODY + '" font-size="14" fill="' + (ok ? C.cream : C.mute) + '">' + esc(it.label) + '</text>';
      y += 30;
    });
    return frame(g, h);
  }

  // ── gauge (progress toward a rule threshold) ─────────────────────────────────
  function gauge(s) {
    var max = s.max, val = s.value, target = s.target, danger = !!s.danger, u = s.unit || '';
    var L = 28, R = 28, bw = W - L - R, by = 150, bh = 30;
    var fillW = Math.max(0, Math.min(1, val / max)) * bw;
    var tX = L + Math.max(0, Math.min(1, target / max)) * bw;
    var accent = danger ? C.terra : C.teal;
    var g = eyebrow(s.title || 'Progress');
    g += '<text x="28" y="86" font-family="' + DISP + '" font-weight="600" font-size="30" fill="' + C.cream + '">' + esc(val + u) + '</text>';
    g += '<text x="' + (W - 28) + '" y="86" font-family="' + MONO + '" font-size="13" fill="' + C.mute + '" text-anchor="end">' + esc(s.rightLabel || ('rule: ' + target + u)) + '</text>';
    g += '<rect x="' + L + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="8" fill="' + C.forest + '" stroke="' + C.forest3 + '"/>';
    g += '<rect x="' + L + '" y="' + by + '" width="' + fillW.toFixed(1) + '" height="' + bh + '" rx="8" fill="' + accent + '" opacity="0.8"/>';
    g += '<line x1="' + tX.toFixed(1) + '" y1="' + (by - 10) + '" x2="' + tX.toFixed(1) + '" y2="' + (by + bh + 10) + '" stroke="' + C.gold + '" stroke-width="2"/>';
    g += '<text x="' + tX.toFixed(1) + '" y="' + (by - 16) + '" font-family="' + MONO + '" font-size="11" fill="' + C.gold + '" text-anchor="middle">' + esc(s.targetLabel || 'rule') + '</text>';
    if (s.caption) g += '<text x="28" y="' + (by + bh + 46) + '" font-family="' + BODY + '" font-size="13" fill="' + C.mute + '">' + esc(s.caption) + '</text>';
    return frame(g, 260);
  }

  // ── streak (W/L tally) ────────────────────────────────────────────────────────
  function streak(s) {
    var o = s.outcomes || [], n = o.length, box = Math.min(58, Math.floor((W - 56) / n) - 10), gap = 10;
    var totalW = n * box + (n - 1) * gap, x0 = (W - totalW) / 2, y = 96;
    var g = eyebrow(s.title || 'Recent results');
    o.forEach(function (r, i) {
      var win = (r === 'W' || r === 'w' || r === true);
      var x = x0 + i * (box + gap);
      g += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + box + '" height="' + box + '" rx="10" fill="' + (win ? C.teal : C.terra) + '" opacity="0.9"/>';
      g += '<text x="' + (x + box / 2).toFixed(1) + '" y="' + (y + box / 2 + 9) + '" font-family="' + DISP + '" font-weight="600" font-size="26" fill="' + C.forest + '" text-anchor="middle">' + (win ? 'W' : 'L') + '</text>';
    });
    if (s.caption) g += '<text x="' + (W / 2) + '" y="' + (y + box + 44) + '" font-family="' + BODY + '" font-size="14" fill="' + C.cream + '" text-anchor="middle">' + esc(s.caption) + '</text>';
    return frame(g, 220);
  }

  // ── bars (horizontal compare) ────────────────────────────────────────────────
  function bars(s) {
    var items = s.items || [], u = s.unit || '', fmt = s.format;
    var vals = items.map(function (i) { return Math.abs(i.value); }), mx = Math.max.apply(null, vals) || 1;
    var L = 190, R = 40, bw = W - L - R, top = 56, rowH = Math.min(46, Math.floor((H - top - 40) / items.length));
    var g = eyebrow(s.title || 'Comparison');
    items.forEach(function (it, i) {
      var y = top + i * rowH, w = Math.abs(it.value) / mx * bw, accent = it.accent === 'good' ? C.teal : it.accent === 'bad' ? C.terra : it.accent === 'gold' ? C.gold : C.mute;
      g += '<text x="' + (L - 12) + '" y="' + (y + rowH / 2 + 4) + '" font-family="' + BODY + '" font-size="13" fill="' + C.cream + '" text-anchor="end">' + esc(it.label) + '</text>';
      g += '<rect x="' + L + '" y="' + (y + 6) + '" width="' + bw + '" height="' + (rowH - 16) + '" rx="6" fill="' + C.forest + '"/>';
      g += '<rect x="' + L + '" y="' + (y + 6) + '" width="' + Math.max(2, w).toFixed(1) + '" height="' + (rowH - 16) + '" rx="6" fill="' + accent + '" opacity="0.85"/>';
      var disp = fmt === 'money' ? money(it.value, u) : (it.value + u);
      g += '<text x="' + (L + Math.max(2, w) + 8).toFixed(1) + '" y="' + (y + rowH / 2 + 4) + '" font-family="' + MONO + '" font-size="13" fill="' + C.goldLt + '">' + esc(it.display || disp) + '</text>';
    });
    if (s.caption) g += '<text x="28" y="' + (H - 18) + '" font-family="' + BODY + '" font-size="12.5" fill="' + C.mute + '">' + esc(s.caption) + '</text>';
    return frame(g);
  }

  // ── sizing (position-size arithmetic) ────────────────────────────────────────
  function sizing(s) {
    var u = s.unit || '£', budget = s.account * s.riskPct / 100, n = Math.floor(budget / s.riskPerContract);
    var g = eyebrow('Position sizing');
    var line = money(s.account, u) + '  ×  ' + s.riskPct + '%  =  ' + money(budget, u) + ' budget';
    g += '<text x="28" y="72" font-family="' + MONO + '" font-size="15" fill="' + C.cream + '">' + esc(line) + '</text>';
    // budget bar split into contract units
    var L = 28, R = 28, bw = W - L - R, by = 110, bh = 40, per = s.riskPerContract, units = Math.max(n, Math.ceil(budget / per));
    g += '<text x="28" y="' + (by - 12) + '" font-family="' + BODY + '" font-size="12.5" fill="' + C.mute + '">each block = one contract at ' + esc(money(per, u)) + ' max loss</text>';
    for (var i = 0; i < units; i++) {
      var uw = bw / units, x = L + i * uw, fits = (i + 1) * per <= budget;
      g += '<rect x="' + (x + 3).toFixed(1) + '" y="' + by + '" width="' + (uw - 6).toFixed(1) + '" height="' + bh + '" rx="6" fill="' + (fits ? C.teal : C.forest) + '" stroke="' + (fits ? 'none' : C.terra) + '" opacity="' + (fits ? 0.85 : 1) + '"/>';
    }
    g += '<text x="28" y="' + (by + bh + 40) + '" font-family="' + DISP + '" font-weight="600" font-size="28" fill="' + C.goldLt + '">' + n + ' contract' + (n === 1 ? '' : 's') + '</text>';
    g += '<text x="' + (W - 28) + '" y="' + (by + bh + 40) + '" font-family="' + BODY + '" font-size="12.5" fill="' + C.mute + '" text-anchor="end">' + esc(money(budget - n * per, u)) + ' left under the cap</text>';
    return frame(g, 240);
  }

  // ── snapshot (market metric chips) ───────────────────────────────────────────
  function snapshot(s) {
    var chips = s.chips || [], cols = Math.min(chips.length, 3), rows = Math.ceil(chips.length / cols);
    var L = 24, T = 52, gap = 14, cw = (W - L * 2 - gap * (cols - 1)) / cols, ch = 62;
    var g = eyebrow(s.title || 'The tape');
    chips.forEach(function (c, i) {
      var r = Math.floor(i / cols), col = i % cols, x = L + col * (cw + gap), y = T + r * (ch + gap);
      var accent = c.dir === 'up' ? C.teal : c.dir === 'down' ? C.terra : C.gold;
      var arrow = c.dir === 'up' ? '▲' : c.dir === 'down' ? '▼' : '—';
      g += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + cw.toFixed(1) + '" height="' + ch + '" rx="10" fill="' + C.forest + '" stroke="' + C.forest3 + '"/>';
      g += '<text x="' + (x + 14).toFixed(1) + '" y="' + (y + 24) + '" font-family="' + MONO + '" font-size="11" letter-spacing="1" fill="' + C.mute + '">' + esc((c.label || '').toUpperCase()) + '</text>';
      g += '<text x="' + (x + 14).toFixed(1) + '" y="' + (y + 48) + '" font-family="' + DISP + '" font-weight="600" font-size="22" fill="' + accent + '">' + esc(arrow + ' ' + c.value) + '</text>';
    });
    if (s.caption) g += '<text x="24" y="' + (T + rows * (ch + gap) + 24) + '" font-family="' + BODY + '" font-size="13" fill="' + C.mute + '">' + esc(s.caption) + '</text>';
    return frame(g, T + rows * (ch + gap) + (s.caption ? 44 : 20));
  }

  // ── volterm (IV across tenors) ───────────────────────────────────────────────
  function volterm(s) {
    var pts = s.points || [], mx = Math.max.apply(null, pts.map(function (p) { return p.iv; })) * 1.15;
    var L = 40, R = 40, T = 60, B = 60, pw = W - L - R, ph = H - T - B, n = pts.length;
    var g = eyebrow(s.title || 'Implied volatility term structure');
    var xAt = function (i) { return L + (n === 1 ? 0.5 : i / (n - 1)) * pw; };
    var yAt = function (v) { return T + (1 - v / mx) * ph; };
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(p.iv).toFixed(1); }).join(' ');
    g += '<line x1="' + L + '" y1="' + (T + ph) + '" x2="' + (L + pw) + '" y2="' + (T + ph) + '" stroke="' + C.forest3 + '" stroke-width="2"/>';
    g += '<path d="' + d + '" fill="none" stroke="' + C.gold + '" stroke-width="3" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) {
      g += '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.iv).toFixed(1) + '" r="5" fill="' + C.goldLt + '"/>';
      g += '<text x="' + xAt(i).toFixed(1) + '" y="' + (yAt(p.iv) - 12).toFixed(1) + '" font-family="' + MONO + '" font-size="13" fill="' + C.cream + '" text-anchor="middle">' + esc(p.iv) + '%</text>';
      g += '<text x="' + xAt(i).toFixed(1) + '" y="' + (T + ph + 24) + '" font-family="' + MONO + '" font-size="12" fill="' + C.mute + '" text-anchor="middle">' + esc(p.label) + '</text>';
    });
    if (s.caption) g += '<text x="40" y="' + (H - 16) + '" font-family="' + BODY + '" font-size="12.5" fill="' + C.mute + '">' + esc(s.caption) + '</text>';
    return frame(g);
  }

  // ── category icons (Knowledge / Emotion / System / Risk / Market) ────────────
  var ICON_PATH = {
    KQ: '<path d="M12 6C10.5 5 8 4.5 5 4.5V18c3 0 5.5.5 7 1.5 1.5-1 4-1.5 7-1.5V4.5c-3 0-5.5.5-7 1.5z"/><path d="M12 6v13.5"/>', // open book
    EQ: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>', // heart
    SQ: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>', // gear
    RQ: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', // shield
    MQ: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' // trending up
  };
  var AXIS_TO_CAT = { Knowledge: 'KQ', Emotion: 'EQ', System: 'SQ', Risk: 'RQ', Market: 'MQ' };
  var CAT_COLOR = { KQ: C.goldLt, EQ: C.terra, SQ: C.teal, RQ: C.gold, MQ: '#3E6E8C' };

  function icon(cat, size, color) {
    var k = ICON_PATH[cat] ? cat : (AXIS_TO_CAT[cat] || cat);
    var d = ICON_PATH[k];
    if (!d) return '';
    size = size || 18;
    color = color || CAT_COLOR[k] || 'currentColor';
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="' + color +
      '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0">' + d + '</svg>';
  }
  function catColor(cat) { var k = ICON_PATH[cat] ? cat : (AXIS_TO_CAT[cat] || cat); return CAT_COLOR[k] || C.gold; }

  var TYPES = { payoff: payoff, checklist: checklist, gauge: gauge, streak: streak, bars: bars, sizing: sizing, snapshot: snapshot, volterm: volterm };

  function render(spec) {
    if (!spec || !spec.type || !TYPES[spec.type]) return '';
    try { return TYPES[spec.type](spec); } catch (e) { return ''; }
  }

  root.TIQVisuals = { render: render, icon: icon, catColor: catColor, types: Object.keys(TYPES) };
})(typeof window !== 'undefined' ? window : globalThis);
