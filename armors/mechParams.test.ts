import { describe, expect, it } from 'vitest';
import { getMechHeight, type MechParams } from './mechParams';

describe('getMechHeight', () => {
  it('scales the centered model height linearly with size', () => {
    const params: MechParams = {
      size: 1, bulk: 1, headStyle: 'dome', thrusterCount: 2,
      primaryColor: '#aa0000', secondaryColor: '#bbbbbb', glowColor: '#ffffff',
    };
    expect(getMechHeight(params)).toBe(2);
    expect(getMechHeight({ ...params, size: 1.55 })).toBeCloseTo(3.1);
    expect(-getMechHeight({ ...params, size: 1.55 }) / 2).toBeCloseTo(-1.55);
  });
});
