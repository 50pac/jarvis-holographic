import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALM_CANNON_CONFIG, INITIAL_FIST_SHIELD_STATE, INITIAL_PALM_CANNON_STATE,
  PALM_CANNON_STORAGE_KEY, evaluateFistShield, evaluatePalmCannon,
  loadPalmCannonConfig, savePalmCannonConfig,
} from './palmCannon';

describe('evaluatePalmCannon', () => {
  const open = { gesture: 'Open_Palm', gestureScore: 0.8, expansionFactor: 1, enabled: true };

  it('charges, fires once, and requires release plus cooldown', () => {
    const start = evaluatePalmCannon({ ...open, nowMs: 100, state: INITIAL_PALM_CANNON_STATE });
    expect(start.action).toBe('charging');
    const wait = evaluatePalmCannon({ ...open, nowMs: 349, state: start.nextState });
    expect(wait.action).toBe('charging');
    const fire = evaluatePalmCannon({ ...open, nowMs: 350, state: wait.nextState });
    expect(fire.action).toBe('fire');
    expect(evaluatePalmCannon({ ...open, nowMs: 1200, state: fire.nextState }).action).toBe('idle');
    const release = evaluatePalmCannon({ ...open, gesture: 'Closed_Fist', nowMs: 1201, state: fire.nextState });
    expect(evaluatePalmCannon({ ...open, nowMs: 1202, state: release.nextState }).action).toBe('charging');
  });

  it('cancels on release and does not fire during cooldown', () => {
    const start = evaluatePalmCannon({ ...open, nowMs: 0, state: INITIAL_PALM_CANNON_STATE });
    const cancel = evaluatePalmCannon({ ...open, gesture: 'None', expansionFactor: 0, nowMs: 100, state: start.nextState });
    expect(cancel.action).toBe('cancel');
    const restart = evaluatePalmCannon({ ...open, nowMs: 200, state: cancel.nextState });
    expect(restart.action).toBe('charging');
    const fire = evaluatePalmCannon({ ...open, nowMs: 450, state: restart.nextState });
    const released = evaluatePalmCannon({ ...open, gesture: undefined, expansionFactor: 0, nowMs: 451, state: fire.nextState });
    expect(evaluatePalmCannon({ ...open, nowMs: 600, state: released.nextState }).action).toBe('idle');
  });

  it('honors enable and score threshold boundaries, with a camera-facing fallback', () => {
    expect(evaluatePalmCannon({ ...open, enabled: false, nowMs: 0, state: INITIAL_PALM_CANNON_STATE }).action).toBe('idle');
    expect(evaluatePalmCannon({ ...open, gestureScore: 0.619, nowMs: 0, state: INITIAL_PALM_CANNON_STATE }).action).toBe('idle');
    expect(evaluatePalmCannon({ ...open, gestureScore: 0.62, nowMs: 0, state: INITIAL_PALM_CANNON_STATE }).action).toBe('charging');
    expect(evaluatePalmCannon({ ...open, gesture: undefined, expansionFactor: 0.78, palmNormalZ: -0.55, nowMs: 0, state: INITIAL_PALM_CANNON_STATE }).action).toBe('charging');
    expect(evaluatePalmCannon({ ...open, gesture: undefined, expansionFactor: 0.78, palmNormalZ: 0.55, nowMs: 0, state: INITIAL_PALM_CANNON_STATE }).action).toBe('idle');
    expect(evaluatePalmCannon({ ...open, gesture: undefined, expansionFactor: 0.78, palmNormalZ: -0.55,
      isPinching: true, nowMs: 0, state: INITIAL_PALM_CANNON_STATE }).action).toBe('idle');
    expect(evaluatePalmCannon({ ...open, nowMs: 0, state: INITIAL_PALM_CANNON_STATE,
      config: { ...DEFAULT_PALM_CANNON_CONFIG, enabled: false } }).action).toBe('idle');
  });

  it('routes manual fire through the same cooldown', () => {
    const first = evaluatePalmCannon({ enabled: true, manualTrigger: true, nowMs: 100, state: INITIAL_PALM_CANNON_STATE });
    expect(first.action).toBe('fire');
    expect(evaluatePalmCannon({ enabled: true, manualTrigger: true, nowMs: 500, state: first.nextState }).action).toBe('idle');
    expect(evaluatePalmCannon({ enabled: true, manualTrigger: true, nowMs: 950, state: first.nextState }).action).toBe('fire');
    expect(evaluatePalmCannon({ enabled: false, manualTrigger: true, nowMs: 1000, state: first.nextState }).action).toBe('idle');
  });
});

describe('evaluateFistShield', () => {
  it('opens on fist and closes on release or disable', () => {
    const fist = evaluateFistShield({ gesture: 'Closed_Fist', gestureScore: 0.62, enabled: true, nowMs: 0, state: INITIAL_FIST_SHIELD_STATE });
    expect(fist.active).toBe(true);
    expect(evaluateFistShield({ gesture: 'Open_Palm', gestureScore: 0.9, enabled: true, nowMs: 1, state: fist.nextState }).active).toBe(false);
    expect(evaluateFistShield({ gesture: 'Closed_Fist', gestureScore: 0.619, enabled: true, nowMs: 2, state: fist.nextState }).active).toBe(false);
    expect(evaluateFistShield({ expansionFactor: 0.16, enabled: true, nowMs: 3, state: fist.nextState }).active).toBe(true);
    expect(evaluateFistShield({ expansionFactor: 0.1, isPinching: true, enabled: true, nowMs: 4, state: fist.nextState }).active).toBe(false);
    expect(evaluateFistShield({ gesture: 'Closed_Fist', gestureScore: 1, enabled: false, nowMs: 5, state: fist.nextState }).active).toBe(false);
  });
});

describe('palm cannon config storage', () => {
  it('round trips injected storage and rejects invalid values', () => {
    let stored = '';
    const storage = { getItem: (key: string) => key === PALM_CANNON_STORAGE_KEY ? stored : null,
      setItem: (_key: string, value: string) => { stored = value; } };
    savePalmCannonConfig({ ...DEFAULT_PALM_CANNON_CONFIG, enabled: false, chargeMs: 300 }, storage);
    expect(loadPalmCannonConfig(storage).enabled).toBe(false);
    expect(loadPalmCannonConfig(storage).chargeMs).toBe(300);
    stored = '{"chargeMs":-1,"openPalmScoreMin":2}';
    expect(loadPalmCannonConfig(storage)).toEqual(DEFAULT_PALM_CANNON_CONFIG);
  });
});
