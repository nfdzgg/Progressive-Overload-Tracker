import { EmptyState, Screen } from '../../ui';

export function CalendarScreen() {
  return (
    <Screen title="Calendar">
      <EmptyState title="Calendar" message="The month view arrives with the Calendar slice." />
    </Screen>
  );
}
