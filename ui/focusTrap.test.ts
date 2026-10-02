import { expect, it } from 'vitest';
import { nextFocusIndex } from './focusTrap';
it('wraps focus forward and backward', () => {
  expect(nextFocusIndex(2, 3)).toBe(0);
  expect(nextFocusIndex(0, 3, true)).toBe(2);
  expect(nextFocusIndex(1, 3)).toBe(2);
  expect(nextFocusIndex(1, 3, true)).toBe(0);
  expect(nextFocusIndex(0, 0)).toBe(-1);
});
