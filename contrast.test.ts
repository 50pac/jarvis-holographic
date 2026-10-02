import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const rootPath = fileURLToPath(new URL('.', import.meta.url));
const file = (path: string) => join(rootPath, path);
const names = ['ink-0', 'ink-1', 'ink-2', 'line', 'line-hi', 'bone', 'bone-2', 'bone-3', 'signal', 'amber', 'verdigris', 'warn', 'danger', 'oxide'] as const;
function luminance(hex: string) {
  const values = hex.slice(1).match(/.{2}/g)!.map(pair => parseInt(pair, 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
function ratio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}
it('keeps palette contrast and config aligned', async () => {
  const css = await readFile(file('styles/tokens.css'), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map(([, key, value]) => [key, value.toUpperCase()]));
  for (const name of names) expect(tokens[name], name).toMatch(/^#[0-9A-F]{6}$/);
  for (const ink of ['ink-0', 'ink-1', 'ink-2']) {
    for (const foreground of ['bone', 'bone-2', 'signal', 'amber', 'verdigris', 'warn', 'danger']) expect(ratio(tokens[foreground], tokens[ink]), `${foreground} on ${ink}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const ink of ['ink-0', 'ink-1']) {
    expect(ratio(tokens['bone-3'], tokens[ink])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tokens['line-hi'], tokens[ink])).toBeGreaterThanOrEqual(3);
    expect(ratio(tokens.oxide, tokens[ink])).toBeGreaterThanOrEqual(3);
    expect(ratio(tokens.oxide, tokens[ink])).toBeLessThan(4.5);
  }
  expect(ratio(tokens['bone-3'], tokens['ink-2'])).toBeLessThan(4.5);
  for (const background of ['signal', 'amber']) expect(ratio(tokens['ink-0'], tokens[background])).toBeGreaterThanOrEqual(4.5);
  expect(ratio(tokens['ink-0'], '#FF7040')).toBeGreaterThanOrEqual(4.5);
  const { default: config } = await import('./tailwind.config.js');
  const colors = config.theme.extend.colors as { ink: Record<number, string>; line: { DEFAULT: string; hi: string }; bone: { DEFAULT: string; 2: string; 3: string }; signal: string; amber: string; verdigris: string; warn: string; danger: string; oxide: string }; 
  const entries = { 'ink-0': colors.ink[0], 'ink-1': colors.ink[1], 'ink-2': colors.ink[2], line: colors.line.DEFAULT, 'line-hi': colors.line.hi, bone: colors.bone.DEFAULT, 'bone-2': colors.bone[2], 'bone-3': colors.bone[3], signal: colors.signal, amber: colors.amber, verdigris: colors.verdigris, warn: colors.warn, danger: colors.danger, oxide: colors.oxide };
  for (const name of names) expect(entries[name].toUpperCase(), name).toBe(tokens[name]);
  const { readdir } = await import('node:fs/promises');
  for (const entry of await readdir(file('ui/'), { recursive: true })) {
    if (!entry.endsWith('.tsx')) continue;
    const source = await readFile(join(rootPath, 'ui', entry), 'utf8');
    expect(source, entry).not.toMatch(/text-oxide|color:\s*var\(--oxide\)/);
  }
  expect(await readFile(file('App.tsx'), 'utf8')).not.toMatch(/text-oxide|color:\s*var\(--oxide\)/);
});
