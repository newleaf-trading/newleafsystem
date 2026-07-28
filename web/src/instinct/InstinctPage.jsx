import { useEffect, useRef, useState } from 'react';
import scoring from '@tiq-scoring';          // pure CJS front-door scorer (frontDoorScore)
import BANK from '@tiq-frontdoor';            // content/tiq/frontdoor-v1.json
import { track } from './track';

/*
  Instinct Quiz — public acquisition front door (spec-frontdoor.md). Ported from
  docs/tiq/reference/instinct-quiz.html: brand tokens, consensus reveal bar,
  archetype result, progress ticks, and the no-red rule (a weaker pick shades
  neutral, never wrong).

  - Score has NO floor: round(100 * earned / available) via shared/tiq
    (scoring.frontDoorScore). Archetype is the headline; the number is smaller
    and sits below it.
  - Consensus percentages are the bank's STATIC illustrative values, labelled as
    such — never presented as live. GET /api/tiq/items/:id/consensus is stubbed
    (available:false) until tiqItemStats has real data.
  - Confidence prompt on 3 of the 12 items only. elapsed_ms captured per item.
  - Analytics: one event per question view, one per abandon, one on completion.
*/

const Q = BANK.questions;
const ARCHE = BANK.archetypes;
const AXES = BANK.axes;
const CONFIDENCE_ITEMS = new Set([2, 6, 10]); // 3 of 12
const CONF = [
  { label: 'Certain', v: 5 }, { label: 'Fairly sure', v: 4 },
  { label: 'Could go either way', v: 3 }, { label: 'Guessing', v: 1 }
];

export default function InstinctPage() {
  const [phase, setPhase] = useState('intro'); // intro | quiz | result
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);   // index of chosen option (reveal state)
  const [confItem, setConfItem] = useState(false); // showing confidence prompt
  const [result, setResult] = useState(null);

  // accumulators kept in a ref so they survive re-renders without re-scoring
  const acc = useRef({ traits: {}, axisPts: {}, axisMax: {}, earned: 0, available: 0, elapsed: [], conf: {} });
  const tStart = useRef(0);
  const done = useRef(false);

  // ── abandon tracking: fire once if the user leaves mid-quiz ──
  useEffect(() => {
    function abandon() {
      if (phaseRef.current === 'quiz' && !done.current) {
        track('instinct_abandon', { itemId: Q[iRef.current]?.id, index: iRef.current, answered: iRef.current });
        done.current = true; // once
      }
    }
    window.addEventListener('beforeunload', abandon);
    return () => { window.removeEventListener('beforeunload', abandon); abandon(); };
  }, []);
  // keep refs in sync for the unmount handler
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const iRef = useRef(i); iRef.current = i;

  // ── per-question view event + timer ──
  useEffect(() => {
    if (phase !== 'quiz') return;
    tStart.current = Date.now();
    setPicked(null); setConfItem(false);
    track('instinct_question_view', { itemId: Q[i].id, index: i, axis: Q[i].axis });
  }, [phase, i]);

  function begin() { done.current = false; setResult(null); acc.current = { traits: {}, axisPts: {}, axisMax: {}, earned: 0, available: 0, elapsed: [], conf: {} }; setI(0); setPhase('quiz'); }

  function choose(n) {
    if (picked !== null || confItem) return;
    if (CONFIDENCE_ITEMS.has(i)) { setPendingChoice(n); setConfItem(true); return; }
    commit(n, null);
  }
  const [pendingChoice, setPendingChoice] = useState(null);
  function pickConfidence(v) { setConfItem(false); commit(pendingChoice, v); }

  function commit(n, confidence) {
    const q = Q[i];
    const o = q.opts ? q.opts[n] : q.options[n];
    const opts = q.options || q.opts;
    const best = Math.max(...opts.map(x => x.points));
    const a = acc.current;
    a.traits[o.trait] = (a.traits[o.trait] || 0) + 1;
    a.axisPts[q.axis] = (a.axisPts[q.axis] || 0) + o.points;
    a.axisMax[q.axis] = (a.axisMax[q.axis] || 0) + best;
    a.earned += o.points; a.available += best;
    a.elapsed.push(Date.now() - tStart.current);
    if (confidence != null) a.conf[q.id] = confidence;
    track('instinct_question_answer', { itemId: q.id, index: i, points: o.points, isBest: o.points === best, confidence: confidence ?? null, elapsed_ms: Date.now() - tStart.current });
    setPicked(n);
  }

  function next() {
    if (i === Q.length - 1) finish();
    else setI(i + 1);
  }

  function finish() {
    const a = acc.current;
    const score = scoring.frontDoorScore(a.earned, a.available); // no floor
    const rows = AXES.filter(x => a.axisMax[x]).map(x => ({ a: x, pct: Math.round(100 * a.axisPts[x] / a.axisMax[x]) })).sort((x, y) => y.pct - x.pct);
    const domTrait = Object.entries(a.traits).sort((x, y) => y[1] - x[1])[0]?.[0];
    const arche = ARCHE[domTrait] || ARCHE.balance;
    done.current = true;
    track('instinct_complete', { score, archetype: arche.name, topAxis: rows[0]?.a, medianElapsedMs: median(a.elapsed) });
    setResult({ score, rows, arche, topAxis: rows[0] });
    setPhase('result');
  }

  return (
    <div className="iq">
      <style>{CSS}</style>
      <div className="iq-stage">
        {phase === 'intro' && <Intro onStart={begin} />}
        {phase === 'quiz' && <Question q={Q[i]} i={i} picked={picked} confItem={confItem} onChoose={choose} onConfidence={pickConfidence} onNext={next} />}
        {phase === 'result' && <Result r={result} onAgain={begin} />}
      </div>
    </div>
  );
}

