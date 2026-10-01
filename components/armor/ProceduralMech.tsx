import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MechParams } from '../../armors/mechParams';

type Point = [number, number, number];
type PartName = 'head' | 'chest' | 'shoulderL' | 'shoulderR' | 'upperArmL' | 'upperArmR' |
  'forearmL' | 'forearmR' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'thrusters' | 'reactor';

const partNames: PartName[] = [
  'head', 'chest', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR',
  'forearmL', 'forearmR', 'thighL', 'thighR', 'shinL', 'shinR', 'thrusters', 'reactor',
];

function plateGeometry(points: [number, number][]): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.075, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018,
    bevelSegments: 1, curveSegments: 1, steps: 1,
  });
  geometry.computeVertexNormals();
  return geometry;
}

function useMechResources(params: MechParams) {
  const geometries = useMemo(() => ({
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 12, 8),
    hemisphere: new THREE.SphereGeometry(0.5, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    cone: new THREE.ConeGeometry(0.5, 1, 12),
    knee: new THREE.CylinderGeometry(0.5, 0.08, 1, 4),
    chestTaper: new THREE.CylinderGeometry(0.5, 0.32, 1, 8),
    waistTaper: new THREE.CylinderGeometry(0.34, 0.29, 1, 8),
    pelvisTaper: new THREE.CylinderGeometry(0.31, 0.46, 1, 8),
    armTaper: new THREE.CylinderGeometry(0.42, 0.3, 1, 8),
    forearmTaper: new THREE.CylinderGeometry(0.46, 0.3, 1, 8),
    thighTaper: new THREE.CylinderGeometry(0.39, 0.29, 1, 8),
    shinTaper: new THREE.CylinderGeometry(0.34, 0.45, 1, 8),
    capsule: new THREE.CapsuleGeometry(0.5, 0.6, 3, 8),
    torus: new THREE.TorusGeometry(0.5, 0.055, 5, 12),
    chest: plateGeometry([[-0.34, -0.5], [0.34, -0.5], [0.5, 0.28], [0.36, 0.5], [-0.36, 0.5], [-0.5, 0.28]]),
    limb: plateGeometry([[-0.34, -0.5], [0.34, -0.5], [0.5, 0.38], [0.4, 0.5], [-0.4, 0.5], [-0.5, 0.38]]),
  }), []);

  const materials = useMemo(() => {
    const primary = new THREE.Color(params.primaryColor);
    const secondary = new THREE.Color(params.secondaryColor);
    const glow = new THREE.Color(params.glowColor);
    return {
      primary: new THREE.MeshStandardMaterial({ color: primary, metalness: 0.56, roughness: 0.34, flatShading: true }),
      highlight: new THREE.MeshStandardMaterial({ color: primary.clone().multiplyScalar(1.2), metalness: 0.52, roughness: 0.3, flatShading: true }),
      secondary: new THREE.MeshStandardMaterial({ color: secondary, metalness: 0.54, roughness: 0.36, flatShading: true }),
      joint: new THREE.MeshStandardMaterial({ color: primary.clone().multiplyScalar(0.45), metalness: 0.5, roughness: 0.5, flatShading: true }),
      glow: new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.35, toneMapped: false }),
    };
  }, [params.primaryColor, params.secondaryColor, params.glowColor]);

  useEffect(() => () => {
    Object.values(geometries).forEach(geometry => geometry.dispose());
  }, [geometries]);
  useEffect(() => () => {
    Object.values(materials).forEach(material => material.dispose());
  }, [materials]);
  return { geometries, materials };
}

function AssemblyPart({ name, anchor, register, children }: {
  name: PartName;
  anchor: Point;
  register: (name: PartName, group: THREE.Group | null) => void;
  children: ReactNode;
}) {
  return <group ref={group => register(name, group)} position={anchor}>
    <group position={[-anchor[0], -anchor[1], -anchor[2]]}>{children}</group>
  </group>;
}

function offsetFor(index: number, anchor: Point): Point {
  // A fixed arithmetic hash keeps every assembly path stable across frames and mounts.
  const hash = (salt: number) => {
    const value = Math.sin((index + 1) * (12.9898 + salt * 4.1414)) * 43758.5453;
    return value - Math.floor(value);
  };
  const side = anchor[0] < -0.01 ? -1 : anchor[0] > 0.01 ? 1 : index % 2 ? -1 : 1;
  return [side * (0.52 + 0.32 * hash(1)), (anchor[1] < 0 ? -1 : 1) * (0.36 + 0.34 * hash(2)), 0.35 + 0.55 * hash(3)];
}

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

