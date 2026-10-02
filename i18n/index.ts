import { useSyncExternalStore } from 'react';
import { zh } from './zh';
import { en } from './en';

export type Lang = 'zh' | 'en';
export type TextKey = keyof typeof zh;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type RootLike = Pick<HTMLElement, 'lang'>;

export function createLanguageStore(deps: { language?: string; storage?: StorageLike; root?: RootLike } = {}) {
  const storage = deps.storage ?? (typeof window !== 'undefined' ? (() => { try { return window.localStorage; } catch { return undefined; } })() : undefined);
  const root = deps.root ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  let lang: Lang = (deps.language ?? (typeof navigator !== 'undefined' ? navigator.language : 'en')).toLowerCase().startsWith('zh') ? 'zh' : 'en';
  try { const stored = storage?.getItem('wright.lang'); if (stored === 'zh' || stored === 'en') lang = stored; } catch { /* Keep detected language. */ }
  const listeners = new Set<() => void>();
  const syncRoot = () => { if (root) root.lang = lang === 'zh' ? 'zh-CN' : 'en'; };
  syncRoot();
  return {
    getSnapshot: () => lang,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    setLang: (next: Lang) => {
      lang = next;
      try { storage?.setItem('wright.lang', next); } catch { /* Keep in-memory language. */ }
      syncRoot();
      listeners.forEach(listener => listener());
    },
    t: (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
  };
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dictionary: Record<string, string> = lang === 'zh' ? zh : en;
  const value = dictionary[key];
  if (value === undefined) {
    if (import.meta.env?.DEV) console.warn(`Missing translation: ${key}`);
    return key;
  }
  return value.replace(/\{(\w+)\}/g, (match, name: string) => params?.[name] === undefined ? match : String(params[name]));
}

export const languageStore = createLanguageStore();
export const t = languageStore.t;
export function useI18n() {
  const lang = useSyncExternalStore(languageStore.subscribe, languageStore.getSnapshot, languageStore.getSnapshot);
  return { lang, setLang: languageStore.setLang, t: (key: string, params?: Record<string, string | number>) => translate(lang, key, params) };
}