function Intro({ onStart }) {
  return (
    <div className="iq-center">
      <div className="iq-kicker">NewLeaf · 12 questions · about 4 minutes</div>
      <div className="iq-big">What kind of trader<br />are you?</div>
      <p className="iq-lede">Twelve situations. No jargon, no maths beyond arithmetic, no wrong answers that make you feel stupid. You will see what other traders picked after each one.</p>
      <button className="iq-next iq-show" onClick={onStart}>Start</button>
    </div>
  );
}

function Question({ q, i, picked, confItem, onChoose, onConfidence, onNext }) {
  const opts = q.options || q.opts;
  const best = Math.max(...opts.map(x => x.points));
  const revealed = picked !== null;

  if (confItem) {
    return (
      <div>
        <div className="iq-axis">{q.axis}</div>
        <div className="iq-confq">Before you see what others picked — how sure are you?</div>
        {CONF.map((c, k) => <button key={k} className="iq-conf" onClick={() => onConfidence(c.v)}>{c.label}</button>)}
      </div>
    );
  }

  return (
    <div>
      <div className="iq-ticks">{Q.map((_, n) => <div key={n} className={'iq-tick ' + (n < i ? 'done' : n === i ? 'now' : '')} />)}</div>
      <div className="iq-meta"><span>{String(i + 1).padStart(2, '0')} / {Q.length}</span><span>{q.axis}</span></div>
      <div className="iq-axis">{q.axis}</div>
      <p className="iq-setup">{q.setup}</p>
      <h1 className="iq-stem">{q.stem}</h1>
      <div className="iq-opts">
        {opts.map((o, n) => {
          const isBest = o.points === best, isPick = n === picked;
          return (
            <button key={n} className={'iq-opt' + (revealed ? ' revealed' : '') + (revealed && isBest ? ' best' : '') + (isPick ? ' picked' : '')}
              disabled={revealed} onClick={() => onChoose(n)}>
              <span className="iq-fill" style={{ width: revealed ? o.consensus + '%' : 0 }} />
              <span className="iq-pct">{revealed ? o.consensus + '%' : ''}</span>
              <span className="iq-label">{o.text}{isPick && <span className="iq-you">YOU</span>}</span>
            </button>
          );
        })}
      </div>
      {revealed && <>
        <div className="iq-insight" dangerouslySetInnerHTML={{ __html: q.insight }} />
        <div className="iq-consnote">Consensus figures are illustrative until enough traders have taken this.</div>
        <button className="iq-next iq-show" onClick={onNext}>{i === Q.length - 1 ? 'See your result' : 'Next'}</button>
      </>}
    </div>
  );
}

