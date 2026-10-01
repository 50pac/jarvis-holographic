import { describe, expect, it } from 'vitest';
import { customArmorDef } from './customArmorDef';
import { deleteCustomArmor, getCustomArmor, listCustomArmors, putCustomArmor, type CustomArmorRecord } from './customArmorDb';
import { cycleArmorId } from './armorCycle';
import { findArmorByName, getArmor, listArmors, registerCustomArmor, unregisterCustomArmor } from './armorRegistry';
import { parseCommand } from '../commands/commandParser';

/** A small in-memory IDBFactory implementing the requests used by customArmorDb. */
function memoryIdb(): IDBFactory {
  const rows = new Map<string, CustomArmorRecord>();
  let created = false;
  const factory = {
    open() {
      const request: Record<string, any> = { result: undefined };
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: () => created },
          createObjectStore: () => { created = true; },
          close: () => {},
          transaction: () => {
            const tx: Record<string, any> = {};
            const operation = (value: () => unknown) => {
              const result: Record<string, any> = {};
              queueMicrotask(() => {
                result.result = value();
                result.onsuccess?.();
                queueMicrotask(() => tx.oncomplete?.());
              });
              return result;
            };
            tx.objectStore = () => ({
              getAll: () => operation(() => [...rows.values()]),
              get: (id: string) => operation(() => rows.get(id)),
              put: (record: CustomArmorRecord) => operation(() => { rows.set(record.id, record); }),
              delete: (id: string) => operation(() => { rows.delete(id); }),
            });
            return tx;
          },
        };
        request.result = db;
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return factory as unknown as IDBFactory;
}

describe('custom armor IndexedDB', () => {
  const record: CustomArmorRecord = {
    id: 'custom-test-1', nameEn: 'Nebula One', nameZh: '星云一号', aliases: ['nebula'],
    fileName: 'nebula.glb', mime: 'model/gltf-binary', size: 4, createdAt: 123,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'model/gltf-binary' }),
  };

  it('persists put/get/list/delete across separate database opens', async () => {
    const factory = memoryIdb();
    expect(await listCustomArmors(factory)).toEqual([]);
    await putCustomArmor(record, factory);
    expect(await getCustomArmor(record.id, factory)).toEqual(record);
    expect(await listCustomArmors(factory)).toEqual([record]);
    await deleteCustomArmor(record.id, factory);
    expect(await getCustomArmor(record.id, factory)).toBeUndefined();
    expect(await listCustomArmors(factory)).toEqual([]);
  });

  it('hydrates a saved armor into name resolution and the cycle, then unregisters it', async () => {
    const factory = memoryIdb();
    await putCustomArmor(record, factory);
    const [saved] = await listCustomArmors(factory);
    const def = customArmorDef(saved, 'blob:test-nebula');
    try {
      registerCustomArmor(def);
      expect(getArmor(record.id)).toBe(def);
      expect(findArmorByName('换装星云一号')).toBe(def);
      expect(parseCommand('switch to Nebula One')).toEqual({ type: 'armorSwitch', target: 'id', id: record.id });
      const ids = listArmors().map(armor => armor.id);
      expect(cycleArmorId(ids, 'atlas', 1)).toBe(record.id);
    } finally {
      unregisterCustomArmor(record.id);
    }
    expect(getArmor(record.id)).toBeUndefined();
  });
});
