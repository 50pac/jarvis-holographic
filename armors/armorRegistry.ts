import ironmanUrl from '../assets/modules/ironman.glb?url';
import type { MechParams } from './mechParams';

export type MaterialValues = Partial<{
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
}>;

export interface MaterialOverride {
  byMaterialName?: Record<string, MaterialValues>;
  default?: MaterialValues;
}

export interface ArmorTheme {
  primary: string;
  secondary: string;
  glow: string;
  scanline: string;
}

export interface ArmorDef {
  id: string;
  nameEn: string;
  nameZh: string;
  aliases: string[];
  kind: 'glb' | 'procedural';
  modelUrl?: string;
  materialOverride?: MaterialOverride;
  mech?: MechParams;
  theme: ArmorTheme;
  sound: { pitch: number; duration: number; noise: number };
  description: string;
  stats: { armor: number; speed: number; power: number; stealth: number };
  defaultScale?: number;
  footOffset?: number;
}

export const DEFAULT_ARMOR_ID = 'mark-85';
export const ARMOR_STORAGE_KEY = 'jarvis.armorId';

const builtIns: ArmorDef[] = [
  {
    id: 'mark-85', nameEn: 'Mark 85', nameZh: '马克85',
    aliases: ['mark 85', 'mark85', '马克85'], kind: 'glb', modelUrl: ironmanUrl,
    theme: { primary: '#00f0ff', secondary: '#1476a8', glow: '#9bfaff', scanline: '#43dfff' },
    sound: { pitch: 620, duration: 0.48, noise: 0.18 },
    description: '纳米科技战甲，兼顾机动性与全面防护。',
    stats: { armor: 80, speed: 85, power: 88, stealth: 50 }, defaultScale: 1.1,
  },
  {
    id: 'mark-3', nameEn: 'Mark 3', nameZh: '马克3',
    aliases: ['mark 3', 'mark3', '马克3', '红金'], kind: 'glb', modelUrl: ironmanUrl,
    materialOverride: {
      default: { metalness: 0.78, roughness: 0.3 },
      byMaterialName: {
        'Mat.2': { color: '#d4a017', metalness: 0.88, roughness: 0.25 },
        material: { color: '#333036', metalness: 0.7, roughness: 0.38 },
        'Mat.1': { color: '#b3121b', metalness: 0.82, roughness: 0.27 },
        PaletteMaterial001: { color: '#b3121b', emissive: '#ff9a36', emissiveIntensity: 1.5 },
        PaletteMaterial002: { color: '#d4a017', emissive: '#ff9a36', emissiveIntensity: 1.5 },
        PaletteMaterial003: { color: '#b3121b', emissive: '#ff9a36', emissiveIntensity: 1.5 },
      },
    },
    theme: { primary: '#e94732', secondary: '#d4a017', glow: '#ff9a36', scanline: '#ffca75' },
    sound: { pitch: 490, duration: 0.55, noise: 0.24 },
    description: '经典红金涂装，厚实装甲与暖橙色反应堆光芒。',
    stats: { armor: 76, speed: 66, power: 72, stealth: 25 }, defaultScale: 1.1,
  },
  {
    id: 'mark-42', nameEn: 'Mark 42', nameZh: '马克42',
    aliases: ['mark 42', 'mark42', '马克42', '流线'], kind: 'glb', modelUrl: ironmanUrl,
    materialOverride: {
      default: { metalness: 0.94, roughness: 0.17 },
      byMaterialName: {
        'Mat.2': { color: '#efbd3f', metalness: 0.96, roughness: 0.13 },
        material: { color: '#4a3632', metalness: 0.88, roughness: 0.2 },
        'Mat.1': { color: '#a9232c', metalness: 0.94, roughness: 0.16 },
        PaletteMaterial001: { color: '#e9b844', emissive: '#c8f5ff', emissiveIntensity: 1.8 },
        PaletteMaterial002: { color: '#bd3031', emissive: '#c8f5ff', emissiveIntensity: 1.8 },
        PaletteMaterial003: { color: '#efbd3f', emissive: '#c8f5ff', emissiveIntensity: 1.8 },
      },
    },
    theme: { primary: '#f5c44b', secondary: '#bd3031', glow: '#c8f5ff', scanline: '#8ce8ff' },
    sound: { pitch: 710, duration: 0.4, noise: 0.12 },
    description: '明亮金红的流线装甲，拥有轻快的机动表现。',
    stats: { armor: 62, speed: 90, power: 78, stealth: 38 }, defaultScale: 1.1,
  },
  {
    id: 'stealth', nameEn: 'Stealth', nameZh: '夜行者',
    aliases: ['stealth', '夜行者', '黑金'], kind: 'glb', modelUrl: ironmanUrl,
    materialOverride: {
      default: { metalness: 0.72, roughness: 0.37 },
      byMaterialName: {
        'Mat.2': { color: '#8a6b1e', metalness: 0.8, roughness: 0.31 },
        material: { color: '#0c0c10', metalness: 0.68, roughness: 0.42 },
        'Mat.1': { color: '#0c0c10', metalness: 0.75, roughness: 0.35 },
        PaletteMaterial001: { color: '#0c0c10', emissive: '#e0a13a', emissiveIntensity: 0.9 },
        PaletteMaterial002: { color: '#8a6b1e', emissive: '#e0a13a', emissiveIntensity: 0.9 },
        PaletteMaterial003: { color: '#0c0c10', emissive: '#e0a13a', emissiveIntensity: 0.9 },
      },
    },
    theme: { primary: '#b18a33', secondary: '#4b3d25', glow: '#e0a13a', scanline: '#a67d32' },
    sound: { pitch: 350, duration: 0.62, noise: 0.08 },
    description: '近黑色装甲配暗金纹路，适合隐蔽行动。',
    stats: { armor: 56, speed: 84, power: 64, stealth: 96 }, defaultScale: 1.1,
  },
  {
    id: 'hulkbuster', nameEn: 'Hulkbuster', nameZh: '反浩克装甲',
    aliases: ['hulkbuster', '反浩克', '反浩克装甲', '重型机甲'], kind: 'procedural',
    mech: { size: 1.55, bulk: 1.7, shoulderSize: 1.18, headStyle: 'dome', thrusterCount: 2, primaryColor: '#a61f24', secondaryColor: '#d1a335', glowColor: '#ffb65b' },
    theme: { primary: '#e44736', secondary: '#c69a32', glow: '#ffb65b', scanline: '#ff8c50' },
    sound: { pitch: 260, duration: 0.82, noise: 0.45 },
    description: '红金重型机甲，依靠大体积装甲与双推进器提供压制力。',
    stats: { armor: 100, speed: 25, power: 100, stealth: 5 },
  },
  {
    id: 'atlas', nameEn: 'Atlas', nameZh: '阿特拉斯',
    aliases: ['atlas', '阿特拉斯', '原创机甲'], kind: 'procedural',
    mech: { size: 1.3, bulk: 0.72, shoulderSize: 0.86, headStyle: 'horned', thrusterCount: 4, primaryColor: '#326a9e', secondaryColor: '#d6e3e9', glowColor: '#54edee' },
    theme: { primary: '#56dce9', secondary: '#9bb7d6', glow: '#54edee', scanline: '#a2ffff' },
    sound: { pitch: 810, duration: 0.36, noise: 0.17 },
    description: '原创蓝银机甲，修长机身与四推进器适合高速穿梭。',
    stats: { armor: 65, speed: 94, power: 82, stealth: 60 },
  },
];

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, '');
const registry = new Map<string, ArmorDef>();
const builtInIds = new Set(builtIns.map(def => def.id));
const listeners = new Set<() => void>();

