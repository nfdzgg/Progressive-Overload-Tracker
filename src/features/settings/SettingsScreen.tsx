import { Screen, Stack } from '../../ui';
import { DataSection } from '../backup';

export function SettingsScreen() {
  return (
    <Screen title="Settings">
      <Stack gap="xl">
        <DataSection />
      </Stack>
    </Screen>
  );
}
