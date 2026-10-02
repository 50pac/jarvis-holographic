import { expect, it } from 'vitest';
import { createMotionStore, resolveReduced } from './useMotionPref';
it('resolves system and user motion settings', () => {
  expect(resolveReduced(false, 'system')).toBe(false);
  expect(resolveReduced(false, 'reduce')).toBe(true);
  expect(resolveReduced(false, 'full')).toBe(false);
  for (const setting of ['system', 'reduce', 'full'] as const) expect(resolveReduced(true, setting)).toBe(true);
});
it('locks system reduced motion and tolerates blocked storage', () => {
  const root = { dataset: {} as DOMStringMap, removeAttribute(name: string) { if (name === 'data-motion') delete this.dataset.motion; } };
  let listener = () => {};
  const media = { matches: true, addEventListener(_name: string, next: () => void) { listener = next; }, removeEventListener() {} };
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const store = createMotionStore({ matchMedia: () => media, storage, root });
  expect(root.dataset.motion).toBe('reduce');
  expect(store.setUserSetting('full')).toEqual({ locked: true });
  expect(store.getSnapshot().reduced).toBe(true);
  media.matches = false;
  listener();
  expect(root.dataset.motion).toBeUndefined();
  expect(store.setUserSetting('reduce')).toEqual({ locked: false });
  expect(root.dataset.motion).toBe('reduce');
  store.destroy();
});
