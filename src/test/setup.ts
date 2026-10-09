import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom does not implement scrolling; the shell scrolls to top on tab change.
if (typeof window !== 'undefined') window.scrollTo = () => {};
