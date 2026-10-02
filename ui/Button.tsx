import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { KeyCap } from './KeyCap';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'md' | 'lg';
  leadingKey?: string;
  children: ReactNode;
};
export function Button({ variant = 'primary', size = 'md', leadingKey, children, className = '', ...props }: Props) {
  return <button {...props} className={`ui-button ui-button-${variant} ${variant === 'primary' ? 'ui-shadow-hard' : ''} ${size === 'lg' ? 'min-h-12 px-6 py-3 text-step-3' : 'min-h-10 px-4 py-2 text-step-1'} ${className}`}>
    {leadingKey && <KeyCap>{leadingKey}</KeyCap>}{children}{variant === 'text' && <span aria-hidden="true">↗</span>}
  </button>;
}
