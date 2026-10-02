import type { HTMLAttributes, ReactNode } from 'react';

type Props = Omit<HTMLAttributes<HTMLElement>, 'title'> & { title?: ReactNode; right?: ReactNode; roomy?: boolean; children: ReactNode };
export function Panel({ title, right, roomy = false, children, className = '', ...props }: Props) {
  return <section {...props} className={`ui-panel ${roomy ? 'p-6' : 'p-4'} ${className}`}>
    <span aria-hidden="true" className="ui-rivet left-2 top-2"/><span aria-hidden="true" className="ui-rivet right-2 top-2"/>
    <span aria-hidden="true" className="ui-rivet bottom-2 left-2"/><span aria-hidden="true" className="ui-rivet bottom-2 right-2"/>
    {(title || right) && <header className="mb-4 flex min-h-6 items-start justify-between gap-4 border-b border-line pb-3 text-step-0 font-semibold uppercase tracking-[.08em] text-bone-2"><span>{title}</span>{right}</header>}
    {children}
  </section>;
}
