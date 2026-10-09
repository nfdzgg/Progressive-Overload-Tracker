import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { addLoggedEntry, createPastSession } from '../../data';
import { addDays, todayISO, type Exercise } from '../../domain';
import {
  allData,
  currentPath,
  exerciseNamed,
  inRow,
  renderSettings,
  seedTemplate,
  workoutNamed,
} from './testUtils';

beforeEach(async () => {
  await seedTemplate();
});

/** Logs one past entry for an exercise's variant, giving it history. */
async function giveHistory(exercise: Exercise, variantId = exercise.defaultVariantId) {
  const workout = (await allData()).workouts[0];
  const session = await createPastSession(addDays(todayISO(), -1), workout.id);
  await addLoggedEntry({
    sessionId: session.id,
    exerciseId: exercise.id,
    variantId,
    unit: 'lb',
    weight: 100,
    sets: [{ reps: 10, weight: null }],
  });
}

describe('Exercises list', () => {
  it('lists active exercises by name with a summary, and hides archived ones', async () => {
    renderSettings('/settings/exercises');
    const list = await screen.findByRole('list', { name: 'Exercises' });
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(16);
    expect(rows[0]).toHaveTextContent('Chest fly');
    expect(screen.getByText('Quads · 2 × 6–12 · 3:00 rest')).toBeInTheDocument();
  });

  it('opens "New exercise" from the top bar', async () => {
    renderSettings('/settings/exercises');
    await userEvent.click(await screen.findByRole('button', { name: 'New exercise' }));
    expect(currentPath()).toBe('/settings/exercises/new');
  });
});

