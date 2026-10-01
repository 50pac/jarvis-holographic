import { describe, expect, it } from 'vitest';
import { resolveArmorHotkey, type ArmorHotkeyInput } from './armorHotkeys';

const base: ArmorHotkeyInput = {
  key: 'a', ctrlKey: false, metaKey: false, altKey: false,
  repeat: false, targetIsEditable: false, commandActive: false, pickerOpen: false,
};

describe('resolveArmorHotkey', () => {
  it('toggles with A but ignores repeated A', () => {
    expect(resolveArmorHotkey(base)).toBe('toggle');
    expect(resolveArmorHotkey({ ...base, key: 'A', repeat: true })).toBeNull();
  });

  it('ignores editable targets, command input and modifiers', () => {
    expect(resolveArmorHotkey({ ...base, targetIsEditable: true })).toBeNull();
    expect(resolveArmorHotkey({ ...base, commandActive: true })).toBeNull();
    expect(resolveArmorHotkey({ ...base, ctrlKey: true })).toBeNull();
    expect(resolveArmorHotkey({ ...base, metaKey: true })).toBeNull();
    expect(resolveArmorHotkey({ ...base, altKey: true })).toBeNull();
  });

  it('uses arrows, Enter and Escape only while open', () => {
    expect(resolveArmorHotkey({ ...base, key: 'ArrowLeft' })).toBeNull();
    expect(resolveArmorHotkey({ ...base, key: 'Enter' })).toBeNull();
    expect(resolveArmorHotkey({ ...base, key: 'ArrowLeft', pickerOpen: true })).toBe('prev');
    expect(resolveArmorHotkey({ ...base, key: 'ArrowRight', pickerOpen: true })).toBe('next');
    expect(resolveArmorHotkey({ ...base, key: 'Enter', pickerOpen: true })).toBe('confirm');
    expect(resolveArmorHotkey({ ...base, key: 'Escape', pickerOpen: true })).toBe('close');
  });
});
