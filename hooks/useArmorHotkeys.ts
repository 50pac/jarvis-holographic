import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { resolveArmorHotkey } from '../armors/armorHotkeys';

interface ArmorHotkeyOptions {
  commandActiveRef: MutableRefObject<boolean>;
  pickerOpen: boolean;
  togglePicker: () => void;
  closePicker: () => void;
  nextArmor: () => void;
  prevArmor: () => void;
  showArmorSuit: () => void;
}

export function useArmorHotkeys(options: ArmorHotkeyOptions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLElement && (
        target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable="true"]')
      );
      const action = resolveArmorHotkey({
        key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey,
        repeat: event.repeat, targetIsEditable: editable, commandActive: options.commandActiveRef.current,
        pickerOpen: options.pickerOpen,
      });
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action === 'toggle') options.togglePicker();
      if (action === 'close') options.closePicker();
      if (action === 'confirm') { options.closePicker(); options.showArmorSuit(); }
      if (action === 'prev') { options.prevArmor(); options.showArmorSuit(); }
      if (action === 'next') { options.nextArmor(); options.showArmorSuit(); }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [options.commandActiveRef, options.pickerOpen, options.togglePicker, options.closePicker, options.nextArmor, options.prevArmor, options.showArmorSuit]);
}
