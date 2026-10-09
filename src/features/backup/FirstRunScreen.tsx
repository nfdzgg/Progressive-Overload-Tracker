import { completeFirstRun } from '../../data';
import { todayISO } from '../../domain';
import { Button, EmptyState, Screen } from '../../ui';

export function FirstRunScreen() {
  return (
    <Screen title="Welcome">
      <EmptyState
        title="First run"
        message="The template choice arrives with the Backup slice."
        action={
          <Button variant="primary" onClick={() => completeFirstRun('blank', 'lb', todayISO())}>
            Continue
          </Button>
        }
      />
    </Screen>
  );
}
