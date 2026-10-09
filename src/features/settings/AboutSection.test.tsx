import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const status = vi.hoisted(() => ({ updated: false, updateWaiting: false, offlineReady: false }));

vi.mock('../../app/pwa', () => ({
  APP_VERSION: '9.8.7',
  APP_BUILD: 'abc1234',
  usePwaStatus: () => status,
}));

const { AboutSection } = await import('./AboutSection');

describe('About', () => {
  it('shows the version and how to install', () => {
    Object.assign(status, { updated: false, updateWaiting: false });
    render(<AboutSection />);
    expect(screen.getByText('9.8.7 (abc1234)')).toBeInTheDocument();
    expect(screen.getByText(/iPhone: in Safari, tap Share/)).toBeInTheDocument();
    expect(screen.getByText(/On iOS 26, Share is in the ••• menu/)).toBeInTheDocument();
    expect(screen.getByText(/install icon in the address bar/)).toBeInTheDocument();
    expect(screen.queryByText('Updated')).not.toBeInTheDocument();
    expect(screen.queryByText(/Update ready/)).not.toBeInTheDocument();
  });

  it('notes an update quietly, never with a prompt', () => {
    Object.assign(status, { updated: true, updateWaiting: true });
    render(<AboutSection />);
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('Update ready, applies next launch')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
