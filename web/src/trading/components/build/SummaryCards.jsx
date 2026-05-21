/**
 * SummaryCards — 5 portfolio-level summary cards for the Build page.
 * Expected Profit, Scenario, Max Gain, Max Risk, Risk Budget.
 */
import { formatScenarioText } from '../../lib/build/allocationMath';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '--';
  const abs = Math.abs(Math.round(v));
  return (v >= 0 ? '+' : '-') + '$' + abs.toLocaleString();
};

export function SummaryCards({ stats, totalCapital, riskBudget }) {
  const scenarioText = formatScenarioText(stats.expectedWinners, stats.count);

  const cards = [
    {
      label: 'Expected Profit',
      value: stats.count > 0 ? fmt(stats.totalExpectedProfit) : '--',
      subtitle: 'per monthly cycle (EV-based)',
      accent: stats.totalExpectedProfit >= 0 ? 'green' : 'red',
    },
    {
      label: 'Scenario',
      value: stats.count > 0 ? scenarioText : '--',
      subtitle: `avg ${(stats.avgWinRate || 0).toFixed(0)}% probability`,
      accent: 'gold',
    },
    {
      label: 'Max Gain',
      value: stats.count > 0 ? `$${stats.totalPotentialReturn.toLocaleString()}` : '--',
      subtitle: 'if all strategies hit max',
    },
    {
      label: 'Max Risk',
      value: stats.count > 0 ? `$${stats.totalMaxRisk.toLocaleString()}` : '--',
      subtitle: `${totalCapital > 0 ? ((stats.totalMaxRisk / totalCapital) * 100).toFixed(1) : 0}% of risk budget`,
    },
    {
      label: 'Risk Budget',
      value: `$${(totalCapital || 0).toLocaleString()}`,
      subtitle: `max ${((riskBudget / (totalCapital || 1)) * 100).toFixed(0)}% drawdown`,
    },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24,
    }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          background: '#fff',
          border: `1px solid ${i < 2 ? 'rgba(201,169,110,0.25)' : 'rgba(17,24,39,0.10)'}`,
          borderRadius: 14, padding: 16,
          ...(i < 2 ? { background: 'linear-gradient(135deg, rgba(201,169,110,0.04), rgba(255,255,255,1))' } : {}),
        }}>
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase',
            color: i < 2 ? '#C9A96E' : 'rgba(17,24,39,0.55)', marginBottom: 8,
          }}>
            {card.label}
          </div>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700,
            color: card.accent === 'red' ? '#C94F4F' : card.accent === 'green' ? '#0B7A52' : '#111827',
            marginBottom: 4, letterSpacing: '-0.3px',
          }}>
            {card.value}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(17,24,39,0.55)' }}>
            {card.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}
