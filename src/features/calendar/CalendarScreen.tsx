import { useId, useMemo, useState } from 'react';
import { formatMonth, monthMatrix, monthStart, type ISODate } from '../../domain';
import { CalendarDay, IconButton, Inline, Screen, SectionLabel, Stack, Text } from '../../ui';
import {
  buildDay,
  calendarContext,
  lastVisibleDate,
  monthOf,
  shiftMonth,
  weekDates,
  type CalendarDayModel,
  type YearMonth,
} from './calendarModel';
import { DaySheet } from './DaySheet';
import { useCalendarData, type CalendarData } from './useCalendarData';
import styles from './Calendar.module.css';

/**
 * Calendar tab (SPEC 6.4): the current week at the top, then the month.
 * Past days show what was done, future days the projection (5.2). Tapping a
 * day opens its sheet.
 */
export function CalendarScreen() {
  const data = useCalendarData();
  if (!data) {
    return <Screen title="Calendar">{null}</Screen>;
  }
  return <CalendarView data={data} />;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function Weekdays() {
  return (
    <div className={styles.weekdays} aria-hidden="true">
      {WEEKDAYS.map((d, i) => (
        <Text key={i} variant="caption" tone="subtle">
          {d}
        </Text>
      ))}
    </div>
  );
}

function Day({ model, onOpen }: { model: CalendarDayModel; onOpen: (date: ISODate) => void }) {
  return (
    <CalendarDay
      day={model.day}
      label={model.label}
      isToday={model.isToday}
      muted={model.muted}
      completed={model.completed}
      ariaLabel={model.ariaLabel}
      onClick={() => onOpen(model.date)}
    />
  );
}

function CalendarView({ data }: { data: CalendarData }) {
  const weekLabelId = useId();
  const monthTitleId = useId();
  // null follows today's month (also across midnight) until the user navigates.
  const [picked, setPicked] = useState<YearMonth | null>(null);
  const [openDate, setOpenDate] = useState<ISODate | null>(null);
  const shown = picked ?? monthOf(data.today);
  const until = lastVisibleDate(shown, data.today);

  const ctx = useMemo(
    () =>
      calendarContext({
        today: data.today,
        cycle: data.cycle,
        sessions: data.sessions,
        workouts: data.workouts,
        until,
      }),
    [data.today, data.cycle, data.sessions, data.workouts, until],
  );

  const week = weekDates(data.today).map((date) => buildDay(date, ctx));
  const monthPrefix = monthStart(shown.year, shown.month).slice(0, 7);
  const openDay = openDate ? buildDay(openDate, ctx) : null;
  const go = (delta: number) => setPicked(shiftMonth(shown, delta));

  return (
    <Screen title="Calendar">
      <Stack gap="xl">
        <section aria-labelledby={weekLabelId}>
          <SectionLabel id={weekLabelId}>This week</SectionLabel>
          <Stack gap="xs">
            <Weekdays />
            <div className={styles.grid}>
              {week.map((model) => (
                <Day key={model.date} model={model} onOpen={setOpenDate} />
              ))}
            </div>
          </Stack>
        </section>

        <section aria-labelledby={monthTitleId}>
          <Stack gap="xs">
            <Inline justify="between">
              <IconButton icon="chevronLeft" label="Previous month" onClick={() => go(-1)} />
              <div className={styles.monthTitle} aria-live="polite">
                <Text as="h2" id={monthTitleId} variant="body-lg" weight="medium">
                  {formatMonth(shown.year, shown.month)}
                </Text>
              </div>
              <IconButton icon="chevronRight" label="Next month" onClick={() => go(1)} />
            </Inline>
            <Weekdays />
            <div className={styles.grid}>
              {monthMatrix(shown.year, shown.month)
                .flat()
                .map((date) =>
                  date.startsWith(monthPrefix) ? (
                    <Day key={date} model={buildDay(date, ctx)} onOpen={setOpenDate} />
                  ) : (
                    <span key={date} aria-hidden="true" />
                  ),
                )}
            </div>
          </Stack>
        </section>
      </Stack>

      {openDay && (
        <DaySheet key={openDay.date} day={openDay} data={data} onClose={() => setOpenDate(null)} />
      )}
    </Screen>
  );
}
