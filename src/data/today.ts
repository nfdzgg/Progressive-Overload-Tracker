import { useEffect, useState } from 'react';
import { todayISO, type ISODate } from '../domain';

/**
 * Today's local date, updated when the day changes (checked every minute and
 * whenever the app comes back to the foreground).
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const interval = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}
