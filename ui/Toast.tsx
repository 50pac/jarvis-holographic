import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';

type Kind = 'info' | 'ok' | 'warn' | 'danger';
type ToastInput = { kind: Kind; text: string; durationMs?: number };
type ToastEntry = ToastInput & { id: number };
const ToastContext = createContext<{ push: (input: ToastInput) => void } | null>(null);
let nextId = 0;
const symbols: Record<Kind, string> = { info: 'i', ok: '✓', warn: '!', danger: '×' };
const borders: Record<Kind, string> = { info: 'border-amber', ok: 'border-verdigris', warn: 'border-warn', danger: 'border-danger' };
export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const { t } = useI18n();
  const dismiss = useCallback((id: number) => setEntries(current => current.filter(entry => entry.id !== id)), []);
  const push = useCallback((input: ToastInput) => setEntries(current => [...current, { ...input, id: ++nextId }].slice(-3)), []);
  const value = useMemo(() => ({ push }), [push]);
  return <ToastContext.Provider value={value}>{children}{typeof document !== 'undefined' && createPortal(
    <div aria-live="polite" className="pointer-events-none fixed bottom-16 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {entries.map(entry => <ToastRow key={entry.id} entry={entry} dismiss={dismiss} dismissLabel={t('ui.dismiss')}/>) }
    </div>, document.body)}</ToastContext.Provider>;
}
function ToastRow({ entry, dismiss, dismissLabel }: { entry: ToastEntry; dismiss: (id: number) => void; dismissLabel: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(entry.id), entry.durationMs ?? (entry.kind === 'danger' ? 8000 : 5000));
    return () => window.clearTimeout(timer);
  }, [entry.id, entry.durationMs, entry.kind, dismiss]);
  return <div role={entry.kind === 'danger' ? 'alert' : undefined} className={`ui-toast-enter pointer-events-auto flex min-h-14 items-center gap-3 border border-line border-l-[6px] ${borders[entry.kind]} bg-ink-1 p-3 text-step-1 text-bone`}>
    <span aria-hidden="true" className="font-mono text-step-3">{symbols[entry.kind]}</span><span className="flex-1">{entry.text}</span>
    <button type="button" aria-label={dismissLabel} onClick={() => dismiss(entry.id)} className="min-h-8 min-w-8 border border-line-hi text-step-3">×</button>
  </div>;
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastProvider is required');
  return context;
}
