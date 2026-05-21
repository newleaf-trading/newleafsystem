/**
 * Shared HTML/CSS diagram components for documentation pages.
 * Pure CSS — no images, no SVG libraries.
 */

// ═══════════════════════════════════════════════════════════════
// Arrow connector (horizontal)
// ═══════════════════════════════════════════════════════════════
export function Arrow({ color = '#C9A96E', label, vertical }) {
  if (vertical) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
        <div style={{ width: 2, height: 24, background: color }} />
        <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${color}` }} />
        {label && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 40 }}>
      <div style={{ flex: 1, height: 2, background: color }} />
      <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `8px solid ${color}` }} />
      {label && <div style={{ position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap' }}>{label}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pipeline flow (horizontal boxes connected by arrows)
// ═══════════════════════════════════════════════════════════════
export function PipelineFlow({ steps, arrowColor = '#C9A96E' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '16px 0', width: '100%',
      flexWrap: 'wrap', justifyContent: 'center', rowGap: 12,
    }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{
            background: step.bg || '#fff',
            border: `2px solid ${step.color || '#C9A96E'}`,
            borderRadius: step.round ? 12 : 10,
            padding: '10px 10px',
            textAlign: 'center',
            minWidth: 72, maxWidth: 100,
          }}>
            {step.icon && <div style={{ fontSize: 16, marginBottom: 1 }}>{step.icon}</div>}
            <div style={{ fontSize: 10, fontWeight: 700, color: step.color || '#0B2D23', letterSpacing: '.02em', lineHeight: 1.2 }}>{step.label}</div>
            {step.sub && <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 2, lineHeight: 1.2 }}>{step.sub}</div>}
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', width: 24, flexShrink: 0 }}>
              <div style={{ flex: 1, height: 2, background: arrowColor }} />
              <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${arrowColor}`, flexShrink: 0 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Vertical flow diagram
// ═══════════════════════════════════════════════════════════════
export function VerticalFlow({ steps, connectorColor = '#C9A96E' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            background: step.bg || `${step.color || '#C9A96E'}08`,
            border: `2px solid ${step.color || '#C9A96E'}30`,
            borderRadius: 14, padding: '14px 24px',
            minWidth: 200, textAlign: 'center',
          }}>
            {step.icon && <div style={{ fontSize: 20, marginBottom: 4 }}>{step.icon}</div>}
            <div style={{ fontSize: 13, fontWeight: 700, color: step.color || '#0B2D23' }}>{step.label}</div>
            {step.sub && <div style={{ fontSize: 11, color: '#6b6b60', marginTop: 4, lineHeight: 1.4 }}>{step.sub}</div>}
            {step.detail && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontFamily: "'Space Mono', monospace" }}>{step.detail}</div>}
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
              <div style={{ width: 2, height: 20, background: connectorColor }} />
              <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `7px solid ${connectorColor}` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Funnel diagram (wide → narrow)
