import { useMemo, useState } from 'react';
import {
  Badge,
  ChipGroup,
  EmptyState,
  Inline,
  LineChart,
  ListGroup,
  ListItem,
  ListRow,
  Select,
  Text,
  type LineSeries,
} from '../../ui';
import { RANGE_OPTIONS, type Range } from './progressFormat';
import {
  chartDateLabel,
  detailBest,
  detailChart,
  exerciseOptions,
  historyRows,
  resolveSelection,
  variantOptions,
  type ProgressContext,
  type Selection,
} from './progressModel';
import { ProgressCard, Stat } from './Cards';
import styles from './Progress.module.css';

const classes = (...names: Array<string | false>) => names.filter(Boolean).join(' ');

const RANGE_NAMES: Record<Range, string> = {
  '1m': 'the last month',
  '3m': 'the last 3 months',
  all: 'this range',
};

/** Pick an exercise and variant; chart over time (5.4) and the full history. */
export function ExerciseDetailCard({ ctx }: { ctx: ProgressContext }) {
  const [wanted, setWanted] = useState<Partial<Selection>>({});
  const [range, setRange] = useState<Range>('3m');
  const selection = useMemo(() => resolveSelection(ctx, wanted), [ctx, wanted]);

  if (!selection) {
    return (
      <ProgressCard label="Exercise detail">
        <EmptyState
          title="No exercise history yet"
          message="Pick an exercise here to see its e1RM and top weight over time, with PRs marked, and every session you logged."
        />
      </ProgressCard>
    );
  }

  const exercises = exerciseOptions(ctx);
  const variants = variantOptions(ctx, selection.exerciseId);
  const best = detailBest(ctx, selection);
  const chart = detailChart(ctx, selection, range);
  const rows = historyRows(ctx, selection);
  const exerciseName = exercises.find((o) => o.value === selection.exerciseId)?.label ?? '';
  const variantName = variants.find((o) => o.value === selection.variantId)?.label ?? '';
  const points = chart.series[0].points;

  return (
    <ProgressCard label="Exercise detail">
      <div className={styles.body}>
        <Select
          label="Exercise"
          hideLabel
          options={exercises}
          value={selection.exerciseId}
          onValueChange={(exerciseId) => setWanted({ exerciseId })}
        />
        {variants.length > 1 ? (
          <ChipGroup
            label="Variant"
            options={variants}
            value={selection.variantId}
            onChange={(variantId) => setWanted({ exerciseId: selection.exerciseId, variantId })}
          />
        ) : (
          <Text as="p" variant="body-sm" tone="muted">
            {variantName}
          </Text>
        )}
        <Inline justify="between" align="end" gap="sm" wrap>
          {best ? <Stat value={best.value} label={best.label} /> : <span />}
          <ChipGroup label="Range" options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </Inline>
        {points.length > 0 ? (
          <>
            <LineChart
              series={chart.series}
              ariaLabel={`${chart.series.map((s) => s.name).join(' and ')} over time for ${exerciseName}, ${variantName}: ${points.length} ${points.length === 1 ? 'session' : 'sessions'}`}
              formatX={chartDateLabel}
              formatY={(v) => String(Math.round(v))}
            />
            <ChartKey series={chart.series} />
          </>
        ) : (
          <EmptyState
            title={`Nothing logged this way in ${RANGE_NAMES[range]}`}
            message="Choose All to see every session of this variant."
          />
        )}
        <Text as="h3" variant="eyebrow" tone="subtle" className={styles.subhead}>
          History
        </Text>
      </div>
      <ListGroup label={`History for ${exerciseName}, ${variantName}`}>
        {rows.map((row) => (
          <ListItem key={row.id}>
            <ListRow
              title={row.date}
              detail={row.e1rm ? `${row.summary} · ${row.e1rm}` : row.summary}
              trailing={
                row.deload || row.pr ? (
                  <span className={styles.badges}>
                    {row.deload && <Badge>Deload</Badge>}
                    {row.pr && <Badge tone="success">PR</Badge>}
                  </span>
                ) : undefined
              }
            />
          </ListItem>
        ))}
      </ListGroup>
    </ProgressCard>
  );
}

/** Direct key for the two series and the point markers that appear. */
function ChartKey({ series }: { series: LineSeries[] }) {
  const points = series.flatMap((s) => s.points);
  return (
    <div className={styles.legend} aria-hidden="true">
      {series.map((s) => (
        <span key={s.id} className={styles.legendItem}>
          <span
            className={classes(styles.swatchLine, s.tone === 'primary' && styles.swatchPrimary)}
          />
          {s.name}
        </span>
      ))}
      {points.some((p) => p.highlight) && (
        <span className={styles.legendItem}>
          <span className={styles.swatchDot} />
          PR
        </span>
      )}
      {points.some((p) => p.muted) && (
        <span className={styles.legendItem}>
          <span className={classes(styles.swatchDot, styles.swatchRing)} />
          Deload
        </span>
      )}
    </div>
  );
}
