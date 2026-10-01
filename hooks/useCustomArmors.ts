import { useCallback, useEffect, useRef, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { customArmorDef } from '../armors/customArmorDef';
import { deleteCustomArmor, listCustomArmors, putCustomArmor, type CustomArmorRecord } from '../armors/customArmorDb';
import { registerCustomArmor, unregisterCustomArmor, type ArmorDef } from '../armors/armorRegistry';
import { MAX_CUSTOM_GLB_BYTES, validateCustomGlb } from '../armors/customGlbValidate';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '自定义战甲操作失败。';
}

function clearModelUrl(url: string): void {
  useLoader.clear(GLTFLoader, url);
  URL.revokeObjectURL(url);
}

function parseGlb(bytes: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes, '', () => resolve(), reject);
  });
}

export function useCustomArmors() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef(new Map<string, string>());
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void listCustomArmors().then(records => {
      if (cancelled) return;
      const skipped: string[] = [];
      for (const record of records) {
        if (!record.id.startsWith('custom-') || !(record.blob instanceof Blob)) {
          skipped.push(record.fileName || record.id);
          continue;
        }
        const url = URL.createObjectURL(record.blob);
        try {
          registerCustomArmor(customArmorDef(record, url));
          urlsRef.current.set(record.id, url);
        } catch {
          URL.revokeObjectURL(url);
          skipped.push(record.fileName);
        }
      }
      if (skipped.length) setError(`部分已保存战甲无法载入：${skipped.join('、')}`);
    }).catch(reason => {
      if (!cancelled) setError(errorMessage(reason));
    }).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      for (const [id, url] of urlsRef.current) {
        unregisterCustomArmor(id);
        clearModelUrl(url);
      }
      urlsRef.current.clear();
    };
  }, []);

  const upload = useCallback(async (file: File, name?: string): Promise<ArmorDef | null> => {
    if (busyRef.current || !ready) return null;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (file.size > MAX_CUSTOM_GLB_BYTES) throw new Error('文件超过 32 MiB 上限。');
      const bytes = await file.arrayBuffer();
      const validation = validateCustomGlb(file.name, bytes);
      if ('error' in validation) throw new Error(validation.error);
      try {
        await parseGlb(bytes);
      } catch (reason) {
        throw new Error(`模型解析失败：${errorMessage(reason)}`);
      }
      const displayName = (name?.trim() || file.name.replace(/\.glb$/i, '')).slice(0, 60).trim();
      if (!displayName) throw new Error('请输入战甲名称。');
      const id = `custom-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const record: CustomArmorRecord = {
        id, nameEn: displayName, nameZh: displayName, aliases: [],
        fileName: file.name, mime: 'model/gltf-binary', size: file.size,
        createdAt: Date.now(), blob: new Blob([bytes], { type: 'model/gltf-binary' }),
      };
      // The registry checks all aliases and names, including built-in suits.
      const url = URL.createObjectURL(record.blob);
      const def = customArmorDef(record, url);
      try {
        registerCustomArmor(def);
        await putCustomArmor(record);
        urlsRef.current.set(id, url);
      } catch (reason) {
        unregisterCustomArmor(id);
        clearModelUrl(url);
        throw reason;
      }
      return def;
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message.startsWith('Armor alias conflicts') ? '战甲名称已存在，请换一个名称。' : message);
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [ready]);

  const remove = useCallback(async (id: string, beforeUnregister?: () => void): Promise<boolean> => {
    if (busyRef.current || !ready || !urlsRef.current.has(id)) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteCustomArmor(id);
      beforeUnregister?.();
      unregisterCustomArmor(id);
      const url = urlsRef.current.get(id)!;
      urlsRef.current.delete(id);
      // Give React a turn to remove the old scene before releasing its loader URL.
      window.setTimeout(() => clearModelUrl(url), 0);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [ready]);

  return { ready, busy, error, upload, remove };
}
