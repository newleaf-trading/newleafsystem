/**
 * ProjectionPage — deterministic projection dashboard, dual-surface via `mode`.
 *
 *   mode="operator" (/workbench/projection): free sliders model a plan; an admin
 *     can "Publish as template" and manage versions. (Default.)
 *   mode="investor" (/invest/projection): READ-ONLY, capital-scaled projections of
 *     the published templates — the investor picks one, names it, and commits a
 *     frozen Plan of Record. No edge/win-rate sliders; only their own capital.
 *
 * Architecture rule: the engine (src/trading/lib/projection/engine.js) computes
 * every number deterministically; this component only renders. Both surfaces call
 * the SAME engine, so the numbers are identical.
 *
 * Charts are drawn on bespoke <canvas> via refs/effects (the band fill + dashed
 * baseline + schematic payoff are illustrative shapes, not strikes-based) — a
 * deliberate deviation from the app's usual Highcharts convention.
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { simulate } from '../lib/projection/engine';
import { templateToState, defaultPlanName } from '../lib/projection/planMath';
import { publishTemplate, retireTemplate, latestVersion, commitPlanOfRecord } from '../lib/projection/planStore';
import { usePlanTemplates } from '../hooks/usePlanTemplates';
import { useProjectionCoach } from '../hooks/useProjectionCoach';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { useAuth } from '../../shared/hooks/useAuth';
import { isAdminEmail } from '../../shared/lib/admins';
import styles from './ProjectionPage.module.css';

// Brand-family colours for canvas drawing (canvas can't read CSS vars cheaply).
// Mirrors the --nl-* palette: green #0B2D23, gold #C9A96E, loss #C94F4F.
const C = {
  muted: '#9aa69c',
  green: '#2F6B4F', // expected path — mid forest, brand green family
  gold: '#C9A96E',
  bandFill: 'rgba(201,169,110,0.45)',
  baseline: '#B9B19A',
  profitFill: 'rgba(47,107,79,0.20)',
  lossFill: 'rgba(201,79,79,0.16)',
  goldLine: 'rgba(182,143,62,0.85)',
  grid: 'rgba(0,0,0,0.05)',
};

const UI_PRESETS = {
  cons: { tpy: 100, wr: 60, aw: 1.0, al: 1.0, capPct: 1.0 },
  base: { tpy: 120, wr: 62, aw: 1.2, al: 1.0, capPct: 1.0 },
  high: { tpy: 200, wr: 65, aw: 1.2, al: 1.0, capPct: 1.0 },
};

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
function fmtK(n) {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return '$' + Math.round(n / 1000) + 'k';
}

// ─── Canvas: projection band chart ───────────────────────────────
function drawChart(canvas, s, sim) {
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  if (!W || !H) return;
  const cx = canvas.getContext('2d');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, W, H);

  const padL = 52, padR = 14, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const maxV = Math.max(sim.finalExpected, sim.p90, s.cap * 1.05);
  const minV = Math.min(s.cap * 0.95, sim.worst);
  const span = maxV - minV || 1;
  const yOf = (v) => padT + plotH - ((v - minV) / span) * plotH;
  const xOf = (i) => padL + (i / sim.total) * plotW;

  // y gridlines + labels
  cx.font = '10px "Space Mono", monospace';
  cx.fillStyle = C.muted;
  cx.textAlign = 'right';
  const steps = 5;
  for (let g = 0; g <= steps; g++) {
    const v = minV + (span * g) / steps, y = yOf(v);
    cx.strokeStyle = C.grid;
    cx.beginPath(); cx.moveTo(padL, y); cx.lineTo(W - padR, y); cx.stroke();
    cx.fillText(fmtK(v), padL - 8, y + 3);
  }
  // x ticks (~7)
  cx.textAlign = 'center';
  const xticks = 7;
  for (let t = 0; t <= xticks; t++) {
    const i = Math.round((t / xticks) * sim.total);
    cx.fillText(i, xOf(i), H - 7);
  }

  // 10–90 band
  cx.beginPath();
  sim.band.forEach((b, i) => { const x = xOf(b.x), y = yOf(b.p90); i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
  for (let i = sim.band.length - 1; i >= 0; i--) { const b = sim.band[i]; cx.lineTo(xOf(b.x), yOf(b.p10)); }
  cx.closePath(); cx.fillStyle = C.bandFill; cx.fill();

  // baseline (starting capital)
  cx.strokeStyle = C.baseline; cx.setLineDash([5, 4]); cx.lineWidth = 1.2;
  cx.beginPath(); cx.moveTo(padL, yOf(s.cap)); cx.lineTo(W - padR, yOf(s.cap)); cx.stroke();
  cx.setLineDash([]);

  // expected line
  cx.strokeStyle = C.green; cx.lineWidth = 2.4; cx.beginPath();
  sim.expected.forEach((v, i) => { const x = xOf(i), y = yOf(v); i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
  cx.stroke();

  // endpoint dot
  cx.fillStyle = C.green; cx.beginPath();
  cx.arc(xOf(sim.total), yOf(sim.finalExpected), 4, 0, Math.PI * 2); cx.fill();
}

// ─── Canvas: schematic payoff diagram ────────────────────────────
function interp(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const t = (x - x0) / ((x1 - x0) || 1e-6);
      return y0 + (y1 - y0) * t;
    }
  }
  return pts[pts.length - 1][1];
}
function drawPayoff(canvas, struct, rr) {
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  const pcx = canvas.getContext('2d');
  canvas.width = W * dpr; canvas.height = H * dpr;
  pcx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pcx.clearRect(0, 0, W, H);

  const padL = 6, padR = 8, padT = 8, padB = 8;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const top = Math.max(rr, 0.6), bot = -1, head = 0.20 * (top - bot);
  const yMin = bot - head, yMax = top + head;
  const X = (t) => padL + t * plotW;
  const Y = (v) => padT + (plotH * (yMax - v)) / (yMax - yMin);
  const zeroY = Y(0);

  // filled profit / loss regions
  const Ns = 170, w = plotW / (Ns - 1) + 0.9;
  for (let i = 0; i < Ns; i++) {
    const t = i / (Ns - 1), y = interp(struct.points, t), px = X(t), py = Y(y);
    if (y >= 0) { pcx.fillStyle = C.profitFill; pcx.fillRect(px, py, w, zeroY - py); }
    else { pcx.fillStyle = C.lossFill; pcx.fillRect(px, zeroY, w, py - zeroY); }
  }
  // breakeven baseline
  pcx.strokeStyle = 'rgba(22,39,28,0.22)'; pcx.lineWidth = 1; pcx.setLineDash([3, 3]);
  pcx.beginPath(); pcx.moveTo(padL, zeroY); pcx.lineTo(W - padR, zeroY); pcx.stroke(); pcx.setLineDash([]);
  // "now" price marker
  const nx = X(struct.now);
  pcx.strokeStyle = C.goldLine; pcx.lineWidth = 1.2; pcx.setLineDash([2, 3]);
  pcx.beginPath(); pcx.moveTo(nx, padT); pcx.lineTo(nx, padT + plotH); pcx.stroke(); pcx.setLineDash([]);
  pcx.fillStyle = '#B68F3E'; pcx.font = '700 8px "Space Mono", monospace'; pcx.textAlign = 'center';
  pcx.fillText('NOW', nx, padT + 7);
  // payoff line
  pcx.strokeStyle = C.green; pcx.lineWidth = 2.2; pcx.lineJoin = 'round'; pcx.beginPath();
  struct.points.forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); i ? pcx.lineTo(x, y) : pcx.moveTo(x, y); });
  pcx.stroke();
}

export default function ProjectionPage({ mode = 'operator' }) {
  const isInvestor = mode === 'investor';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  // Investor commits are bound to the account's configured capital — never free-entered.
  const { settings } = usePortfolioSettings();
  const accountCapital = settings?.totalCapital ?? null;

  // Shared inputs (both surfaces scale to their own capital + horizon)
  const [cap, setCap] = useState(100000);
  const [yrs, setYrs] = useState(1);

  // Operator-only slider state
  const [tpy, setTpy] = useState(120);
  const [wr, setWr] = useState(62);
  const [aw, setAw] = useState(1.2);
  const [al, setAl] = useState(1.0);
  const [capPct, setCapPct] = useState(1.0);
  const [preset, setPreset] = useState('base');
  const [interacted, setInteracted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Template-driven state (investor chooser + operator publish/manage)
  const { templates } = usePlanTemplates({ publishedOnly: isInvestor });
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [planName, setPlanName] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);

  const chartRef = useRef(null);
  const payoffRef = useRef(null);
  const openBtnRef = useRef(null);
  const closeBtnRef = useRef(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  // Engine state: from the selected template (investor) or from the sliders (operator).
  const s = useMemo(() => {
    if (isInvestor) {
      return selectedTemplate ? templateToState(selectedTemplate, cap, yrs) : null;
    }
    return { cap, yrs, tpy, wr: wr / 100, aw: aw / 100, al: al / 100, capPct: capPct / 100 };
  }, [isInvestor, selectedTemplate, cap, yrs, tpy, wr, aw, al, capPct]);

  const sim = useMemo(() => (s ? simulate(s) : null), [s]);

  // derived display values (work in both modes; read from engine state `s`)
  const perWk = s ? s.tpy / 52 : 0;
  const profit = sim ? sim.finalExpected - cap : 0;
  const d = sim ? sim.dollars : { riskPerTrade: 0, typicalWin: 0, typicalLoss: 0 };
  const wrPct = s ? s.wr * 100 : 0;
  const awPct = s ? s.aw * 100 : 0;
  const alPct = s ? s.al * 100 : 0;
  const capPctPct = s ? s.capPct * 100 : 0;
  const needed = Math.max(1, Math.round(perWk * (s ? s.wr : 0)));

  // investor: capital basis is the account's configured capital (read-only, never free-entered)
  useEffect(() => {
    if (isInvestor && accountCapital != null) setCap(accountCapital);
  }, [isInvestor, accountCapital]);

  // investor: default-select the first published template + prefill its plan name
  useEffect(() => {
    if (isInvestor && !selectedTemplateId && templates.length) setSelectedTemplateId(templates[0].id);
  }, [isInvestor, templates, selectedTemplateId]);
  useEffect(() => {
    if (isInvestor && selectedTemplate) setPlanName(defaultPlanName(selectedTemplate, new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  // redraw both canvases whenever the simulation changes or the window resizes
  const redraw = useCallback(() => {
    if (!sim) return;
    if (chartRef.current) drawChart(chartRef.current, s, sim);
    if (payoffRef.current) drawPayoff(payoffRef.current, sim.structure, sim.rr);
  }, [s, sim]);

  useEffect(() => {
    redraw();
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [redraw]);

  // modal: focus management + ESC close
  useEffect(() => {
    if (modalOpen) {
      closeBtnRef.current?.focus();
      const onKey = (e) => { if (e.key === 'Escape') setModalOpen(false); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    openBtnRef.current?.focus();
  }, [modalOpen]);

  const onSlider = (setter) => (e) => { setter(Number(e.target.value)); setPreset(null); setInteracted(true); };

  const applyPreset = (name) => {
    const p = UI_PRESETS[name];
    setTpy(p.tpy); setWr(p.wr); setAw(p.aw); setAl(p.al); setCapPct(p.capPct);
    setPreset(name); setInteracted(true);
  };
  const reset = () => { setCap(100000); setYrs(1); applyPreset('base'); };

  const pctLabel = (v) => v.toFixed(1) + '%';

  // ── AI coach (operator only): intro until first interaction, then a plain-English summary + Q&A.
  // Code computes every figure; the LLM only narrates the numbers below (never recomputes).
  const [question, setQuestion] = useState('');
  const coach = useProjectionCoach();

  const context = useMemo(() => (sim ? {
    startingCapital: cap,
    projectionYears: yrs,
    tradesPerYear: s.tpy,
    totalTrades: sim.total,
    tradesPerWeek: Number((s.tpy / 52).toFixed(1)),
    winRatePct: wrPct,
    avgWinPct: awPct,
    avgLossPct: alPct,
    maxLossCapPct: capPctPct,
    edgePerTradePct: Number((sim.ev * 100).toFixed(2)),
    expectedFinalUSD: Math.round(sim.finalExpected),
    projectedProfitUSD: Math.round(sim.finalExpected - cap),
    likelyRangeLowUSD: Math.round(sim.p10),
    likelyRangeHighUSD: Math.round(sim.p90),
    losingPathRiskPct: Math.round(sim.losingRisk * 100),
    riskPerTradeUSD: Math.round(sim.dollars.riskPerTrade),
    typicalWinUSD: Math.round(sim.dollars.typicalWin),
    typicalLossUSD: Math.round(sim.dollars.typicalLoss),
    rewardToRisk: Number(sim.rr.toFixed(1)),
    structureThatFits: sim.structure.name,
  } : null), [cap, yrs, s, sim, wrPct, awPct, alPct, capPctPct]);
  const contextKey = JSON.stringify(context);

  // Auto-summarise once inputs settle (debounced) after the first interaction.
  useEffect(() => {
    if (isInvestor || !interacted || !context) return;
    const t = setTimeout(() => { coach.generateSummary(context, contextKey); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacted, contextKey, isInvestor]);

  // ── Publish (operator/admin)
  const nextPublishVersion = latestVersion(templates, publishName.trim()) + 1;
  const [publishMaxLoss, setPublishMaxLoss] = useState(20); // portfolio max loss %
  const onPublish = async () => {
    const name = publishName.trim();
    if (!name) return;
    await publishTemplate({
      name,
      version: latestVersion(templates, name) + 1,
      state: s,
      portfolioMaxLossPct: publishMaxLoss / 100,
      user,
    });
    setPublishOpen(false);
  };

  // ── Commit (investor)
  const onCommit = async () => {
    if (!selectedTemplate || !user) return;
    setCommitting(true);
    setCommitError(null);
    try {
      await commitPlanOfRecord({
        uid: user.uid,
        template: selectedTemplate,
        capital: cap,
        planName: planName.trim() || defaultPlanName(selectedTemplate, new Date()),
      });
      navigate('/invest');
    } catch (e) {
      setCommitError(e.message || 'Could not commit plan.');
      setCommitting(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* COACH / INTRO BAND */}
      {isInvestor ? (
        <section className={styles.coach}>
          <div className={styles.investIntro}>
            <span className={styles.eyebrow}>Choose your plan</span>
            <p>
              These are vetted NewLeaf plans, each scaled to <b>your</b> starting capital. The
              assumptions (win rate, edge, cadence) are fixed — you can’t move them. Adjust your
              capital, compare the projections, then <b>name and commit</b> the one you’ll run. You
              place every trade yourself; this just sets your plan of record.
            </p>
          </div>
        </section>
      ) : (
        <section className={styles.coach} aria-live="polite">
          {!interacted ? (
            <div className={styles.coachIntro}>
              <span className={styles.eyebrow}>How to use this tool</span>
              <p>
                Drag the sliders to model a repeatable options plan — starting capital, how many
                trades a year, your win rate, and how much you risk per idea. The curve shows how a
                small edge compounds; the right panel turns it into real dollars and the option
                structure that fits. <b>Move any control</b> to get a plain-English summary here, plus
                a box to ask questions.
              </p>
            </div>
          ) : (
            <div className={styles.coachLive}>
              <div className={styles.coachSummary}>
                <span className={styles.eyebrow}>Your plan in plain English</span>
                {coach.summaryError ? (
                  <p className={styles.coachErr}>
                    Couldn’t generate a summary ({coach.summaryError}). The numbers on the page are still accurate.
                  </p>
                ) : coach.summaryLoading && !coach.summary ? (
                  <p className={styles.coachMuted}>Summarising your plan…</p>
                ) : (
                  <p>{coach.summary || 'Adjust a control to refresh the summary.'}</p>
                )}
              </div>
              <div className={styles.coachAskWrap}>
                <div className={styles.coachAskRow}>
                  <input
                    className={styles.coachInput}
                    type="text"
                    value={question}
                    placeholder="Ask about your plan — e.g. is this many trades a week realistic?"
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') coach.ask(question, context); }}
                    aria-label="Ask about your plan"
                  />
                  <button
                    className={styles.coachAsk}
                    type="button"
                    disabled={coach.answerLoading || !question.trim()}
                    onClick={() => coach.ask(question, context)}
                  >
                    {coach.answerLoading ? 'Asking…' : 'Ask'}
                  </button>
                </div>
                {coach.answerError ? (
                  <p className={styles.coachErr}>Couldn’t answer ({coach.answerError}). Please try again.</p>
                ) : coach.answer ? (
                  <p className={styles.coachAnswer}>{coach.answer}</p>
                ) : null}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ROW 1 — capital + years + headline trades */}
      <div className={styles.row1}>
        <div className={styles.bigfield}>
          <div className={styles.bigTop}>
            <span className={styles.lbl}>{isInvestor ? 'Your account capital' : 'Starting capital'}</span>
            <span className={styles.bigVal}>{fmt(cap)}</span>
          </div>
          {isInvestor ? (
            <div className={styles.capNote}>
              {accountCapital == null
                ? 'Set your account capital in Home → Add funds to scale this plan.'
                : 'Scaled to your configured account capital. Plans commit on this basis.'}
            </div>
          ) : (
            <>
              <input type="range" min="25000" max="500000" step="5000" value={cap}
                onChange={onSlider(setCap)} aria-label="Starting capital" />
              <div className={styles.ends}><span>$25k</span><span>$500k</span></div>
            </>
          )}
        </div>
        <div className={styles.bigfield}>
          <div className={styles.bigTop}>
            <span className={styles.lbl}>Projection years</span>
            <span className={styles.bigVal}>{yrs}</span>
          </div>
          <input type="range" min="1" max="5" step="1" value={yrs}
            onChange={onSlider(setYrs)} aria-label="Projection years" />
          <div className={styles.ends}><span>1 yr</span><span>5 yrs</span></div>
        </div>
        <div className={styles.chips}>
          <div className={styles.chip}><b>{(sim?.total ?? 0).toLocaleString()}</b><span>Total trades</span></div>
          <div className={`${styles.chip} ${styles.chipGold}`}><b>{perWk.toFixed(1)}</b><span>Trades / week</span></div>
          <div className={styles.chip}><b>{((sim?.ev ?? 0) * 100).toFixed(2)}%</b><span>Edge / trade</span></div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className={styles.main}>
        {/* LEFT — sliders (operator) or template chooser (investor) */}
        {isInvestor ? (
          <section className={styles.card}>
            <div className={styles.panelHead}>
              <h2>Available plans</h2>
            </div>
            {templates.length === 0 ? (
              <div className={styles.emptyChooser}>
                No published plans yet. Check back once your operator publishes one.
              </div>
            ) : (
              <div className={styles.chooser}>
                {templates.map((t) => {
                  const st = templateToState(t, cap, yrs);
                  const sm = simulate(st);
                  const active = t.id === selectedTemplateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.tmplRow} ${active ? styles.tmplRowActive : ''}`}
                      aria-pressed={active}
                      onClick={() => setSelectedTemplateId(t.id)}
                    >
                      <span className={styles.tmplName}>
                        {t.name}
                        <span className={styles.tmplVer}>v{t.version}</span>
                      </span>
                      <span className={styles.tmplMeta}>
                        <span>Win <b>{Math.round(t.winRateTarget * 100)}%</b></span>
                        <span><b>{t.tradesPerWeek}</b>/wk</span>
                        <span>Edge <b>{(sm.ev * 100).toFixed(2)}%</b></span>
                        <span>Risk/trade <b>{fmt(t.riskCapPct * cap)}</b></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className={styles.card}>
            <div className={styles.panelHead}>
              <h2>Trade shape</h2>
              <button className={styles.reset} onClick={reset} type="button">↺ Reset</button>
            </div>
            <div className={styles.presets}>
              {[['cons', 'Conservative'], ['base', 'Base'], ['high', 'High activity']].map(([k, label]) => (
                <button key={k} type="button"
                  className={`${styles.preset} ${preset === k ? styles.presetActive : ''}`}
                  onClick={() => applyPreset(k)}>{label}</button>
              ))}
            </div>
            <div className={styles.sliders}>
              <Slider name="Trades per year" sub="100–200 is the NewLeaf cadence." badge={tpy}
                min="50" max="240" step="1" value={tpy} onChange={onSlider(setTpy)} ends={['50', '240']} />
              <Slider name="Win rate" sub="Safe setups target 60–65%." badge={wr + '%'} gold
                min="45" max="75" step="1" value={wr} onChange={onSlider(setWr)} ends={['45%', '75%']} />
              <Slider name="Average winning trade" sub="Profit as % of portfolio." badge={pctLabel(aw)} gold
                min="0.4" max="3" step="0.1" value={aw} onChange={onSlider(setAw)} ends={['0.4%', '3%']} />
              <Slider name="Average losing trade" sub="Loss as % before the cap." badge={pctLabel(al)}
                min="0.4" max="3" step="0.1" value={al} onChange={onSlider(setAl)} ends={['0.4%', '3%']} />
              <Slider name="Maximum loss cap" sub="Hard ceiling on any single idea." badge={pctLabel(capPct)}
                min="0.5" max="2" step="0.1" value={capPct} onChange={onSlider(setCapPct)} ends={['0.5%', '2%']} />
            </div>
          </section>
        )}

        {/* CENTER — chart */}
        <section className={`${styles.card} ${styles.chartCard}`}>
          <div className={styles.chartHead}>
            <div>
              <span className={styles.eyebrow}>Projection curve</span>
              <h2>Capital growth over repeated trades</h2>
            </div>
            <div className={styles.final}>
              <b>{sim ? fmtK(sim.finalExpected) : '—'}</b>
              <span>Expected final</span>
            </div>
          </div>
          {sim ? (
            <>
              <div className={styles.canvasWrap}><canvas ref={chartRef} /></div>
              <div className={styles.legend}>
                <span><i style={{ background: C.green }} />Expected path</span>
                <span><i style={{ background: C.gold }} />10th–90th range</span>
                <span><i style={{ background: C.muted }} />Starting capital</span>
              </div>
            </>
          ) : (
            <div className={styles.placeholder}>Select a plan to see its capital-scaled projection.</div>
          )}
        </section>

        {/* RIGHT — summary */}
        <section className={`${styles.card} ${styles.sum}`}>
          {sim ? (
            <>
              <div className={`${styles.kpi} ${styles.kpiProfit}`}>
                <span className={styles.k}>Projected profit</span>
                <span className={styles.v}>{fmtK(profit)}</span>
                <span className={styles.kd}>+{Math.round((profit / cap) * 100)}% over {sim.total} trades</span>
              </div>
              <div className={`${styles.kpi} ${styles.kpiRange}`}>
                <span className={styles.k}>Likely range (10th–90th)</span>
                <span className={styles.v}>{fmtK(sim.p10)} – {fmtK(sim.p90)}</span>
                <span className={styles.kd}>Across 240 simulated paths</span>
              </div>
              <div className={styles.kpi}>
                <span className={styles.k}>Losing-path risk</span>
                <span className={styles.v}>{Math.round(sim.losingRisk * 100)}%</span>
                <span className={styles.kd}>Paths ending below start</span>
              </div>
              <div className={styles.dollar}>
                <div className={styles.dk}>In real money</div>
                <div className={styles.dline}>Risk per trade <b>{fmt(d.riskPerTrade)}</b></div>
                <div className={styles.dline}>Typical win <b>{fmt(d.typicalWin)}</b></div>
                <div className={styles.dline}>Typical loss <b>{fmt(d.typicalLoss)}</b></div>
              </div>
              <div className={styles.payoffCard}>
                <div className={styles.poffHead}>
                  <span className={styles.eyebrow}>Structure that fits</span>
                  <h3>{sim.structure.name}</h3>
                </div>
                <div className={styles.poffCanvas}><canvas ref={payoffRef} /></div>
                <p className={styles.poffDesc}>{sim.structure.desc}</p>
                <div className={styles.poffMeta}>
                  <span>Reward <b>{fmt(d.typicalWin)}</b></span>
                  <span>Risk <b>{fmt(d.riskPerTrade)}</b></span>
                  <span className={styles.rr}>{sim.rr.toFixed(1)} : 1</span>
                </div>
              </div>

              {isInvestor ? (
                <div className={styles.commitBar}>
                  <button className={styles.openBtn} ref={openBtnRef} onClick={() => setModalOpen(true)} type="button">
                    View full summary →
                  </button>
                  <span className={styles.nameLabel}>Name this plan</span>
                  <input
                    className={styles.nameInput}
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    aria-label="Plan name"
                  />
                  <button
                    className={styles.commitBtn}
                    type="button"
                    disabled={committing || !selectedTemplate}
                    onClick={onCommit}
                  >
                    {committing ? 'Committing…' : 'Commit this plan →'}
                  </button>
                  {commitError && <span className={styles.commitErr}>{commitError}</span>}
                </div>
              ) : (
                <>
                  <button className={styles.openBtn} ref={openBtnRef} onClick={() => setModalOpen(true)} type="button">
                    View full summary →
                  </button>
                  {isAdmin && (
                    <button
                      className={styles.publishBtn}
                      type="button"
                      onClick={() => { setPublishName(''); setPublishMaxLoss(20); setPublishOpen(true); }}
                    >
                      Publish as template
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <div className={styles.placeholder}>No projection yet.</div>
          )}
        </section>
      </div>

      {/* OPERATOR — thin template manager (admin only) */}
      {!isInvestor && isAdmin && (
        <section className={styles.manager}>
          <div className={styles.managerHead} onClick={() => setManagerOpen((o) => !o)}>
            <h3>Plan templates ({templates.length})</h3>
            <button className={styles.linkBtn} type="button">{managerOpen ? 'Hide' : 'Manage'}</button>
          </div>
          {managerOpen && (
            <div className={styles.mgrList}>
              {templates.length === 0 && <div className={styles.emptyChooser}>No templates yet — publish one above.</div>}
              {templates.map((t) => (
                <div className={styles.mgrRow} key={t.id}>
                  <span className={styles.mgrNm}>{t.name}</span>
                  <span className={styles.mgrTag}>v{t.version}</span>
                  <span className={`${styles.mgrStatus} ${t.status === 'retired' ? styles.stRetired : styles.stPublished}`}>{t.status}</span>
                  <button
                    className={styles.linkBtn}
                    type="button"
                    onClick={() => { setPublishName(t.name); setPublishMaxLoss(Math.round((t.portfolioMaxLossPct || 0.2) * 100)); setPublishOpen(true); }}
                  >
                    New version
                  </button>
                  {t.status !== 'retired' && (
                    <button className={styles.linkBtn} type="button" onClick={() => retireTemplate(t.id)}>Retire</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* PUBLISH DIALOG (operator/admin) */}
      {publishOpen && (
        <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setPublishOpen(false); }}>
          <div className={styles.pubDialog} role="dialog" aria-modal="true" aria-labelledby="pj-pubtitle">
            <h2 id="pj-pubtitle">Publish as template</h2>
            <p className={styles.sub}>Freezes the current assumptions as a versioned, investor-facing plan.</p>
            <div className={styles.field}>
              <label htmlFor="pj-pubname">Template name</label>
              <input id="pj-pubname" type="text" value={publishName}
                onChange={(e) => setPublishName(e.target.value)} placeholder="e.g. Base Cadence" autoFocus />
              <span className={styles.hint}>Will publish as version {nextPublishVersion}.</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="pj-pubmaxloss">Portfolio max loss (%)</label>
              <input id="pj-pubmaxloss" type="number" min="1" max="100" step="1" value={publishMaxLoss}
                onChange={(e) => setPublishMaxLoss(Number(e.target.value))} />
              <span className={styles.hint}>
                Risk per trade {pctLabel(capPctPct)} · edge {(sim ? sim.ev * 100 : 0).toFixed(2)}% · {perWk.toFixed(1)} trades/wk
              </span>
            </div>
            <div className={styles.dialogActions}>
              <button className={styles.btnGhost} type="button" onClick={() => setPublishOpen(false)}>Cancel</button>
              <button className={styles.btnPrimary} type="button" disabled={!publishName.trim()} onClick={onPublish}>Publish</button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SUMMARY MODAL */}
      {modalOpen && sim && (
        <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="pj-mtitle">
            <div className={styles.modalHead}>
              <div>
                <h2 id="pj-mtitle">What the plan actually asks of you</h2>
                <p>The same projection, translated into a real trading cadence.</p>
              </div>
              <button className={styles.x} ref={closeBtnRef} onClick={() => setModalOpen(false)} aria-label="Close summary" type="button">✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.mgrid}>
                <MStat b={perWk.toFixed(1)} label="Trades / week" />
                <MStat b={Math.round(s.tpy / 12)} label="Trades / month" />
                <MStat b={sim.total.toLocaleString()} label="Total trades" />
                <MStat b={`${Math.round(sim.total * s.wr)} / ${Math.round(sim.total * (1 - s.wr))}`} label="Wins / losses" />
                <MStat b={`${sim.rr.toFixed(1)} : 1`} label="Reward : risk" />
              </div>

              <div className={`${styles.msec} ${styles.twocol}`}>
                <div>
                  <h3>Per-trade in dollars</h3>
                  <div className={styles.moneybox}>
                    <div className={styles.mrow}>Portfolio <b>{fmt(cap)}</b></div>
                    <div className={styles.mrow}>Max risk / idea ({pctLabel(capPctPct)}) <b className={styles.neg}>{fmt(d.riskPerTrade)}</b></div>
                    <div className={styles.mrow}>Typical win ({pctLabel(awPct)}) <b className={styles.pos}>+{fmt(d.typicalWin)}</b></div>
                    <div className={styles.mrow}>Typical loss ({pctLabel(alPct)}) <b className={styles.neg}>−{fmt(d.typicalLoss)}</b></div>
                    <div className={styles.mrow}>Winners needed / week <b>{needed} of {Math.round(perWk)}</b></div>
                  </div>
                </div>
                <div>
                  <h3>The maths behind the edge</h3>
                  <div className={styles.formula}>
                    <span className={styles.eyebrow}>Expected value per trade</span>
                    <div className={styles.f}>win rate × avg win − loss rate × avg loss</div>
                    <div className={styles.calc}>
                      {Math.round(wrPct)}% × {pctLabel(awPct)} − {Math.round(100 - wrPct)}% × {pctLabel(sim.lossMag * 100)} = {(sim.ev * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.msec}>
                <h3>Three ways to fill the week</h3>
                <div className={styles.plays}>
                  <Play h="Income" tag="Range-bound"
                    lines={[['Iron condor 1×1', '1/wk'], ['Butterfly 2×1', '1/wk']]}
                    p="Sell premium when you expect a stock to stay in a range. Highest hit-rate, smaller wins." />
                  <Play h="Balanced" tag="Theta + direction"
                    lines={[['Iron condor 1×1', '1/wk'], ['Bull-call spread 1×1', '1/wk']]}
                    p="Half premium-selling, half directional. Keeps the hit-rate up while a few directional ideas run." />
                  <Play h="Directional" tag="Lean bullish, capped"
                    lines={[['Bull-call spread 2×1', '1/wk'], ['Iron condor 1×1', '1/wk']]}
                    p="Mostly defined-risk spreads with a few condors for ballast. Discipline on the loss cap is everything." />
                </div>
              </div>

              <p className={styles.disclaim}>Educational only · Not financial advice · Numbers are model outputs, not promises.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ name, sub, badge, gold, ends, ...input }) {
  return (
    <div className={styles.slider}>
      <div className={styles.lr}>
        <span className={styles.sname}>{name}</span>
        <span className={`${styles.badge} ${gold ? styles.badgeGold : ''}`}>{badge}</span>
      </div>
      <div className={styles.ssub}>{sub}</div>
      <input type="range" aria-label={name} {...input} />
      <div className={styles.ends}><span>{ends[0]}</span><span>{ends[1]}</span></div>
    </div>
  );
}

function MStat({ b, label }) {
  return <div className={styles.mstat}><b>{b}</b><span>{label}</span></div>;
}

function Play({ h, tag, lines, p }) {
  return (
    <div className={styles.play}>
      <h4>{h}</h4>
      <div className={styles.ptag}>{tag}</div>
      {lines.map(([a, b], i) => <div className={styles.pln} key={i}><span>{a}</span><span>{b}</span></div>)}
      <p>{p}</p>
    </div>
  );
}
