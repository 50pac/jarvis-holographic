import type { ArmorTheme } from './armorRegistry';

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(value)) {
    return [...value].map(char => parseInt(char + char, 16)) as [number, number, number];
  }
  if (/^[\da-f]{6}$/i.test(value)) {
    return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

export function themeToCssVars(theme: ArmorTheme): Record<string, string> {
  return {
    '--hud-primary': theme.primary,
    '--hud-primary-rgb': hexToRgb(theme.primary).join(' '),
    '--hud-secondary': theme.secondary,
    '--hud-glow': theme.glow,
    '--hud-scanline': theme.scanline,
  };
}
