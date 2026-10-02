import type { ReactNode } from 'react';
import { Led } from './Led';
import { useI18n } from '../i18n';

export type StatusItem = { state: 'online' | 'off' | 'error'; label: string };
export function StatusStrip({ items, hint, className = '' }: { items: StatusItem[]; hint?: ReactNode; className?: string }) {
  const { t } = useI18n();
  return <footer role="status" aria-live="polite" className={`flex h-14 items-center justify-between gap-4 border-t border-line bg-ink-1 px-6 ${className}`}>
    <div className="flex flex-wrap gap-x-6 gap-y-1">{items.map((item, index) => <span key={index} className="inline-flex items-center gap-2 text-step-1 text-bone"><Led state={item.state}/>{item.label}<span className="text-bone-2">{t(`ui.led.${item.state}`)}</span></span>)}</div>
    {hint && <div className="hidden text-step-1 text-bone-2 md:block">{hint}</div>}
  </footer>;
}
