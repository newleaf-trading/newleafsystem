# PayoffChart Highcharts Migration + Adjust Tab Interaction

_Completed 2026-04-19._

## Part 1 — Highcharts refactor

### What changed

| File | Change |
|---|---|
| `src/trading/components/PayoffChart.jsx` | Full rewrite: canvas → Highcharts. Uses `Highcharts.chart()` + `useRef` pattern (same as PayoffDiagramCard, GammaChart, etc.). |
| `src/trading/utils/payoffMath.js` | **New** — extracted `samplePayoff()` and `detectBreakevens()` from the old canvas component. Shared util for payoff computation. |
| `src/trading/utils/adjustmentCatalogue.js` | Removed dead `buildConvertToVertical` function (Phase 6b review confirmed removal). |

### Chart architecture

Single Highcharts chart with two y-axes:

| Axis | Position | Content |
|---|---|---|
| yAxis[1] (ruler) | Top 20% | Scatter series with coloured strike markers |
| yAxis[0] (P&L) | Bottom 75% | Area series (primary) + line series (comparison) |

Shared x-axis (strike price) — ruler markers and P&L curve align vertically.

### Colour palette (matched to spec)

| Element | Colour |
|---|---|
| Put markers (long) | `#0F6E56` outlined |
| Put markers (short) | `#0F6E56` filled |
| Call markers (long) | `#791F1F` outlined |
| Call markers (short) | `#791F1F` filled |
| Spot marker | `#BA7517` gold dashed |
| Primary P&L curve | `accentColor` prop (default `#0F6E56`) |
| Reference curve | `#B4B2A9` dashed, 60% opacity |
| Profit fill | `rgba(151,196,89,0.20)` |
| Loss fill | `rgba(247,193,193,0.15)` |

### Animation config

```js
chart.animation: { duration: 300 }
plotOptions.series.animation: { duration: 300 }
```

Series updates use `series.setData(data, redraw, animationConfig)` — Highcharts handles interpolation natively.

## Part 2 — Adjust tab interaction

### State model

```
selectedAdjustmentId   — click commits (defaults to recommended on mount)
hoveredAdjustmentId    — hover previews (null when not hovering)
displayedAdjustmentId  — computed: hoveredId ?? selectedId
```

Chart and outcome tiles bind to `displayedAdjustmentId`.
Execute button binds to `selectedAdjustmentId`.

### Behaviour

| Action | Effect |
|---|---|
| Tab mount | Recommended pre-selected. Chart shows recommended payoff + current position reference. |
| Hover Other row | Chart morphs to hovered option (300ms). Tiles update instantly. Row shows hover bg. |
| Leave hover | Chart morphs back to selected option. Tiles revert. |
| Click any row | Row becomes selected (green tint). Chart and tiles stay on that option. |
| Click Execute | Runs the currently selected option, ignoring hover. |
| Touch (mobile) | Tap both selects and previews in one gesture (no hover state). |
| Rapid hover | Highcharts interrupts in-flight morph cleanly with new setData call. |

### Row visual states

| State | Background |
|---|---|
| Default | `#fff` |
| Hover (displayed, not selected) | `rgba(247,248,250,0.8)` subtle grey |
| Selected | `rgba(11,122,82,0.04)` green tint |

### Special cases

| Adjustment | Chart behaviour |
|---|---|
| Close entire | Primary curve is flat at zero. Grey dashed shows current for comparison. |
| Hold & monitor | Primary curve exactly overlays grey dashed (nothing changes). |

### Chart data flow

```
PayoffChart receives:
  legs = displayedAdj's proposed legs (or current legs if no proposed legs)
  comparisonLegs = current position's legs (always)
  spotPrice = liveData.currentSpot
  accentColor = strategy theme primary
```

When `displayedAdjustmentId` changes, the parent passes new `legs` to PayoffChart. The Highcharts `useEffect` detects the data change and calls `series.setData()` with animation config, producing the morph.

## Future cleanup logged

- Migrate `workbench/strategy-builder.html` to use `src/trading/utils/payoffMath.js` for shared payoff computation. Eliminates duplicate vanilla-JS `samplePayoff` in the workbench. (Not blocking — workbench has its own implementation that works.)
