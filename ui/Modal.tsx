import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { getFocusable, nextFocusIndex } from './focusTrap';
import { Panel } from './Panel';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode; closeOnBackdrop?: boolean };
export function Modal({ open, title, onClose, children, closeOnBackdrop = true }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    if (!root) return;
    (getFocusable(root)[0] ?? root).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable(root);
      if (!focusable.length) { event.preventDefault(); root.focus(); return; }
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      if (current === -1) { event.preventDefault(); focusable[event.shiftKey ? focusable.length - 1 : 0].focus(); return; }
      if ((event.shiftKey && current === 0) || (!event.shiftKey && current === focusable.length - 1)) {
        event.preventDefault(); focusable[nextFocusIndex(current, focusable.length, event.shiftKey)].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [open]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-0/[.85] p-6" onMouseDown={event => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="ui-dialog-enter w-full max-w-xl">
      <Panel roomy title={<h2 id={titleId} className="font-display text-step-4 font-extrabold tracking-[.04em] text-bone">{title}</h2>} right={<button type="button" aria-label={t('ui.close')} onClick={onClose} className="min-h-10 min-w-10 border border-line-hi text-step-3 text-bone">×</button>}>{children}</Panel>
    </div>
  </div>, document.body);
}
