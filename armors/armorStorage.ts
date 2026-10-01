import { DEFAULT_ARMOR_ID, ARMOR_STORAGE_KEY } from './armorRegistry';
import { normalizeArmorId } from './armorCycle';

export function loadArmorId(storage?: Pick<Storage, 'getItem'>, ids: readonly string[] = []): string {
  try {
    const source = storage ?? globalThis.localStorage;
    return normalizeArmorId(ids, source.getItem(ARMOR_STORAGE_KEY) ?? '', DEFAULT_ARMOR_ID);
  } catch {
    return DEFAULT_ARMOR_ID;
  }
}

export function saveArmorId(id: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(ARMOR_STORAGE_KEY, id);
  } catch {
    // Storage may be blocked or absent (e.g. private browsing or SSR).
  }
}
