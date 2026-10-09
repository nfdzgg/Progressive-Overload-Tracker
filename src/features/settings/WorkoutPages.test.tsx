import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  allData,
  currentPath,
  cycleNow,
  inRow,
  renderSettings,
  seedTemplate,
  workoutNamed,
} from './testUtils';

beforeEach(async () => {
  await seedTemplate();
});

async function exerciseNames(workoutName: string) {
  const data = await allData();
  const workout = data.workouts.find((w) => w.name === workoutName)!;
  return workout.exerciseIds.map((id) => data.exercises.find((e) => e.id === id)!.name);
}

describe('Workouts list', () => {
  it('lists workouts by name with their exercise count', async () => {
    renderSettings('/settings/workouts');
    const list = await screen.findByRole('list', { name: 'Workouts' });
    const titles = within(list)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(titles).toEqual(['Legs5 exercises', 'Pull6 exercises', 'Push6 exercises']);
  });

  it('creates a workout and opens it', async () => {
    renderSettings('/settings/workouts');
    await userEvent.click(await screen.findByRole('button', { name: 'New workout' }));
    const sheet = screen.getByRole('dialog', { name: 'New workout' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Create workout' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Enter a name');
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Upper{Enter}');
    await waitFor(async () => expect(await workoutNamed('Upper')).toBeDefined());
    const upper = (await workoutNamed('Upper'))!;
    await waitFor(() => expect(currentPath()).toBe(`/settings/workouts/${upper.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Upper' })).toBeInTheDocument();
    expect(screen.getByText('No exercises yet')).toBeInTheDocument();
  });
});

describe('Workout page', () => {
  async function openPush() {
    const push = (await workoutNamed('Push'))!;
    renderSettings(`/settings/workouts/${push.id}`);
    await screen.findByRole('list', { name: 'Exercises in Push' });
    return push;
  }

  it('renames the workout as you type', async () => {
    await openPush();
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    await userEvent.type(name, 'Push A');
    await waitFor(async () => expect(await workoutNamed('Push A')).toBeDefined());
    expect(await screen.findByRole('heading', { level: 1, name: 'Push A' })).toBeInTheDocument();
  });

  it('reorders and removes exercises', async () => {
    await openPush();
    await userEvent.click(
      inRow('Incline press').getByRole('button', { name: 'Move Incline press up' }),
    );
    await waitFor(async () =>
      expect((await exerciseNames('Push')).slice(0, 2)).toEqual(['Incline press', 'Chest press']),
    );
    await userEvent.click(
      inRow('Chest fly').getByRole('button', { name: 'Remove Chest fly from Push' }),
    );
    await waitFor(async () => expect(await exerciseNames('Push')).not.toContain('Chest fly'));
    // Removing from a workout never touches the library.
    expect((await allData()).exercises.some((e) => e.name === 'Chest fly')).toBe(true);
  });

  it('adds exercises from a picker of library exercises not already in the workout', async () => {
    await openPush();
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    const sheet = screen.getByRole('dialog', { name: 'Add to Push' });
    expect(within(sheet).queryByRole('button', { name: 'Add Chest press' })).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add Row' }));
    await waitFor(async () => expect((await exerciseNames('Push')).at(-1)).toBe('Row'));
    // The added exercise leaves the picker; the sheet stays open for more.
    await waitFor(() =>
      expect(within(sheet).queryByRole('button', { name: 'Add Row' })).toBeNull(),
    );
    await userEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('listitem', { name: 'Row' })).toBeInTheDocument();
  });

  it('deletes the workout and its cycle items after a confirmation', async () => {
    const push = await openPush();
    await userEvent.click(screen.getByRole('button', { name: 'Delete workout' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Push?' });
    expect(dialog).toHaveTextContent('It is removed from the cycle (2 items).');
    expect(dialog).toHaveTextContent('Past sessions keep their history.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete workout' }));
    await waitFor(async () => expect(await workoutNamed('Push')).toBeUndefined());
    const cycle = await cycleNow();
    expect(cycle.items).toHaveLength(5);
    expect(cycle.items.some((i) => i.kind === 'workout' && i.workoutId === push.id)).toBe(false);
    expect(currentPath()).toBe('/settings/workouts');
  });
});
