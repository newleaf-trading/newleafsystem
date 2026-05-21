function fmt(n, d = 2) { return n != null ? Number(n).toFixed(d) : '—' }

export default function CondorPanel({ data }) {
  if (!data) return null
  const { condor_allowed, decision, ticker, position_in_band_pct: pos } = data
  const { summary, reasons = [], notes = [], suggestedStrikes } = decision ?? {}

  const insight = pos < 25
    ? `${ticker} is trading near the lower edge of the gamma band. Condor entry is currently not preferred.`
    : pos > 75
    ? `${ticker} is trading near the upper edge of the gamma band. Condor entry is currently not preferred.`
    : `${ticker} is well-centred within the gamma band. Conditions look favourable for a condor.`

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-4
      ${condor_allowed ? 'bg-green-950/30 border-green-800/40' : 'bg-red-950/30 border-red-800/40'}`}>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-xl font-semibold flex items-center gap-2
            ${condor_allowed ? 'text-green-400' : 'text-red-400'}`}>
            {condor_allowed ? '✓ Condor Allowed' : '✗ Condor Blocked'}
          </div>
          <div className="text-sm text-[#94a3b8] mt-1">{summary}</div>
        </div>
        {data.confidence_score != null && (
          <div className={`text-2xl num font-semibold ${condor_allowed ? 'text-green-400' : 'text-red-400'}`}>
            {(data.confidence_score * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <div className="bg-[#0f172a]/60 rounded-lg px-4 py-3 text-sm text-[#94a3b8] border border-[#1e3a5f]">
        💡 {insight}
      </div>

      {reasons.length > 0 && (
        <div>
          <div className="text-[10px] tracking-widest text-[#475569] uppercase font-mono mb-2">Blocked Because</div>
          <div className="flex flex-col gap-2">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#0f172a]/40 rounded-lg px-3 py-2.5">
                <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                <div>
                  <span className="text-xs font-medium text-red-300 font-mono">{r.rule}</span>
                  <p className="text-xs text-[#94a3b8] mt-0.5">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <div className="text-[10px] tracking-widest text-[#475569] uppercase font-mono mb-2">Notes</div>
          {notes.map((n, i) => (
            <div key={i} className="text-xs text-[#94a3b8] flex items-start gap-2">
              <span className="text-blue-400">•</span>{n}
            </div>
          ))}
        </div>
      )}

      {suggestedStrikes && (
        <div>
          <div className="text-[10px] tracking-widest text-[#475569] uppercase font-mono mb-2">Suggested Strikes</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(suggestedStrikes).map(([k, v]) => (
              <div key={k} className="bg-[#0f172a]/60 rounded-lg px-3 py-2 flex justify-between items-center border border-green-900/40">
                <span className="text-[10px] text-[#64748b] uppercase font-mono">{k.replace(/_/g, ' ')}</span>
                <span className="num text-green-400 text-sm font-medium">${fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
