import type { KeyboardEvent, PointerEvent } from 'react';
import { useRef, useState } from 'react';
import { linear, niceTicks } from './scale';
import { useWidth } from './useWidth';
import styles from './LineChart.module.css';

export interface ChartPoint {
  x: number;
  y: number;
  /** PR point: filled green dot. */
  highlight?: boolean;
  /** Visually marked point, e.g. a deload session (hollow dot). */
  muted?: boolean;
  /** Tooltip text; defaults to the formatted value. */
  label?: string;
}

export interface LineSeries {
  id: string;
  name: string;
  /** `primary` is the lavender series; `secondary` uses subtle ink. Never a second hue. */
  tone: 'primary' | 'secondary';
  points: ChartPoint[];
}

export interface LineChartProps {
  series: LineSeries[];
  /** Describes the chart for screen readers. */
  ariaLabel: string;
  formatY?: (value: number) => string;
  formatX?: (value: number) => string;
}

const HEIGHT = 160;
const PAD = { top: 8, right: 8, bottom: 22, left: 40 };

/**
 * Hand-built SVG line chart: 2px lines, horizontal hairline gridlines,
 * caption axis labels, green PR points. Touching a point shows its value.
 */
export function LineChart({
  series,
  ariaLabel,
  formatY = (v) => String(Math.round(v * 10) / 10),
  formatX = (v) => String(v),
}: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const [active, setActive] = useState<{ s: number; p: number } | null>(null);

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return <div ref={ref} className={styles.root} aria-label={ariaLabel} role="img" />;
  }
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 3);
  const y = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - PAD.bottom, PAD.top);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const x = linear(xMin, xMax, PAD.left + 6, width - PAD.right - 6);

  const flat = series.flatMap((s, si) => s.points.map((p, pi) => ({ s: si, p: pi, point: p })));

  function nearest(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left;
    let best: { s: number; p: number } | null = null;
    let bestDist = Infinity;
    for (const item of flat) {
      const d = Math.abs(x(item.point.x) - px);
      if (d < bestDist) {
        bestDist = d;
        best = { s: item.s, p: item.p };
      }
    }
    return best;
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' || event.type === 'pointerdown' || event.buttons) {
      setActive(nearest(event.clientX));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = active ? flat.findIndex((f) => f.s === active.s && f.p === active.p) : -1;
    const next = event.key === 'ArrowRight' ? index + 1 : index - 1;
    const clamped = Math.max(0, Math.min(flat.length - 1, next < 0 ? flat.length - 1 : next));
    setActive({ s: flat[clamped].s, p: flat[clamped].p });
  }

  const activePoint = active ? series[active.s]?.points[active.p] : undefined;

  return (
    <div
      ref={ref}
      className={styles.root}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setActive(null)}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={HEIGHT} aria-hidden="true" className={styles.svg}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={styles.grid}
            />
            <text
              x={PAD.left - 6}
              y={y(t)}
              className={styles.axis}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatY(t)}
            </text>
          </g>
        ))}
        <text x={x(xMin)} y={HEIGHT - 4} className={styles.axis} textAnchor="start">
          {formatX(xMin)}
        </text>
        {xMax !== xMin && (
          <text x={x(xMax)} y={HEIGHT - 4} className={styles.axis} textAnchor="end">
            {formatX(xMax)}
          </text>
        )}
        {series.map((s) => {
          const sorted = [...s.points].sort((a, b) => a.x - b.x);
          const d = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x)},${y(p.y)}`).join(' ');
          return (
            <g key={s.id} data-series={s.id}>
              <path
                d={d}
                className={s.tone === 'primary' ? styles.linePrimary : styles.lineSecondary}
              />
              {sorted.map((p, i) => (
                <circle
                  key={i}
                  cx={x(p.x)}
                  cy={y(p.y)}
                  r={p.highlight ? 4 : p.muted ? 3.5 : 2.5}
                  className={
                    p.highlight
                      ? styles.pointPr
                      : p.muted
                        ? styles.pointMuted
                        : s.tone === 'primary'
                          ? styles.pointPrimary
                          : styles.pointSecondary
                  }
                  data-pr={p.highlight || undefined}
                  data-muted={p.muted || undefined}
                />
              ))}
            </g>
          );
        })}
        {activePoint && (
          <circle
            cx={x(activePoint.x)}
            cy={y(activePoint.y)}
            r={5}
            className={styles.pointActive}
          />
        )}
      </svg>
      {activePoint && active && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(Math.max(x(activePoint.x), 60), width - 60),
            top: y(activePoint.y),
          }}
          role="status"
        >
          <span className={styles.tooltipName}>{series[active.s].name}</span>
          <span>{activePoint.label ?? formatY(activePoint.y)}</span>
        </div>
      )}
    </div>
  );
}
