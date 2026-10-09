// Slice S1 Today. The app routes `/today/*` to `TodayScreen`; Session extras
// (S6) plugs in through the extension points in `extensions.ts`.
export { TodayScreen } from './TodayScreen';
export {
  registerTodayExtensions,
  useTodayExtensions,
  type EntryLoggedEvent,
  type SetCommittedEvent,
  type TodayCardContext,
  type TodayExtensions,
} from './extensions';
