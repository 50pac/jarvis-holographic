import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { t } from '../i18n';
import { Button, Gauge, KeyCap, Led, Panel, StatusStrip, TicketCard, Toggle } from './index';
const rootPath = fileURLToPath(new URL('..', import.meta.url));
const render = (component: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(component);
it('renders accessible component states', () => {
  expect(render(createElement(Button, { variant: 'primary', children: t('kit.button.primary') }))).toContain('ui-shadow-hard');
  expect(render(createElement(Panel, { title: t('kit.panel.title'), children: t('kit.panel.body') }))).toContain('ui-rivet');
  for (const state of ['open', 'selected', 'done', 'locked'] as const) {
    const html = render(createElement(TicketCard, { id: t('kit.order.id'), name: t('kit.order.name'), stars: 2, faults: [t('kit.order.fault.leak')], state, stamp: t('kit.order.stamp') }));
    expect(html).toContain('<article');
    expect(html).toContain('aria-labelledby=');
  }
  expect(render(createElement(Gauge, { label: t('kit.gauge.label'), value: 120, min: 0, max: 200, valueText: t('kit.gauge.reading', { n: 120 }), statusText: t('s3.gauge.torque.ok') }))).toContain('aria-valuenow="120"');
  for (const checked of [true, false]) expect(render(createElement(Toggle, { checked, label: t('kit.toggle.label') }))).toContain(`aria-checked="${checked}"`);
  expect(render(createElement(KeyCap, null, t('kit.key.space')))).toContain('<kbd');
  expect(render(createElement(StatusStrip, { items: [{ state: 'online', label: t('status.gesture.on') }] }))).toContain('aria-hidden="true"');
  expect(render(createElement(Led, { state: 'off' }))).toContain('aria-hidden="true"');
});
it('keeps component source free of Han characters', async () => {
  for (const directory of ['ui', 'components']) {
    const entries = await readdir(join(rootPath, directory), { recursive: true });
    for (const entry of entries) {
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      expect(await readFile(join(rootPath, directory, entry), 'utf8'), entry).not.toMatch(/\p{Script=Han}/u);
    }
  }
});
