/**
 * BuildTradeModal.jsx
 * NewLeaf design system — inline styles, no Tailwind dependency
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X, CheckCircle, AlertCircle, Loader2, Hammer, ChevronRight,
  Globe, Database, Cpu, Server, Zap
} from 'lucide-react';
import { createTileTask, getTaskStatus } from '../../api/tilesApi';

const NL_GREEN  = '#0B2D23';
const NL_GOLD   = '#C9A96E';
const NL_BORDER = '#e8eaed';

// ── Pipeline stages with full explanation ──────────────────────────
const PIPELINE_STAGES = [
  {
    id: 'queued',
    label: 'Queued',
    icon: Server,
    color: '#6b7280',
    activeColor: NL_GREEN,
    duration: '< 10s',
    destination: 'Firestore → API Gateway worker',
    description: 'Task written to Firestore. The tile worker (running inside API Gateway on :4000) picks it up within 10 seconds.',
  },
  {
    id: 'researching',
    label: 'Researching',
    icon: Cpu,
    color: '#6b7280',
    activeColor: '#2563eb',
    duration: '3 – 5 min',
    destination: 'Claude CLI → IB Gateway :5001 + Web Search',
    description: 'Claude CLI runs a full research session: web search for earnings/news, IB Gateway for live strikes & greeks across 3 expiries, strategy evaluation across iron condor / spreads, quality gates (R:R ≥ 1.0×, PoP ≥ 65%), then writes a research JSON.',
    steps: [
      { icon: Globe,    label: 'Web search',       detail: 'Earnings date, news, analyst sentiment' },
      { icon: Database, label: 'IB options data',  detail: 'Live strikes, bid/ask, greeks via :5001' },
      { icon: Zap,      label: 'Strategy eval',    detail: 'Multi-expiry × multi-strategy scoring' },
    ]
  },
  {
    id: 'building',
    label: 'Building',
    icon: Database,
    color: '#6b7280',
    activeColor: NL_GOLD,
    duration: '15 – 30s',
    destination: 'stage2-execute.cjs → Firestore newleafdb',
    description: 'stage2-execute.cjs reads the research JSON, validates all quality rules, builds the tile + analysis documents, and pushes to Firestore. The tile appears on Discover immediately after.',
  },
];

export default function BuildTradeModal({
  isOpen, onClose,
  defaultSymbol, defaultDirection,
  defaultDteMin, defaultDteMax,
}) {
  const [symbol,     setSymbol]     = useState(defaultSymbol    || '');
  const [direction,  setDirection]  = useState(defaultDirection || 'neutral');
  const [strategy,   setStrategy]   = useState('auto');
  const [dteMin,     setDteMin]     = useState(defaultDteMin    || 20);
  const [dteMax,     setDteMax]     = useState(defaultDteMax    || 60);
  const [showPipeline, setShowPipeline] = useState(false);

  const [phase,      setPhase]      = useState('configure');
  const [taskId,     setTaskId]     = useState(null);
  const [task,       setTask]       = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [elapsed,    setElapsed]    = useState(0);
  const startTimeRef = useRef(null);
  const pollRef      = useRef(null);
  const timerRef     = useRef(null);
  const logRef       = useRef(null);

  // ── Elapsed timer ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'progress' && task?.status === 'researching') {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, task?.status]);

  // ── Polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'progress' || !taskId) return;
    const poll = async () => {
      try {
        const t = await getTaskStatus(taskId);
        setTask(t);
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        if (t.status === 'completed' || t.status === 'failed') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [phase, taskId]);

  // ── Reset on open ────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setSymbol(defaultSymbol || '');
      setDirection(defaultDirection || 'neutral');
      setStrategy('auto');
      setDteMin(defaultDteMin || 20);
      setDteMax(defaultDteMax || 60);
      setPhase('configure');
      setTaskId(null);
      setTask(null);
      setError(null);
      setSubmitting(false);
      setElapsed(0);
      setShowPipeline(false);
      startTimeRef.current = null;
    } else {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    }
  }, [isOpen, defaultSymbol, defaultDirection, defaultDteMin, defaultDteMax]);

  const handleStart = async () => {
    if (!symbol) return;
    setSubmitting(true);
    setError(null);
    try {
      const opts = { dteMin, dteMax };
      if (strategy !== 'auto') opts.strategy = strategy;
      const result = await createTileTask(symbol.toUpperCase(), direction, opts);
      setTaskId(result.taskId);
      setPhase('progress');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // ── Step helpers ─────────────────────────────────────────────────
  const activeStepIdx = task
    ? PIPELINE_STAGES.findIndex(s => s.id === task.status)
    : -1;

  const stepIsDone = (i) =>
    task?.status === 'completed' ||
    (activeStepIdx > i);

  const stepIsActive = (i) =>
    activeStepIdx === i &&
    task?.status !== 'completed' &&
    task?.status !== 'failed';

  const fmtElapsed = (s) => s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  return (
    <>
      {/* ── Overlay ── */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.40)',
        backdropFilter: 'blur(3px)',
      }} />

      {/* ── Modal ── */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        width: '100%', maxWidth: 760,
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.20)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px 18px',
          borderBottom: `1px solid ${NL_BORDER}`,
          background: 'linear-gradient(135deg, rgba(11, 45, 35,0.03) 0%, rgba(201, 169, 110,0.04) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: NL_GREEN,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(11, 45, 35,0.3)',
            }}>
              <Hammer size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700, color: '#0f1117' }}>
                Build Trade
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                {phase === 'configure'
                  ? `AI-powered research → live IB data → Discover`
                  : `Task ${taskId}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {phase === 'configure' ? (
            <div style={{ display: 'flex', gap: 28 }}>

              {/* LEFT — Form */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={labelStyle}>Symbol</label>
                  <input
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. NVDA"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Direction</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { val: 'bullish', label: '↑ Bullish', color: '#16a34a' },
                      { val: 'neutral', label: '↔ Neutral', color: NL_GREEN  },
                      { val: 'bearish', label: '↓ Bearish', color: '#dc2626' },
                    ].map(({ val, label, color }) => (
                      <button key={val} onClick={() => setDirection(val)} style={{
                        flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13,
                        fontWeight: direction === val ? 700 : 500,
                        border: direction === val ? `2px solid ${color}` : `1.5px solid ${NL_BORDER}`,
                        background: direction === val ? color : '#fafafa',
                        color: direction === val ? '#fff' : '#374151',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Strategy</label>
                  <select value={strategy} onChange={e => setStrategy(e.target.value)} style={inputStyle}>
                    <option value="auto">Auto-select (recommended)</option>
                    <option value="iron condor">Iron Condor</option>
                    <option value="bull put spread">Bull Put Spread</option>
                    <option value="bear call spread">Bear Call Spread</option>
                    <option value="bull call spread">Bull Call Spread</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>DTE Min</label>
                    <input type="number" value={dteMin}
                      onChange={e => setDteMin(parseInt(e.target.value) || 20)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>DTE Max</label>
                    <input type="number" value={dteMax}
                      onChange={e => setDteMax(parseInt(e.target.value) || 60)}
                      style={inputStyle} />
                  </div>
                </div>

                {error && (
                  <div style={{
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 10, padding: '12px 16px',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: '#b91c1c' }}>{error}</span>
                  </div>
                )}
              </div>

              {/* RIGHT — Pipeline preview */}
              <div style={{
                width: 280, flexShrink: 0,
                background: '#f8f9fb',
                borderRadius: 14,
                border: `1px solid ${NL_BORDER}`,
                padding: '18px 20px',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  marginBottom: 14,
                }}>
                  What happens when you click "Start Research"
                </div>

                {PIPELINE_STAGES.map((stage, i) => {
                  const Icon = stage.icon;
                  return (
                    <div key={stage.id}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: stage.activeColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Icon size={16} color="#fff" />
                          </div>
                          {i < PIPELINE_STAGES.length - 1 && (
                            <div style={{ width: 2, flex: 1, minHeight: 20, background: NL_BORDER, margin: '4px 0' }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: i < PIPELINE_STAGES.length - 1 ? 16 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{stage.label}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: stage.activeColor,
                              background: `${stage.activeColor}15`,
                              padding: '1px 6px', borderRadius: 4,
                            }}>{stage.duration}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.5 }}>
                            {stage.description}
                          </div>
                          {stage.steps && (
                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {stage.steps.map((s, j) => {
                                const SIcon = s.icon;
                                return (
                                  <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <SIcon size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, color: '#374151' }}>
                                      <strong>{s.label}</strong> — {s.detail}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{
                  marginTop: 14, padding: '10px 12px',
                  background: 'rgba(11, 45, 35,0.06)',
                  borderRadius: 8, fontSize: 11,
                  color: NL_GREEN, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <CheckCircle size={13} />
                  Total: ~4–6 min end-to-end
                </div>
              </div>
            </div>

          ) : (
            // ── PHASE 2: Progress ─────────────────────────────────
            <div style={{ display: 'flex', gap: 28 }}>

              {/* LEFT — stepper + log */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Stepper */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {PIPELINE_STAGES.map((stage, i) => (
                    <React.Fragment key={stage.id}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: stepIsDone(i)
                            ? NL_GREEN
                            : stepIsActive(i)
                            ? stage.activeColor
                            : '#e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: stepIsActive(i) ? `3px solid ${NL_GOLD}` : '3px solid transparent',
                          transition: 'all 0.3s',
                          boxShadow: stepIsActive(i) ? `0 0 0 4px ${stage.activeColor}22` : 'none',
                        }}>
                          {stepIsActive(i) ? (
                            <Loader2 size={20} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                          ) : stepIsDone(i) ? (
                            <CheckCircle size={20} color="#fff" />
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: 14, fontWeight: 700 }}>{i + 1}</span>
                          )}
                        </div>
                        <span style={{
                          marginTop: 6, fontSize: 11, fontWeight: 700,
                          color: stepIsDone(i) || stepIsActive(i) ? NL_GREEN : '#9ca3af',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {stage.label}
                        </span>
                        <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                          {stage.duration}
                        </span>
                      </div>
                      {i < 2 && (
                        <div style={{
                          flex: 1, height: 2, margin: '0 2px', marginBottom: 28,
                          background: stepIsDone(i) ? NL_GREEN : '#e5e7eb',
                          transition: 'background 0.4s',
                        }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Current status card */}
                <div style={{
                  background: task?.status === 'completed' ? 'rgba(22,163,74,0.05)'
                    : task?.status === 'failed' ? '#fef2f2'
                    : 'rgba(11, 45, 35,0.04)',
                  border: `1.5px solid ${task?.status === 'completed' ? '#bbf7d0' : task?.status === 'failed' ? '#fecaca' : NL_BORDER}`,
                  borderRadius: 12, padding: '14px 18px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Current Status
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {task?.status === 'completed' ? (
                      <CheckCircle size={18} color="#16a34a" />
                    ) : task?.status === 'failed' ? (
                      <AlertCircle size={18} color="#dc2626" />
                    ) : (
                      <Loader2 size={18} color={NL_GREEN}
                        style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        color: task?.status === 'completed' ? '#16a34a'
                          : task?.status === 'failed' ? '#dc2626' : NL_GREEN,
                      }}>
                        {!task                        && 'Initialising...'}
                        {task?.status === 'queued'      && 'Waiting for worker to pick up task...'}
                        {task?.status === 'researching' && 'Claude CLI is researching options data...'}
                        {task?.status === 'building'    && 'Pushing tile to Firestore...'}
                        {task?.status === 'completed'   && '🎉 Trade built and live on Discover!'}
                        {task?.status === 'failed'      && 'Build failed'}
                      </div>
                      {task?.status === 'researching' && elapsed > 0 && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                          Elapsed: {fmtElapsed(elapsed)} — expect 3–5 min total
                        </div>
                      )}
                      {task?.status === 'failed' && (
                        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                          {task.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Log */}
                {task?.log?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Activity Log
                    </div>
                    <div ref={logRef} style={{
                      background: '#0d1117', borderRadius: 10, padding: '14px 16px',
                      maxHeight: 160, overflowY: 'auto',
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, lineHeight: 1.7,
                    }}>
                      {task.log.map((entry, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10 }}>
                          <span style={{ color: '#4b5563', flexShrink: 0, minWidth: 64 }}>
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          <span style={{
                            color: entry.message.includes('✅') ? '#4ade80'
                              : entry.message.includes('❌') ? '#f87171'
                              : '#94d2bd',
                          }}>
                            {entry.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed tile card */}
                {task?.status === 'completed' && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(11, 45, 35,0.08), rgba(201, 169, 110,0.08))',
                    border: `2px solid ${NL_GREEN}`, borderRadius: 14, padding: '18px 22px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CheckCircle size={24} color={NL_GREEN} />
                      <div>
                        <div style={{ fontWeight: 700, color: NL_GREEN, fontSize: 15 }}>
                          Tile is live on Discover
                        </div>
                        <div style={{
                          fontSize: 12, fontFamily: 'IBM Plex Mono, monospace',
                          color: '#6b7280', marginTop: 4,
                        }}>
                          {task.resultTileId}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT — active stage explanation */}
              <div style={{ width: 260, flexShrink: 0 }}>
                {PIPELINE_STAGES.map((stage, i) => {
                  if (!stepIsActive(i) && !(task?.status === 'completed' && i === 2)) return null;
                  const Icon = stage.icon;
                  return (
                    <div key={stage.id} style={{
                      background: '#f8f9fb', borderRadius: 14,
                      border: `1.5px solid ${stage.activeColor}40`,
                      padding: '18px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: task?.status === 'completed' ? NL_GREEN : stage.activeColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {task?.status === 'completed'
                            ? <CheckCircle size={18} color="#fff" />
                            : <Icon size={18} color="#fff" />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>
                            {stage.label}
                          </div>
                          <div style={{
                            fontSize: 10, fontWeight: 700,
                            color: stage.activeColor,
                            background: `${stage.activeColor}15`,
                            padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 2,
                          }}>
                            {stage.duration}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: 11, fontWeight: 700, color: '#6b7280',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                      }}>
                        Destination
                      </div>
                      <div style={{
                        fontSize: 11, color: '#374151', fontFamily: 'IBM Plex Mono, monospace',
                        background: '#fff', border: `1px solid ${NL_BORDER}`,
                        borderRadius: 6, padding: '6px 10px', marginBottom: 12,
                      }}>
                        {stage.destination}
                      </div>

                      <div style={{
                        fontSize: 11, fontWeight: 700, color: '#6b7280',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                      }}>
                        What's happening
                      </div>
                      <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>
                        {stage.description}
                      </div>

                      {stage.steps && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {stage.steps.map((s, j) => {
                            const SIcon = s.icon;
                            return (
                              <div key={j} style={{
                                display: 'flex', gap: 8, alignItems: 'flex-start',
                                background: '#fff', borderRadius: 8,
                                border: `1px solid ${NL_BORDER}`, padding: '7px 10px',
                              }}>
                                <SIcon size={13} color={stage.activeColor} style={{ flexShrink: 0, marginTop: 1 }} />
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>{s.label}</div>
                                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{s.detail}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {task?.status === 'researching' && elapsed > 0 && (
                        <div style={{
                          marginTop: 14, padding: '10px 12px',
                          background: `${stage.activeColor}10`,
                          borderRadius: 8,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <Loader2 size={13} color={stage.activeColor}
                            style={{ animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: 11, color: stage.activeColor, fontWeight: 600 }}>
                            {fmtElapsed(elapsed)} elapsed
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Fallback when status not in active stages */}
                {task && !PIPELINE_STAGES.some((s, i) => stepIsActive(i)) && task.status !== 'completed' && (
                  <div style={{
                    background: '#f8f9fb', borderRadius: 14,
                    border: `1.5px solid ${NL_BORDER}`, padding: '18px 20px',
                    fontSize: 12, color: '#6b7280',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: '#374151' }}>
                      {task.status === 'failed' ? '❌ Build failed' : 'Initialising pipeline...'}
                    </div>
                    {task.error && <div style={{ color: '#dc2626', fontSize: 11 }}>{task.error}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px', borderTop: `1px solid ${NL_BORDER}`,
          background: '#fafafa',
        }}>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {phase === 'configure'
              ? 'Quality gates: R:R ≥ 1.0× · PoP ≥ 65% · Real IB conids'
              : task?.status === 'researching'
              ? `🔬 Claude CLI running on API Gateway — polling every 3s`
              : task?.status === 'building'
              ? '📦 stage2-execute.cjs → Firestore newleafdb'
              : task?.status === 'completed'
              ? `✅ Tile live · Task ${taskId}`
              : `Task ${taskId || '—'}`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {phase === 'configure' ? (
              <>
                <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                <button
                  onClick={handleStart}
                  disabled={!symbol || submitting}
                  style={{
                    ...primaryBtnStyle,
                    opacity: (!symbol || submitting) ? 0.5 : 1,
                    cursor: (!symbol || submitting) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {submitting
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Starting...</>
                    : <><Hammer size={15} /> Start Research</>}
                </button>
              </>
            ) : (
              <>
                {task?.status === 'failed' && (
                  <button onClick={() => { setPhase('configure'); setTask(null); setTaskId(null); setElapsed(0); startTimeRef.current = null; }} style={cancelBtnStyle}>
                    Try Again
                  </button>
                )}
                {task?.status === 'completed' && (
                  <button onClick={() => window.location.href = '/discover'} style={{
                    ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    View on Discover <ChevronRight size={15} />
                  </button>
                )}
                <button onClick={onClose} style={cancelBtnStyle}>Close</button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#374151', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14,
  color: '#1a1a1a', background: '#fafafa', outline: 'none',
  fontFamily: 'inherit',
};

const cancelBtnStyle = {
  padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151',
  cursor: 'pointer',
};

const primaryBtnStyle = {
  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
  border: 'none', background: NL_GREEN, color: '#fff', cursor: 'pointer',
};
