import type { ButtonHTMLAttributes } from 'react';
import { useI18n } from '../i18n';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & { checked: boolean; onChange?: (checked: boolean) => void; label: string; lockedReason?: string };
export function Toggle({ checked, onChange, label, lockedReason, disabled, className = '', ...props }: Props) {
  const { t } = useI18n();
  return <div className={`flex flex-wrap items-center gap-3 ${className}`}>
    <button {...props} type="button" role="switch" aria-checked={checked} aria-label={`${label}: ${checked ? t('ui.on') : t('ui.off')}`} disabled={disabled} onClick={() => onChange?.(!checked)} className="inline-flex min-h-10 items-center gap-2 border border-line-hi bg-ink-1 px-2 text-step-1 text-bone disabled:cursor-not-allowed disabled:text-bone-3">
      <span aria-hidden="true" className="relative h-6 w-12 border border-line-hi bg-ink-2"><span className={`absolute top-0 h-[22px] w-[22px] border border-ink-0 transition-transform duration-120 ease-mech ${checked ? 'translate-x-6 bg-signal' : 'translate-x-0 bg-bone-2'}`}/></span>
      <span>{checked ? t('ui.on') : t('ui.off')}</span>
    </button>
    <span className="text-step-1 text-bone">{label}</span>
    {disabled && lockedReason && <span className="w-full text-step-0 text-bone-3">{lockedReason}</span>}
  </div>;
}
