import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { HandTrackingState } from '../types';
import {
  INITIAL_FIST_SHIELD_STATE, INITIAL_PALM_CANNON_STATE,
  evaluateFistShield, evaluatePalmCannon,
} from '../gestures/palmCannon';
import type { FistShieldState, PalmCannonConfig, PalmCannonState } from '../gestures/palmCannon';
import { SoundService } from '../services/soundService';

type Side = 'left' | 'right';
const SIDES: Side[] = ['left', 'right'];
const HAND_X: Record<Side, number> = { left: -0.3, right: 0.3 };

interface Props {
  handTrackingRef: MutableRefObject<HandTrackingState>;
  flyActiveRef: MutableRefObject<boolean>;
  landingActiveRef: MutableRefObject<boolean>;
  config: PalmCannonConfig;
  manualFire: { tick: number; atMs: number };
  color: string;
}

export default function PalmCannonFx({ handTrackingRef, flyActiveRef, landingActiveRef,
  config, manualFire, color }: Props) {
  const cannonStates = useRef<Record<Side, PalmCannonState>>({
    left: { ...INITIAL_PALM_CANNON_STATE }, right: { ...INITIAL_PALM_CANNON_STATE },
  });
  const shieldStates = useRef<Record<Side, FistShieldState>>({
    left: { ...INITIAL_FIST_SHIELD_STATE }, right: { ...INITIAL_FIST_SHIELD_STATE },
  });
  const lastManualTick = useRef(0);
  const firedAt = useRef<Record<Side, number>>({ left: -Infinity, right: -Infinity });
  const chargeMeshes = useRef<Partial<Record<Side, THREE.Mesh>>>({});
  const beamMeshes = useRef<Partial<Record<Side, THREE.Mesh>>>({});
  const beamMaterials = useRef<Partial<Record<Side, THREE.MeshBasicMaterial>>>({});
  const shockMeshes = useRef<Partial<Record<Side, THREE.Mesh>>>({});
  const shockMaterials = useRef<Partial<Record<Side, THREE.MeshBasicMaterial>>>({});
  const shieldGroup = useRef<THREE.Group>(null);

  useFrame(() => {
    const nowMs = Date.now();
    const hands = handTrackingRef.current;
    // Flight beams already own the hands; shield remains available while flying or landing.
    const canFire = !flyActiveRef.current && !landingActiveRef.current;
    const newManual = manualFire.tick !== lastManualTick.current;
    if (newManual) lastManualTick.current = manualFire.tick;
    const manualSide: Side = hands.rightHand ? 'right' : hands.leftHand ? 'left' : 'right';
    let shieldActive = false;

    for (const side of SIDES) {
      const hand = side === 'left' ? hands.leftHand : hands.rightHand;
      const manualTrigger = newManual && side === manualSide && nowMs - manualFire.atMs < 5000;
      const result = evaluatePalmCannon({
        gesture: hand?.gesture, gestureScore: hand?.gestureScore,
        expansionFactor: hand?.combatExpansionFactor ?? hand?.expansionFactor, palmNormalZ: hand?.palmNormalZ,
        isPinching: hand?.isPinching, enabled: canFire, nowMs,
        state: cannonStates.current[side], config, manualTrigger,
      });
      cannonStates.current[side] = result.nextState;
      if (result.action === 'fire') {
        firedAt.current[side] = nowMs;
        SoundService.playBlast();
      }

      const shield = evaluateFistShield({
        gesture: hand?.gesture, gestureScore: hand?.gestureScore,
        expansionFactor: hand?.combatExpansionFactor ?? hand?.expansionFactor, isPinching: hand?.isPinching,
        enabled: !!hand, nowMs, state: shieldStates.current[side], config,
      });
      if (shield.active && !shieldStates.current[side].active) SoundService.playBlip();
      shieldStates.current[side] = shield.nextState;
      shieldActive ||= shield.active;

      const charge = chargeMeshes.current[side];
      if (charge) {
        charge.visible = result.action === 'charging';
        if (charge.visible) charge.scale.setScalar(0.65 + 0.14 * Math.sin(nowMs * 0.025));
      }
      const age = nowMs - firedAt.current[side];
      const beam = beamMeshes.current[side];
      const beamMat = beamMaterials.current[side];
      const shock = shockMeshes.current[side];
      const shockMat = shockMaterials.current[side];
      const visible = age >= 0 && age < 380;
      if (beam) beam.visible = visible;
      if (shock) shock.visible = visible;
      if (visible) {
        const progress = age / 380;
        if (beam) beam.scale.set(1 + progress * 2, 1 + progress * 2, 1);
        if (beamMat) beamMat.opacity = 0.8 * (1 - progress);
        if (shock) shock.scale.setScalar(0.5 + progress * 3.2);
        if (shockMat) shockMat.opacity = 0.75 * (1 - progress);
      }
    }
    if (shieldGroup.current) {
      shieldGroup.current.visible = shieldActive;
      if (shieldActive) shieldGroup.current.rotation.y += 0.003;
    }
  });

  return <>
    {SIDES.map(side => <group key={side} position={[HAND_X[side], 0.1, 0.42]}>
      <mesh ref={mesh => { if (mesh) chargeMeshes.current[side] = mesh; }} visible={false}>
        <sphereGeometry args={[0.12, 20, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={mesh => { if (mesh) beamMeshes.current[side] = mesh; }} visible={false} position={[0, 0, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.09, 2.8, 20]} />
        <meshBasicMaterial ref={material => { if (material) beamMaterials.current[side] = material; }}
          color={color} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={mesh => { if (mesh) shockMeshes.current[side] = mesh; }} visible={false} position={[0, 0, 0.12]}>
        <ringGeometry args={[0.12, 0.18, 32]} />
        <meshBasicMaterial ref={material => { if (material) shockMaterials.current[side] = material; }}
          color={color} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>)}
    <group ref={shieldGroup} visible={false}>
      <mesh>
        <sphereGeometry args={[1.06, 12, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} blending={THREE.AdditiveBlending}
          depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.075, 12, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.38}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  </>;
}
