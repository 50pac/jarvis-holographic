import type { ArmorDef } from './armorRegistry';
import type { CustomArmorRecord } from './customArmorDb';

export function customArmorDef(record: CustomArmorRecord, modelUrl: string): ArmorDef {
  return {
    id: record.id,
    nameEn: record.nameEn,
    nameZh: record.nameZh,
    aliases: record.aliases,
    kind: 'glb',
    modelUrl,
    theme: record.theme ?? { primary: '#9a7bff', secondary: '#3c568e', glow: '#c8bdff', scanline: '#a9d6ff' },
    sound: { pitch: 570, duration: 0.5, noise: 0.16 },
    description: '用户上传 · 仅本地',
    stats: { armor: 70, speed: 70, power: 70, stealth: 70 },
  };
}
