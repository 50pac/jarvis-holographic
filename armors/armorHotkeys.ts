export interface ArmorHotkeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  targetIsEditable: boolean;
  commandActive: boolean;
  pickerOpen: boolean;
}

export type ArmorHotkeyAction = 'toggle' | 'prev' | 'next' | 'confirm' | 'close' | null;

export function resolveArmorHotkey(input: ArmorHotkeyInput): ArmorHotkeyAction {
  if (input.ctrlKey || input.metaKey || input.altKey || input.targetIsEditable || input.commandActive) return null;
  if (input.key.toLowerCase() === 'a') return input.repeat ? null : 'toggle';
  if (!input.pickerOpen) return null;
  if (input.key === 'ArrowLeft') return 'prev';
  if (input.key === 'ArrowRight') return 'next';
  if (input.key === 'Enter') return 'confirm';
  if (input.key === 'Escape') return 'close';
  return null;
}
