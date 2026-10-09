import { EmptyState, Screen } from '../../ui';

export function TodayScreen() {
  return (
    <Screen title="Today">
      <EmptyState title="Today" message="Exercise cards arrive with the Today slice." />
    </Screen>
  );
}
