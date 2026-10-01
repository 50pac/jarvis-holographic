import { useEffect, useState } from 'react';
import { DEFAULT_ARMOR_ID, isCustomArmorId, type ArmorDef } from '../../armors/armorRegistry';

interface ArmorPickerProps {
  armors: ArmorDef[];
  armorId: string;
  selectArmor: (id: string) => void;
  showArmorSuit: () => void;
  closePicker: () => void;
  customReady: boolean;
  customBusy: boolean;
  customError: string | null;
  uploadCustomArmor: (file: File) => Promise<ArmorDef | null>;
  removeCustomArmor: (id: string) => Promise<boolean>;
}

const statLabels = { armor: '装甲', speed: '速度', power: '火力', stealth: '隐匿' } as const;

export default function ArmorPicker({ armors, armorId, selectArmor, showArmorSuit, closePicker,
  customReady, customBusy, customError, uploadCustomArmor, removeCustomArmor }: ArmorPickerProps) {
  const [selectedId, setSelectedId] = useState(armorId);
  useEffect(() => setSelectedId(armorId), [armorId]);
  const selected = armors.find(armor => armor.id === selectedId) ?? armors.find(armor => armor.id === armorId) ?? armors[0];
  if (!selected) return null;

  return (
    <aside data-testid="armor-picker" className="fixed right-4 top-1/2 z-[70] flex max-h-[calc(100vh-2rem)] w-[min(390px,calc(100vw-2rem))] -translate-y-1/2 flex-col overflow-hidden border border-holo-cyan bg-black/90 text-holo-cyan shadow-[0_0_35px_rgb(var(--hud-primary-rgb)/0.28)] backdrop-blur-xl" aria-label="战甲库">
      <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-white" />
      <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-white" />
      <header className="flex items-start justify-between border-b border-holo-cyan/40 px-5 py-4">
        <div>
          <p className="text-[10px] tracking-[0.35em] opacity-70">J.A.R.V.I.S. // EQUIPMENT</p>
          <h2 className="font-display text-xl font-bold tracking-widest">战甲库 <span className="text-xs">ARMORY</span></h2>
        </div>
        <button type="button" onClick={closePicker} className="px-2 text-xl hover:text-white" aria-label="关闭战甲库">×</button>
      </header>

      <section className="border-b border-holo-cyan/25 px-4 py-3 text-xs">
        <label className={`inline-block cursor-pointer border border-holo-cyan/60 px-3 py-2 hover:bg-holo-cyan/10 ${customBusy || !customReady ? 'pointer-events-none opacity-50' : ''}`}>
          {customBusy ? '处理中…' : customReady ? '上传机甲 .glb' : '正在读取本地战甲…'}
          <input type="file" accept=".glb,model/gltf-binary" className="sr-only" disabled={customBusy || !customReady}
            onChange={async event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              const armor = await uploadCustomArmor(file);
              if (armor) { setSelectedId(armor.id); selectArmor(armor.id); showArmorSuit(); }
            }} />
        </label>
        <span className="ml-2 text-white/50">单文件 GLB · ≤32 MiB · 仅保存在本机</span>
        {customError && <p role="alert" className="mt-2 text-red-300">{customError}</p>}
      </section>

      <div className="grid min-h-0 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
        {armors.map(armor => {
          const active = armor.id === armorId;
          const selectedCard = armor.id === selected.id;
          return (
            <div key={armor.id} className="relative">
            <button type="button" data-armor-id={armor.id} data-active={active ? 'true' : undefined}
              onMouseEnter={() => setSelectedId(armor.id)}
              onFocus={() => setSelectedId(armor.id)}
              onClick={() => { setSelectedId(armor.id); selectArmor(armor.id); showArmorSuit(); }}
              className={`group relative flex min-h-20 w-full items-center gap-3 border bg-black/60 p-2 text-left transition-all hover:bg-holo-cyan/10 ${active ? 'border-holo-cyan shadow-[inset_0_0_12px_rgb(var(--hud-primary-rgb)/0.25)]' : selectedCard ? 'border-white/70' : 'border-holo-cyan/25'}`}>
              <span className="h-12 w-10 shrink-0 border border-white/20" style={{ background: `linear-gradient(145deg, ${armor.theme.secondary}, ${armor.theme.primary} 55%, #080b12)` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xs font-bold text-white">{armor.nameEn}</span>
                <span className="block text-xs opacity-75">{armor.nameZh}</span>
                <span className="mt-1 inline-block border border-holo-cyan/40 px-1 text-[9px] tracking-wider">{isCustomArmorId(armor.id) ? 'CUSTOM' : armor.kind === 'glb' ? 'GLB' : 'PROC'}</span>
              </span>
              {active && <span className="absolute right-1 top-1 text-[9px] tracking-wider">已装备</span>}
            </button>
            {isCustomArmorId(armor.id) && <button type="button" disabled={customBusy} aria-label={`删除 ${armor.nameEn}`}
              className="absolute bottom-1 right-1 border border-red-300/50 bg-black/90 px-1.5 py-0.5 text-[10px] text-red-200 hover:bg-red-900/40 disabled:opacity-50"
              onClick={async () => {
                if (await removeCustomArmor(armor.id)) setSelectedId(armorId === armor.id ? DEFAULT_ARMOR_ID : armorId);
              }}>删除</button>}
            </div>
          );
        })}
      </div>

      <section className="border-t border-holo-cyan/40 bg-holo-cyan/5 px-5 py-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-white">{selected.nameEn}</h3>
          <span className="text-xs">{selected.nameZh}</span>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-white/70">{selected.description}</p>
        <div className="space-y-2">
          {(Object.keys(statLabels) as (keyof typeof statLabels)[]).map(stat => (
            <div key={stat} className="flex items-center gap-2 text-[10px]">
              <span className="w-8 shrink-0">{statLabels[stat]}</span>
              <div className="h-1 flex-1 bg-white/10"><div key={`${selected.id}-${stat}`} className="armor-stat-fill h-full bg-holo-cyan shadow-[0_0_8px_var(--hud-glow)]" style={{ width: `${selected.stats[stat]}%` }} /></div>
              <span className="w-6 text-right">{selected.stats[stat]}</span>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-holo-cyan/25 px-4 py-2 text-center text-[10px] tracking-wider opacity-70">A 开关 · ←/→ 切换 · Enter 确认 · Esc 关闭</footer>
    </aside>
  );
}