function Result({ r, onAgain }) {
  const { score, rows, arche, topAxis } = r;
  return (
    <div className="iq-center">
      <div className="iq-kicker">Your trading instinct</div>
      <div className="iq-arche">{arche.name}</div>
      <p className="iq-arche-sub">{arche.line}</p>
      <div className="iq-score">{score}<span>/100</span></div>
      <div className="iq-bars">
        {rows.map((row, n) => (
          <div key={row.a} className={'iq-bar-row' + (n === 0 ? ' top' : '')}>
            <div className="iq-bar-top"><span>{row.a}</span><span>{row.pct}%</span></div>
            <div className="iq-bar"><i style={{ width: row.pct + '%' }} /></div>
          </div>
        ))}
      </div>
      <div className="iq-callout"><h3>Your strongest instinct — {topAxis.a}</h3><p>{arche.edge}</p></div>
      <div className="iq-callout"><h3>Your growth edge</h3><p>{arche.grow}</p></div>
      <p className="iq-footnote">Twelve questions is a conversation starter, not a measurement. The full NewLeaf assessment runs 40 questions across five dimensions and includes checks this version cannot make — including whether your rules hold up when you are losing, not just when you are winning.</p>
      <button className="iq-again" onClick={onAgain}>Take it again</button>
    </div>
  );
}

