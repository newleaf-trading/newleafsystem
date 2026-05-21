import React, { useMemo, useRef, useState } from 'react';
import { generatePnLData, calculateMetrics, getUnderlyingPrice } from '../utils/optionsCalc';

/**
 * Pure SVG P&L Chart - no recharts dependency issues
 */
export function PnLChart({ tile, currentPrice: livePriceOverride }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const rawData = useMemo(() => {
    if (!tile || !tile.legs || tile.legs.length === 0) return [];
    const data = generatePnLData(tile);
    console.log('[PnLChart] Generated data points:', data.length, 'Sample:', data.slice(0, 3), 'Max:', Math.max(...data.map(d => d.pnl)), 'Min:', Math.min(...data.map(d => d.pnl)));
    return data;
  }, [tile]);

  const metrics = useMemo(() => {
    if (!tile) return { maxProfit: 0, maxLoss: 0, breakevens: [] };
    return calculateMetrics(tile);
  }, [tile]);

  const currentPrice = useMemo(() => {
    // Use live price override if provided, otherwise fall back to tile data
    return livePriceOverride || getUnderlyingPrice(tile);
  }, [livePriceOverride, tile]);

  if (rawData.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No P&L data available</div>;
  }

  // Chart dimensions
  const width = 800;
  const height = 320;
  const margin = { top: 30, right: 50, bottom: 50, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  // Data ranges
  const prices = rawData.map(d => d.price);
  const pnls = rawData.map(d => d.pnl);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minPnl = Math.min(...pnls);
  const maxPnl = Math.max(...pnls);

  // Add padding to Y axis
  const yPad = Math.max(Math.abs(maxPnl), Math.abs(minPnl)) * 0.15;
  const yMin = minPnl - yPad;
  const yMax = maxPnl + yPad;

  // Scale functions
  const xScale = (price) => margin.left + ((price - minPrice) / (maxPrice - minPrice)) * chartW;
  const yScale = (pnl) => margin.top + chartH - ((pnl - yMin) / (yMax - yMin)) * chartH;
  const zeroY = yScale(0);

  // Build the P&L path
  const linePath = rawData.map((d, i) => {
    const x = xScale(d.price);
    const y = yScale(d.pnl);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Build profit fill area (above zero)
  const profitPath = (() => {
    let path = `M ${xScale(rawData[0].price)} ${zeroY}`;
    rawData.forEach(d => {
      const y = d.pnl > 0 ? yScale(d.pnl) : zeroY;
      path += ` L ${xScale(d.price)} ${y}`;
    });
    path += ` L ${xScale(rawData[rawData.length - 1].price)} ${zeroY} Z`;
    return path;
  })();

  // Build loss fill area (below zero)
  const lossPath = (() => {
    let path = `M ${xScale(rawData[0].price)} ${zeroY}`;
    rawData.forEach(d => {
      const y = d.pnl < 0 ? yScale(d.pnl) : zeroY;
      path += ` L ${xScale(d.price)} ${y}`;
    });
    path += ` L ${xScale(rawData[rawData.length - 1].price)} ${zeroY} Z`;
    return path;
  })();

  // Breakeven points
  const breakevens = [];
  for (let i = 1; i < rawData.length; i++) {
    const prev = rawData[i - 1];
    const curr = rawData[i];
    if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl > 0 && curr.pnl <= 0)) {
      const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
      const bePrice = prev.price + ratio * (curr.price - prev.price);
      breakevens.push(bePrice);
    }
  }

  // Y-axis ticks
  const yTickCount = 6;
  const yTickStep = (yMax - yMin) / yTickCount;
  const yTicks = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(yMin + i * yTickStep);
  }

  // X-axis ticks
  const xTickCount = 8;
  const xTickStep = (maxPrice - minPrice) / xTickCount;
  const xTicks = [];
  for (let i = 0; i <= xTickCount; i++) {
    xTicks.push(minPrice + i * xTickStep);
  }

  // Mouse handler for tooltip
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const price = minPrice + ((mouseX - margin.left) / chartW) * (maxPrice - minPrice);
    
    // Find closest data point
    let closest = rawData[0];
    let closestDist = Infinity;
    for (const d of rawData) {
      const dist = Math.abs(d.price - price);
      if (dist < closestDist) {
        closestDist = dist;
        closest = d;
      }
    }
    
    if (mouseX >= margin.left && mouseX <= width - margin.right) {
      setTooltip({
        x: xScale(closest.price),
        y: yScale(closest.pnl),
        price: closest.price,
        pnl: closest.pnl
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: '1.05em', fontWeight: 600, marginBottom: 16 }}>Profit & Loss at Expiration</h3>
      <div style={{ 
        background: 'white', 
        border: '1px solid #e2e8f0', 
        borderRadius: 12, 
        padding: '16px 8px',
        position: 'relative'
      }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', maxHeight: 360 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={`yg-${i}`}
              x1={margin.left}
              y1={yScale(tick)}
              x2={width - margin.right}
              y2={yScale(tick)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
          ))}
          {xTicks.map((tick, i) => (
            <line
              key={`xg-${i}`}
              x1={xScale(tick)}
              y1={margin.top}
              x2={xScale(tick)}
              y2={height - margin.bottom}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
          ))}

          {/* Zero line (dashed) */}
          {yMin < 0 && yMax > 0 && (
            <line
              x1={margin.left}
              y1={zeroY}
              x2={width - margin.right}
              y2={zeroY}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}

          {/* Profit fill (green) */}
          <path d={profitPath} fill="#0B2D23" fillOpacity={0.1} />

          {/* Loss fill (red) */}
          <path d={lossPath} fill="#ef4444" fillOpacity={0.1} />

          {/* P&L line - draw green segment above zero, red below */}
          {rawData.map((d, i) => {
            if (i === 0) return null;
            const prev = rawData[i - 1];
            const x1 = xScale(prev.price);
            const y1 = yScale(prev.pnl);
            const x2 = xScale(d.price);
            const y2 = yScale(d.pnl);
            // Use green if both points are profit, red if both loss, green otherwise
            const color = (prev.pnl >= 0 && d.pnl >= 0) ? '#0B2D23' 
                        : (prev.pnl < 0 && d.pnl < 0) ? '#ef4444' 
                        : '#64748b';
            return (
              <line
                key={`seg-${i}`}
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Current price vertical line */}
          {currentPrice > minPrice && currentPrice < maxPrice && (
            <>
              <line
                x1={xScale(currentPrice)}
                y1={margin.top}
                x2={xScale(currentPrice)}
                y2={height - margin.bottom}
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text
                x={xScale(currentPrice)}
                y={margin.top - 8}
                textAnchor="middle"
                fill="#3b82f6"
                fontSize={10}
                fontWeight={600}
              >
                Current: ${Math.round(currentPrice)}
              </text>
            </>
          )}

          {/* Breakeven dots */}
          {breakevens.map((be, i) => (
            <g key={`be-${i}`}>
              <line
                x1={xScale(be)}
                y1={margin.top}
                x2={xScale(be)}
                y2={height - margin.bottom}
                stroke="#f59e0b"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <circle
                cx={xScale(be)}
                cy={zeroY}
                r={6}
                fill="#f59e0b"
                stroke="white"
                strokeWidth={2}
              />
            </g>
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <text
              key={`yl-${i}`}
              x={margin.left - 8}
              y={yScale(tick) + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize={10}
            >
              ${Math.round(tick).toLocaleString()}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((tick, i) => (
            <text
              key={`xl-${i}`}
              x={xScale(tick)}
              y={height - margin.bottom + 18}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={10}
            >
              ${Math.round(tick)}
            </text>
          ))}

          {/* Axis labels */}
          <text
            x={width / 2}
            y={height - 8}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={12}
          >
            Stock Price at Expiration
          </text>
          <text
            x={15}
            y={height / 2}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={12}
            transform={`rotate(-90, 15, ${height / 2})`}
          >
            Profit / Loss ($)
          </text>

          {/* Tooltip crosshair and dot */}
          {tooltip && (
            <>
              <line
                x1={tooltip.x}
                y1={margin.top}
                x2={tooltip.x}
                y2={height - margin.bottom}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={0.5}
              />
              <circle
                cx={tooltip.x}
                cy={tooltip.y}
                r={5}
                fill={tooltip.pnl >= 0 ? '#0B2D23' : '#ef4444'}
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100 - 12}%`,
            transform: 'translate(-50%, -100%)',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: '0.8em',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>
            <div style={{ color: '#64748b', fontSize: '0.85em' }}>
              Stock: ${tooltip.price.toFixed(2)}
            </div>
            <div style={{ 
              color: tooltip.pnl >= 0 ? '#0B2D23' : '#ef4444', 
              fontWeight: 700 
            }}>
              P&L: {tooltip.pnl >= 0 ? '+' : ''}${tooltip.pnl.toLocaleString()}
            </div>
          </div>
        )}

        {/* Annotations */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 24px 0',
          fontSize: '0.78em'
        }}>
          <span style={{ color: '#0B2D23', fontWeight: 600 }}>
            ● Max Profit: ${maxPnl.toLocaleString()}
          </span>
          {breakevens.length > 0 && (
            <span style={{ color: '#d97706', fontWeight: 600 }}>
              ● Breakevens: {breakevens.map(b => `$${b.toFixed(2)}`).join(' / ')}
            </span>
          )}
          <span style={{ color: '#ef4444', fontWeight: 600 }}>
            ● Max Loss: -${Math.abs(minPnl).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
