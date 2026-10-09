// Slice S6 Session extras: the rest timer, the notes sheet, and the more menu
// (skip, swap, deload). It plugs into Today through Today's extension points;
// registration runs when the app shell imports this module, before Today
// renders. Contract: export `ShellOverlay`, rendered by the app shell above
// the tab bar on every tab (the rest timer lives there).
import { registerTodayExtensions } from '../today';
import { CardHeaderActions } from './CardActions';
import { DeloadBadge } from './DeloadBadge';
import { startRestTimer } from './startRestTimer';

registerTodayExtensions({
  CardHeaderActions,
  TopBarAccessory: DeloadBadge,
  onSetCommitted: (event) => void startRestTimer(event.exercise.name, event.restSeconds),
  onEntryLogged: (event) => void startRestTimer(event.exercise.name, event.restSeconds),
});

export { ShellOverlay } from './ShellOverlay';
