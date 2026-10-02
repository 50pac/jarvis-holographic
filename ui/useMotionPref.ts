import { useSyncExternalStore } from 'react';

export type MotionSetting = 'system' | 'reduce' | 'full';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type RootLike = Pick<HTMLElement, 'dataset' | 'removeAttribute'>;
type MediaLike = { matches: boolean; addEventListener?: (type: 'change', listener: () => void) => void; removeEventListener?: (type: 'change', listener: () => void) => void }; 
export type MotionSnapshot = Readonly<{
  reduced: boolean;
  userSetting: MotionSetting;
  systemReduced: boolean;
}>;

export function resolveReduced(system: boolean, user: MotionSetting): boolean {
  return system || user === 'reduce';
}

export function createMotionStore(deps: {
  matchMedia?: (query: string) => MediaLike;
  storage?: StorageLike;
  root?: RootLike;
} = {}) {
  const media = (() => {
    try { return deps.matchMedia?.('(prefers-reduced-motion: reduce)') ?? (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined); }
    catch { return undefined; }
  })();
  const storage = deps.storage ?? (typeof window !== 'undefined' ? (() => { try { return window.localStorage; } catch { return undefined; } })() : undefined);
  const root = deps.root ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  let userSetting: MotionSetting = 'system';
  try {
    const stored = storage?.getItem('wright.motion');
    if (stored === 'system' || stored === 'reduce' || stored === 'full') userSetting = stored;
  } catch { /* Storage may be disabled. */ }
  let snapshot: MotionSnapshot = { systemReduced: Boolean(media?.matches), userSetting, reduced: resolveReduced(Boolean(media?.matches), userSetting) };
  const listeners = new Set<() => void>();
  const syncRoot = () => {
    if (snapshot.reduced) root?.dataset && (root.dataset.motion = 'reduce');
    else root?.removeAttribute('data-motion');
  };
  const publish = () => {
    snapshot = { systemReduced: Boolean(media?.matches), userSetting, reduced: resolveReduced(Boolean(media?.matches), userSetting) };
    syncRoot();
    listeners.forEach(listener => listener());
  };
  syncRoot();
  const onMediaChange = () => publish();
  media?.addEventListener?.('change', onMediaChange);
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    setUserSetting: (next: MotionSetting): { locked: boolean } => {
      if (snapshot.systemReduced && next === 'full') return { locked: true };
      userSetting = next;
      try { storage?.setItem('wright.motion', next); } catch { /* Keep in-memory preference. */ }
      publish();
      return { locked: snapshot.systemReduced };
    },
    destroy: () => { media?.removeEventListener?.('change', onMediaChange); listeners.clear(); },
  };
}

export const motionStore = createMotionStore();
export function useMotionPref() {
  const { reduced, userSetting, systemReduced } = useSyncExternalStore(motionStore.subscribe, motionStore.getSnapshot, motionStore.getSnapshot);
  return { reduced, userSetting, systemReduced, setUserSetting: motionStore.setUserSetting };
}
