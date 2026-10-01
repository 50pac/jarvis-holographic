import type { ArmorTheme } from './armorRegistry';

export const CUSTOM_ARMOR_DB_NAME = 'jarvis.customArmor.v1';
const STORE_NAME = 'armors';

export interface CustomArmorRecord {
  id: string;
  nameEn: string;
  nameZh: string;
  aliases: string[];
  theme?: ArmorTheme;
  fileName: string;
  mime: string;
  size: number;
  createdAt: number;
  blob: Blob;
}

function factoryOrDefault(factory?: IDBFactory): IDBFactory {
  const result = factory ?? globalThis.indexedDB;
  if (!result) throw new Error('此浏览器无法使用 IndexedDB，不能保存自定义战甲。');
  return result;
}

function openDatabase(factory?: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factoryOrDefault(factory).open(CUSTOM_ARMOR_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开自定义战甲数据库。'));
    request.onblocked = () => reject(new Error('自定义战甲数据库被其他页面占用，请关闭其他页面后重试。'));
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, setResult: (value: T) => void) => void, factory?: IDBFactory): Promise<T> {
  const db = await openDatabase(factory);
  return new Promise<T>((resolve, reject) => {
    let result: T;
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, mode);
      action(tx.objectStore(STORE_NAME), value => { result = value; });
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('自定义战甲数据库操作失败。')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('自定义战甲数据库操作已取消。')); };
  });
}

export function listCustomArmors(factory?: IDBFactory): Promise<CustomArmorRecord[]> {
  return transact('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result as CustomArmorRecord[]);
  }, factory);
}

export function getCustomArmor(id: string, factory?: IDBFactory): Promise<CustomArmorRecord | undefined> {
  return transact('readonly', (store, setResult) => {
    const request = store.get(id);
    request.onsuccess = () => setResult(request.result as CustomArmorRecord | undefined);
  }, factory);
}

export function putCustomArmor(record: CustomArmorRecord, factory?: IDBFactory): Promise<void> {
  return transact('readwrite', store => { store.put(record); }, factory);
}

export function deleteCustomArmor(id: string, factory?: IDBFactory): Promise<void> {
  return transact('readwrite', store => { store.delete(id); }, factory);
}
