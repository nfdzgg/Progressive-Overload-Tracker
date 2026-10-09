import { useMemo } from 'react';
import { Screen } from '../../ui';
import {
  ConsistencyCard,
  MuscleSetsCard,
  RecentPrsCard,
  StalledCard,
  ThisWeekCard,
  VolumeCard,
} from './Cards';
import { ExerciseDetailCard } from './ExerciseDetail';
import { buildContext, type ProgressData } from './progressModel';
import { useProgressData } from './useProgressData';
import styles from './Progress.module.css';

/** SPEC 6.5: the Progress dashboard, sections top to bottom. */
export function ProgressScreen() {
  const data = useProgressData();
  return (
    <Screen title="Progress" wide>
      {data && <Dashboard data={data} />}
    </Screen>
  );
}

function Dashboard({ data }: { data: ProgressData }) {
  const ctx = useMemo(() => buildContext(data), [data]);
  return (
    <div className={styles.grid}>
      <ThisWeekCard ctx={ctx} />
      <ConsistencyCard ctx={ctx} />
      <MuscleSetsCard ctx={ctx} />
      <RecentPrsCard ctx={ctx} />
      <StalledCard ctx={ctx} />
      <ExerciseDetailCard ctx={ctx} />
      <VolumeCard ctx={ctx} />
    </div>
  );
}