describe('New exercise', () => {
  it('choosing a type fills in its rep range and rest (SPEC 4.1)', async () => {
    renderSettings('/settings/exercises/new');
    const min = await screen.findByLabelText('Min reps');
    const max = screen.getByLabelText('Max reps');
    const rest = screen.getByLabelText('Rest');
    expect(screen.getByLabelText('Sets')).toHaveValue('2');

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'legCompound');
    expect(min).toHaveValue('6');
    expect(max).toHaveValue('12');
    expect(rest).toHaveValue('180');
    expect(within(rest as HTMLElement).getByRole('option', { selected: true })).toHaveTextContent(
      '3:00',
    );

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'smallIsolation');
    expect(min).toHaveValue('10');
    expect(max).toHaveValue('15');
    expect(rest).toHaveValue('90');
  });

  it('validates the name and rep range before creating', async () => {
    renderSettings('/settings/exercises/new');
    const max = await screen.findByLabelText('Max reps');
    await userEvent.clear(max);
    await userEvent.type(max, '4');
    expect(max).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText("Max can't be below min")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }));
    expect(screen.getByText('Enter a name')).toBeInTheDocument();
    // The first invalid field gets focus so the user sees what to fix.
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.type(screen.getByLabelText('Name'), 'chest PRESS');
    expect(screen.getByText('An exercise with this name already exists')).toBeInTheDocument();
    expect((await allData()).exercises).toHaveLength(16);
  });

  it('creates the exercise with the edited values and opens it', async () => {
    renderSettings('/settings/exercises/new');
    await userEvent.type(await screen.findByLabelText('Name'), 'Dips');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'upperCompound');
    await userEvent.selectOptions(screen.getByLabelText('Muscle group'), 'triceps');
    await userEvent.selectOptions(screen.getByLabelText('Sets'), '3');
    const min = screen.getByLabelText('Min reps');
    await userEvent.clear(min);
    await userEvent.type(min, '8');
    await userEvent.selectOptions(screen.getByLabelText('Rest'), '120');
    await userEvent.click(screen.getByRole('radio', { name: 'On' }));
    await userEvent.type(screen.getByLabelText('Main variant'), 'Parallel bars');
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }));

    await waitFor(async () => expect(await exerciseNamed('Dips')).toBeDefined());
    const dips = (await exerciseNamed('Dips'))!;
    expect(dips).toMatchObject({
      type: 'upperCompound',
      muscleGroup: 'triceps',
      sets: 3,
      repMin: 8,
      repMax: 12,
      restSeconds: 120,
      perSetWeight: true,
      archived: false,
    });
    expect(dips.variants.map((v) => v.name)).toEqual(['Parallel bars']);
    await waitFor(() => expect(currentPath()).toBe(`/settings/exercises/${dips.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dips' })).toBeInTheDocument();
  });
});

describe('Exercise page', () => {
  async function open(name: string) {
    const exercise = (await exerciseNamed(name))!;
    renderSettings(`/settings/exercises/${exercise.id}`);
    await screen.findByRole('heading', { level: 1, name });
    return exercise;
  }

  it('saves edits as they are made; an invalid rep range is not saved', async () => {
    const press = await open('Chest press');
    await userEvent.selectOptions(screen.getByLabelText('Sets'), '4');
    await userEvent.selectOptions(screen.getByLabelText('Rest'), '180');
    await userEvent.selectOptions(screen.getByLabelText('Muscle group'), 'shoulders');
    await waitFor(async () =>
      expect(await exerciseNamed('Chest press')).toMatchObject({
        sets: 4,
        restSeconds: 180,
        muscleGroup: 'shoulders',
      }),
    );

    const min = screen.getByLabelText('Min reps');
    await userEvent.clear(min);
    await userEvent.type(min, '15');
    expect(screen.getByText("Max can't be below min")).toBeInTheDocument();
    const max = screen.getByLabelText('Max reps');
    await userEvent.clear(max);
    await userEvent.type(max, '20');
    expect(screen.queryByText("Max can't be below min")).not.toBeInTheDocument();
    await waitFor(async () =>
      expect(await exerciseNamed('Chest press')).toMatchObject({ repMin: 15, repMax: 20 }),
    );

    // Changing the type of an existing exercise keeps its values.
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'smallIsolation');
    await waitFor(async () =>
      expect((await allData()).exercises.find((e) => e.id === press.id)).toMatchObject({
        type: 'smallIsolation',
        repMin: 15,
        repMax: 20,
        restSeconds: 180,
      }),
    );
  });

  it('renames the exercise', async () => {
    const press = await open('Chest press');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Machine press');
    await waitFor(async () =>
      expect((await allData()).exercises.find((e) => e.id === press.id)?.name).toBe(
        'Machine press',
      ),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Machine press' }),
    ).toBeInTheDocument();
  });

  it('adds, renames, reorders variants and chooses the default', async () => {
    const fly = await open('Chest fly');
    await userEvent.click(screen.getByRole('button', { name: 'Add variant' }));
    let sheet = screen.getByRole('dialog', { name: 'Add variant' });
    await userEvent.type(within(sheet).getByLabelText('Variant name'), 'cable{Enter}');
    await waitFor(async () =>
      expect((await exerciseNamed('Chest fly'))!.variants.map((v) => v.name)).toContain('cable'),
    );

    await userEvent.click(inRow('cable').getByRole('button', { name: 'Edit cable' }));
    sheet = screen.getByRole('dialog', { name: 'Edit variant' });
    const field = within(sheet).getByLabelText('Variant name');
    expect(field).toHaveValue('cable');
    await userEvent.clear(field);
    await userEvent.type(field, 'Cable');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await exerciseNamed('Chest fly'))!.variants.at(-1)?.name).toBe('Cable'),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Move Cable up' }));
    await waitFor(async () =>
      expect((await exerciseNamed('Chest fly'))!.variants.map((v) => v.name)).toEqual([
        'Downstairs machine',
        'Upstairs machine',
        'Cable',
        'Dumbbell on bench',
      ]),
    );

    const cable = (await exerciseNamed('Chest fly'))!.variants.find((v) => v.name === 'Cable')!;
    await userEvent.selectOptions(screen.getByLabelText('Default variant'), cable.id);
    await waitFor(async () =>
      expect((await exerciseNamed('Chest fly'))!.defaultVariantId).toBe(cable.id),
    );
    await waitFor(() => expect(inRow('Cable').getByText('Default')).toBeInTheDocument());
    expect(fly.id).toBeDefined();
  });

  it('deletes a variant without history and archives one with history', async () => {
    const press = await open('Chest press');
    const bench = press.variants.find((v) => v.name === 'Bench')!;
    const machine = press.variants.find((v) => v.name === 'Machine')!;
    await giveHistory(press, machine.id);

    await userEvent.click(inRow('Bench').getByRole('button', { name: 'Edit Bench' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove variant' }));
    let dialog = await screen.findByRole('alertdialog', { name: 'Delete Bench?' });
    expect(dialog).toHaveTextContent('has no logged history, so it is deleted for good');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () =>
      expect((await exerciseNamed('Chest press'))!.variants.map((v) => v.id)).toEqual([machine.id]),
    );
    expect(bench.id).toBeDefined();

    // The last active variant cannot be removed.
    await userEvent.click(inRow('Machine').getByRole('button', { name: 'Edit Machine' }));
    expect(screen.queryByRole('button', { name: 'Remove variant' })).toBeNull();
    expect(screen.getByText(/An exercise needs at least one/)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    // Add a second variant so Machine (with history) can go: it is archived.
    await userEvent.click(screen.getByRole('button', { name: 'Add variant' }));
    await userEvent.type(screen.getByLabelText('Variant name'), 'Smith{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Machine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove variant' }));
    dialog = await screen.findByRole('alertdialog', { name: 'Archive Machine?' });
    expect(dialog).toHaveTextContent('has logged history, so it is archived');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => {
      const after = (await exerciseNamed('Chest press'))!;
      expect(after.variants.find((v) => v.id === machine.id)?.archived).toBe(true);
      expect(after.defaultVariantId).not.toBe(machine.id);
    });
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Machine' })).toBeNull());
  });

  it('deletes an exercise without history after a confirmation', async () => {
    const curl = await open('Hammer curl');
    const button = await screen.findByRole('button', { name: 'Delete exercise' });
    await userEvent.click(button);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Hammer curl?' });
    expect(dialog).toHaveTextContent('no logged history, so it is deleted for good');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await exerciseNamed('Hammer curl')).toBeUndefined());
    const pull = (await workoutNamed('Pull'))!;
    expect(pull.exerciseIds).not.toContain(curl.id);
    expect(currentPath()).toBe('/settings/exercises');
  });

  it('archives an exercise with history: it leaves workouts and the library', async () => {
    const row = (await exerciseNamed('Row'))!;
    await giveHistory(row);
    await open('Row');
    await userEvent.click(await screen.findByRole('button', { name: 'Archive exercise' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Archive Row?' });
    expect(dialog).toHaveTextContent('has logged history, so it is archived');
    expect(dialog).toHaveTextContent('its history, charts, and PRs stay');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect((await exerciseNamed('Row'))?.archived).toBe(true));
    expect((await workoutNamed('Pull'))!.exerciseIds).not.toContain(row.id);
    expect((await allData()).entries.filter((e) => e.exerciseId === row.id)).toHaveLength(1);
    expect(await screen.findByRole('list', { name: 'Exercises' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Row/ })).toBeNull();
  });
});
