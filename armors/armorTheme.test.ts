import { describe, expect, it } from 'vitest';
import { hexToRgb, themeToCssVars } from './armorTheme';

describe('armor theme', () => {
  it('parses short and full hex colors', () => {
    expect(hexToRgb('#0af')).toEqual([0, 170, 255]);
    expect(hexToRgb('#00F0FF')).toEqual([0, 240, 255]);
  });

  it('creates CSS variables for a theme', () => {
    expect(themeToCssVars({ primary: '#0af', secondary: '#123456', glow: '#fff', scanline: '#abcdef' })).toEqual({
      '--hud-primary': '#0af',
      '--hud-primary-rgb': '0 170 255',
      '--hud-secondary': '#123456',
      '--hud-glow': '#fff',
      '--hud-scanline': '#abcdef',
    });
  });
});
