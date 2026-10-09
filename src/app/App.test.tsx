import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { completeFirstRun, wipeAllData } from '../data';
import { todayISO } from '../domain';
import { App } from './App';

beforeEach(async () => {
  await wipeAllData();
  window.location.hash = '';
});

describe('App shell', () => {
  it('shows first run until onboarded', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('after onboarding shows the four tabs with Today active', async () => {
    await completeFirstRun('template', 'lb', todayISO());
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    for (const tab of ['Today', 'Calendar', 'Progress', 'Settings']) {
      expect(screen.getByRole('link', { name: tab })).toBeInTheDocument();
    }
    await waitFor(() => expect(window.location.hash).toBe('#/today'));
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('routes to each tab', async () => {
    await completeFirstRun('blank', 'lb', todayISO());
    window.location.hash = '#/progress';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
  });
});
