import { EmptyState, Screen } from '../../ui';

export function ProgressScreen() {
  return (
    <Screen title="Progress" wide>
      <EmptyState title="Progress" message="The dashboard arrives with the Progress slice." />
    </Screen>
  );
}
