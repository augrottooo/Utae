import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })),
});
window.scrollTo = vi.fn();
afterEach(() => {
  cleanup();
  localStorage.clear();
});
