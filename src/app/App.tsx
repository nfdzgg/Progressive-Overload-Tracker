import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { useSettings, useToday } from '../data';
import { FirstRunScreen } from '../features/backup';
import { CalendarScreen } from '../features/calendar';
import { ProgressScreen } from '../features/progress';
import { SettingsScreen } from '../features/settings';
import { TodayScreen } from '../features/today';
import { KitchenSink } from '../ui/KitchenSink';
import { Shell } from './Shell';
import { useDailyCycle } from './useDailyCycle';

/** Routes for the four tabs. Each tab owns everything below its path. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/kitchen-sink" element={<KitchenSink />} />
      <Route element={<Shell />}>
        <Route path="/today/*" element={<TodayScreen />} />
        <Route path="/calendar/*" element={<CalendarScreen />} />
        <Route path="/progress/*" element={<ProgressScreen />} />
        <Route path="/settings/*" element={<SettingsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

/** Shows first run until onboarding is done, then the tabs. */
export function App() {
  const settings = useSettings();
  const today = useToday();
  const onboarded = settings?.onboarded ?? false;
  useDailyCycle(today, onboarded);

  // Nothing (just the canvas) while settings load, so first run never flashes.
  if (!settings) return null;

  return (
    <HashRouter>
      {onboarded ? (
        <AppRoutes />
      ) : (
        <Routes>
          <Route path="/kitchen-sink" element={<KitchenSink />} />
          <Route path="*" element={<FirstRunScreen />} />
        </Routes>
      )}
    </HashRouter>
  );
}
