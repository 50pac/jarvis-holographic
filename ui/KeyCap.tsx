import type { HTMLAttributes } from 'react';

export function KeyCap({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <kbd {...props} className={`inline-flex min-w-6 items-center justify-center border border-line-hi border-b-[3px] bg-ink-2 px-1.5 py-0.5 font-mono text-step-0 text-bone ${className}`}>{children}</kbd>;
}
