export interface PalmCannonConfig {
  enabled: boolean;
  fireCooldownMs: number;
  chargeMs: number;
  openPalmScoreMin: number;
  fistScoreMin: number;
  shieldEnabled: boolean;
}

export const PALM_CANNON_STORAGE_KEY = 'jarvis.palmCannon.v1';
export const DEFAULT_PALM_CANNON_CONFIG: PalmCannonConfig = {
  enabled: true,
  fireCooldownMs: 850,
  chargeMs: 250,
  openPalmScoreMin: 0.62,
  fistScoreMin: 0.62,
  shieldEnabled: true,
};

function validNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function loadPalmCannonConfig(storage?: Pick<Storage, 'getItem'>): PalmCannonConfig {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(PALM_CANNON_STORAGE_KEY) ?? '{}');
    const defaults = DEFAULT_PALM_CANNON_CONFIG;
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaults.enabled,
      shieldEnabled: typeof saved.shieldEnabled === 'boolean' ? saved.shieldEnabled : defaults.shieldEnabled,
      fireCooldownMs: validNumber(saved.fireCooldownMs, 100, 5000, defaults.fireCooldownMs),
      chargeMs: validNumber(saved.chargeMs, 50, 2000, defaults.chargeMs),
      openPalmScoreMin: validNumber(saved.openPalmScoreMin, 0, 1, defaults.openPalmScoreMin),
      fistScoreMin: validNumber(saved.fistScoreMin, 0, 1, defaults.fistScoreMin),
    };
  } catch {
    return { ...DEFAULT_PALM_CANNON_CONFIG };
  }
}

export function savePalmCannonConfig(config: PalmCannonConfig, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(PALM_CANNON_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private browsing and SSR can make storage unavailable.
  }
}

export interface PalmCannonState {
  phase: 'idle' | 'charging' | 'spent';
  chargeStartedAt: number | null;
  lastFireAt: number;
}

export const INITIAL_PALM_CANNON_STATE: PalmCannonState = {
  phase: 'idle', chargeStartedAt: null, lastFireAt: -Infinity,
};

export interface PalmCannonInput {
  gesture?: string;
  gestureScore?: number;
  expansionFactor?: number;
  palmNormalZ?: number;
  isPinching?: boolean;
  enabled: boolean;
  nowMs: number;
  state: PalmCannonState;
  config?: PalmCannonConfig;
  manualTrigger?: boolean;
}

export function evaluatePalmCannon(input: PalmCannonInput): {
  action: 'idle' | 'charging' | 'fire' | 'cancel'; nextState: PalmCannonState;
} {
  const config = input.config ?? DEFAULT_PALM_CANNON_CONFIG;
  const active = input.enabled && config.enabled;
  const recognized = !input.isPinching && input.gesture === 'Open_Palm' &&
    (input.gestureScore ?? 0) >= config.openPalmScoreMin;
  const fallbackCandidate = !input.gesture || input.gesture === 'None' || input.gesture === 'Open_Palm';
  const fallback = fallbackCandidate && !input.isPinching &&
    (input.expansionFactor ?? 0) >= 0.78 && (input.palmNormalZ ?? 0) <= -0.55;
  const open = active && (recognized || fallback);
  const state = input.state;
  if (!active || (!open && !input.manualTrigger)) {
    return {
      action: state.phase === 'charging' ? 'cancel' : 'idle',
      nextState: { phase: 'idle', chargeStartedAt: null, lastFireAt: state.lastFireAt },
    };
  }
  const cooled = input.nowMs - state.lastFireAt >= config.fireCooldownMs;
  if (input.manualTrigger && cooled) {
    return { action: 'fire', nextState: { phase: open ? 'spent' : 'idle', chargeStartedAt: null, lastFireAt: input.nowMs } };
  }
  if (!open || !cooled || state.phase === 'spent') return { action: 'idle', nextState: state };
  if (state.phase !== 'charging' || state.chargeStartedAt === null) {
    return { action: 'charging', nextState: { ...state, phase: 'charging', chargeStartedAt: input.nowMs } };
  }
  if (input.nowMs - state.chargeStartedAt >= config.chargeMs) {
    return { action: 'fire', nextState: { phase: 'spent', chargeStartedAt: null, lastFireAt: input.nowMs } };
  }
  return { action: 'charging', nextState: state };
}

export interface FistShieldState { active: boolean }
export const INITIAL_FIST_SHIELD_STATE: FistShieldState = { active: false };

export function evaluateFistShield(input: {
  gesture?: string; gestureScore?: number; expansionFactor?: number; isPinching?: boolean;
  enabled: boolean; nowMs: number; state: FistShieldState; config?: PalmCannonConfig;
}): { active: boolean; nextState: FistShieldState } {
  const config = input.config ?? DEFAULT_PALM_CANNON_CONFIG;
  const fist = input.gesture === 'Closed_Fist' && (input.gestureScore ?? 0) >= config.fistScoreMin;
  const fallback = (!input.gesture || input.gesture === 'None' || input.gesture === 'Closed_Fist') && !input.isPinching &&
    (input.expansionFactor ?? 1) <= 0.16;
  const active = input.enabled && config.enabled && config.shieldEnabled && (fist || fallback);
  return { active, nextState: { active } };
}
