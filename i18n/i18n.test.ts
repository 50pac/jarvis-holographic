import { expect, it, vi } from 'vitest';
import { zh } from './zh';
import { en } from './en';
import { createLanguageStore, translate } from './index';
const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
it('has matching translated keys and placeholders', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  for (const key of Object.keys(zh) as (keyof typeof zh)[]) expect(placeholders(en[key]), key).toEqual(placeholders(zh[key]));
  for (const key of ['s0.title', 's0.btn.start', 's1.order.btn', 's3.gauge.torque', 's6.btn.export', 'err.webgl.unsupported', 'err.save.fail', 'status.gesture.off']) expect(zh).toHaveProperty(key);
  expect(zh['s0.title']).toBe('机匠');
  const forbidden = new RegExp(['jar'+'vis', 'ar'+'mor'].join('|'), 'i');
  for (const value of [...Object.values(zh), ...Object.values(en)]) expect(value).not.toMatch(forbidden);
});
it('substitutes parameters and falls back for unknown keys', () => {
  expect(translate('en', 's1.shift', { time: '02:14' })).toContain('02:14');
  expect(translate('en', 'missing.key')).toBe('missing.key');
  const root = { lang: '' };
  const store = createLanguageStore({ language: 'zh-CN', root, storage: { getItem: () => null, setItem: vi.fn() } });
  expect(store.getSnapshot()).toBe('zh');
  store.setLang('en');
  expect(root.lang).toBe('en');
});
