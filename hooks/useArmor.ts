import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { cycleArmorId } from '../armors/armorCycle';
import { getArmor, listArmors, subscribeArmorRegistry } from '../armors/armorRegistry';
import { loadArmorId, saveArmorId } from '../armors/armorStorage';
import { themeToCssVars } from '../armors/armorTheme';
import { SoundService } from '../services/soundService';

export interface ArmorTransition {
  tick: number;
  from: string | null;
  startedAt: number;
}

interface ArmorOptions {
  startTypewrite: (role: 'I' | 'J', text: string) => void;
  speakingRef: MutableRefObject<boolean>;
  ttsEndAtRef: MutableRefObject<number>;
}

export function useArmor({ startTypewrite, speakingRef, ttsEndAtRef }: ArmorOptions) {
  const [registryVersion, setRegistryVersion] = useState(0);
  const [armorId, setArmorId] = useState(() => loadArmorId(undefined, listArmors().map(armor => armor.id)));
  const armorIdRef = useRef(armorId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [transition, setTransition] = useState<ArmorTransition>({ tick: 0, from: null, startedAt: 0 });
  const speechTokenRef = useRef(0);
  const armors = useMemo(() => listArmors(), [registryVersion]);

  useEffect(() => subscribeArmorRegistry(() => setRegistryVersion(version => version + 1)), []);
  useEffect(() => {
    const theme = getArmor(armorId)?.theme;
    if (!theme) return;
    const vars = themeToCssVars(theme);
    for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) document.documentElement.style.removeProperty(name);
    };
  }, [armorId, registryVersion]);

  const selectArmor = useCallback((id: string, options: { announce?: boolean } = {}) => {
    const armor = getArmor(id);
    if (!armor || armor.id === armorIdRef.current) return;
    const from = armorIdRef.current;
    armorIdRef.current = armor.id;
    setArmorId(armor.id);
    saveArmorId(armor.id);
    setTransition(previous => ({ tick: previous.tick + 1, from, startedAt: Date.now() }));
    SoundService.playArmorSwitch(armor.sound);
    if (options.announce !== false) {
      const message = `Armor switched to ${armor.nameEn}`;
      startTypewrite('J', message);
      const token = ++speechTokenRef.current;
      speakingRef.current = true;
      void SoundService.speak(message).catch(error => console.error('Armor TTS error', error)).finally(() => {
        if (speechTokenRef.current === token) {
          speakingRef.current = false;
          ttsEndAtRef.current = Date.now();
        }
      });
    }
  }, [speakingRef, startTypewrite, ttsEndAtRef]);

  const nextArmor = useCallback(() => {
    selectArmor(cycleArmorId(listArmors().map(armor => armor.id), armorIdRef.current, 1));
  }, [selectArmor]);
  const prevArmor = useCallback(() => {
    selectArmor(cycleArmorId(listArmors().map(armor => armor.id), armorIdRef.current, -1));
  }, [selectArmor]);
  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const togglePicker = useCallback(() => setPickerOpen(open => !open), []);

  return { armorId, armors, pickerOpen, transition, selectArmor, nextArmor, prevArmor, openPicker, closePicker, togglePicker };
}
