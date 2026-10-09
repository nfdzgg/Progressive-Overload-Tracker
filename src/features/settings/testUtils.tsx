// Test helpers for the Settings slice (used only by *.test.tsx files).
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { completeFirstRun, getCycle, readAllData, wipeAllData } from '../../data';
import { todayISO } from '../../domain';
import { SettingsScreen } from './SettingsScreen';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/** Renders the Settings tab at `path` inside a memory router. */
export function renderSettings(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/settings/*"
          element={
            <>
              <SettingsScreen />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

export const currentPath = () => screen.getByTestId('location').textContent;

/** A clean database seeded with the Push / Pull / Legs template. */
export async function seedTemplate() {
  await wipeAllData();
  await completeFirstRun('template', 'lb', todayISO());
}

export async function allData() {
  return readAllData(todayISO());
}

export async function cycleNow() {
  return getCycle(todayISO());
}

export async function exerciseNamed(name: string) {
  const data = await allData();
  return data.exercises.find((e) => e.name === name);
}

export async function workoutNamed(name: string) {
  const data = await allData();
  return data.workouts.find((w) => w.name === name);
}

/** The row (listitem) with this accessible name. */
export function row(name: string) {
  return screen.getByRole('listitem', { name });
}

export function inRow(name: string) {
  return within(row(name));
}
