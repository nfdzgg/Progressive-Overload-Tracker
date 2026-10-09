import { getTodayView } from '../../domain';
import { FinishedView } from './FinishedView';
import { EmptyCycleView, RestView, WaitingRestartView } from './StateViews';
import { useTodayData } from './useTodayData';
import { WorkoutView } from './WorkoutView';

/**
 * Today (SPEC 5.1, 6.2): the workout at the pointer (or the in-progress
 * session) as exercise cards, the finished summary, a rest day, the wait for
 * a scheduled restart, or an empty cycle.
 */
export function TodayScreen() {
  const data = useTodayData();
  if (!data) return null;

  const view = getTodayView(data.cycle, data.sessions, data.today);
  const hasWorkouts = data.cycle.items.some(
    (item) => item.kind === 'workout' && data.workoutsById.has(item.workoutId),
  );

  switch (view.kind) {
    case 'session':
    case 'workout': {
      const session = view.kind === 'session' ? data.sessionsById.get(view.sessionId) : undefined;
      const workoutId = session?.workoutId ?? (view.kind === 'workout' ? view.workoutId : '');
      const workout = data.workoutsById.get(workoutId);
      if (!session && !workout) return <EmptyCycleView />;
      // Same element for both kinds, so the cards keep their state (and focus)
      // when the first interaction creates the session.
      return (
        <WorkoutView
          key={workoutId}
          data={data}
          workoutId={workoutId}
          session={session ?? null}
          title={session?.workoutName ?? workout?.name ?? ''}
        />
      );
    }
    case 'finished':
      return (
        <FinishedView
          data={data}
          session={(view.sessionId && data.sessionsById.get(view.sessionId)) || null}
        />
      );
    case 'waitingRestart':
      return <WaitingRestartView today={data.today} restartOn={view.restartOn} />;
    case 'rest':
      return hasWorkouts ? <RestView today={data.today} /> : <EmptyCycleView />;
    case 'empty':
      return <EmptyCycleView />;
  }
}