function median(xs) { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

const CSS = `
.iq{--forest:#16271C;--forest2:#1E3326;--forest3:#27412F;--gold:#B68F3E;--gold-lt:#E7D9AE;--cream:#F2ECDD;--card:#FBF8F0;--teal:#3E7C6A;
  --display:'Fraunces',Georgia,serif;--body:'DM Sans',system-ui,sans-serif;--mono:'Space Mono',monospace;
  background:var(--forest);color:var(--cream);font-family:var(--body);min-height:100vh;display:flex;justify-content:center;padding:32px 18px 80px}
.iq *{box-sizing:border-box}
.iq-stage{width:100%;max-width:600px}
.iq-kicker{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.iq-big{font-family:var(--display);font-size:34px;line-height:1.15;font-weight:600;margin:14px 0 16px;letter-spacing:-.02em}
.iq-lede{font-size:16px;line-height:1.65;color:#C9D6CC;max-width:460px;margin:0 auto 26px}
.iq-center{text-align:center}
.iq-ticks{display:flex;gap:5px;margin-bottom:18px}
.iq-tick{flex:1;height:3px;border-radius:2px;background:var(--forest3)}
.iq-tick.done{background:var(--gold)} .iq-tick.now{background:var(--gold-lt)}
.iq-meta{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;color:#8FA396;letter-spacing:.06em;margin-bottom:14px}
.iq-axis{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
.iq-setup{font-size:14.5px;line-height:1.6;color:#C9D6CC;margin-bottom:14px}
.iq-stem{font-family:var(--display);font-size:22px;line-height:1.32;font-weight:600;margin-bottom:20px}
.iq-opts{display:flex;flex-direction:column;gap:9px}
.iq-opt{position:relative;overflow:hidden;background:var(--card);color:#243027;border:none;border-radius:10px;padding:15px 17px;text-align:left;font-family:var(--body);font-size:15px;line-height:1.45;cursor:pointer;transition:transform .12s ease,box-shadow .18s ease}
.iq-opt:hover:not(:disabled){transform:translateX(3px);box-shadow:-3px 0 0 var(--gold)}
.iq-opt:disabled{cursor:default}
.iq-fill{position:absolute;inset:0 auto 0 0;height:100%;width:0;background:rgba(62,124,106,.20);transition:width .6s ease;z-index:0}
.iq-opt.best .iq-fill{background:rgba(62,124,106,.34)}
.iq-pct{position:relative;z-index:1;font-family:var(--mono);font-size:12px;color:#5c6f62;margin-right:10px}
.iq-label{position:relative;z-index:1}
.iq-opt.best .iq-label{font-weight:700}
.iq-you{display:inline-block;margin-left:8px;font-family:var(--mono);font-size:9px;letter-spacing:.1em;background:var(--teal);color:var(--cream);padding:2px 6px;border-radius:4px;vertical-align:middle}
.iq-insight{background:var(--forest2);border:1px solid var(--forest3);border-radius:10px;padding:15px 16px;margin-top:16px;font-size:14.5px;line-height:1.6;color:#D8E2DA}
.iq-insight b{color:var(--gold-lt)}
.iq-consnote{font-family:var(--mono);font-size:10px;color:#7C8F83;letter-spacing:.03em;margin-top:8px;text-align:center}
.iq-confq{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
.iq-conf{display:block;width:100%;text-align:left;background:var(--forest2);border:1px solid var(--forest3);color:var(--cream);border-radius:8px;padding:13px 16px;font-family:var(--body);font-size:14.5px;cursor:pointer;margin-bottom:8px}
.iq-conf:hover{border-color:var(--gold)}
.iq-next{border:none;border-radius:8px;padding:13px 26px;font-family:var(--body);font-weight:700;font-size:15px;cursor:pointer;margin-top:20px;background:var(--gold);color:var(--forest);opacity:0;transition:opacity .3s}
.iq-next.iq-show{opacity:1}
.iq-next:hover{background:var(--gold-lt)}
.iq-arche{font-family:var(--display);font-size:30px;font-weight:600;margin-top:14px}
.iq-arche-sub{font-size:15.5px;line-height:1.6;color:#C9D6CC;max-width:460px;margin:12px auto 0}
.iq-score{font-family:var(--display);font-size:40px;font-weight:600;color:var(--gold-lt);margin-top:22px}
.iq-score span{font-size:18px;color:#8FA396;margin-left:2px}
.iq-bars{margin:26px 0 8px;text-align:left}
.iq-bar-row{margin-bottom:11px}
.iq-bar-row.top .iq-bar i{background:var(--gold)}
.iq-bar-top{display:flex;justify-content:space-between;font-size:13px;color:#C9D6CC;margin-bottom:5px}
.iq-bar{height:8px;background:var(--forest3);border-radius:4px;overflow:hidden}
.iq-bar i{display:block;height:100%;width:0;background:var(--teal);transition:width .8s ease}
.iq-callout{text-align:left;background:var(--forest2);border:1px solid var(--forest3);border-radius:10px;padding:17px;margin-top:12px}
.iq-callout h3{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:400;margin-bottom:8px}
.iq-callout p{font-size:14.5px;line-height:1.6;color:#D8E2DA}
.iq-footnote{font-size:12.5px;line-height:1.6;color:#7C8F83;margin-top:24px;text-align:left}
.iq-again{background:none;border:1px solid var(--forest3);color:#8FA396;border-radius:8px;padding:11px 20px;font-family:var(--body);font-size:14px;cursor:pointer;margin-top:22px}
.iq-again:hover{border-color:var(--gold);color:var(--gold-lt)}
@media (max-width:480px){.iq-big{font-size:28px}.iq-stem{font-size:19px}.iq-arche{font-size:25px}}
`;