export default function ProceduralMech({ params, assemble = 1, time }: {
  params: MechParams;
  assemble?: number;
  time?: number;
}) {
  const { geometries: g, materials: m } = useMechResources(params);
  const heavy = params.frameStyle === 'heavy';
  const aero = params.frameStyle === 'aero';
  const groupsRef = useRef<Partial<Record<PartName, THREE.Group>>>({});
  const assembleRef = useRef(assemble);
  const timeRef = useRef(time);
  assembleRef.current = assemble;
  timeRef.current = time;

  const register = useCallback((name: PartName, group: THREE.Group | null) => {
    if (group) groupsRef.current[name] = group;
    else delete groupsRef.current[name];
  }, []);

  const width = 0.68 + 0.34 * params.bulk;
  const depth = 0.78 + 0.2 * params.bulk;
  const limb = 0.72 + 0.28 * params.bulk;
  const shoulder = params.shoulderSize ?? 1;
  const shoulderX = (heavy ? 0.52 : aero ? 0.45 : 0.47) * width;
  const armX = (heavy ? 0.61 : aero ? 0.52 : 0.54) * width;
  const legX = 0.19 * width;
  const fist = heavy ? 1.5 : aero ? 0.78 : 1;
  const legWidth = heavy ? 1.2 : aero ? 0.88 : 1;
  const legLength = heavy ? 0.92 : aero ? 1.18 : 1;
  const thrusterCount = Math.max(0, Math.floor(params.thrusterCount));

  const anchors = useMemo<Record<PartName, Point>>(() => ({
    head: [0, 0.82, 0], chest: [0, 0.33, 0],
    shoulderL: [-shoulderX, 0.56, 0], shoulderR: [shoulderX, 0.56, 0],
    upperArmL: [-armX, 0.33, 0], upperArmR: [armX, 0.33, 0],
    forearmL: [-armX * 1.06, -0.08, 0], forearmR: [armX * 1.06, -0.08, 0],
    thighL: [-legX, -0.28, 0], thighR: [legX, -0.28, 0],
    shinL: [-legX, -0.7, 0], shinR: [legX, -0.7, 0],
    thrusters: [0, 0.4, -0.3], reactor: [0, 0.47, 0.27 * depth],
  }), [shoulderX, armX, legX, depth]);
  const assemblyOffsets = useMemo(() => Object.fromEntries(
    partNames.map((name, index) => [name, offsetFor(index, anchors[name])]),
  ) as Record<PartName, Point>, [anchors]);

  useFrame(state => {
    const progress = THREE.MathUtils.clamp(assembleRef.current, 0, 1);
    partNames.forEach((name, index) => {
      const group = groupsRef.current[name];
      if (!group) return;
      const delay = index * 0.026;
      const local = THREE.MathUtils.clamp((progress - delay) / (1 - delay), 0, 1);
      const remaining = 1 - easeOutCubic(local);
      const anchor = anchors[name];
      const offset = assemblyOffsets[name];
      group.position.set(anchor[0] + offset[0] * remaining, anchor[1] + offset[1] * remaining, anchor[2] + offset[2] * remaining);
      group.rotation.set(0.35 * remaining, (index % 2 ? -1 : 1) * 0.46 * remaining, (index % 2 ? 1 : -1) * 0.26 * remaining);
      group.scale.setScalar(1 - 0.42 * remaining);
    });
    const pulseTime = timeRef.current ?? state.clock.elapsedTime;
    m.glow.emissiveIntensity = 1.75 + 0.18 * Math.sin(pulseTime * 3.2);
  });

  return <group scale={params.size}>
    <AssemblyPart name="chest" anchor={anchors.chest} register={register}>
      <mesh geometry={g.chestTaper} material={m.joint} position={[0, 0.43, 0]}
        scale={[1.04 * width, 0.5, 0.7 * depth]} />
      <mesh geometry={g.chest} material={m.primary} position={[0, 0.46, 0.34 * depth]}
        scale={[0.87 * width, 0.34, 1]} />
      {[-1, 1].map(side => <mesh key={side} geometry={g.limb} material={m.highlight}
        position={[side * 0.23 * width, 0.46, 0.43 * depth]}
        rotation={[0, 0, side * -0.11]} scale={[0.3 * width, 0.28, 0.65]} />)}
      {([-1, 1] as const).map(side => <group key={side}>
        <mesh geometry={g.limb} material={m.secondary} position={[side * 0.37 * width, 0.57, 0.42 * depth]}
          rotation={[0, 0, side * -0.42]} scale={[0.19 * width, 0.28, 0.8]} />
        <mesh geometry={g.box} material={m.joint} position={[side * 0.37 * width, 0.41, 0.45 * depth]}
          rotation={[0, 0, side * -0.3]} scale={[0.025, 0.18, 0.018]} />
        <mesh geometry={g.limb} material={m.secondary} position={[side * 0.26 * width, -0.09, 0.26 * depth]}
          rotation={[0, 0, side * 0.28]} scale={[0.16 * width, 0.16, 0.8]} />
        <mesh geometry={g.limb} material={m.secondary} position={[side * 0.22 * width, 0.43, -0.39 * depth]}
          rotation={[0, Math.PI, side * 0.12]} scale={[0.27 * width, 0.28, 0.8]} />
        <mesh geometry={g.cylinder} material={m.joint} position={[side * 0.1 * width, 0.23, -0.37 * depth]}
          scale={[0.022, 0.48, 0.022]} />
      </group>)}
      <mesh geometry={g.chest} material={m.primary} position={[0, 0.45, -0.36 * depth]}
        rotation={[0, Math.PI, 0]} scale={[0.78 * width, 0.34, 1]} />
      <mesh geometry={g.waistTaper} material={m.joint} position={[0, 0.14, 0]}
        scale={[0.74 * width, 0.25, 0.51 * depth]} />
      {[0.095, 0.16, 0.225].map((y, index) => <mesh key={y} geometry={g.limb}
        material={index % 2 ? m.highlight : m.secondary} position={[0, y, 0.26 * depth]}
        scale={[(0.27 + index * 0.025) * width, 0.05, 0.48]} />)}
      <mesh geometry={g.pelvisTaper} material={m.primary} position={[0, -0.07, 0]}
        scale={[0.86 * width, 0.2, 0.58 * depth]} />
      <mesh geometry={g.limb} material={m.secondary} position={[0, -0.075, 0.3 * depth]}
        rotation={[0, 0, Math.PI]} scale={[(aero ? 0.2 : 0.32) * width, 0.17, 0.7]} />
      <mesh geometry={g.limb} material={m.secondary} position={[0, -0.075, -0.31 * depth]}
        rotation={[0, Math.PI, Math.PI]} scale={[0.25 * width, 0.17, 0.7]} />
      {([-1, 1] as const).flatMap(side => [0, 1, 2].map(index => <mesh key={`${side}-${index}`}
        geometry={g.limb} material={index % 2 ? m.highlight : m.secondary}
        position={[side * (0.27 + index * 0.055) * width, -0.15 - index * 0.016, (index - 1) * 0.2 * depth]}
        rotation={[0, side * (0.3 + index * 0.25), side * -0.24]}
        scale={[0.11 * width, 0.15, 0.65]} />))}
      <mesh geometry={g.cylinder} material={m.joint} position={[0, 0.675, 0]} scale={[0.17, heavy ? 0.095 : 0.14, 0.17]} />
      <mesh geometry={g.chestTaper} material={m.secondary} position={[0, 0.655, 0.12 * depth]} scale={[0.4, 0.075, 0.2]} />
    </AssemblyPart>

    <AssemblyPart name="head" anchor={anchors.head} register={register}>
      <mesh geometry={g.sphere} material={m.joint} position={[0, 0.81, 0]} scale={[0.32, 0.34, 0.3]} />
      {params.headStyle === 'dome' ? <>
        <mesh geometry={g.hemisphere} material={m.primary} position={[0, 0.82, 0]} scale={[0.38, 0.34, 0.35]} />
        <mesh geometry={g.box} material={m.secondary} position={[0, 0.785, 0.16]} scale={[0.36, 0.105, 0.09]} />
        <mesh geometry={g.box} material={m.glow} position={[0, 0.81, 0.213]} scale={[0.32, 0.028, 0.017]} />
        <mesh geometry={g.limb} material={m.primary} position={[0, 0.675, 0.17]}
          rotation={[0, 0, Math.PI]} scale={[0.25, 0.09, 0.7]} />
        <mesh geometry={g.box} material={m.secondary} position={[0, 0.655, 0.215]} scale={[0.15, 0.028, 0.025]} />
      </> : params.headStyle === 'horned' ? <>
        <mesh geometry={g.chestTaper} material={m.primary} position={[0, 0.83, -0.02]}
          scale={[0.6, 0.43, 0.56]} />
        <mesh geometry={g.limb} material={m.secondary} position={[0, 0.82, -0.29]}
          rotation={[0, Math.PI, 0]} scale={[0.24, 0.2, 0.8]} />
        <mesh geometry={g.limb} material={m.primary} position={[0, 0.83, 0.09]} scale={[0.29, 0.3, 0.8]} />
        <mesh geometry={g.cone} material={m.secondary} position={[0, 0.735, 0.09]} rotation={[0, 0, Math.PI]} scale={[0.13, 0.16, 0.12]} />
        {[-1, 1].map(side => <group key={side}>
          <mesh geometry={g.cone} material={m.secondary} position={[side * 0.14, 0.89, -0.025]}
            rotation={[-0.42, 0, side * -0.48]} scale={[0.105, 0.25, 0.11]} />
          <mesh geometry={g.cone} material={m.primary} position={[side * 0.21, 0.955, -0.13]}
            rotation={[-1.05, 0, side * -0.32]} scale={[0.073, 0.32, 0.078]} />
          <mesh geometry={g.box} material={m.glow} position={[side * 0.075, 0.825, 0.16]}
            rotation={[0, 0, side * 0.15]} scale={[0.085, 0.025, 0.015]} />
        </group>)}
      </> : <>
        <mesh geometry={g.box} material={m.primary} position={[0, 0.84, 0.025]} scale={[0.33, 0.26, 0.28]} />
        <mesh geometry={g.box} material={m.secondary} position={[0, 0.71, 0.08]} scale={[0.23, 0.075, 0.2]} />
        <mesh geometry={g.box} material={m.glow} position={[0, 0.865, 0.175]} scale={[0.23, 0.022, 0.014]} />
        <mesh geometry={g.box} material={m.glow} position={[0, 0.816, 0.175]} scale={[0.023, 0.11, 0.014]} />
      </>}
    </AssemblyPart>

    {([-1, 1] as const).map(side => {
      const shoulderName = side === -1 ? 'shoulderL' : 'shoulderR';
      const upperName = side === -1 ? 'upperArmL' : 'upperArmR';
      const forearmName = side === -1 ? 'forearmL' : 'forearmR';
      const thighName = side === -1 ? 'thighL' : 'thighR';
      const shinName = side === -1 ? 'shinL' : 'shinR';
      return <group key={side}>
        <AssemblyPart name={shoulderName} anchor={anchors[shoulderName]} register={register}>
          <mesh geometry={g.sphere} material={m.joint} position={[side * shoulderX, 0.51, 0]} scale={[0.23, 0.23, 0.23]} />
          <mesh geometry={g.hemisphere} material={m.primary} position={[side * shoulderX, 0.56, 0]}
            rotation={[0, 0, side * -0.14]} scale={[0.37 * shoulder, 0.38 * shoulder, 0.38 * shoulder]} />
          {[0, 1, 2].map(index => <mesh key={index} geometry={g.limb}
            material={index === 1 ? m.highlight : m.secondary}
            position={[side * (shoulderX + index * 0.045 * shoulder), 0.58 - index * 0.065, 0.18 * shoulder + index * 0.015]}
            rotation={[0, 0, side * (-0.1 - index * 0.1)]}
            scale={[(0.28 - index * 0.035) * shoulder, (0.14 - index * 0.018) * shoulder, 0.6]} />)}
          <mesh geometry={g.limb} material={m.secondary} position={[side * shoulderX, 0.53, -0.23 * shoulder]}
            rotation={[0, Math.PI, side * -0.18]} scale={[0.26 * shoulder, 0.21 * shoulder, 0.7]} />
          <mesh geometry={g.limb} material={m.highlight} position={[side * (shoulderX + 0.2 * shoulder), 0.49, 0]}
            rotation={[0, side * Math.PI / 2, side * -0.18]} scale={[0.21 * shoulder, 0.27 * shoulder, 0.75]} />
          {heavy && [-1, 1].map(offset => <group key={offset}>
            <mesh geometry={g.cylinder} material={m.joint} position={[side * (shoulderX + offset * 0.1), 0.79, -0.18]}
              scale={[0.065, 0.24, 0.065]} />
            <mesh geometry={g.cylinder} material={m.secondary} position={[side * (shoulderX + offset * 0.1), 0.91, -0.18]}
              scale={[0.087, 0.055, 0.087]} />
          </group>)}
        </AssemblyPart>

        <AssemblyPart name={upperName} anchor={anchors[upperName]} register={register}>
          <mesh geometry={g.capsule} material={m.joint} position={[side * armX, 0.32, 0]}
            scale={[0.27 * limb, 0.34, 0.29 * limb]} />
          <mesh geometry={g.armTaper} material={m.primary} position={[side * armX, 0.33, 0]}
            scale={[0.36 * limb, 0.34, 0.32 * limb]} />
          <mesh geometry={g.limb} material={m.primary} position={[side * armX, 0.32, 0.09]}
            rotation={[0, 0, side * -0.12]} scale={[0.23 * limb, 0.27, 0.85]} />
          <mesh geometry={g.limb} material={m.secondary} position={[side * armX, 0.32, -0.13]}
            rotation={[0, Math.PI, side * 0.12]} scale={[0.2 * limb, 0.24, 0.7]} />
        </AssemblyPart>

        <AssemblyPart name={forearmName} anchor={anchors[forearmName]} register={register}>
          <mesh geometry={g.sphere} material={m.joint} position={[side * armX, 0.155, 0]} scale={[0.16 * limb, 0.16, 0.16]} />
          <mesh geometry={g.forearmTaper} material={m.secondary} position={[side * armX * 1.06, -0.055, 0]}
            scale={[0.38 * limb, 0.43, 0.4 * limb]} />
          <mesh geometry={g.limb} material={m.primary} position={[side * armX * 1.06, -0.06, 0.09]}
            rotation={[0, 0, side * 0.07]} scale={[0.31 * limb, 0.32, 1.15]} />
          <mesh geometry={g.limb} material={m.highlight} position={[side * armX * 1.06, -0.1, 0.19]}
            scale={[0.22 * limb, 0.23, 0.55]} />
          <mesh geometry={g.limb} material={m.secondary} position={[side * (armX * 1.06 + 0.18 * limb), -0.08, 0.015]}
            rotation={[0, side * Math.PI / 2, side * -0.1]} scale={[0.23 * limb, 0.36, 0.85]} />
          {heavy && <mesh geometry={g.cone} material={m.highlight}
            position={[side * armX, 0.15, 0.21]} rotation={[Math.PI / 2, 0, 0]}
            scale={[0.12, 0.27, 0.12]} />}
          <mesh geometry={g.chestTaper} material={m.joint} position={[side * armX * 1.06, -0.33, 0.025]}
            scale={[0.4 * limb * fist, 0.17 * fist, 0.4 * fist]} />
          <mesh geometry={g.pelvisTaper} material={m.primary} position={[side * armX * 1.06, -0.37, 0.025]}
            scale={[0.5 * limb * fist, 0.19 * fist, 0.48 * fist]} />
          {[-1, 0, 1].map(finger => <mesh key={finger} geometry={g.box} material={m.secondary}
            position={[side * armX * 1.06 + finger * 0.1 * limb * fist, -0.395, 0.235 * fist]}
            scale={[0.085 * limb * fist, 0.115 * fist, 0.065 * fist]} />)}
        </AssemblyPart>

        <AssemblyPart name={thighName} anchor={anchors[thighName]} register={register}>
          <mesh geometry={g.sphere} material={m.joint} position={[side * legX, -0.11, 0]} scale={[0.17 * limb, 0.17, 0.17]} />
          <mesh geometry={g.capsule} material={m.joint} position={[side * legX, -0.29, 0]}
            scale={[0.29 * limb, 0.36 * legLength, 0.28 * depth]} />
          <mesh geometry={g.thighTaper} material={m.secondary} position={[side * legX, -0.28, 0]}
            scale={[0.45 * limb * legWidth, 0.34 * legLength, 0.38 * depth]} />
          <mesh geometry={g.limb} material={m.primary} position={[side * legX, -0.27, 0.105 * depth]}
            rotation={[0, 0, side * 0.045]} scale={[0.25 * limb * legWidth, 0.32 * legLength, 1]} />
          <mesh geometry={g.limb} material={m.highlight} position={[side * legX, -0.28, 0.22 * depth]}
            rotation={[0, 0, side * 0.045]} scale={[0.13 * limb * legWidth, 0.22 * legLength, 0.55]} />
          <mesh geometry={g.limb} material={m.primary} position={[side * legX, -0.29, -0.19 * depth]}
            rotation={[0, Math.PI, side * -0.045]} scale={[0.21 * limb * legWidth, 0.28 * legLength, 0.85]} />
          <mesh geometry={g.sphere} material={m.joint} position={[side * legX, -0.48, 0]} scale={[0.16 * limb, 0.16, 0.16]} />
          <mesh geometry={g.knee} material={m.secondary} position={[side * legX, -0.49, 0.2 * depth]}
            scale={[0.36 * limb * legWidth, 0.21, 0.17]} />
          {heavy && <mesh geometry={g.cone} material={m.highlight} position={[side * legX, -0.46, 0.29 * depth]}
            rotation={[Math.PI / 2, 0, 0]} scale={[0.12, 0.28, 0.13]} />}
        </AssemblyPart>

        <AssemblyPart name={shinName} anchor={anchors[shinName]} register={register}>
          <mesh geometry={g.shinTaper} material={m.joint} position={[side * legX, -0.68, 0]}
            scale={[0.42 * limb * legWidth, 0.36 * legLength, 0.38 * depth]} />
          <mesh geometry={g.limb} material={m.primary} position={[side * legX, -0.67, 0.1 * depth]}
            rotation={[0, 0, side * -0.04]} scale={[0.26 * limb * legWidth, 0.33 * legLength, 0.95]} />
          <mesh geometry={g.limb} material={m.secondary} position={[side * legX, -0.68, -0.17 * depth]}
            rotation={[0, Math.PI, side * 0.04]} scale={[0.22 * limb * legWidth, 0.31 * legLength, 0.8]} />
          <mesh geometry={g.limb} material={m.highlight} position={[side * (legX + 0.145 * limb * legWidth), -0.65, 0.01]}
            rotation={[0, side * Math.PI / 2, side * -0.06]} scale={[0.19 * limb, 0.29 * legLength, 0.8]} />
          <mesh geometry={g.limb} material={m.secondary} position={[side * (legX + 0.2 * limb * legWidth), -0.69, 0.13]}
            rotation={[0, side * Math.PI / 2, 0]} scale={[0.08, 0.21 * legLength, 0.55]} />
          <mesh geometry={g.sphere} material={m.joint} position={[side * legX, -0.85, 0]} scale={[0.13 * limb, 0.13, 0.13]} />
          <mesh geometry={g.cylinder} material={m.secondary} position={[side * legX, -0.87, 0]}
            scale={[0.18 * limb, 0.11, 0.18 * limb]} />
          <mesh geometry={g.pelvisTaper} material={m.primary} position={[side * legX, -0.94, 0.09]}
            scale={[0.4 * limb, 0.13, 0.47]} />
          {[-1, 0, 1].map(toe => <mesh key={toe} geometry={g.pelvisTaper} material={toe === 0 ? m.highlight : m.secondary}
            position={[side * legX + toe * 0.08 * limb, -0.95, 0.275]}
            scale={[0.13 * limb, 0.075, 0.18]} />)}
          <mesh geometry={g.limb} material={m.secondary} position={[side * legX, -0.91, -0.15]}
            rotation={[0, Math.PI, 0]} scale={[0.2 * limb, 0.08, 0.5]} />
        </AssemblyPart>
      </group>;
    })}

    <AssemblyPart name="thrusters" anchor={anchors.thrusters} register={register}>
      {aero && ([-1, 1] as const).map(side => <group key={side}>
        <mesh geometry={g.limb} material={m.joint} position={[side * 0.37 * width, 0.46, -0.28 * depth]}
          rotation={[0, Math.PI, side * -0.43]} scale={[0.43 * width, 0.26, 1.1]} />
        <mesh geometry={g.limb} material={m.secondary} position={[side * 0.5 * width, 0.51, -0.4 * depth]}
          rotation={[0, Math.PI, side * -0.43]} scale={[0.35 * width, 0.22, 0.8]} />
        <mesh geometry={g.limb} material={m.primary} position={[side * 0.67 * width, 0.39, -0.33 * depth]}
          rotation={[0, Math.PI, side * 0.38]} scale={[0.26 * width, 0.22, 0.9]} />
        <mesh geometry={g.cylinder} material={m.highlight} position={[side * 0.5 * width, 0.47, -0.47 * depth]}
          rotation={[0, 0, side * -0.43]} scale={[0.018, 0.48 * width, 0.018]} />
      </group>)}
      {heavy && ([-1, 1] as const).map(side => <group key={side}>
        <mesh geometry={g.limb} material={m.primary} position={[side * 0.2 * width, 0.39, -0.37 * depth]}
          rotation={[0, Math.PI, side * 0.12]} scale={[0.24 * width, 0.35, 0.8]} />
        {[0, 1].map(index => <mesh key={index} geometry={g.cylinder} material={m.joint}
          position={[side * (0.16 + index * 0.1) * width, 0.73, -0.31 * depth]}
          scale={[0.045, 0.24, 0.045]} />)}
      </group>)}
      {Array.from({ length: thrusterCount }, (_, index) => {
        const outer = index === 0 || index === thrusterCount - 1;
        const side = index < thrusterCount / 2 ? -1 : 1;
        const x = aero && thrusterCount === 4
          ? side * (outer ? 0.79 : 0.42) * width
          : (index - (thrusterCount - 1) / 2) * (thrusterCount <= 2 ? 0.48 : 0.22) * width;
        const y = aero && thrusterCount === 4 ? (outer ? 0.56 : 0.34) : 0.41 + (index % 2) * 0.08;
        return <group key={index}>
          <mesh geometry={g.cylinder} material={m.joint} position={[x, y, -0.25 * depth]}
            rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.23, 0.14]} />
          <mesh geometry={g.cylinder} material={m.secondary} position={[x, y, -0.31 * depth]}
            rotation={[Math.PI / 2, 0, 0]} scale={[0.18, 0.17, 0.18]} />
          <mesh geometry={g.torus} material={m.glow} position={[x, y, -0.4 * depth]}
            rotation={[0, Math.PI, 0]} scale={[0.19, 0.19, 0.19]} />
          <mesh geometry={g.cylinder} material={m.glow} position={[x, y, -0.405 * depth]}
            rotation={[Math.PI / 2, 0, 0]} scale={[0.115, 0.016, 0.115]} />
          <mesh geometry={g.cone} material={m.glow} position={[x, y, -0.48 * depth]}
            rotation={[-Math.PI / 2, 0, 0]} scale={[0.075, 0.14, 0.075]} />
        </group>;
      })}
    </AssemblyPart>

    <AssemblyPart name="reactor" anchor={anchors.reactor} register={register}>
      <mesh geometry={g.cylinder} material={m.joint} position={[0, 0.47, 0.49 * depth]}
        rotation={[Math.PI / 2, 0, 0]} scale={heavy ? [0.5, 0.09, 0.5] : [0.32, 0.07, 0.32]} />
      <mesh geometry={g.torus} material={m.secondary} position={[0, 0.47, 0.55 * depth]}
        scale={heavy ? [0.51, 0.51, 0.51] : [0.32, 0.32, 0.32]} />
      <mesh geometry={g.cylinder} material={m.glow} position={[0, 0.47, 0.56 * depth]}
        rotation={[Math.PI / 2, 0, 0]} scale={heavy ? [0.39, 0.025, 0.39] : [0.23, 0.025, 0.23]} />
      <mesh geometry={g.torus} material={m.glow} position={[0, 0.47, 0.59 * depth]}
        scale={heavy ? [0.24, 0.24, 0.24] : [0.14, 0.14, 0.14]} />
    </AssemblyPart>
  </group>;
}
