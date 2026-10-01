import { describe, expect, it } from 'vitest';
import { ARMOR_STORAGE_KEY, DEFAULT_ARMOR_ID } from './armorRegistry';
import { loadArmorId, saveArmorId } from './armorStorage';

describe('armor storage', () => {
  const ids = ['mark-85', 'atlas'];

  it('loads known ids and falls back for unknown or missing ids', () => {
    expect(loadArmorId({ getItem: () => 'atlas' }, ids)).toBe('atlas');
    expect(loadArmorId({ getItem: () => 'unknown' }, ids)).toBe(DEFAULT_ARMOR_ID);
    expect(loadArmorId({ getItem: () => null }, ids)).toBe(DEFAULT_ARMOR_ID);
  });

  it('handles blocked or unavailable storage', () => {
    expect(loadArmorId({ getItem: () => { throw new Error('blocked'); } }, ids)).toBe(DEFAULT_ARMOR_ID);
    expect(loadArmorId(undefined, ids)).toBe(DEFAULT_ARMOR_ID);
    expect(() => saveArmorId('atlas', { setItem: () => { throw new Error('blocked'); } })).not.toThrow();
    expect(() => saveArmorId('atlas')).not.toThrow();
  });

  it('saves using the shared key', () => {
    const writes: [string, string][] = [];
    saveArmorId('atlas', { setItem: (key, value) => { writes.push([key, value]); } });
    expect(writes).toEqual([[ARMOR_STORAGE_KEY, 'atlas']]);
  });
});
