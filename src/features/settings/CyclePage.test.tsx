import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveCycleItems } from '../../data';
import { todayISO, type CycleItem } from '../../domain';
import { allData, cycleNow, inRow, renderSettings, row, seedTemplate } from './testUtils';

beforeEach(async () => {
  await seedTemplate();
});

async function labels(items?: CycleItem[]) {
  const data = await allData();
  const list = items ?? data.cycle.items;
  return list.map((i) =>
    i.kind === 'rest' ? 'Rest' : data.workouts.find((w) => w.id === i.workoutId)!.name,
  );
}

describe('Cycle page', () => {
  it('lists the items in order and marks the next one', async () => {
    renderSettings('/settings/cycle');
    const list = await screen.findByRole('list', { name: 'Cycle items' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      '1. Push',
      '2. Pull',
      '3. Legs',
      '4. Push',
      '5. Pull',
      '6. Legs',
      '7. Rest',
    ]);
    expect(within(rows[0]).getByText('Next')).toBeInTheDocument();
    expect(inRow('1. Push').getByRole('button', { name: 'Move Push up' })).toBeDisabled();
    expect(inRow('7. Rest').getByRole('button', { name: 'Move Rest down' })).toBeDisabled();
  });

  it('reorders items and keeps the pointer on the same item', async () => {
    renderSettings('/settings/cycle');
    await screen.findByRole('list', { name: 'Cycle items' });
    await userEvent.click(inRow('1. Push').getByRole('button', { name: 'Move Push down' }));
    await waitFor(async () =>
      expect(await labels()).toEqual(['Pull', 'Push', 'Legs', 'Push', 'Pull', 'Legs', 'Rest']),
    );
    expect((await cycleNow()).pointer).toBe(1);
    await waitFor(() => expect(within(row('2. Push')).getByText('Next')).toBeInTheDocument());

    await userEvent.click(inRow('7. Rest').getByRole('button', { name: 'Move Rest up' }));
    await waitFor(async () =>
      expect(await labels()).toEqual(['Pull', 'Push', 'Legs', 'Push', 'Pull', 'Rest', 'Legs']),
    );
    expect((await cycleNow()).pointer).toBe(1);
  });

  it('removes items; removing an earlier item keeps the pointer on its item', async () => {
    const cycle = await cycleNow();
    await saveCycleItems(cycle.items, todayISO(), 2); // Legs is next
    renderSettings('/settings/cycle');
    await screen.findByRole('list', { name: 'Cycle items' });
    await userEvent.click(
      inRow('1. Push').getByRole('button', { name: 'Remove Push from the cycle' }),
    );
    await waitFor(async () =>
      expect(await labels()).toEqual(['Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest']),
    );
    expect((await cycleNow()).pointer).toBe(1);
    await waitFor(() => expect(within(row('2. Legs')).getByText('Next')).toBeInTheDocument());
  });

  it('adds workout and rest items from a sheet', async () => {
    renderSettings('/settings/cycle');
    await userEvent.click(await screen.findByRole('button', { name: 'Add to cycle' }));
    let sheet = screen.getByRole('dialog', { name: 'Add to cycle' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Rest day' }));
    await waitFor(async () => expect((await labels()).at(-1)).toBe('Rest'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add to cycle' }));
    sheet = screen.getByRole('dialog', { name: 'Add to cycle' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Legs' }));
    await waitFor(async () => expect(await labels()).toHaveLength(9));
    expect((await labels()).slice(-2)).toEqual(['Rest', 'Legs']);
    expect(await screen.findByRole('listitem', { name: '9. Legs' })).toBeInTheDocument();
  });

  it('shows an empty state for an empty cycle', async () => {
    await saveCycleItems([], todayISO());
    renderSettings('/settings/cycle');
    expect(await screen.findByText('No items in the cycle yet')).toBeInTheDocument();
  });
});
