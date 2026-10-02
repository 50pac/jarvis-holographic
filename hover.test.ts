import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { expect, it } from 'vitest';
import config from './tailwind.config.js';
const rootPath = fileURLToPath(new URL('.', import.meta.url));
const file = (path: string) => join(rootPath, path);
it('keeps all pointer hover rules inside a hover-capable media query', async () => {
  const sources = ['App.tsx', 'index.tsx', ...(await readdir(file('ui/'), { recursive: true })).filter(path => path.endsWith('.tsx')).map(path => `ui/${path}`)];
  for (const source of sources) expect(await readFile(file(source), 'utf8'), source).not.toMatch(/(^|[\s"'`:])hover:/m);
  const result = await postcss([tailwindcss({ ...config, content: [{ raw: '<div class="hov:bg-ink-2"></div>', extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  const parsed = postcss.parse(result.css);
  let found = false;
  parsed.walkRules(rule => {
    if (!rule.selector.includes('hov\\:bg-ink-2')) return;
    found = true;
    let parent: postcss.Node | undefined = rule.parent;
    while (parent && parent.type !== 'atrule') parent = parent.parent;
    expect(parent?.type).toBe('atrule');
    if (parent?.type === 'atrule') expect((parent as postcss.AtRule).params).toMatch(/hover:\s*hover/);
  });
  expect(found).toBe(true);
  for (const path of ['index.css', ...(await readdir(file('styles/'))).filter(path => path.endsWith('.css')).map(path => `styles/${path}`)]) {
    const css = postcss.parse(await readFile(file(path), 'utf8'));
    css.walkRules(rule => {
      if (!rule.selector.includes(':hover')) return;
      let parent: postcss.Node | undefined = rule.parent;
      while (parent && !(parent.type === 'atrule' && (parent as postcss.AtRule).name === 'media' && /hover:\s*hover/.test((parent as postcss.AtRule).params))) parent = parent.parent;
      expect(parent, `${path}: ${rule.selector}`).toBeTruthy();
    });
  }
});
