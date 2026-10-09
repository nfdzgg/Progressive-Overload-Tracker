import { useNavigate } from 'react-router';
import { cancelRestartAndStartNow, trainAnywayToday } from '../../data';
import { formatDate, type ISODate } from '../../domain';
import { Button, EmptyState, Screen } from '../../ui';

/** The pointer is on a rest item: rest day with "Train anyway". */
export function RestView({ today }: { today: ISODate }) {
  return (
    <Screen title="Rest day">
      <EmptyState
        title="Nothing to log today"
        message="Rest is part of the cycle. Your next workout is up tomorrow."
        action={
          <Button variant="secondary" onClick={() => void trainAnywayToday(today)}>
            Train anyway
          </Button>
        }
      />
    </Screen>
  );
}

/** A restart is scheduled: rest until then, or "Start now". */
export function WaitingRestartView({ today, restartOn }: { today: ISODate; restartOn: ISODate }) {
  return (
    <Screen title="Rest">
      <EmptyState
        title={`The cycle restarts ${formatDate(restartOn)}`}
        message="Rest until then, or start again from the first workout now."
        action={
          <Button variant="secondary" onClick={() => void cancelRestartAndStartNow(today)}>
            Start now
          </Button>
        }
      />
    </Screen>
  );
}

/** No workouts in the cycle: the routine is set up in Settings. */
export function EmptyCycleView() {
  const navigate = useNavigate();
  return (
    <Screen title="Today">
      <EmptyState
        title="No workouts in your cycle"
        message="Set up your routine in Settings: create workouts and add them to the cycle."
        action={
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            Open Settings
          </Button>
        }
      />
    </Screen>
  );
}
