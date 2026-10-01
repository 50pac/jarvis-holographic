import { describe, expect, it } from 'vitest';
import { parseCommand } from '../commands/commandParser';
import {
  DEFAULT_ARMOR_ID, findArmorByName, getArmor, listArmors,
  registerArmor, subscribeArmorRegistry, unregisterArmor, type ArmorDef,
} from './armorRegistry';

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, '');
const color = /^#[0-9a-f]{6}$/i;

function customArmor(id: string, aliases: string[]): ArmorDef {
  return {
    id, nameEn: 'Custom Suit', nameZh: '自定义战甲', aliases, kind: 'procedural',
    mech: { size: 1, bulk: 1, headStyle: 'visor', thrusterCount: 2, primaryColor: '#123456', secondaryColor: '#abcdef', glowColor: '#ffffff' },
    theme: { primary: '#123456', secondary: '#abcdef', glow: '#ffffff', scanline: '#fedcba' },
    sound: { pitch: 500, duration: 0.5, noise: 0.2 },
    description: '测试战甲。', stats: { armor: 50, speed: 50, power: 50, stealth: 50 },
  };
}

describe('armor registry', () => {
  it('contains six ordered, complete built-in definitions with unique names', () => {
    const armors = listArmors();
    expect(armors.map(armor => armor.id)).toEqual(['mark-85', 'mark-3', 'mark-42', 'stealth', 'hulkbuster', 'atlas']);
    expect(DEFAULT_ARMOR_ID).toBe('mark-85');
    const owner = new Map<string, string>();
    for (const armor of armors) {
      expect(getArmor(armor.id)).toBe(armor);
      for (const name of [armor.id, armor.nameEn, armor.nameZh, ...armor.aliases]) {
        const key = normalize(name);
        expect(owner.get(key) === undefined || owner.get(key) === armor.id).toBe(true);
        owner.set(key, armor.id);
      }
      for (const value of Object.values(armor.theme)) expect(value).toMatch(color);
      expect(armor.sound.pitch).toBeGreaterThan(0);
      expect(armor.sound.pitch).toBeLessThan(2000);
      expect(armor.sound.duration).toBeGreaterThan(0);
      expect(armor.sound.duration).toBeLessThanOrEqual(2);
      expect(armor.sound.noise).toBeGreaterThanOrEqual(0);
      expect(armor.sound.noise).toBeLessThanOrEqual(1);
      for (const value of Object.values(armor.stats)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      if (armor.kind === 'glb') {
        expect(armor.modelUrl).toBeTruthy();
        expect(armor.mech).toBeUndefined();
      } else {
        expect(armor.mech).toBeDefined();
        expect(armor.mech?.size).toBeGreaterThan(0);
        expect(armor.mech?.thrusterCount).toBeGreaterThan(0);
      }
    }
    expect(getArmor('mark-85')?.materialOverride).toBeUndefined();
    expect(getArmor('mark-85')?.defaultScale).toBe(1.1);
    expect(getArmor('mark-85')?.footOffset).toBeUndefined();
    expect(getArmor('mark-42')?.theme.primary).toBe('#f5c44b');
    expect(getArmor('mark-42')?.theme.glow).toBe('#c8f5ff');
    expect(getArmor('mark-3')?.hologram).toBeUndefined();
    expect(getArmor('stealth')?.theme).toEqual({
      primary: '#a8741a', secondary: '#2b2416', glow: '#ffb02e', scanline: '#8a5f18',
    });
    expect(getArmor('stealth')?.hologram?.wireOpacity).toBe(0.05);
  });

  it('matches exact names first, then bounded text with the longest alias', () => {
    expect(findArmorByName('  MARK   3  ')?.id).toBe('mark-3');
    expect(findArmorByName('切换反浩克装甲')?.id).toBe('hulkbuster');
    expect(findArmorByName('please switch to stealth')?.id).toBe('stealth');
    expect(findArmorByName('stealthy')).toBeNull();
    expect(findArmorByName('remark 3')).toBeNull();
    expect(findArmorByName('')).toBeNull();
  });

  it('allows runtime additions, notifies listeners, and protects built-ins', () => {
    const def = customArmor('custom-suit', ['custom', '定制']);
    let changes = 0;
    const unsubscribe = subscribeArmorRegistry(() => { changes += 1; });
    try {
      registerArmor(def);
      expect(listArmors().at(-1)).toBe(def);
      expect(findArmorByName('switch to custom')?.id).toBe(def.id);
      expect(parseCommand('定制')).toEqual({ type: 'armorSwitch', target: 'id', id: def.id });
      expect(() => registerArmor(def)).toThrow();
      expect(() => registerArmor(customArmor('another', ['custom']))).toThrow();
      expect(() => registerArmor(customArmor('other', ['mark85']))).toThrow();
      expect(() => registerArmor(customArmor('atlas', ['unique']))).toThrow();
      expect(() => unregisterArmor('mark-85')).toThrow();
      expect(changes).toBe(1);
    } finally {
      unregisterArmor(def.id);
      unsubscribe();
    }
    expect(changes).toBe(2);
    expect(getArmor(def.id)).toBeUndefined();
    expect(listArmors()).toHaveLength(6);
  });
});
