import { useId } from 'react';

type Zone = { from: number; to: number; kind: 'low' | 'ok' | 'high' };
type Props = { label: string; value: number; min: number; max: number; zones?: Zone[]; valueText: string; statusText: string; className?: string };
export function Gauge({ label, value, min, max, zones = [], valueText, statusText, className = '' }: Props) {
  const id = useId();
  const span = Math.max(1, max - min);
  const percent = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  return <div className={`border border-line bg-ink-1 p-4 ${className}`}>
    <div className="flex items-baseline justify-between gap-3"><label id={id} className="text-step-1 font-semibold uppercase tracking-[.08em] text-bone-2">{label}</label><strong className="font-mono text-step-2 tabular-nums text-amber">{valueText}</strong></div>
    <div role="meter" aria-labelledby={id} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${valueText} · ${statusText}`} className="relative mt-6 h-8 border-y border-line-hi bg-ink-2 [container-type:inline-size]">
      {zones.map((zone, index) => <div key={index} aria-hidden="true" className={`absolute bottom-1 top-1 ${zone.kind === 'ok' ? 'bg-verdigris' : 'bg-oxide'}`} style={{ left: `${((zone.from - min) / span) * 100}%`, width: `${((zone.to - zone.from) / span) * 100}%` }}/>) }
      <div aria-hidden="true" className="absolute bottom-[-6px] top-[-6px] w-[2px] bg-bone transition-transform duration-120 ease-mech" style={{ left: 0, transform: `translateX(calc(${percent}cqw - 1px))` }}/>
      <span aria-hidden="true" className="absolute bottom-[-10px] h-0 w-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-bone transition-transform duration-120 ease-mech" style={{ left: 0, transform: `translateX(calc(${percent}cqw - 50%))` }}/>
    </div>
    <div className="mt-3 flex justify-between font-mono text-step-0 tabular-nums text-amber"><span>{min}</span><span className="text-bone">{statusText}</span><span>{max}</span></div>
  </div>;
}
