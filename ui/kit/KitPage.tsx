import { useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { useMotionPref } from '../useMotionPref';
import { Button, Gauge, KeyCap, Modal, Panel, StatusStrip, TicketCard, Toggle, useToast } from '../index';

type Tone = 'ink-0' | 'ink-1' | 'ink-2' | 'line' | 'line-hi' | 'bone' | 'bone-2' | 'bone-3' | 'signal' | 'amber' | 'verdigris' | 'warn' | 'danger' | 'oxide';
const tones: Tone[] = ['ink-0', 'ink-1', 'ink-2', 'line', 'line-hi', 'bone', 'bone-2', 'bone-3', 'signal', 'amber', 'verdigris', 'warn', 'danger', 'oxide'];
const nav = ['colors', 'type', 'buttons', 'panel', 'tickets', 'gauges', 'toggles', 'toasts', 'modal', 'keys', 'status'] as const;
const useKeys: Record<Tone, string> = {
  'ink-0': 'kit.token.use.ink', 'ink-1': 'kit.token.use.ink', 'ink-2': 'kit.token.use.ink',
  line: 'kit.token.use.line', 'line-hi': 'kit.token.use.line', bone: 'kit.token.use.text',
  'bone-2': 'kit.token.use.text', 'bone-3': 'kit.token.use.text', signal: 'kit.token.use.signal',
  amber: 'kit.token.use.readout', verdigris: 'kit.token.use.good', warn: 'kit.token.use.warn',
  danger: 'kit.token.use.danger', oxide: 'kit.token.use.graphic',
};
function luminance(hex: string) {
  const channels = hex.replace('#', '').match(/.{2}/g)?.map(pair => parseInt(pair, 16) / 255) ?? [0, 0, 0];
  const [r, g, b] = channels.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light + .05) / (dark + .05)).toFixed(2);
}
function TokenCard({ tone }: { tone: Tone }) {
  const { t } = useI18n();
  const style = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const hex = style?.getPropertyValue(`--${tone}`).trim() || '';
  const floor = style?.getPropertyValue('--ink-0').trim() || '';
  return <div className="border border-line bg-ink-1 p-3">
    <div className="h-16 border border-line-hi" style={{ backgroundColor: hex }} aria-hidden="true"/>
    <div className="mt-3 flex items-baseline justify-between gap-2"><strong className="font-mono text-step-1 text-bone">{t(`kit.token.${tone}`)}</strong><span className="font-mono text-step-0 text-bone-2">{hex}</span></div>
    <div className="mt-1 flex justify-between gap-2 text-step-0 text-bone-2"><span>{t(useKeys[tone])}</span><span className="tabular-nums">{t('kit.contrast', { ratio: contrast(hex || floor, floor) })}</span></div>
  </div>;
}
function Section({ id, children }: { id: typeof nav[number]; children: ReactNode }) {
  const { t } = useI18n();
  return <section id={id} className="scroll-mt-6"><Panel title={t(`kit.nav.${id}`)} roomy>{children}</Panel></section>;
}
export default function KitPage() {
  const { lang, setLang, t } = useI18n();
  const { reduced, systemReduced, setUserSetting } = useMotionPref();
  const { push } = useToast();
  const [torque, setTorque] = useState(Number(t('kit.gauge.okValue')));
  const [power, setPower] = useState(false);
  const [secondPower, setSecondPower] = useState(true);
  const [open, setOpen] = useState(false);
  const faults = [t('kit.order.fault.leak'), t('kit.order.fault.crack'), t('kit.order.fault.paint')];
  const gaugeMin = Number(t('kit.gauge.min'));
  const gaugeMax = Number(t('kit.gauge.max'));
  const okFrom = Number(t('kit.gauge.okFrom'));
  const okTo = Number(t('kit.gauge.okTo'));
  const status = torque < okFrom ? t('s3.gauge.torque.low') : torque > okTo ? t('s3.gauge.torque.high') : t('s3.gauge.torque.ok');
  const sampleButtons = ['primary', 'secondary', 'text'] as const;
  const buttonText = { primary: t('kit.button.primary'), secondary: t('kit.button.secondary'), text: t('kit.button.text') };
  return <div className="h-screen overflow-y-auto bg-ink-0 text-bone">
    <div aria-hidden="true" className="ui-hazard h-[6px]"/>
    <div className="mx-auto max-w-[1600px] pb-24 xl:grid xl:grid-cols-[72px_minmax(0,1fr)]">
      <nav aria-label={t('kit.title')} className="sticky top-0 z-10 hidden h-screen flex-col gap-1 overflow-y-auto border-r border-line bg-ink-1 p-1 xl:flex">
        {nav.map(item => <a key={item} href={`#${item}`} className="min-h-12 border-b border-line px-1 py-2 text-center text-step-0 text-bone-2 hov:bg-ink-2 hov:text-bone">{t(`kit.nav.${item}`)}</a>)}
      </nav>
      <main className="space-y-6 px-6 py-8 lg:px-10">
        <header className="border-b-2 border-signal pb-6">
          <div className="font-mono text-step-0 uppercase tracking-[.08em] text-amber">{t('kit.subtitle')}</div>
          <h1 className="mt-2 font-display text-step-6 font-extrabold tracking-[.04em] text-bone">{t('kit.title')}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-step-1 text-bone-2">{t('s8.lang')}</span>
            <Button variant="secondary" aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>{t('kit.language.zh')}</Button>
            <Button variant="secondary" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>{t('kit.language.en')}</Button>
            <Toggle checked={reduced} disabled={systemReduced} lockedReason={systemReduced ? t('s8.motion.locked') : undefined} onChange={checked => setUserSetting(checked ? 'reduce' : 'full')} label={t('ui.motion.reduced')}/>
          </div>
        </header>
        <Section id="colors"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{tones.map(tone => <TokenCard key={tone} tone={tone}/>)}</div></Section>
        <Section id="type"><div className="space-y-5">{[72, 40, 28, 20, 16, 14, 12].map(size => <div key={size} className="grid grid-cols-[52px_1fr] gap-4 border-b border-line pb-3"><span className="font-mono text-step-0 tabular-nums text-amber">{size}</span><div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 overflow-hidden"><span className="font-display font-extrabold tracking-[.04em]" style={{ fontSize: size }}>{t('kit.sample.display')}</span><span className="font-sans font-semibold" style={{ fontSize: size }}>{t('kit.sample.sans')}</span><span className="font-mono tabular-nums" style={{ fontSize: size }}>{t('kit.sample.mono')}</span></div></div>)}</div></Section>
        <Section id="buttons"><div className="space-y-5">{sampleButtons.map(variant => <div key={variant} className="grid gap-5 border-b border-line pb-5 lg:grid-cols-2">{(['md', 'lg'] as const).map(size => <div key={size} className="flex flex-wrap items-center gap-5"><Button variant={variant} size={size}>{buttonText[variant]}</Button><Button variant={variant} size={size} leadingKey={t('kit.key.space')}>{buttonText[variant]}</Button><Button variant={variant} size={size} disabled>{t('kit.button.disabled')}</Button></div>)}</div>)}</div></Section>
        <Section id="panel"><Panel title={t('kit.panel.title')} right={<KeyCap>{t('kit.key.help')}</KeyCap>}><p className="text-step-2">{t('kit.panel.body')}</p></Panel></Section>
        <Section id="tickets"><div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">{(['open', 'selected', 'done', 'locked'] as const).map(state => <div key={state}><div className="mb-2 font-mono text-step-0 text-amber">{t(`kit.ticket.${state}`)}</div><TicketCard id={t('kit.order.id')} name={t('kit.order.name')} stars={Number(t('kit.order.stars'))} faults={faults} state={state} stamp={t('kit.order.stamp')}/></div>)}</div></Section>
        <Section id="gauges"><div className="grid gap-5 lg:grid-cols-3">{([Number(t('kit.gauge.lowValue')), torque, Number(t('kit.gauge.highValue'))] as const).map((value, index) => <Gauge key={index} label={t('kit.gauge.label')} value={value} min={gaugeMin} max={gaugeMax} zones={[{ from: gaugeMin, to: okFrom, kind: 'low' }, { from: okFrom, to: okTo, kind: 'ok' }, { from: okTo, to: gaugeMax, kind: 'high' }]} valueText={t('kit.gauge.reading', { n: value })} statusText={value < okFrom ? t('s3.gauge.torque.low') : value > okTo ? t('s3.gauge.torque.high') : t('s3.gauge.torque.ok')}/>)}</div><label className="mt-4 block text-step-1 text-bone-2" htmlFor="kit-torque">{t('kit.gauge.adjust')}: <span className="font-mono tabular-nums text-amber">{torque}</span> · {status}</label><input id="kit-torque" type="range" min={gaugeMin} max={gaugeMax} value={torque} onChange={event => setTorque(Number(event.target.value))} className="mt-3 w-full accent-signal"/></Section>
        <Section id="toggles"><div className="flex flex-wrap gap-8"><Toggle checked={power} onChange={setPower} label={t('kit.toggle.label')}/><Toggle checked={secondPower} onChange={setSecondPower} label={t('kit.toggle.label')}/><Toggle checked disabled lockedReason={t('s8.motion.locked')} label={t('kit.toggle.disabled')}/></div></Section>
        <Section id="toasts"><div className="flex flex-wrap gap-4">{(['info', 'ok', 'warn', 'danger'] as const).map(kind => <Button key={kind} variant="secondary" onClick={() => push({ kind, text: t(`kit.toast.${kind}`) })}>{t(`kit.toast.show.${kind}`)}</Button>)}</div></Section>
        <Section id="modal"><Button onClick={() => setOpen(true)}>{t('kit.modal.open')}</Button></Section>
        <Section id="keys"><p className="mb-4 text-step-1 text-bone-2">{t('kit.keys.hint')}</p><div className="flex flex-wrap gap-3">{(['space', 'right', 'escape', 'undo', 'help'] as const).map(key => <KeyCap key={key}>{t(`kit.key.${key}`)}</KeyCap>)}</div></Section>
        <Section id="status"><p className="text-step-1 text-bone-2">{t('kit.status.hint')}</p></Section>
      </main>
    </div>
    <StatusStrip className="fixed bottom-0 left-0 right-0 z-20" items={[{ state: 'online', label: t('status.gesture.on') }, { state: 'off', label: t('kit.status.voice') }, { state: 'error', label: t('kit.status.error') }]} hint={<>{t('kit.status.hint')} <KeyCap>{t('kit.key.help')}</KeyCap></>}/>
    <Modal open={open} title={t('kit.modal.title')} onClose={() => setOpen(false)}><p className="mb-6 text-step-2">{t('kit.modal.body')}</p><div className="flex gap-4"><Button onClick={() => setOpen(false)}>{t('kit.modal.confirm')}</Button><Button variant="secondary" onClick={() => setOpen(false)}>{t('kit.modal.cancel')}</Button></div></Modal>
  </div>;
}
