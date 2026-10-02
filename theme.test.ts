import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const rootFile = (name: string) => new URL(name, import.meta.url);

it('defines the workshop palette', async () => {
  const { default: config } = await import('./tailwind.config.js');
  const colors = config.theme.extend.colors;
  expect(colors).toEqual({
    ink: { 0: '#0E0D0B', 1: '#17140F', 2: '#221E17' },
    line: { DEFAULT: '#3A342A', hi: '#6E6757' },
    bone: { DEFAULT: '#EDE6D3', 2: '#B9B09B', 3: '#8B826F' },
    signal: '#FF5A1F',
    amber: '#F2A33A',
    verdigris: '#4FB39C',
    warn: '#FFC247',
    danger: '#FF4B3A',
    oxide: '#C8412F',
  });
});

it('keeps the new shell clear of the old palette and identity', async () => {
  const files = ['index.css', 'tailwind.config.js', 'App.tsx', 'index.html'];
  const forbidden = [
    ['00', 'F0', 'FF'],
    ['holo', '-cy', 'an'],
    ['FF', '00', 'FF'],
    ['00', 'A3', 'FF'],
    ['00', '2F', 'A7'],
    ['jar', 'vis'],
  ].map(parts => new RegExp(parts.join(''), 'i'));

  for (const file of files) {
    const source = await readFile(rootFile(file), 'utf8');
    for (const pattern of forbidden) expect(source, file).not.toMatch(pattern);
  }
  expect(await readFile(rootFile('App.tsx'), 'utf8')).toContain('机匠');
});