function names(def: ArmorDef): string[] {
  return [def.id, def.nameEn, def.nameZh, ...def.aliases];
}

function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

export function registerArmor(def: ArmorDef): void {
  const id = normalize(def.id);
  if (!id || registry.has(id)) throw new Error(`Armor id already exists or is empty: ${def.id}`);
  const ownNames = new Set<string>();
  for (const name of names(def)) {
    const key = normalize(name);
    if (!key) throw new Error('Armor names and aliases cannot be empty');
    // Duplicate spelling within one armor is harmless (e.g. id and nameEn).
    ownNames.add(key);
  }
  for (const existing of registry.values()) {
    if (names(existing).some(name => ownNames.has(normalize(name)))) {
      throw new Error(`Armor alias conflicts with ${existing.id}`);
    }
  }
  registry.set(id, def);
  notifyListeners();
}

export function unregisterArmor(id: string): void {
  const key = normalize(id);
  if (builtInIds.has(key)) throw new Error(`Cannot unregister built-in armor: ${id}`);
  if (registry.delete(key)) notifyListeners();
}

export function listArmors(): ArmorDef[] {
  return Array.from(registry.values());
}

export function getArmor(id: string): ArmorDef | undefined {
  return registry.get(normalize(id));
}

function containsName(text: string, name: string): boolean {
  const lower = name.toLowerCase();
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (!/[a-z0-9]/.test(lower)) return text.includes(lower);
  // ASCII boundaries reject matches inside words such as "stealthy".
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

export function findArmorByName(text: string): ArmorDef | null {
  const normalized = normalize(text.trim());
  if (!normalized) return null;
  for (const def of registry.values()) {
    if (names(def).some(name => normalize(name) === normalized)) return def;
  }
  const lower = text.toLowerCase();
  let best: { def: ArmorDef; length: number } | null = null;
  for (const def of registry.values()) {
    for (const name of names(def)) {
      if (containsName(lower, name) && (!best || normalize(name).length > best.length)) {
        best = { def, length: normalize(name).length };
      }
    }
  }
  return best?.def ?? null;
}

export function subscribeArmorRegistry(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

builtIns.forEach(registerArmor);
