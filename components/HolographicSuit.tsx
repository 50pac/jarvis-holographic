import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DEFAULT_ARMOR_ID, getArmor, isCustomArmorId } from '../armors/armorRegistry';
import type { MaterialValues } from '../armors/armorRegistry';
import { getMechHeight } from '../armors/mechParams';
import type { ArmorTransition } from '../hooks/useArmor';
import { HandTrackingState } from '../types';
import { SoundService } from '../services/soundService';
import PalmCannonFx from './PalmCannonFx';
import type { PalmCannonConfig } from '../gestures/palmCannon';

const ProceduralMech = lazy(() => import('./armor/ProceduralMech'));

function applyMaterialValues(material: THREE.Material, values?: MaterialValues): void {
  if (!values || !(material instanceof THREE.MeshStandardMaterial)) return;
  if (values.color) material.color.set(values.color);
  if (values.metalness !== undefined) material.metalness = values.metalness;
  if (values.roughness !== undefined) material.roughness = values.roughness;
  if (values.emissive) material.emissive.set(values.emissive);
  if (values.emissiveIntensity !== undefined) material.emissiveIntensity = values.emissiveIntensity;
  material.needsUpdate = true;
}

export default function HolographicSuit({ handTrackingRef, command, armorId, transition,
  palmCannonConfig, palmFire }: {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  command?: { type: 'stop' | 'reset' | 'fly' | 'landing' | null; tick: number };
  armorId: string;
  transition: ArmorTransition;
  palmCannonConfig: PalmCannonConfig;
  palmFire: { tick: number; atMs: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const armor = getArmor(armorId) ?? getArmor(DEFAULT_ARMOR_ID)!;
  const modelUrl = armor.kind === 'glb' ? armor.modelUrl : getArmor(DEFAULT_ARMOR_ID)?.modelUrl;
  const gltf = useLoader(GLTFLoader, modelUrl!, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
  const modelAssemblyRef = useRef<THREE.Group>(null);
  const scannerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const [assemble, setAssemble] = useState(1);
  const assembleStartRef = useRef<number | null>(null);
  const lastArmorTickRef = useRef(transition.tick);
  const scaleSmoothRef = useRef(1.1);
  const speedSmoothRef = useRef(0.3);
  const speedTargetRef = useRef(0.3);
  const prevXRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(0);
  const posSmoothRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const prevHandsDistRef = useRef<number | null>(null);
  const scalingActiveRef = useRef(false);
  const lastRightPresentRef = useRef(false);
  const dragBlockUntilRef = useRef(0);
  const lastIdxRef = useRef<{ x: number; y: number } | null>(null);
  const dragActiveRef = useRef(false);
  const pinchStartAtRef = useRef(0);
  const lastPinchingRef = useRef(false);
  const stopRotationRef = useRef(false);
  const flyActiveRef = useRef(false);
  const flySpeedRef = useRef(0);
  const flyStartTimeRef = useRef(0);
  const lastCommandTickRef = useRef(0);
  const footOffsetRef = useRef(-0.6);
  const thrusterLightRef = useRef<THREE.PointLight>(null);
  const thrusterBeamLRef = useRef<THREE.Mesh>(null);
  const thrusterBeamRRef = useRef<THREE.Mesh>(null);
  const thrusterMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.0 }, uRadius: { value: 0.06 }, uLen: { value: 2.2 } },
    vertexShader: `
      varying vec3 vWorldPos; varying vec3 vNormal; varying float vRad; varying float vV; uniform float uRadius; uniform float uLen;
      void main(){ vNormal = normalize(normalMatrix * normal); vec4 wp = modelMatrix * vec4(position,1.0); vWorldPos = wp.xyz; vRad = length(vec2(position.x, position.z)) / max(0.0001, uRadius); vV = (position.y / uLen) + 0.5; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: `
      uniform float uTime; uniform float uIntensity; varying vec3 vWorldPos; varying vec3 vNormal; varying float vRad; varying float vV;
      float stripes(float x){ return 0.6 + 0.4*sin(x); }
      void main(){
        float core = exp(-vRad*vRad*1.4);
        float s = stripes(vV*36.0 + uTime*50.0 + vRad*7.0);
        float shimmer = 0.95 + 0.05*sin(uTime*60.0 + vV*12.0 + vRad*9.0);
        float lengthFall = smoothstep(0.0,1.0,vV);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - dot(normalize(vNormal), V), 3.0);
        float alpha = clamp(core * s * (0.25 + uIntensity*1.0) * shimmer * lengthFall + fres*0.2, 0.0, 1.0);
        gl_FragColor = vec4(0.0, 0.94, 1.0, alpha);
      }
    `
  }), []);
  const landingActiveRef = useRef(false);
  const landingSpeedRef = useRef(0);
  const cloudVisibleRef = useRef(false);
  const cloudGroupRef = useRef<THREE.Group>(null);
  
  const ribbonInstRef = useRef<THREE.InstancedMesh>(null);
  const ribbonCountRef = useRef(64);
  const ribbonPosRef = useRef<Float32Array | null>(null);
  const ribbonVelRef = useRef<Float32Array | null>(null);
  const ribbonLifeRef = useRef<Float32Array | null>(null);
  const ribbonScaleRef = useRef<Float32Array | null>(null);
  const ribbonSpawnAccRef = useRef(0);
  const ribbonGeom = useMemo(() => new THREE.PlaneGeometry(0.12, 0.9, 1, 1), []);
  const ribbonMatRef = useRef<THREE.MeshBasicMaterial | null>(new THREE.MeshBasicMaterial({ color: new THREE.Color('#6fd9ff'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  const preFlightPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const preFlightRotRef = useRef(new THREE.Euler(0, 0, 0));
  const preFlightScaleRef = useRef(1.1);
  const flightScaleRef = useRef(1.1);
  const preFlightCamPosRef = useRef(new THREE.Vector3(0, 0, 5));
  const preFlightCamTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const beamLeftRef = useRef<THREE.Mesh>(null);
  const beamRightRef = useRef<THREE.Mesh>(null);
  const beamMuzzleLeftRef = useRef<THREE.Mesh>(null);
  const beamMuzzleRightRef = useRef<THREE.Mesh>(null);
  const beamHumOnRef = useRef(false);
  const prevBeamLeftActiveRef = useRef(false);
  const prevBeamRightActiveRef = useRef(false);
  const mirrorXRef = useRef(false);
  const mirrorCalibratedRef = useRef(false);
  const fingerSmoothLeftRef = useRef(new THREE.Vector3());
  const fingerSmoothRightRef = useRef(new THREE.Vector3());
  const aimRingLeftRef = useRef<THREE.Mesh>(null);
  const aimRingRightRef = useRef<THREE.Mesh>(null);
  const lastClosedLeftRef = useRef(false);
  const lastClosedRightRef = useRef(false);
  const { camera } = useThree();
  const initialCamPosRef = useRef(new THREE.Vector3());
  const initialCamTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const initialCamCapturedRef = useRef(false);
  const initialPlacedRef = useRef(false);
  const initialModelPosRef = useRef(new THREE.Vector3(0, 0, 0));


  const projectorMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#00F0FF') },
      uPower: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uPower; varying vec2 vUv;
      float ring(vec2 uv,float r,float w){ float d = abs(length(uv-0.5) - r); return smoothstep(w,0.0,d); }
      float glow(vec2 uv){ float d = length(uv-0.5); return smoothstep(0.6,0.0,d); }
      void main(){
        vec2 uv = vUv;
        float t = uTime;
        float base = glow(uv);
        float r1 = ring(uv, 0.18 + 0.02*sin(t*4.0), 0.02);
        float r2 = ring(uv, 0.36 + 0.02*sin(t*3.0+1.0), 0.02);
        float sweep = ring(uv, fract(t*0.2), 0.015);
        float intensity = base*0.7 + r1*0.9 + r2*0.6 + sweep*0.8;
        intensity *= uPower;
        vec3 col = uColor * intensity;
        gl_FragColor = vec4(col, intensity);
      }
    `
  }), []);

  const cloudMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFlow: { value: 0 }, uColor: { value: new THREE.Color('#00F0FF') }, uOpacity: { value: 0.12 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uFlow; uniform vec3 uColor; uniform float uOpacity; float hash(vec2 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*(p.x+p.y)); } float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); float a=hash(i); float b=hash(i+vec2(1,0)); float c=hash(i+vec2(0,1)); float d=hash(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(a,b,u.x)+ (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y; } float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; } void main(){ vec2 uv = vUv*vec2(2.0,1.4); uv.x += uTime*0.06*(0.4+uFlow); uv.y += sin(uTime*0.2)*0.02; float n = fbm(uv); float m = smoothstep(0.4,0.9,n); vec3 col = uColor * (0.6+0.4*n); gl_FragColor = vec4(col, m*uOpacity); }`
  }), []);


  const initRibbons = useMemo(() => {
    const count = ribbonCountRef.current;
    ribbonPosRef.current = new Float32Array(count * 3);
    ribbonVelRef.current = new Float32Array(count * 3);
    ribbonLifeRef.current = new Float32Array(count);
    ribbonScaleRef.current = new Float32Array(count * 2); // width, length
    for (let i = 0; i < count; i++) {
      ribbonLifeRef.current[i] = 0;
      ribbonScaleRef.current[i*2] = 0.08; // width
      ribbonScaleRef.current[i*2+1] = 0.4; // length
    }
    return true;
  }, []);

  const beamMatL = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uRadius: { value: 0.05 }, uLen: { value: 4.2 } },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vRad;
        varying float vV;
        uniform float uRadius;
        uniform float uLen;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position,1.0);
          vWorldPos = wp.xyz;
          vRad = length(vec2(position.x, position.z)) / max(0.0001, uRadius);
          vV = (position.y / uLen) + 0.5;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vRad;
        varying float vV;
        float stripes(float x){
          return 0.6 + 0.4*sin(x);
        }
        void main(){
          float core = exp(-vRad*vRad*1.2);
          float s = stripes(vV*40.0 + uTime*60.0 + vRad*6.0);
          float shimmer = 0.95 + 0.05*sin(uTime*50.0 + vV*10.0 + vRad*8.0);
          float lengthFall = smoothstep(0.0,1.0,vV);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - dot(normalize(vNormal), V), 3.0);
          float alpha = clamp(core * s * (0.35 + uIntensity*0.9) * shimmer * lengthFall + fres*0.2, 0.0, 1.0);
          gl_FragColor = vec4(0.0, 0.94, 1.0, alpha);
        }
      `
    });
  }, []);

  const beamMatR = useMemo(() => beamMatL.clone(), [beamMatL]);

  const mats = useMemo(() => {
    const base = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#00F0FF'),
      transparent: true,
      opacity: 0.02,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const wire = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#00F0FF'),
      transparent: true,
      opacity: 0.1,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const fresnel = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#00F0FF') }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          vec4 wp = modelMatrix * vec4(position,1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main(){
          vec3 V = normalize(cameraPosition - vWorldPos);
          float f = pow(1.0 - dot(normalize(vNormal), V), 3.0);
          float alpha = clamp(f, 0.0, 1.0) * 0.25;
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    });
    return { base, wire, fresnel };
  }, []);

  const processed = useMemo(() => {
    if (armor.kind !== 'glb') return null;
    const root = gltf.scene.clone(true);
    const meshes: THREE.Mesh[] = [];
    const clonedMaterials: THREE.Material[] = [];

    root.traverse((obj: any) => {
      if (obj.isMesh && !obj.userData?.hologramOverlay) {
        meshes.push(obj as THREE.Mesh);
      }
    });

    for (const obj of meshes) {
      const cloneMaterial = (source: THREE.Material) => {
        const material = source.clone();
        applyMaterialValues(material, armor.materialOverride?.default);
        applyMaterialValues(material, armor.materialOverride?.byMaterialName?.[source.name]);
        clonedMaterials.push(material);
        return material;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(cloneMaterial) : cloneMaterial(obj.material);
      const geo = obj.geometry;
      const overlayWire = new THREE.Mesh(geo, mats.wire);
      overlayWire.userData.hologramOverlay = true;
      overlayWire.renderOrder = 2;

      const overlayFresnel = new THREE.Mesh(geo, mats.fresnel);
      overlayFresnel.userData.hologramOverlay = true;
      overlayFresnel.renderOrder = 3;

      const overlayBase = new THREE.Mesh(geo, mats.base);
      overlayBase.userData.hologramOverlay = true;
      overlayBase.renderOrder = 1;

      obj.add(overlayBase);
      obj.add(overlayWire);
      obj.add(overlayFresnel);
    }

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    if (isCustomArmorId(armor.id) && !box.isEmpty()) {
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = THREE.MathUtils.clamp(2 / maxDimension, 0.01, 100);
      root.scale.setScalar(scale);
      root.position.sub(center.multiplyScalar(scale));
      return { root, footOffset: -size.y * scale * 0.5 + 0.05, clonedMaterials };
    }
    root.position.y -= center.y;
    return { root, footOffset: -size.y * 0.5 + 0.05, clonedMaterials };
  }, [gltf, mats, armor]);

  useEffect(() => () => processed?.clonedMaterials.forEach(material => material.dispose()), [processed]);

  const footOffset = armor.footOffset ?? (armor.kind === 'procedural' && armor.mech
    ? -getMechHeight(armor.mech) * 0.5 + 0.05
    : processed?.footOffset ?? -0.6);
  footOffsetRef.current = footOffset;

  useEffect(() => {
    mats.base.color.set(armor.theme.primary);
    mats.wire.color.set(armor.theme.primary);
    (mats.fresnel.uniforms.uColor.value as THREE.Color).set(armor.theme.glow);
    (projectorMat.uniforms.uColor.value as THREE.Color).set(armor.theme.primary);
    (cloudMat.uniforms.uColor.value as THREE.Color).set(armor.theme.glow);
    scaleSmoothRef.current = armor.defaultScale ?? 1;
  }, [armor, mats, projectorMat, cloudMat]);

  useEffect(() => {
    if (transition.tick === lastArmorTickRef.current) return;
    lastArmorTickRef.current = transition.tick;
    assembleStartRef.current = performance.now();
    setAssemble(0);
  }, [transition.tick]);

  const particlePositions = useMemo(() => new Float32Array(120 * 3), []);

  useFrame((state, delta) => {
    const raw = assembleStartRef.current === null ? 1 : Math.min(1, (performance.now() - assembleStartRef.current) / 1200);
    const progress = 1 - Math.pow(1 - raw, 3);
    if (armor.kind === 'procedural' && progress !== assemble) setAssemble(progress);
    if (modelAssemblyRef.current) {
      modelAssemblyRef.current.scale.set(0.85 + progress * 0.15, 0.2 + progress * 0.8, 0.85 + progress * 0.15);
    }
    if (scannerRef.current) {
      scannerRef.current.visible = armor.kind === 'glb' && raw < 1;
      scannerRef.current.position.y = footOffset + (raw * 2 - 0.05) * (0.05 - footOffset);
    }
    if (particlesRef.current) {
      particlesRef.current.visible = armor.kind === 'glb' && raw < 1;
      if (particlesRef.current.visible) {
        for (let i = 0; i < 120; i++) {
          const angle = i * 2.399963 + raw * 5;
          const radius = (0.3 + (i % 11) * 0.065) * (1 - progress * 0.85);
          particlePositions[i * 3] = Math.cos(angle) * radius;
          particlePositions[i * 3 + 1] = footOffset + raw * (0.1 - footOffset) * 2 + Math.sin(i * 1.7) * 0.13;
          particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
        }
        (particlesRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    }
    if (processed && raw < 1) {
      const pulse = Math.sin(raw * Math.PI) * 0.55;
      processed.clonedMaterials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissiveIntensity = (material.userData.armorBaseEmissive ??= material.emissiveIntensity) + pulse;
        }
      });
    } else if (processed) {
      processed.clonedMaterials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial && material.userData.armorBaseEmissive !== undefined) {
          material.emissiveIntensity = material.userData.armorBaseEmissive;
        }
      });
    }
    if (!initialCamCapturedRef.current) {
      initialCamPosRef.current.copy(camera.position);
      initialCamCapturedRef.current = true;
    }
    if (!initialPlacedRef.current && groupRef.current) {
      const rightX = state.viewport.width * 0.2;
      targetPosRef.current.set(rightX, 0, 0);
      posSmoothRef.current.copy(targetPosRef.current);
      groupRef.current.position.set(posSmoothRef.current.x, posSmoothRef.current.y, 0);
      initialModelPosRef.current.copy(targetPosRef.current);
      initialPlacedRef.current = true;
    }
    (mats.fresnel.uniforms as any).uTime.value = state.clock.getElapsedTime();
    (projectorMat.uniforms as any).uTime.value = state.clock.getElapsedTime();
    (projectorMat.uniforms as any).uPower.value = flyActiveRef.current ? 1.2 : 1.0;
    (cloudMat.uniforms as any).uTime.value = state.clock.getElapsedTime();

    const left = handTrackingRef.current.leftHand;
    const right = handTrackingRef.current.rightHand;
    const rightPresent = !!right;
    if (rightPresent && !lastRightPresentRef.current) {
      dragBlockUntilRef.current = state.clock.elapsedTime + 0.2;
      lastIdxRef.current = null;
    }
    if (!rightPresent && lastRightPresentRef.current) {
      lastIdxRef.current = null;
    }
    lastRightPresentRef.current = rightPresent;

    if (right) {
      const isP = !!right.isPinching;
      const now = state.clock.elapsedTime;
      const strongThreshold = 0.045;
      const holdTime = 0.25;
      if (isP && !lastPinchingRef.current) {
        pinchStartAtRef.current = now;
      }
      if (!isP) {
        dragActiveRef.current = false;
      } else {
        const strong = typeof right.pinchDistance === 'number' ? right.pinchDistance < strongThreshold : false;
        dragActiveRef.current = strong && (now - pinchStartAtRef.current >= holdTime);
      }
      lastPinchingRef.current = isP;
    } else {
      dragActiveRef.current = false;
      lastPinchingRef.current = false;
    }

    const nowT = state.clock.elapsedTime;
    const leftLm = left && left.landmarks && left.landmarks.length > 8 ? left.landmarks : null;
    const rightLm = right && right.landmarks && right.landmarks.length > 8 ? right.landmarks : null;
    const leftExp = left?.expansionFactor ?? 0;
    const rightExp = right?.expansionFactor ?? 0;
    const leftClosed = leftExp < 0.25;
    const rightClosed = rightExp < 0.25;
    const leftJustOpen = lastClosedLeftRef.current && leftExp > 0.6;
    const rightJustOpen = lastClosedRightRef.current && rightExp > 0.6;
    lastClosedLeftRef.current = leftClosed;
    lastClosedRightRef.current = rightClosed;
    const palmCenter = (lm: any) => {
      const wrist = lm[0];
      const mcp5 = lm[5];
      const mcp9 = lm[9] || lm[8];
      const cx = (mcp5.x + mcp9.x) * 0.5;
      const cy = (mcp5.y + mcp9.y) * 0.5;
      const px = cx * 0.6 + wrist.x * 0.4;
      const py = cy * 0.6 + wrist.y * 0.4;
      return { x: px, y: py };
    };
    const indexPoint = (lm: any) => {
      const tip = lm[8] || lm[9] || lm[7];
      return { x: tip.x, y: tip.y };
    };
    const toScene = (norm: { x: number; y: number }) => {
      const nx = mirrorXRef.current ? (1 - norm.x) : norm.x;
      const vx = (nx - 0.5) * state.viewport.width * 0.8;
      const vy = -(norm.y - 0.5) * state.viewport.height * 0.8;
      return new THREE.Vector3(vx, vy, 0);
    };
    if (!mirrorCalibratedRef.current) {
      if (leftLm && rightLm) {
        const li = indexPoint(leftLm);
        const ri = indexPoint(rightLm);
        const lx = (li.x - 0.5);
        const rx = (ri.x - 0.5);
        mirrorXRef.current = lx < rx;
        mirrorCalibratedRef.current = true;
      } else if (leftLm && !rightLm) {
        const li = indexPoint(leftLm);
        mirrorXRef.current = (li.x < 0.5);
        mirrorCalibratedRef.current = true;
      } else if (rightLm && !leftLm) {
        const ri = indexPoint(rightLm);
        mirrorXRef.current = (ri.x > 0.5);
        mirrorCalibratedRef.current = true;
      }
    }
    const computePalmNormal = (lm: any) => {
      if (!lm || lm.length < 18) return null;
      const a = lm[5];
      const b = lm[17];
      const c = lm[9];
      const w = lm[0];
      const u = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
      const v = new THREE.Vector3(c.x - w.x, c.y - w.y, c.z - w.z);
      const n = new THREE.Vector3().crossVectors(u, v);
      if (n.lengthSq() < 1e-6) return null;
      n.normalize();
      const fixed = new THREE.Vector3(-n.x, -n.y, -Math.abs(n.z));
      return fixed.normalize();
    };
    if (flyActiveRef.current) {
      const leftActive = !!leftLm;
      const rightActive = !!rightLm;
      if (beamLeftRef.current && beamMuzzleLeftRef.current) {
        if (leftActive && leftLm) {
          const ip = indexPoint(leftLm);
          const origin = toScene(ip);
          fingerSmoothLeftRef.current.lerp(origin, 0.35);
          let dir: THREE.Vector3 | null = null;
          if (leftLm.length > 8) {
            const pip = leftLm[6];
            const tip = leftLm[8];
            const dx = (tip.x - pip.x);
            const dy = (tip.y - pip.y);
            const sx = mirrorXRef.current ? -dx : dx;
            const sy = -dy;
            const sz = -Math.max(0.2, Math.abs((tip.z ?? 0) - (pip.z ?? 0)));
            dir = new THREE.Vector3(sx, sy, sz);
            if (dir.lengthSq() < 1e-6) dir = null;
          }
          const fallback = computePalmNormal(leftLm) || new THREE.Vector3(0, 0, -1);
          const finalDir = (dir || fallback).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), finalDir);
          beamLeftRef.current.quaternion.copy(q);
          const pos = fingerSmoothLeftRef.current.clone().add(finalDir.clone().multiplyScalar(4.2 * 0.5));
          beamLeftRef.current.position.copy(pos);
          beamMuzzleLeftRef.current.position.copy(fingerSmoothLeftRef.current);
          if (aimRingLeftRef.current) {
            aimRingLeftRef.current.visible = true;
            aimRingLeftRef.current.position.copy(fingerSmoothLeftRef.current);
            aimRingLeftRef.current.quaternion.copy(camera.quaternion);
          }
          beamLeftRef.current.visible = true;
          beamMuzzleLeftRef.current.visible = true;
          (beamMatL.uniforms as any).uTime.value = state.clock.getElapsedTime();
          (beamMatL.uniforms as any).uIntensity.value = THREE.MathUtils.clamp(leftExp, 0, 1);
        } else {
          beamLeftRef.current.visible = false;
          beamMuzzleLeftRef.current.visible = false;
          if (aimRingLeftRef.current) aimRingLeftRef.current.visible = false;
        }
      }
      if (beamRightRef.current && beamMuzzleRightRef.current) {
        if (rightActive && rightLm) {
          const ip = indexPoint(rightLm);
          const origin = toScene(ip);
          fingerSmoothRightRef.current.lerp(origin, 0.35);
          let dir: THREE.Vector3 | null = null;
          if (rightLm.length > 8) {
            const pip = rightLm[6];
            const tip = rightLm[8];
            const dx = (tip.x - pip.x);
            const dy = (tip.y - pip.y);
            const sx = mirrorXRef.current ? -dx : dx;
            const sy = -dy;
            const sz = -Math.max(0.2, Math.abs((tip.z ?? 0) - (pip.z ?? 0)));
            dir = new THREE.Vector3(sx, sy, sz);
            if (dir.lengthSq() < 1e-6) dir = null;
          }
          const fallback = computePalmNormal(rightLm) || new THREE.Vector3(0, 0, -1);
          const finalDir = (dir || fallback).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), finalDir);
          beamRightRef.current.quaternion.copy(q);
          const pos = fingerSmoothRightRef.current.clone().add(finalDir.clone().multiplyScalar(4.2 * 0.5));
          beamRightRef.current.position.copy(pos);
          beamMuzzleRightRef.current.position.copy(fingerSmoothRightRef.current);
          if (aimRingRightRef.current) {
            aimRingRightRef.current.visible = true;
            aimRingRightRef.current.position.copy(fingerSmoothRightRef.current);
            aimRingRightRef.current.quaternion.copy(camera.quaternion);
          }
          beamRightRef.current.visible = true;
          beamMuzzleRightRef.current.visible = true;
          (beamMatR.uniforms as any).uTime.value = state.clock.getElapsedTime();
          (beamMatR.uniforms as any).uIntensity.value = THREE.MathUtils.clamp(rightExp, 0, 1);
        } else {
          beamRightRef.current.visible = false;
          beamMuzzleRightRef.current.visible = false;
          if (aimRingRightRef.current) aimRingRightRef.current.visible = false;
        }
      }
      const anyActive = leftActive || rightActive;
      const startedLeft = leftActive && !prevBeamLeftActiveRef.current;
      const startedRight = rightActive && !prevBeamRightActiveRef.current;
      if (startedLeft || startedRight) {
        SoundService.playBlast?.();
      }
      if (anyActive && !beamHumOnRef.current) {
        SoundService.startBeamHum?.();
        beamHumOnRef.current = true;
      } else if (!anyActive && beamHumOnRef.current) {
        SoundService.stopBeamHum?.();
        beamHumOnRef.current = false;
      }
      const intensity = Math.max(leftExp || 0, rightExp || 0);
      SoundService.updateBeamHum?.(intensity);
      prevBeamLeftActiveRef.current = !!leftActive;
      prevBeamRightActiveRef.current = !!rightActive;
    } else {
      if (beamLeftRef.current) beamLeftRef.current.visible = false;
      if (beamRightRef.current) beamRightRef.current.visible = false;
      if (beamMuzzleLeftRef.current) beamMuzzleLeftRef.current.visible = false;
      if (beamMuzzleRightRef.current) beamMuzzleRightRef.current.visible = false;
      if (beamHumOnRef.current) {
        SoundService.stopBeamHum?.();
        beamHumOnRef.current = false;
      }
    }

    // Apply incoming external command once per tick
    if (command && command.tick !== lastCommandTickRef.current) {
      lastCommandTickRef.current = command.tick;
      if (command.type === 'stop') {
        stopRotationRef.current = true;
        speedTargetRef.current = 0;
        speedSmoothRef.current = 0;
        flyActiveRef.current = false;
        landingActiveRef.current = false;
        
        if (thrusterLightRef.current) thrusterLightRef.current.intensity = 0;
        SoundService.stopThrusters?.();
      } else if (command.type === 'reset') {
        stopRotationRef.current = false;
        flyActiveRef.current = false;
        flySpeedRef.current = 0;
        landingActiveRef.current = false;
        
        if (thrusterLightRef.current) thrusterLightRef.current.intensity = 0;
        if (groupRef.current) {
          groupRef.current.position.set(0, 0, 0);
          groupRef.current.rotation.set(0, 0, 0);
        }
        speedTargetRef.current = 0.3;
        SoundService.stopThrusters?.();
      } else if (command.type === 'fly') {
        stopRotationRef.current = true;
        flyActiveRef.current = true;
        flySpeedRef.current = 0.2;
        flyStartTimeRef.current = state.clock.elapsedTime;
        landingActiveRef.current = false;
        speedTargetRef.current = 0;
        speedSmoothRef.current = 0;
        if (groupRef.current) {
          preFlightPosRef.current.copy(groupRef.current.position);
          preFlightRotRef.current.copy(groupRef.current.rotation as THREE.Euler);
        }
        preFlightScaleRef.current = scaleSmoothRef.current;
        flightScaleRef.current = scaleSmoothRef.current;
        preFlightCamPosRef.current.copy(camera.position);
        preFlightCamTargetRef.current.copy(groupRef.current ? groupRef.current.position : new THREE.Vector3(0, 0, 0));
        SoundService.startThrusters?.();
      } else if (command.type === 'landing') {
        landingActiveRef.current = true;
        flyActiveRef.current = false;
        landingSpeedRef.current = 0.3;
        flightScaleRef.current = preFlightScaleRef.current;
        scaleSmoothRef.current = preFlightScaleRef.current;
        targetPosRef.current.copy(preFlightPosRef.current);
        if (groupRef.current) {
          groupRef.current.position.copy(preFlightPosRef.current);
          groupRef.current.rotation.y = preFlightRotRef.current.y;
          groupRef.current.rotation.x = 0;
        }
        camera.position.copy(initialCamPosRef.current);
        camera.lookAt(initialCamTargetRef.current);
        camera.updateProjectionMatrix();
        cloudVisibleRef.current = false;
      }
    }

    // Rotation speed controlled by right hand horizontal velocity (swipe-based step + fine control)
    let targetSpeed = speedTargetRef.current;
    if (!stopRotationRef.current && right && right.landmarks && right.landmarks.length > 9 && delta > 0) {
      const p9 = right.landmarks[9]; // middle_mcp as hand center proxy
      const x = p9.x;
      if (prevXRef.current !== null) {
        const velX = (x - prevXRef.current) / delta; // units/sec in normalized [0..1]
        const now = state.clock.elapsedTime;
        const threshold = 0.5; // swipe threshold (lower for higher sensitivity)
        const step = 0.6;      // larger discrete speed step per swipe
        const fineGain = 0.06; // analog fine tuning gain (slightly stronger)
        const cooldown = 0.15; // shorter cooldown for faster response

        if (Math.abs(velX) > threshold && (now - lastTriggerRef.current) > cooldown) {
          targetSpeed += Math.sign(velX) * step;
          lastTriggerRef.current = now;
        } else {
          // Fine tuning, small continuous adjustments
          targetSpeed += velX * fineGain * delta;
        }

        targetSpeed = THREE.MathUtils.clamp(targetSpeed, -3.0, 3.0);
      }
      prevXRef.current = x;
    } else {
      prevXRef.current = null;
    }

    speedTargetRef.current = targetSpeed;
    // Smooth speed (increase filter gain for faster convergence)
    speedSmoothRef.current += (speedTargetRef.current - speedSmoothRef.current) * 0.22;

    let targetScale = scaleSmoothRef.current;
    if (!flyActiveRef.current && !landingActiveRef.current && left && right && left.landmarks && right.landmarks && left.landmarks.length > 8 && right.landmarks.length > 8) {
      const lt = left.landmarks[4];
      const li = left.landmarks[8];
      const rt = right.landmarks[4];
      const ri = right.landmarks[8];
      const lmx = (lt.x + li.x) * 0.5;
      const lmy = (lt.y + li.y) * 0.5;
      const rmx = (rt.x + ri.x) * 0.5;
      const rmy = (rt.y + ri.y) * 0.5;
      const dx = lmx - rmx;
      const dy = lmy - rmy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const minD = 0.08;
      const maxD = 0.45;
      const norm = Math.max(0, Math.min(1, (d - minD) / (maxD - minD)));
      targetScale = 0.7 + norm * 1.1;
      targetScale = Math.max(0.7, Math.min(1.8, targetScale));

      if (prevHandsDistRef.current !== null) {
        const dd = Math.abs(d - prevHandsDistRef.current);
        scalingActiveRef.current = dd > 0.003;
      }
      prevHandsDistRef.current = d;
    } else {
      scalingActiveRef.current = false;
    }
    if (flyActiveRef.current || landingActiveRef.current) {
      targetScale = flightScaleRef.current;
    }
    scaleSmoothRef.current += (targetScale - scaleSmoothRef.current) * 0.15;

    if (groupRef.current) {
      const targetPitch = flyActiveRef.current ? -Math.PI / 4 : landingActiveRef.current ? 0 : 0;
      const targetYaw = flyActiveRef.current ? Math.PI : groupRef.current.rotation.y + delta * speedSmoothRef.current;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetYaw, flyActiveRef.current ? 0.25 : 1.0);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetPitch, flyActiveRef.current ? 0.25 : 0.12);
      groupRef.current.scale.setScalar(scaleSmoothRef.current);

      if (
        !flyActiveRef.current &&
        right &&
        dragActiveRef.current &&
        !scalingActiveRef.current &&
        right.landmarks &&
        right.landmarks.length > 8 &&
        state.clock.elapsedTime >= dragBlockUntilRef.current
      ) {
        const idx = right.landmarks[8];
        if (idx.x > 0.05 && idx.x < 0.95 && idx.y > 0.05 && idx.y < 0.95) {
          const screenX = (1 - idx.x) - 0.5;
          const screenY = idx.y - 0.5;
          const vx = screenX * state.viewport.width * 0.8;
          const vy = -screenY * state.viewport.height * 0.8;
          const maxX = state.viewport.width * 0.48;
          const maxY = state.viewport.height * 0.48;
          targetPosRef.current.set(
            THREE.MathUtils.clamp(vx, -maxX, maxX),
            THREE.MathUtils.clamp(vy, -maxY, maxY),
            0
          );
          // Optional jump suppression based on last idx
          if (lastIdxRef.current) {
            const jump = Math.hypot(idx.x - lastIdxRef.current.x, idx.y - lastIdxRef.current.y);
            if (jump > 0.25) {
              // ignore extreme jumps
            }
          }
          lastIdxRef.current = { x: idx.x, y: idx.y };
          posSmoothRef.current.lerp(targetPosRef.current, 0.35);
          groupRef.current.position.set(posSmoothRef.current.x, posSmoothRef.current.y, 0);
        }
      } else if (!flyActiveRef.current) {
        if (!landingActiveRef.current && !dragActiveRef.current) {
          targetPosRef.current.copy(initialModelPosRef.current);
          posSmoothRef.current.copy(targetPosRef.current);
          groupRef.current.position.set(posSmoothRef.current.x, posSmoothRef.current.y, 0);
        } else {
          posSmoothRef.current.lerp(targetPosRef.current, 0.25);
          groupRef.current.position.set(posSmoothRef.current.x, posSmoothRef.current.y, 0);
        }
      }

      if (flyActiveRef.current) {
        flySpeedRef.current += 0.6 * delta;
        groupRef.current.position.y += flySpeedRef.current * 0.2 * delta;
        groupRef.current.position.z -= flySpeedRef.current * 1.5 * delta;
        const foot = new THREE.Vector3(groupRef.current.position.x, groupRef.current.position.y + footOffsetRef.current, groupRef.current.position.z);
        const desired = new THREE.Vector3(groupRef.current.position.x, groupRef.current.position.y + 0.5, groupRef.current.position.z + 5.5);
        camera.position.lerp(desired, 0.85);
        camera.lookAt(groupRef.current.position.x, groupRef.current.position.y - 0.05, groupRef.current.position.z - 2.0);
        cloudVisibleRef.current = groupRef.current.position.y > 2.0;
        
        if (thrusterLightRef.current) thrusterLightRef.current.intensity = Math.max(0, flySpeedRef.current * 1.5);
        if (thrusterBeamLRef.current && thrusterBeamRRef.current) {
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(groupRef.current.quaternion);
          const tailDir = forward.clone().negate();
          const dir = new THREE.Vector3(tailDir.x, tailDir.y - 0.6, tailDir.z - 0.2).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const footBase = new THREE.Vector3(groupRef.current.position.x, groupRef.current.position.y + footOffsetRef.current, groupRef.current.position.z - 0.2);
          const offsetX = 0.18;
          thrusterBeamLRef.current.position.set(footBase.x - offsetX, footBase.y, footBase.z);
          thrusterBeamRRef.current.position.set(footBase.x + offsetX, footBase.y, footBase.z);
          thrusterBeamLRef.current.quaternion.copy(q);
          thrusterBeamRRef.current.quaternion.copy(q);
          (thrusterMat.uniforms as any).uTime.value = state.clock.getElapsedTime();
          (thrusterMat.uniforms as any).uIntensity.value = THREE.MathUtils.clamp(flySpeedRef.current * 0.6, 0.0, 1.2);
          thrusterBeamLRef.current.visible = true;
          thrusterBeamRRef.current.visible = true;
        }
        SoundService.updateThrusters?.(flySpeedRef.current);
      }

      if (landingActiveRef.current) {
        landingSpeedRef.current = Math.max(0, landingSpeedRef.current - 0.7 * delta);
        groupRef.current.position.lerp(preFlightPosRef.current, 0.18);
        const targetYawL = preFlightRotRef.current.y;
        const targetPitchL = 0;
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetYawL, 0.18);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetPitchL, 0.18);
        scaleSmoothRef.current = THREE.MathUtils.lerp(scaleSmoothRef.current, preFlightScaleRef.current, 0.2);
        
        const desiredCam = initialCamPosRef.current;
        camera.position.lerp(desiredCam, 0.18);
        camera.lookAt(initialCamTargetRef.current);
        if (groupRef.current.position.distanceTo(preFlightPosRef.current) < 0.05 && landingSpeedRef.current <= 0.02) {
          landingActiveRef.current = false;
          stopRotationRef.current = false;
          speedTargetRef.current = 0.3;
          scaleSmoothRef.current = preFlightScaleRef.current;
          flightScaleRef.current = preFlightScaleRef.current;
          cloudVisibleRef.current = false;
          
          if (thrusterLightRef.current) thrusterLightRef.current.intensity = 0;
          if (thrusterBeamLRef.current) thrusterBeamLRef.current.visible = false;
          if (thrusterBeamRRef.current) thrusterBeamRRef.current.visible = false;
          SoundService.stopThrusters?.();
        }
      }

      (cloudMat.uniforms as any).uFlow.value = THREE.MathUtils.clamp(flySpeedRef.current*0.3, 0, 2);

      if (ribbonInstRef.current && ribbonPosRef.current && ribbonVelRef.current && ribbonLifeRef.current && ribbonScaleRef.current && groupRef.current) {
        const dt = state.clock.getDelta();
        const count = ribbonCountRef.current;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(groupRef.current.quaternion);
        const tailDir = forward.clone().negate().normalize();
        const foot = new THREE.Vector3(groupRef.current.position.x, groupRef.current.position.y + footOffsetRef.current, groupRef.current.position.z);

        if (flyActiveRef.current) {
          ribbonSpawnAccRef.current += dt * (0.6 + THREE.MathUtils.clamp(flySpeedRef.current, 0.2, 3.0));
          while (ribbonSpawnAccRef.current >= 1.0) {
            ribbonSpawnAccRef.current -= 1.0;
            let idx = -1;
            for (let i = 0; i < count; i++) { if (ribbonLifeRef.current[i] <= 0) { idx = i; break; } }
            if (idx >= 0) {
              ribbonPosRef.current[idx*3] = foot.x + (Math.random()-0.5)*0.08;
              ribbonPosRef.current[idx*3+1] = foot.y + (Math.random()-0.5)*0.06;
              ribbonPosRef.current[idx*3+2] = foot.z - 0.2;
              ribbonVelRef.current[idx*3] = tailDir.x * (1.2 + flySpeedRef.current*0.6) + (Math.random()-0.5)*0.2;
              ribbonVelRef.current[idx*3+1] = tailDir.y * (0.6 + flySpeedRef.current*0.3) + (Math.random()-0.5)*0.2;
              ribbonVelRef.current[idx*3+2] = tailDir.z * (1.6 + flySpeedRef.current*0.8);
              ribbonLifeRef.current[idx] = 0.9; // seconds
              ribbonScaleRef.current[idx*2] = 0.08 + flySpeedRef.current*0.02; // width
              ribbonScaleRef.current[idx*2+1] = 0.4; // length starting
            }
          }
        }

        for (let i = 0; i < count; i++) {
          const life = ribbonLifeRef.current[i];
          if (life > 0) {
            ribbonLifeRef.current[i] = life - dt;
            const ix = i*3;
            ribbonPosRef.current[ix] += ribbonVelRef.current[ix] * dt;
            ribbonPosRef.current[ix+1] += ribbonVelRef.current[ix+1] * dt;
            ribbonPosRef.current[ix+2] += ribbonVelRef.current[ix+2] * dt;
            ribbonScaleRef.current[i*2+1] += dt * (0.9 + flySpeedRef.current*0.6);

            const vel = new THREE.Vector3(
              ribbonVelRef.current[ix],
              ribbonVelRef.current[ix+1],
              ribbonVelRef.current[ix+2]
            ).normalize();
            q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel);
            m.compose(
              new THREE.Vector3(ribbonPosRef.current[ix], ribbonPosRef.current[ix+1], ribbonPosRef.current[ix+2]),
              q,
              new THREE.Vector3(ribbonScaleRef.current[i*2], ribbonScaleRef.current[i*2+1], 1)
            );
            ribbonInstRef.current.setMatrixAt(i, m);
          } else {
            // move offscreen
            m.compose(new THREE.Vector3(999,999,999), new THREE.Quaternion(), new THREE.Vector3(0,0,0));
            ribbonInstRef.current.setMatrixAt(i, m);
          }
        }
        ribbonInstRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <PalmCannonFx handTrackingRef={handTrackingRef} flyActiveRef={flyActiveRef}
        landingActiveRef={landingActiveRef} config={palmCannonConfig}
        manualFire={palmFire} color={armor.theme.glow} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 2, 4]} intensity={0.6} />
      {armor.kind === 'glb' && processed && (
        <group ref={modelAssemblyRef}>
          <primitive object={processed.root} />
        </group>
      )}
      {armor.kind === 'procedural' && armor.mech && (
        <Suspense fallback={null}>
          <ProceduralMech params={armor.mech} assemble={assemble} />
        </Suspense>
      )}
      <mesh ref={scannerRef as any} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.72, 48]} />
        <meshBasicMaterial color={armor.theme.glow} transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <points ref={particlesRef as any} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={armor.theme.glow} size={0.025} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      
      <mesh position={[0, footOffset - 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[0.9, 64]} />
        <primitive object={projectorMat} attach="material" />
      </mesh>
      
      <group ref={cloudGroupRef} visible={cloudVisibleRef.current} position={[0, -0.1, 0]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.6, 0.9, 1, 1]} />
          <primitive object={cloudMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.15, 0.6]}>
          <planeGeometry args={[1.2, 0.6, 1, 1]} />
          <primitive object={cloudMat} attach="material" />
        </mesh>
      </group>
      
      <instancedMesh ref={ribbonInstRef as any} args={[ribbonGeom, ribbonMatRef.current as any, ribbonCountRef.current]} />
      <mesh ref={thrusterBeamLRef as any} visible={false}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 32]} />
        <primitive object={thrusterMat} attach="material" />
      </mesh>
      <mesh ref={thrusterBeamRRef as any} visible={false}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 32]} />
        <primitive object={thrusterMat} attach="material" />
      </mesh>
      <pointLight ref={thrusterLightRef as any} position={[0, footOffset, -0.3]} intensity={0} color={new THREE.Color('#88d7ff')} distance={6} decay={2} />
      <mesh ref={beamLeftRef as any} visible={false} position={[0,0,0]}>
        <cylinderGeometry args={[0.05, 0.05, 4.2, 32]} />
        <primitive object={beamMatL} attach="material" />
      </mesh>
      <mesh ref={beamRightRef as any} visible={false} position={[0,0,0]}>
        <cylinderGeometry args={[0.05, 0.05, 4.2, 32]} />
        <primitive object={beamMatR} attach="material" />
      </mesh>
      <mesh ref={beamMuzzleLeftRef as any} visible={false}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.8} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={beamMuzzleRightRef as any} visible={false}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.8} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={aimRingLeftRef as any} visible={false}>
        <ringGeometry args={[0.05, 0.06, 32]} />
        <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.85} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={aimRingRightRef as any} visible={false}>
        <ringGeometry args={[0.05, 0.06, 32]} />
        <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.85} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
