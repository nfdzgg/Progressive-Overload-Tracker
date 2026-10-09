import type { ReactNode } from 'react';
import {
  BarChart,
  ComparisonBars,
  DashboardCard,
  EmptyState,
  ListGroup,
  ListItem,
  ListRow,
  Text,
  type Bar,
} from '../../ui';
import { formatCompact, formatVolume, plural } from './progressFormat';
import {
  consistency,
  hasAnyData,
  hasFinishedSessions,
  muscleSets,
  recentPrs,
  stalledRows,
  thisWeek,
  volume,
  WEEKS,
  type ProgressContext,
} from './progressModel';
import styles from './Progress.module.css';

/** A dashboard card in the grid, named for assistive tech by its eyebrow label. */
export function ProgressCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} className={styles.cell}>
      <DashboardCard label={label}>{children}</DashboardCard>
    </div>
  );
}

/** Key value in card-title type with a caption label below it. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className={styles.stat}>
      <Text as="p" variant="card-title">
        {value}
      </Text>
      <Text as="p" variant="caption" tone="subtle">
        {label}
      </Text>
    </div>
  );
}

function barsDescription(title: string, bars: Bar[], format: (v: number) => string): string {
  return `${title}: ${bars
    .map((b) => `${b.current ? 'this week' : `week of ${b.label}`} ${format(b.value)}`)
    .join(', ')}`;
}

export function ThisWeekCard({ ctx }: { ctx: ProgressContext }) {
  const n = thisWeek(ctx);
  return (
    <ProgressCard label="This week">
      {hasAnyData(ctx) ? (
        <div className={styles.stats}>
          <Stat value={n.sessions} label={n.sessions === 1 ? 'Session' : 'Sessions'} />
          <Stat value={n.prs} label={n.prs === 1 ? 'PR set' : 'PRs set'} />
          <Stat value={n.hardSets} label={n.hardSets === 1 ? 'Hard set' : 'Hard sets'} />
        </div>
      ) : (
        <EmptyState
          title="Nothing logged yet"
          message="Finished sessions, PRs, and hard sets for the week appear here once you log a workout."
        />
      )}
    </ProgressCard>
  );
}

export function ConsistencyCard({ ctx }: { ctx: ProgressContext }) {
  if (!hasFinishedSessions(ctx)) {
    return (
      <ProgressCard label="Consistency">
        <EmptyState
          title="No finished sessions yet"
          message={`Sessions per week for the last ${WEEKS} weeks and your weekly streak appear here once you finish a workout.`}
        />
      </ProgressCard>
    );
  }
  const { bars, streak } = consistency(ctx);
  return (
    <ProgressCard label="Consistency">
      <Stat value={plural(streak, 'week', 'weeks')} label="Current streak" />
      <div className={styles.body}>
        <BarChart
          bars={bars}
          ariaLabel={barsDescription(`Finished sessions per week`, bars, String)}
        />
        <Text as="p" variant="caption" tone="subtle">
          Finished sessions per week, last {WEEKS} weeks
        </Text>
      </div>
    </ProgressCard>
  );
}

export function MuscleSetsCard({ ctx }: { ctx: ProgressContext }) {
  const { rows, current, previous } = muscleSets(ctx);
  return (
    <ProgressCard label="Sets per muscle group">
      {rows.length > 0 ? (
        <>
          <Stat value={plural(current, 'set', 'sets')} label={`This week, ${previous} last week`} />
          <div className={styles.body}>
            <ComparisonBars
              rows={rows}
              currentLabel="This week"
              previousLabel="Last week"
              ariaLabel={`Hard sets per muscle group, this week against last week: ${rows
                .map((r) => `${r.label} ${r.current} against ${r.previous}`)
                .join(', ')}`}
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="No sets this week or last week"
          message="Hard sets per muscle group, this week against last week, appear here once you log sets."
        />
      )}
    </ProgressCard>
  );
}

export function RecentPrsCard({ ctx }: { ctx: ProgressContext }) {
  const rows = recentPrs(ctx);
  return (
    <ProgressCard label="Recent PRs">
      {rows.length > 0 ? (
        <ListGroup label="Recent PRs">
          {rows.map((row) => (
            <ListItem key={row.id}>
              <ListRow
                title={row.exercise}
                detail={`${row.variant} · ${row.kind}`}
                trailing={
                  <span className={styles.trailing}>
                    <span className={styles.value}>{row.value}</span>
                    <span className={styles.date}>{row.date}</span>
                  </span>
                }
              />
            </ListItem>
          ))}
        </ListGroup>
      ) : (
        <EmptyState
          title="No PRs yet"
          message="Your latest personal records appear here once you beat an earlier session. The first session of each exercise sets the baseline."
        />
      )}
    </ProgressCard>
  );
}

/** Hidden entirely when nothing is stalled (6.5). */
export function StalledCard({ ctx }: { ctx: ProgressContext }) {
  const rows = stalledRows(ctx);
  if (rows.length === 0) return null;
  return (
    <ProgressCard label="Stalled">
      <Text as="p" variant="body-sm" tone="subtle">
        No new best in the last three sessions.
      </Text>
      <ListGroup label="Stalled">
        {rows.map((row) => (
          <ListItem key={row.id}>
            <ListRow title={row.exercise} detail={row.variant} />
          </ListItem>
        ))}
      </ListGroup>
    </ProgressCard>
  );
}

export function VolumeCard({ ctx }: { ctx: ProgressContext }) {
  if (ctx.logged.length === 0) {
    return (
      <ProgressCard label="Volume">
        <EmptyState
          title="No volume yet"
          message={`Weekly volume (weight × reps) for the last ${WEEKS} weeks appears here once you log sets.`}
        />
      </ProgressCard>
    );
  }
  const { bars, thisWeek: current } = volume(ctx);
  return (
    <ProgressCard label="Volume">
      <Stat value={formatVolume(current, ctx.unit)} label="This week" />
      <div className={styles.body}>
        <BarChart
          bars={bars}
          formatValue={formatCompact}
          ariaLabel={barsDescription(`Weekly volume in ${ctx.unit}`, bars, formatCompact)}
        />
        <Text as="p" variant="caption" tone="subtle">
          Weight × reps per week, last {WEEKS} weeks
        </Text>
      </div>
    </ProgressCard>
  );
}
