import { describe, expect, it } from 'vitest';
import { cycleArmorId, normalizeArmorId } from './armorCycle';

describe('armor cycle', () => {
  const ids = ['mark-85', 'mark-3', 'atlas'];

  it('cycles in both directions and wraps', () => {
    expect(cycleArmorId(ids, 'mark-85', 1)).toBe('mark-3');
    expect(cycleArmorId(ids, 'atlas', 1)).toBe('mark-85');
    expect(cycleArmorId(ids, 'mark-85', -1)).toBe('atlas');
  });

  it('handles an unknown current id and empty list', () => {
    expect(cycleArmorId(ids, 'missing', 1)).toBe('mark-85');
    expect(cycleArmorId(ids, 'missing', -1)).toBe('atlas');
    expect(cycleArmorId([], 'missing', 1)).toBe('missing');
  });

  it('normalizes to a known fallback or first id', () => {
    expect(normalizeArmorId(ids, 'atlas', 'mark-85')).toBe('atlas');
    expect(normalizeArmorId(ids, 'missing', 'mark-85')).toBe('mark-85');
    expect(normalizeArmorId(ids, 'missing', 'also-missing')).toBe('mark-85');
    expect(normalizeArmorId([], 'missing', 'mark-85')).toBe('mark-85');
  });
});
