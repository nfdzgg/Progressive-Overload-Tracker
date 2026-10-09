import { cx } from '../cx';
import styles from './BarChart.module.css';

export interface Bar {
  label: string;
  value: number;
  /** The current week: lavender. Past weeks use hairline-tertiary. */
  current?: boolean;
}

export interface BarChartProps {
  bars: Bar[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
}

/** Vertical bars with direct value labels (weekly volume, sessions per week). */
export function BarChart({ bars, ariaLabel, formatValue = String }: BarChartProps) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <div className={styles.chart} role="img" aria-label={ariaLabel}>
      {bars.map((bar, i) => {
        const pct = max > 0 ? (bar.value / max) * 100 : 0;
        return (
          <div key={`${bar.label}-${i}`} className={styles.column} aria-hidden="true">
            <span className={cx(styles.value, bar.current && styles.valueCurrent)}>
              {formatValue(bar.value)}
            </span>
            <span className={styles.track}>
              <span
                className={cx(
                  styles.bar,
                  bar.current && styles.current,
                  bar.value > 0 && styles.nonZero,
                )}
                style={{ height: `${pct}%` }}
                data-current={bar.current || undefined}
              />
            </span>
            <span className={styles.label}>{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface ComparisonRow {
  label: string;
  current: number;
  previous: number;
}

export interface ComparisonBarsProps {
  rows: ComparisonRow[];
  ariaLabel: string;
  currentLabel: string;
  previousLabel: string;
}

/** Horizontal paired bars: this period (lavender) against the last (hairline-tertiary). */
export function ComparisonBars({
  rows,
  ariaLabel,
  currentLabel,
  previousLabel,
}: ComparisonBarsProps) {
  const max = Math.max(0, ...rows.flatMap((r) => [r.current, r.previous]));
  const pct = (v: number) => (max > 0 ? (v / max) * 100 : 0);
  return (
    <div className={styles.comparison} role="img" aria-label={ariaLabel}>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={cx(styles.swatch, styles.current)} />
          {currentLabel}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} />
          {previousLabel}
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className={styles.row} aria-hidden="true">
          <span className={styles.rowLabel}>{row.label}</span>
          <span className={styles.hbars}>
            <span className={styles.hline}>
              <span
                className={cx(styles.hbar, styles.current)}
                style={{ width: `${pct(row.current)}%` }}
              />
              <span className={styles.hvalue}>{row.current}</span>
            </span>
            <span className={styles.hline}>
              <span className={styles.hbar} style={{ width: `${pct(row.previous)}%` }} />
              <span className={cx(styles.hvalue, styles.hvalueMuted)}>{row.previous}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
