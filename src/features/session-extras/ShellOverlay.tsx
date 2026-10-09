import { useSettings } from '../../data';
import { restAlert } from './restAlert';
import { restTimerStore } from './restTimer';
import { RestTimerOverlay } from './RestTimerOverlay';

/** Rendered by the app shell above the tab bar on every tab: the rest timer. */
export function ShellOverlay() {
  const settings = useSettings();
  return <RestTimerOverlay store={restTimerStore} alert={restAlert} settings={settings} />;
}
