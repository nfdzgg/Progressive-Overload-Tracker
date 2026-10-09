import { useLocation, useNavigate } from 'react-router';

interface SettingsNavState {
  fromSettings?: boolean;
}

/**
 * Navigation between Settings pages. A page opened from inside Settings goes
 * back through history; a page opened directly (deep link, reload) goes back
 * to its parent instead, so Back never leaves the app.
 */
export function useSettingsNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SettingsNavState | null;
  const cameFromSettings = state?.fromSettings === true;

  return {
    open: (path: string) => navigate(path, { state: { fromSettings: true } }),
    /** Swaps the current page for another (e.g. "New exercise" → the created exercise). */
    replace: (path: string) => navigate(path, { replace: true, state }),
    back: (parent: string) => {
      if (cameFromSettings) navigate(-1);
      else navigate(parent, { replace: true });
    },
  };
}
