import { useId } from 'react';
import { Button } from './Button';
import { useI18n } from '../i18n';

type Props = {
  id: string;
  name: string;
  stars: number;
  faults: string[];
  state: 'open' | 'selected' | 'done' | 'locked';
  stamp?: string;
  onAction?: () => void;
  className?: string;
};
export function TicketCard({ id, name, stars, faults, state, stamp, onAction, className = '' }: Props) {
  const titleId = useId();
  const { t } = useI18n();
  return <article aria-labelledby={titleId} className={`ui-ticket-cut relative bg-line p-px ${state === 'selected' ? 'outline outline-2 outline-signal' : ''} ${className}`}>
    <div className="ui-ticket-cut relative bg-ink-1">
      <div aria-hidden="true" className="ui-hazard h-[6px]"/>
      <div aria-hidden="true" className={`ui-ticket-holes absolute bottom-0 left-0 top-[6px] w-6 border-r ${state === 'selected' ? 'border-signal bg-signal' : 'border-line bg-ink-2'}`}/>
      <div className={`relative min-h-64 p-4 pl-10 ${state === 'locked' ? 'text-bone-3' : 'text-bone'}`}>
        {state === 'done' && stamp && <div className="absolute right-6 top-6 rotate-[-4deg] border-2 border-verdigris px-2 py-1 font-display text-step-3 font-extrabold uppercase tracking-[.08em] text-verdigris">{stamp}</div>}
        <h3 id={titleId} className="font-display text-step-5 font-extrabold tracking-[.04em]">{id}</h3>
        <div className="text-step-3 font-semibold">{name}</div>
        <div role="img" aria-label={t('kit.order.difficulty', { stars })} className={`mt-2 text-step-2 ${state === 'locked' ? 'text-bone-3' : 'text-amber'}`}><span aria-hidden="true">{'★'.repeat(Math.max(0, Math.min(3, stars)))}{'☆'.repeat(Math.max(0, 3 - stars))}</span></div>
        <ul className="mt-4 space-y-1 font-mono text-step-0">{faults.map((fault, index) => <li key={`${fault}-${index}`}><span aria-hidden="true">{state === 'done' ? '■' : '□'}</span> {fault}</li>)}</ul>
        {state === 'locked' && <p className="mt-3 text-step-1">{t('s1.order.locked')}</p>}
        <div className="mt-5 border-t border-line pt-4"><Button variant="secondary" disabled={state === 'locked' || state === 'done'} onClick={onAction}>{state === 'done' ? t('kit.ticket.done') : t('s1.order.btn')}</Button></div>
      </div>
    </div>
  </article>;
}