// ═══════════════════════════════════════════════════════════════
export function FunnelDiagram({ stages }) {
  const maxWidth = 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0' }}>
      {stages.map((stage, i) => {
        const widthPct = maxWidth - (i * (maxWidth - 30) / (stages.length - 1));
        return (
          <div key={i} style={{
            width: `${widthPct}%`, padding: '10px 16px',
            background: `${stage.color}12`, border: `1px solid ${stage.color}25`,
            borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
            <span style={{ fontSize: 11, color: '#6b6b60' }}>{stage.value}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Decision tree (branching diagram)
// ═══════════════════════════════════════════════════════════════
export function DecisionTree({ root, branches }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '8px 0' }}>
      {/* Root node */}
      <div style={{
        background: `${root.color}12`, border: `2px solid ${root.color}`,
        borderRadius: 14, padding: '14px 28px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: root.color }}>{root.label}</div>
        {root.sub && <div style={{ fontSize: 11, color: '#6b6b60', marginTop: 2 }}>{root.sub}</div>}
      </div>

      {/* Connector lines */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, width: '100%' }}>
        <div style={{ position: 'relative', width: '100%', height: 32 }}>
          {/* Vertical trunk */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 16, background: '#C9A96E' }} />
          {/* Horizontal bar */}
          <div style={{
            position: 'absolute', top: 16,
            left: `${50 - (branches.length - 1) * 8}%`,
            right: `${50 - (branches.length - 1) * 8}%`,
            height: 2, background: '#C9A96E',
          }} />
          {/* Vertical drops */}
          {branches.map((_, i) => {
            const leftPct = branches.length === 1 ? 50 : (50 - (branches.length - 1) * 8) + i * (((branches.length - 1) * 16) / (branches.length - 1));
            return (
              <div key={i} style={{ position: 'absolute', left: `${leftPct}%`, top: 16, width: 2, height: 14, background: '#C9A96E' }}>
                <div style={{ position: 'absolute', bottom: -6, left: -4, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid #C9A96E` }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Branch nodes */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${branches.length}, 1fr)`, gap: 10, width: '100%' }}>
        {branches.map((branch, i) => (
          <div key={i} style={{
            background: `${branch.color}08`, border: `1.5px solid ${branch.color}25`,
            borderRadius: 12, padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: branch.color }}>{branch.label}</div>
            {branch.condition && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>{branch.condition}</div>}
            {branch.sub && <div style={{ fontSize: 10, color: '#6b6b60', marginTop: 4, lineHeight: 1.4 }}>{branch.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Merge diagram (multiple inputs → single output)
// ═══════════════════════════════════════════════════════════════
export function MergeDiagram({ inputs, output, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '8px 0', width: '100%' }}>
      {/* Input nodes */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${inputs.length}, 1fr)`, gap: 8, width: '100%' }}>
        {inputs.map((inp, i) => (
          <div key={i} style={{
            background: `${inp.color}10`, border: `2px solid ${inp.color}`,
            borderRadius: 10, padding: '10px 6px', textAlign: 'center', minWidth: 0,
          }}>
            {inp.icon && <div style={{ fontSize: 16, marginBottom: 1 }}>{inp.icon}</div>}
            <div style={{ fontSize: 10, fontWeight: 700, color: inp.color, wordBreak: 'break-word' }}>{inp.label}</div>
            {inp.detail && <div style={{ fontSize: 9, color: '#6b6b60', marginTop: 2 }}>{inp.detail}</div>}
          </div>
        ))}
      </div>

      {/* Merge lines */}
      <div style={{ position: 'relative', width: '100%', height: 32 }}>
        {inputs.map((_, i) => {
          const leftPct = (100 / inputs.length) * i + (100 / inputs.length / 2);
          return (
            <div key={i} style={{ position: 'absolute', left: `${leftPct}%`, top: 0, width: 2, height: 16, background: '#C9A96E', transform: 'translateX(-1px)' }} />
          );
        })}
        <div style={{ position: 'absolute', top: 14, left: `${100 / inputs.length / 2}%`, right: `${100 / inputs.length / 2}%`, height: 2, background: '#C9A96E' }} />
        <div style={{ position: 'absolute', left: '50%', top: 14, width: 2, height: 12, background: '#C9A96E', transform: 'translateX(-1px)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 24, transform: 'translateX(-5px)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #C9A96E' }} />
      </div>

      {label && <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>}

      {/* Output node */}
      <div style={{
        background: `${output.color}12`, border: `2px solid ${output.color}`,
        borderRadius: 14, padding: '14px 32px', textAlign: 'center',
      }}>
        {output.icon && <div style={{ fontSize: 20, marginBottom: 2 }}>{output.icon}</div>}
        <div style={{ fontSize: 14, fontWeight: 700, color: output.color }}>{output.label}</div>
        {output.detail && <div style={{ fontSize: 11, color: '#6b6b60', marginTop: 4 }}>{output.detail}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Score bar (visual bar chart with labeled segments)
// ═══════════════════════════════════════════════════════════════
export function ScoreBar({ segments, total, height = 32 }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height, border: '1px solid rgba(17,24,39,0.08)' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{
            width: `${(seg.value / total) * 100}%`, background: seg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {seg.label} ({seg.value})
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#0B2D23' }}>
          Total: {total}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cascade / waterfall (tier fallback)
// ═══════════════════════════════════════════════════════════════
export function CascadeDiagram({ tiers }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {tiers.map((tier, i) => (
        <div key={i}>
          <div style={{
            display: 'flex', alignItems: 'stretch', gap: 0,
            marginLeft: i * 32,
          }}>
            {/* Badge */}
            <div style={{
              background: tier.color, color: '#fff',
              borderRadius: '10px 0 0 10px', padding: '12px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 44, fontWeight: 700, fontSize: 14,
            }}>
              {tier.tier}
            </div>
            {/* Content */}
            <div style={{
              flex: 1, background: `${tier.color}08`,
              border: `1.5px solid ${tier.color}25`, borderLeft: 'none',
              borderRadius: '0 10px 10px 0', padding: '10px 16px',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0B2D23' }}>{tier.label}</div>
              <div style={{ fontSize: 11, color: '#6b6b60', marginTop: 2 }}>{tier.description}</div>
            </div>
          </div>
          {i < tiers.length - 1 && (
            <div style={{ marginLeft: (i + 1) * 32 - 10, padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#C94F4F', fontSize: 10, fontWeight: 600 }}>
                <span style={{ display: 'inline-block', width: 12, height: 2, background: '#C94F4F' }} />
                miss
                <span style={{ display: 'inline-block', width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid #C94F4F' }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Architecture box diagram (labeled box with sub-sections)
// ═══════════════════════════════════════════════════════════════
export function ArchitectureBox({ title, titleColor = '#0B2D23', sections, borderColor = '#C9A96E' }) {
  return (
    <div style={{
      border: `2px solid ${borderColor}`, borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        background: `${borderColor}15`, padding: '10px 18px',
        borderBottom: `1px solid ${borderColor}30`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: titleColor }}>{title}</div>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.map((sec, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: `${sec.color || '#6b7280'}08`,
            border: `1px solid ${sec.color || '#6b7280'}15`,
          }}>
            {sec.icon && <span style={{ fontSize: 16 }}>{sec.icon}</span>}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: sec.color || '#0B2D23' }}>{sec.label}</div>
              {sec.detail && <div style={{ fontSize: 10, color: '#6b6b60' }}>{sec.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
