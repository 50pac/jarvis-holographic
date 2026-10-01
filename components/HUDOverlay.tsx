import React, { useRef, useEffect, useState, useMemo } from 'react';
import { HandTrackingState, RegionName } from '../types';
import { SoundService } from '../services/soundService';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HUDOverlayProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
  currentRegion: RegionName;
  voiceMode?: 'idle' | 'listening' | 'processing' | 'speaking';
  recognitionActive?: boolean;
  showMark?: boolean;
}

// --- Sub-Components for Static HUD Elements ---

const CircularGauge = ({ label, value, color = "text-holo-cyan", size = 256 }: { label: string, value: string, color?: string, size?: number }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    {/* Outer Static Ring */}
    <div className={`absolute inset-0 border-2 ${color} opacity-30 rounded-full border-t-transparent border-l-transparent -rotate-45`}></div>
    {/* Inner Spinning Ring */}
    <div className={`absolute inset-2 border-2 ${color} opacity-60 rounded-full border-b-transparent border-r-transparent animate-spin-slow`}></div>
    {/* Core Value */}
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-display font-bold ${color} [filter:drop-shadow(0_0_5px_var(--hud-glow))]`}>{value}</span>
      <span className="text-[8px] uppercase tracking-widest opacity-70">{label}</span>
    </div>
  </div>
);

const ParticlePyramid: React.FC<{ size?: number }> = ({ size = 320 }) => {
  const PyramidScene: React.FC = () => {
    const points = useMemo(() => {
      const apex = new THREE.Vector3(0, 0.7, 0);
      const b0 = new THREE.Vector3(-0.7, -0.5, -0.4);
      const b1 = new THREE.Vector3(0.7, -0.5, -0.4);
      const b2 = new THREE.Vector3(0, -0.5, 0.8);
      const faces = [
        [apex, b0, b1],
        [apex, b1, b2],
        [apex, b2, b0],
        [b0, b1, b2]
      ];
      const pts: number[] = [];
      const N = 6000;
      for (let i = 0; i < N; i++) {
        const f = faces[i % faces.length] as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
        const r1 = Math.random();
        const r2 = Math.random();
        const u = 1 - Math.sqrt(r1);
        const v = Math.sqrt(r1) * (1 - r2);
        const w = Math.sqrt(r1) * r2;
        const p = new THREE.Vector3()
          .addScaledVector(f[0], u)
          .addScaledVector(f[1], v)
          .addScaledVector(f[2], w);
        pts.push(p.x, p.y, p.z);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return geom;
    }, []);
    const points2 = useMemo(() => {
      const apex = new THREE.Vector3(0, 0.7, 0);
      const b0 = new THREE.Vector3(-0.7, -0.5, -0.4);
      const b1 = new THREE.Vector3(0.7, -0.5, -0.4);
      const b2 = new THREE.Vector3(0, -0.5, 0.8);
      const faces = [
        [apex, b0, b1],
        [apex, b1, b2],
        [apex, b2, b0],
        [b0, b1, b2]
      ];
      const center = new THREE.Vector3(0, 0.05, 0);
      const pts: number[] = [];
      const N = 5000;
      for (let i = 0; i < N; i++) {
        const f = faces[(i * 3) % faces.length] as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
        const r1 = Math.random();
        const r2 = Math.random();
        const u = 1 - Math.sqrt(r1);
        const v = Math.sqrt(r1) * (1 - r2);
        const w = Math.sqrt(r1) * r2;
        const base = new THREE.Vector3()
          .addScaledVector(f[0], u)
          .addScaledVector(f[1], v)
          .addScaledVector(f[2], w);
        const dir = new THREE.Vector3().subVectors(base, center).normalize();
        const offset = 0.025 + Math.random() * 0.045;
        const p = new THREE.Vector3().copy(base).addScaledVector(dir, offset);
        pts.push(p.x, p.y, p.z);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return geom;
    }, []);
    const mat = useMemo(() => new THREE.PointsMaterial({ color: '#00F0FF', size: 0.015, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), []);
    const mat2 = useMemo(() => new THREE.PointsMaterial({ color: '#A8F5FF', size: 0.009, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }), []);
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state) => {
      if (groupRef.current) {
        const t = state.clock.elapsedTime;
        groupRef.current.rotation.y = t * 0.4;
        groupRef.current.rotation.x = Math.sin(t * 0.6) * 0.2;
        const s = 1 + Math.sin(t * 2.5) * 0.05;
        groupRef.current.scale.set(s * 2, s * 2, s * 2);
      }
      (mat as any).size = 0.015 + Math.sin(state.clock.elapsedTime * 3) * 0.007;
      (mat2 as any).size = 0.009 + Math.sin(state.clock.elapsedTime * 2.2) * 0.004;
    });
    return (
      <group ref={groupRef}>
        <points geometry={points} material={mat} />
        <points geometry={points2} material={mat2} />
      </group>
    );
  };
  return (
    <div style={{ width: size, height: size }}>
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 90 }}>
        <PyramidScene />
      </Canvas>
    </div>
  );
};

const VisualsFrame = ({ hexDump, powerLevel, width = 320, height = 140 }: { hexDump: string[], powerLevel?: number, width?: number, height?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const sparksRef = useRef<{x:number,y:number,vx:number,vy:number,l:number}[]>([]);
  const resize = () => {
    const c = canvasRef.current;
    const parent = c?.parentElement as HTMLElement | null;
    if (!c || !parent) return;
    const rect = parent.getBoundingClientRect();
    c.width = Math.max(1, Math.floor(rect.width));
    c.height = Math.max(1, Math.floor(rect.height - 28));
  };
  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const loop = () => {
      const c = canvasRef.current; if (!c) { rafRef.current = requestAnimationFrame(loop); return; }
      const ctx = c.getContext('2d'); if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
      const css = getComputedStyle(document.documentElement);
      const hudColor = css.getPropertyValue('--hud-primary').trim() || '#00F0FF';
      const hudRgb = css.getPropertyValue('--hud-primary-rgb').trim().split(/\s+/).join(',') || '0,240,255';
      const w = c.width, h = c.height; ctx.clearRect(0,0,w,h);
      // Grid
      ctx.save();
      ctx.globalAlpha = 0.15; ctx.strokeStyle = hudColor; ctx.lineWidth = 1;
      const sp = 14; for (let x=0; x<w; x+=sp){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for (let y=0; y<h; y+=sp){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      ctx.restore();
      // Sweep
      timeRef.current += 0.016;
      const rate = powerLevel ? 40 + powerLevel * 0.6 : 60;
      const sweepY = (timeRef.current*rate) % (h+40) - 40;
      const grad = ctx.createLinearGradient(0, sweepY, 0, sweepY+40);
      grad.addColorStop(0, `rgba(${hudRgb},0)`);
      grad.addColorStop(0.5, `rgba(${hudRgb},0.25)`);
      grad.addColorStop(1, `rgba(${hudRgb},0)`);
      ctx.fillStyle = grad; ctx.fillRect(0, sweepY, w, 40);
      // Tri reticle
      ctx.save(); ctx.translate(w*0.5, h*0.5); ctx.rotate((timeRef.current*0.35)% (Math.PI*2));
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2;
      const r = Math.min(w,h)*0.22; for(let i=0;i<3;i++){ const a = -Math.PI/2 + i*2*Math.PI/3; const x = r*Math.cos(a), y=r*Math.sin(a); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke(); }
      ctx.beginPath(); for(let i=0;i<3;i++){ const a=-Math.PI/2+i*2*Math.PI/3; const x=r*Math.cos(a), y=r*Math.sin(a); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); ctx.restore();
      // Sparks
      const targetCount = powerLevel ? Math.floor(16 + powerLevel * 0.12) : 24;
      if (sparksRef.current.length < targetCount){ for(let i=0;i<4;i++){ sparksRef.current.push({x:Math.random()*w,y:h*Math.random(),vx:(Math.random()*0.8+0.2),vy:-(Math.random()*0.8+0.2),l:Math.random()*1+0.6}); } }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      sparksRef.current = sparksRef.current.map(s=>{ const nx=s.x + s.vx*2; const ny=s.y + s.vy*2; const nl = s.l*0.985; return {x:nx> w?0:nx, y: ny<0? h:ny, vx:s.vx, vy:s.vy, l:nl}; }).filter(s=> s.l>0.05);
      sparksRef.current.forEach(s=>{ ctx.beginPath(); ctx.arc(s.x,s.y,2.2,0,Math.PI*2); ctx.fillStyle = `rgba(${hudRgb},${s.l})`; ctx.fill(); });
      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);
  return (
    <div className="relative border border-holo-cyan/40 p-1 bg-black/20 backdrop-blur-sm" style={{ width, height }}>
      <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-holo-cyan"></div>
      <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-holo-cyan"></div>
      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-holo-cyan"></div>
      <div className="flex justify-between items-center mb-1 px-1">
        <span className="text-[8px] uppercase text-holo-cyan tracking-widest">Visuals</span>
        <div className="flex gap-0.5 items-end">
          <div className="w-1 h-3 bg-holo-cyan/60 animate-pulse"></div>
          <div className="w-1 h-2 bg-holo-cyan/40 animate-pulse"></div>
          <div className="w-1 h-1 bg-holo-cyan/30 animate-pulse"></div>
        </div>
      </div>
      <div className="relative w-full h-full border border-white/10 bg-black/30">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent"></div>
        <div className="pointer-events-none absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      </div>
    </div>
  );
};

const MiniWorldMap: React.FC<{ width?: number, height?: number }> = ({ width = 320, height = 140 }) => {
  return (
    <div className="relative border border-holo-cyan/40 bg-black/40 backdrop-blur-sm" style={{ width, height }}>
      <svg viewBox="0 0 100 64" className="w-full h-full">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hud-primary)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--hud-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--hud-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="64" fill="transparent" />
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={(i + 1) * 5.8} x2="100" y2={(i + 1) * 5.8} stroke="var(--hud-primary)" strokeOpacity="0.12" strokeWidth="0.25" strokeDasharray="1.6 2.2">
            <animate attributeName="stroke-dashoffset" from="0" to="6" dur="6s" repeatCount="indefinite" />
          </line>
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`v-${i}`} x1={(i + 1) * 5.2} y1="0" x2={(i + 1) * 5.2} y2="64" stroke="var(--hud-primary)" strokeOpacity="0.12" strokeWidth="0.25" strokeDasharray="1.6 2.2">
            <animate attributeName="stroke-dashoffset" from="0" to="6" dur="6s" repeatCount="indefinite" />
          </line>
        ))}

        <g filter="url(#glow)" stroke="var(--hud-primary)" strokeOpacity="0.9" strokeWidth="0.9" fill="var(--hud-primary)" fillOpacity="0.06">
          <path d="M 8 12 L 14 9 L 22 10 L 28 14 L 32 18 L 30 22 L 26 25 L 25 30 L 22 34 L 18 33 L 16 28 L 12 24 L 10 18 Z" />
          <path d="M 20 6 L 26 5 L 30 8 L 28 12 L 22 11 Z" />
          <path d="M 32 24 L 35 26 L 36 30 L 34 32 L 31 31 Z" />
          <path d="M 36 32 L 40 34 L 44 40 L 46 48 L 44 56 L 40 60 L 36 58 L 34 50 L 34 42 Z" />
          <path d="M 56 14 L 61 12 L 66 14 L 70 18 L 68 22 L 64 22 L 60 20 L 58 16 Z" />
          <path d="M 58 18 L 60 18 L 61 20 L 59 21 Z" />
          <path d="M 64 10 L 68 10 L 70 14 L 68 16 L 64 14 Z" />
          <path d="M 58 26 L 62 28 L 66 32 L 68 38 L 66 46 L 62 50 L 58 48 L 56 40 L 56 32 Z" />
          <path d="M 68 26 L 72 28 L 74 32 L 70 34 L 66 32 Z" />
          <path d="M 66 18 L 72 18 L 78 22 L 84 26 L 90 30 L 94 34 L 92 38 L 86 38 L 80 34 L 74 30 L 70 26 L 66 22 Z" />
          <path d="M 88 26 L 90 28 L 90 30 L 88 30 Z" />
          <path d="M 84 24 L 86 26 L 86 28 L 84 28 Z" />
          <path d="M 76 32 L 80 36 L 82 40 L 78 40 L 74 36 Z" />
          <path d="M 84 44 L 88 46 L 92 50 L 90 56 L 86 58 L 82 56 L 80 50 L 82 46 Z" />
          <path d="M 80 40 L 83 42 L 84 44 L 81 44 Z" />
          <path d="M 94 52 L 96 54 L 95 56 L 93 54 Z" />
          <path d="M 20 60 L 40 62 L 60 62 L 80 60 L 70 63 L 50 64 L 30 63 Z" />
        </g>

        <g stroke="var(--hud-primary)" strokeOpacity="0.5" strokeWidth="0.6" fill="none">
          <path d="M 24 20 L 26 18 L 28 20 L 29 22 L 27 24 L 25 23 Z" />
          <path d="M 62 22 L 66 20 L 70 22 L 72 26 L 68 28 L 64 26 Z" />
          <path d="M 72 34 L 74 32 L 76 34 L 76 36 L 74 36 Z" />
        </g>

        <g stroke="var(--hud-primary)" strokeOpacity="0.35" strokeWidth="0.5" fill="none" strokeDasharray="1.8 1.6">
          <path d="M 30 30 L 40 30 L 52 28 L 64 28" />
          <path d="M 64 20 L 74 22 L 86 26" />
          <path d="M 50 44 L 60 46 L 70 44" />
        </g>

        <g stroke="var(--hud-primary)" strokeOpacity="0.6" fill="none">
          <circle cx="50" cy="32" r="28" strokeDasharray="2 4">
            <animateTransform attributeName="transform" type="rotate" from="0 50 32" to="360 50 32" dur="20s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="32" r="20" strokeDasharray="1.5 3.5">
            <animateTransform attributeName="transform" type="rotate" from="360 50 32" to="0 50 32" dur="14s" repeatCount="indefinite" />
          </circle>
        </g>

        <rect x="0" y="-20" width="100" height="20" fill="url(#scanGrad)">
          <animate attributeName="y" from="-20" to="84" dur="6s" repeatCount="indefinite" />
        </rect>

        <g fill="var(--hud-primary)">
          <circle cx="28" cy="34" r="0.8" opacity="0.6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="55" cy="28" r="0.8" opacity="0.6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.7s" repeatCount="indefinite" />
          </circle>
          <circle cx="76" cy="32" r="0.8" opacity="0.6">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
};

const EnergyOrb: React.FC<{ powerLevel: number, width?: number, height?: number }> = ({ powerLevel, width = 320, height = 180 }) => {
  const ArcReactorScene: React.FC<{ powerLevel: number }> = ({ powerLevel }) => {
    const groupRef = useRef<THREE.Group>(null);
    const backGlowRef = useRef<THREE.Mesh>(null);
    const coreTriRef = useRef<THREE.Mesh>(null);
    const radialRefs = useRef<THREE.Mesh[]>([]);

    const triVerts = useMemo(() => {
      const r = 0.6;
      const arr: THREE.Vector3[] = [];
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + i * (2 * Math.PI / 3);
        arr.push(new THREE.Vector3(r * Math.cos(ang), r * Math.sin(ang), 0));
      }
      return arr;
    }, []);

    const coreShape = useMemo(() => {
      const r = 0.25;
      const s = new THREE.Shape();
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + i * (2 * Math.PI / 3);
        const x = r * Math.cos(ang);
        const y = r * Math.sin(ang);
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      s.closePath();
      return s;
    }, []);

    const frameEdges = useMemo(() => {
      const edges: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triVerts[i];
        const b = triVerts[(i + 1) % 3];
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        edges.push({ pos: mid, quat: q, len });
      }
      return edges;
    }, [triVerts]);

    const radialPanels = useMemo(() => {
      const arr: { pos: THREE.Vector3; rotZ: number }[] = [];
      const count = 18;
      const r = 0.86;
      for (let i = 0; i < count; i++) {
        const ang = i * (2 * Math.PI / count);
        const x = r * Math.cos(ang);
        const y = r * Math.sin(ang);
        arr.push({ pos: new THREE.Vector3(x, y, -0.01), rotZ: ang });
      }
      return arr;
    }, []);

    const glowMat = useMemo(() => new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#00F0FF') }, uRate: { value: 1 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor; uniform float uRate; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); float a = hash(i); float b = hash(i+vec2(1.0,0.0)); float c = hash(i+vec2(0.0,1.0)); float d = hash(i+vec2(1.0,1.0)); vec2 u = f*f*(3.0-2.0*f); return mix(a,b,u.x)+ (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y; }
        float ring(vec2 uv,float r,float w){ float d = abs(length(uv-0.5) - r); return smoothstep(w,0.0,d); }
        void main(){
          float r = length(vUv-0.5);
          float core = smoothstep(0.7,0.0,r);
          float rim = ring(vUv,0.47,0.02);
          float pulse = 0.5 + 0.5*sin(uTime*6.0*uRate);
          float flick = noise(vUv*8.0 + uTime*0.8) * 0.25;
          float glow = core*(0.6+flick) + rim*(0.6+0.4*pulse);
          vec3 col = uColor*(0.6 + 0.4*pulse + flick*0.2);
          gl_FragColor = vec4(col, glow*0.35);
        }
      `
    }), []);

    const particleGeomRef = useRef<THREE.BufferGeometry>(null);
    const anglesRef = useRef<Float32Array | null>(null);
    const radiiRef = useRef<Float32Array | null>(null);
    const particleMat = useMemo(() => new THREE.PointsMaterial({ color: '#00F0FF', size: 0.015, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), []);
    const particleCount = 600;
    const initParticles = useMemo(() => {
      const positions = new Float32Array(particleCount * 3);
      const angles = new Float32Array(particleCount);
      const radii = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.2 + Math.random() * 0.65;
        angles[i] = a; radii[i] = r;
        positions[i*3] = r * Math.cos(a);
        positions[i*3+1] = r * Math.sin(a);
        positions[i*3+2] = -0.01;
      }
      anglesRef.current = angles; radiiRef.current = radii;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return g;
    }, []);

    useFrame((state) => {
      const t = state.clock.elapsedTime;
      if (groupRef.current) {
        groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.03;
      }
      if (backGlowRef.current) {
        const s = 0.98 + Math.sin(t * 3.0) * 0.02;
        backGlowRef.current.scale.set(s, s, 1);
        (glowMat.uniforms as any).uTime.value = t;
        (glowMat.uniforms as any).uRate.value = Math.max(0.4, Math.min(2.0, 0.6 + powerLevel/100*1.4));
      }
      if (coreTriRef.current) {
        const s = 1.0 + Math.sin(t * 6.0) * 0.05;
        coreTriRef.current.scale.set(s, s, s);
        const mat = coreTriRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.22 + Math.abs(Math.sin(t * 8.0)) * 0.18;
      }
      radialRefs.current.forEach((m, i) => {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.12 + Math.abs(Math.sin(t * 2.0 + i * 0.6)) * 0.18;
      });
      if (particleGeomRef.current && anglesRef.current && radiiRef.current) {
        const pos = particleGeomRef.current.getAttribute('position') as THREE.BufferAttribute;
        const sp = (0.25 + powerLevel/100*0.75) * state.clock.getDelta();
        for (let i = 0; i < particleCount; i++) {
          radiiRef.current[i] += sp * (0.3 + 0.7*Math.sin(i*0.1 + t));
          if (radiiRef.current[i] > 0.95) radiiRef.current[i] = 0.2;
          const a = anglesRef.current[i];
          pos.array[i*3] = radiiRef.current[i] * Math.cos(a);
          pos.array[i*3+1] = radiiRef.current[i] * Math.sin(a);
        }
        pos.needsUpdate = true;
      }
    });

    return (
      <group ref={groupRef}>
        <ambientLight intensity={0.5} />
        <pointLight position={[0,0,2]} intensity={0.5} color={new THREE.Color('#88a8c0')} />
        <mesh ref={backGlowRef}>
          <circleGeometry args={[0.95, 64]} />
          <primitive object={glowMat} attach="material" />
        </mesh>
        <mesh>
          <torusGeometry args={[1.0, 0.045, 32, 100]} />
          <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.55} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.72, 0.03, 32, 100]} />
          <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.35} blending={THREE.AdditiveBlending} />
        </mesh>
        {radialPanels.map((p, idx) => (
          <mesh key={idx} position={p.pos} rotation={[0, 0, p.rotZ]} ref={(m) => { if (m) radialRefs.current[idx] = m; }}>
            <planeGeometry args={[0.36, 0.13]} />
            <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.22} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
        {frameEdges.map((e, idx) => (
          <mesh key={idx} position={e.pos} quaternion={e.quat}>
            <boxGeometry args={[0.07, e.len, 0.02]} />
            <meshStandardMaterial color={new THREE.Color('#9aa8b5')} metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {triVerts.map((v, i) => (
          <mesh key={`bolt-${i}`} position={v}>
            <cylinderGeometry args={[0.02, 0.02, 0.02, 12]} />
            <meshStandardMaterial color={new THREE.Color('#adb8c6')} metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
        {triVerts.map((v, i) => (
          <mesh key={`glow-${i}`} position={[v.x*0.92, v.y*0.92, 0.03] as any}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.35} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
        {[new THREE.Vector3((triVerts[0].x+triVerts[1].x)/2,(triVerts[0].y+triVerts[1].y)/2,0), new THREE.Vector3((triVerts[1].x+triVerts[2].x)/2,(triVerts[1].y+triVerts[2].y)/2,0)].map((v,i)=>(
          <mesh key={`inner-glow-${i}`} position={[v.x*0.6, v.y*0.6, 0.03] as any}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
        <mesh ref={coreTriRef} position={[0, 0, 0.02]}> 
          <shapeGeometry args={[coreShape]} />
          <meshBasicMaterial color={new THREE.Color('#00F0FF')} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </mesh>
        <points ref={(m)=>{ if(!m) return; particleGeomRef.current = m.geometry as THREE.BufferGeometry; }} geometry={initParticles} material={particleMat} />
      </group>
    );
  };

  return (
    <div className="border border-holo-cyan/40 bg-black/40 backdrop-blur-sm" style={{ width, height }}>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ArcReactorScene powerLevel={powerLevel} />
      </Canvas>
    </div>
  );
};


const HUDOverlay: React.FC<HUDOverlayProps> = ({ handTrackingRef, currentRegion, voiceMode = 'idle', recognitionActive = false, showMark = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // UI State for Floating Panel
  const [showIntelPanel, setShowIntelPanel] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  
  const [hexDump, setHexDump] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [storage, setStorage] = useState(74);
  const [power, setPower] = useState(98);
  
  const reticleRotationRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const topLeftRef = useRef<HTMLDivElement>(null);
  const topRightRef = useRef<HTMLDivElement>(null);
  const [headerOffsets, setHeaderOffsets] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  // Hex Dump & Time Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const chars = '0123456789ABCDEF';
      const line = '0x' + Array(12).fill(0).map(() => chars[Math.floor(Math.random() * 16)]).join('');
      setHexDump(prev => [line, ...prev.slice(0, 20)]);
    }, 120);
    
    const timeInterval = setInterval(() => {
        const now = new Date();
        setTime(now.toLocaleTimeString('zh-CN', { hour12: false }) + `.${now.getMilliseconds().toString().padStart(3, '0')}`);
    }, 50);

    const gaugeInterval = setInterval(() => {
      setStorage(s => Math.max(0, Math.min(100, s + (Math.random() * 4 - 2))));
      setPower(p => Math.max(0, Math.min(100, p + (Math.random() * 3 - 1.5))));
    }, 800);

    return () => {
        clearInterval(interval);
        clearInterval(timeInterval);
        clearInterval(gaugeInterval);
    }
  }, []);

  // Canvas Drawing Loop (Hand Skeletal & Effects)
  useEffect(() => {
    const renderFrame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const css = getComputedStyle(document.documentElement);
      const hudColor = css.getPropertyValue('--hud-primary').trim() || '#00F0FF';
      const hudRgb = css.getPropertyValue('--hud-primary-rgb').trim().split(/\s+/).join(',') || '0,240,255';
      const hands = handTrackingRef.current;
      
      reticleRotationRef.current += 0.05;

      // --- HAND RENDERING ---
      [hands.leftHand, hands.rightHand].forEach(hand => {
        if (hand) {
          const isRight = hand.handedness === 'Right';
          const mainColor = isRight ? hudColor : '#00A3FF';
          
          // Skeleton
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          
          const connections = [[0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8], [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16], [13,17],[17,18],[18,19],[19,20], [0,17]];
          
          connections.forEach(([start, end]) => {
            const p1 = hand.landmarks[start];
            const p2 = hand.landmarks[end];
            ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
            ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
          });
          ctx.stroke();
          ctx.setLineDash([]);

          // Joints
          hand.landmarks.forEach((lm, index) => {
            const x = (1 - lm.x) * canvas.width;
            const y = lm.y * canvas.height;
            
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 1;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            if ([4, 8, 12, 16, 20].includes(index)) {
                ctx.beginPath();
                ctx.arc(x, y, 8, reticleRotationRef.current, reticleRotationRef.current + Math.PI);
                ctx.strokeStyle = isRight ? '#FF2A2A' : hudColor;
                ctx.stroke();
            }
          });
          
          // Palm Info
          const palmX = (1 - hand.landmarks[0].x) * canvas.width;
          const palmY = hand.landmarks[0].y * canvas.height;
          
          ctx.beginPath();
          ctx.arc(palmX, palmY, 20, -reticleRotationRef.current, -reticleRotationRef.current + Math.PI * 1.5);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.stroke();
          
          ctx.font = '10px Rajdhani';
          ctx.fillStyle = mainColor;
          const label = isRight ? 'ID: 右手-01' : 'ID: 左手-02';
          ctx.fillText(label, palmX + 25, palmY);
        }
      });

      // --- LEFT HAND: EXPANSION GAUGE ---
      if (hands.leftHand) {
          const wrist = hands.leftHand.landmarks[0];
          const gaugeX = (1 - wrist.x) * canvas.width - 100;
          const gaugeY = wrist.y * canvas.height;

          const exp = hands.leftHand.expansionFactor;
          const isMaxed = exp > 0.95;
          const gaugeColor = isMaxed ? '#FF2A2A' : hudColor;

          // Gauge Background
          ctx.beginPath();
          ctx.arc(gaugeX, gaugeY, 40, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 47, 167, 0.5)';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Active Gauge Value
          ctx.beginPath();
          // Map 0-1 to angle
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (exp * Math.PI * 2);
          ctx.arc(gaugeX, gaugeY, 40, startAngle, endAngle);
          ctx.strokeStyle = gaugeColor;
          ctx.lineWidth = isMaxed ? 6 : 4; // Thicker when maxed
          if (isMaxed) {
              ctx.shadowColor = '#FF2A2A';
              ctx.shadowBlur = 15;
          } else {
              ctx.shadowBlur = 0;
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset

          // Text
          ctx.fillStyle = gaugeColor;
          ctx.font = isMaxed ? 'bold 14px "Orbitron"' : 'bold 12px "Orbitron"';
          ctx.textAlign = 'center';
          ctx.fillText(isMaxed ? "最大输出" : "解除限制", gaugeX, gaugeY - 10);
          ctx.fillText(`${Math.round(exp * 100)}%`, gaugeX, gaugeY + 15);
          ctx.textAlign = 'left'; // Reset
          
          // Connecting line
          ctx.beginPath();
          ctx.moveTo((1 - wrist.x) * canvas.width - 25, wrist.y * canvas.height);
          ctx.lineTo(gaugeX + 45, gaugeY);
          ctx.strokeStyle = isMaxed ? 'rgba(255, 42, 42, 0.5)' : `rgba(${hudRgb},0.3)`;
          ctx.lineWidth = 1;
          ctx.stroke();
      }

      // --- RIGHT HAND: PINCH TO SHOW INTEL ---
      if (hands.rightHand && voiceMode === 'idle' && !showMark) {
        const isPinching = hands.rightHand.isPinching;
        
        // Handle State Transition for Sound
        if (isPinching && !wasPinchingRef.current) {
            SoundService.playLock();
            setShowIntelPanel(true);
        } else if (!isPinching && wasPinchingRef.current) {
            SoundService.playRelease();
            setShowIntelPanel(false);
        }
        wasPinchingRef.current = isPinching;

        // Update Panel Position logic
        if (isPinching) {
            const indexTip = hands.rightHand.landmarks[8];
            const cursorX = (1 - indexTip.x) * canvas.width;
            const cursorY = indexTip.y * canvas.height;
            setPanelPos({ x: cursorX + 50, y: cursorY - 100 });
            
            // Connector Line from Hand to Panel
            ctx.beginPath();
            ctx.moveTo(cursorX, cursorY);
            ctx.lineTo(cursorX + 50, cursorY - 100); // Connects to top-left of where panel div renders
            ctx.strokeStyle = `rgba(${hudRgb},0.5)`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw Pinch Reticle
        if (isPinching) {
             const indexTip = hands.rightHand.landmarks[8];
             const thumbTip = hands.rightHand.landmarks[4];
             const midX = ((1 - indexTip.x) * canvas.width + (1 - thumbTip.x) * canvas.width) / 2;
             const midY = (indexTip.y * canvas.height + thumbTip.y * canvas.height) / 2;
             
             ctx.beginPath();
             ctx.arc(midX, midY, 15, 0, Math.PI * 2);
             ctx.strokeStyle = '#FF2A2A';
             ctx.lineWidth = 2;
             ctx.stroke();
             
             ctx.beginPath();
             ctx.arc(midX, midY, 5, 0, Math.PI * 2);
             ctx.fillStyle = '#FF2A2A';
             ctx.fill();
        }
      } else {
          // If hand lost or not allowed by mode, hide panel
          if (showIntelPanel) setShowIntelPanel(false);
          wasPinchingRef.current = false;
      }

      requestRef.current = requestAnimationFrame(renderFrame);
    };

    requestRef.current = requestAnimationFrame(renderFrame);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [handTrackingRef, showIntelPanel]);

  // Responsive layout computation
  const [layout, setLayout] = useState(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const margin = 24;
    const gap = Math.max(8, Math.min(24, Math.floor(vw * 0.02)));
    const colWidth = Math.max(240, Math.min(360, Math.floor(vw * 0.28)));

    let visH = Math.floor(Math.max(120, Math.min(220, colWidth * 0.4)));
    let mapH = visH;
    let energyH = Math.floor(Math.max(160, Math.min(280, colWidth * 0.6)));
    let rightTotal = visH + mapH + energyH + gap * 2;
    const rightAvail = vh - margin * 2;
    if (rightTotal > rightAvail) {
      const s = rightAvail / rightTotal;
      visH = Math.floor(visH * s);
      mapH = Math.floor(mapH * s);
      energyH = Math.floor(energyH * s);
      rightTotal = visH + mapH + energyH + gap * 2;
    }
    const extraGapR = Math.floor((vh - rightTotal - margin * 2) / 4);
    const rightX = vw - colWidth - margin;
    const visTop = margin + extraGapR;
    const mapTop = visTop + visH + gap + extraGapR;
    const energyTop = mapTop + mapH + gap + extraGapR;

    let pyramidSize = Math.floor(Math.max(180, Math.min(colWidth, colWidth)));
    let bioH = Math.floor(Math.max(120, Math.min(180, Math.round(colWidth * 0.5))));
    let gaugeSize = Math.floor(Math.max(160, Math.min(colWidth, Math.round(colWidth * 0.9))));
    let leftTotal = gaugeSize + gap + pyramidSize + bioH + gap;
    const leftAvail = vh - margin * 2;
    if (leftTotal > leftAvail) {
      const s = leftAvail / leftTotal;
      gaugeSize = Math.floor(gaugeSize * s);
      pyramidSize = Math.floor(pyramidSize * s);
      bioH = Math.floor(bioH * s);
      leftTotal = gaugeSize + gap + pyramidSize + bioH + gap;
    }
    const extraGapL = Math.floor((vh - leftTotal - margin * 2) / 4);
    const leftX = margin;
    const gauge1Top = margin + extraGapL;
    const bottomTop = gauge1Top + gaugeSize + gap + extraGapL;

    return {
      margin, gap, colWidth,
      right: { x: rightX, visTop, mapTop, energyTop, visH, mapH, energyH },
      left: { x: leftX, gaugeSize, gauge1Top, bottomTop, pyramidSize, bioH }
    };
  });

  useEffect(() => {
    const measureHeaders = () => {
      const l = topLeftRef.current?.getBoundingClientRect();
      const r = topRightRef.current?.getBoundingClientRect();
      setHeaderOffsets({ left: Math.ceil(l?.bottom ?? 0), right: Math.ceil(r?.bottom ?? 0) });
    };
    measureHeaders();
    window.addEventListener('resize', measureHeaders);
    return () => window.removeEventListener('resize', measureHeaders);
  }, []);

  useEffect(() => {
    const recompute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 24;
      const gap = Math.max(8, Math.min(24, Math.floor(vw * 0.02)));
      const colWidth = Math.max(240, Math.min(360, Math.floor(vw * 0.28)));

      let visH = Math.floor(Math.max(120, Math.min(220, colWidth * 0.4)));
      let mapH = visH;
      let energyH = Math.floor(Math.max(160, Math.min(280, colWidth * 0.6)));
      let rightTotal = visH + mapH + energyH + gap * 2;
      const topStartR = Math.max(margin, headerOffsets.right + gap);
      let rightAvail = vh - topStartR - margin;
      if (rightTotal > rightAvail) {
        const s = rightAvail / rightTotal;
        visH = Math.floor(visH * s);
        mapH = Math.floor(mapH * s);
        energyH = Math.floor(energyH * s);
        rightTotal = visH + mapH + energyH + gap * 2;
      }
      const extraGapR = Math.max(0, Math.floor((rightAvail - rightTotal) / 3));
      const rightX = vw - colWidth - margin;
      const visTop = topStartR;
      const mapTop = visTop + visH + gap + extraGapR;
      const energyTop = mapTop + mapH + gap + extraGapR;

      let pyramidSize = Math.floor(Math.max(180, Math.min(colWidth, colWidth)));
      let bioH = Math.floor(Math.max(120, Math.min(180, Math.round(colWidth * 0.5))));
      let gaugeSize = Math.floor(Math.max(160, Math.min(colWidth, Math.round(colWidth * 0.9))));
      let leftTotal = gaugeSize + gap + pyramidSize + bioH + gap;
      const topStartL = Math.max(margin, headerOffsets.left + gap);
      let leftAvail = vh - topStartL - margin;
      if (leftTotal > leftAvail) {
        const s = leftAvail / leftTotal;
        gaugeSize = Math.floor(gaugeSize * s);
        pyramidSize = Math.floor(pyramidSize * s);
        bioH = Math.floor(bioH * s);
        leftTotal = gaugeSize + gap + pyramidSize + bioH + gap;
      }
      const extraGapL = Math.max(0, Math.floor((leftAvail - leftTotal) / 3));
      const leftX = margin;
      const gauge1Top = topStartL;
      const bottomTop = gauge1Top + gaugeSize + gap + extraGapL;

      setLayout({
        margin, gap, colWidth,
        right: { x: rightX, visTop, mapTop, energyTop, visH, mapH, energyH },
        left: { x: leftX, gaugeSize, gauge1Top, bottomTop, pyramidSize, bioH }
      });
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [headerOffsets.left, headerOffsets.right]);

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden font-sans text-holo-cyan select-none">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-20" />
      <div className="vignette"></div>
      <div className="scanlines z-10 opacity-50"></div>

      {/* --- TOP HEADER --- */}
      
      {/* Top Left: System Status */}
      <div ref={topLeftRef} className="absolute top-8 left-8 z-30 flex flex-col gap-2 animate-pulse-fast">
        <div className="border-l-4 border-holo-cyan pl-4 bg-black/40 p-2 backdrop-blur-sm rounded-r-lg [box-shadow:0_0_15px_rgb(var(--hud-primary-rgb)/0.3)]">
          <h2 className="text-xl font-display font-bold text-white tracking-widest">Howard Lei</h2>
          <div className="h-[1px] w-32 bg-holo-cyan my-1"></div>
          <div className="text-xs text-holo-blue font-mono opacity-80">MARK VII HUD 固件 V1.0.0</div>
        </div>
        
      </div>

      {/* Top Right: Title & Clock */}
      <div ref={topRightRef} className="absolute top-8 right-8 z-30 text-right">
        <h1 className="text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-holo-blue [filter:drop-shadow(0_0_15px_var(--hud-glow))] tracking-tighter">
          J.A.R.V.I.S.
        </h1>
        <div className="text-2xl font-mono text-holo-cyan mt-[-5px] tracking-widest flex justify-end items-center gap-4">
            <span className="animate-blink text-alert-red text-xs border border-alert-red px-2 py-0.5 rounded bg-alert-red/10">实时画面</span>
            {time}
        </div>
      </div>


      {/* --- LEFT SIDE PANELS --- */}

      {/* Left Panel 1: Power/Storage Gauge */}
      <div className="absolute z-30 flex flex-col" style={{ left: layout.left.x, top: layout.left.gauge1Top, gap: layout.gap }}>
         <CircularGauge label="Power Cells" value={`${Math.round(power)}%`} color="text-holo-blue" size={layout.left.gaugeSize} />
      </div>

      {/* Left Panel 2: Particle Pyramid (Bottom Left) */}
      <div className="absolute z-30" style={{ left: layout.left.x, top: layout.left.bottomTop }}>
           <ParticlePyramid size={layout.left.pyramidSize} />
           {/* Status Widget below tree */}
           <div className="mt-4 bg-black/60 border-t border-l border-holo-blue p-4 rounded-tr-xl backdrop-blur-md relative" style={{ width: layout.colWidth, height: layout.left.bioH }}>
               <div className="absolute top-0 right-0 w-2 h-2 bg-holo-cyan [box-shadow:0_0_10px_var(--hud-glow)]"></div>
               <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-700 pb-1">生物识别输入</div>
               <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-holo-cyan text-sm font-bold">左手操控模组</span>
                        <span className={`text-xs px-2 rounded ${handTrackingRef.current.leftHand ? 'bg-holo-cyan text-black' : 'bg-red-900/50 text-red-500'}`}>
                             {handTrackingRef.current.leftHand ? '在线' : '离线'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-holo-cyan text-sm font-bold">右手交互模组</span>
                        <span className={`text-xs px-2 rounded ${handTrackingRef.current.rightHand ? 'bg-holo-cyan text-black' : 'bg-red-900/50 text-red-500'}`}>
                             {handTrackingRef.current.rightHand ? '在线' : '离线'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-holo-cyan text-sm font-bold">语音监听</span>
                        <span className={`text-xs px-2 rounded ${voiceMode === 'idle' ? 'bg-gray-800 text-gray-300' : voiceMode === 'listening' ? 'bg-holo-cyan text-black' : voiceMode === 'processing' ? 'bg-holo-blue text-black' : 'bg-holo-cyan/70 text-black'}`}>
                             {voiceMode === 'idle' ? '空闲' : voiceMode === 'listening' ? '监听中' : voiceMode === 'processing' ? '处理中' : '播报中'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-holo-cyan text-sm font-bold">语音引擎</span>
                        <span className={`text-xs px-2 rounded ${recognitionActive ? 'bg-holo-cyan text-black' : 'bg-red-900/50 text-red-500'}`}>
                             {recognitionActive ? '已启动' : '已停止'}
                        </span>
                    </div>
                </div>
           </div>
      </div>


      {/* --- RIGHT SIDE PANELS --- */}

      {/* Right Panel 1: Visuals Frame */}
      <div className="absolute z-30" style={{ right: layout.margin, top: layout.right.visTop }}>
          <VisualsFrame hexDump={hexDump} powerLevel={power} width={layout.colWidth} height={layout.right.visH} />
      </div>

      {/* Right Panel 2: Mini World Map */}
      <div className="absolute z-30" style={{ right: layout.margin, top: layout.right.mapTop }}>
           <div className="flex flex-col items-center gap-2" style={{ width: layout.colWidth }}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-holo-cyan/70 border-b border-holo-cyan/30 pb-1 w-full text-center">World Map</div>
                <MiniWorldMap width={layout.colWidth} height={layout.right.mapH} />
           </div>
      </div>

      {/* Right Panel 3: Energy Orb */}
      <div className="absolute z-30 flex flex-col items-end gap-2" style={{ right: layout.margin, top: layout.right.energyTop, width: layout.colWidth }}>
           <div className="text-[10px] uppercase tracking-widest text-holo-cyan/70 border-b-2 border-holo-cyan/30 pb-1 w-full text-center">Energy Core</div>
           <EnergyOrb powerLevel={power} width={layout.colWidth} height={layout.right.energyH} />
      </div>

      {/* --- INTERACTIVE FLOATING PANEL (PINCH) --- */}
      {showIntelPanel && (
          <div 
            className="absolute z-40 animate-flash origin-top-left"
            style={{ 
                left: panelPos.x,
                top: panelPos.y,
                width: '300px'
            }}
          >
            <div className="bg-black/80 border-l-2 border-alert-red shadow-[0_0_40px_rgba(255,42,42,0.3)] backdrop-blur-xl p-1 rounded-r-lg">
                <div className="flex justify-between items-center bg-gradient-to-r from-alert-red/50 to-transparent p-2 mb-2 border-b border-white/10">
                    <span className="font-display font-bold text-sm tracking-widest text-white">GEO_INTEL_LIVE</span>
                    <div className="w-2 h-2 bg-alert-red rounded-full animate-ping"></div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="text-xs text-holo-blue uppercase">目标区域</div>
                        <div className="text-2xl font-display text-white font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                            {currentRegion}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-gray-400">
                                <span>信号强度</span>
                                <span>98%</span>
                            </div>
                            <div className="w-full bg-gray-900 h-1.5 overflow-hidden rounded-sm">
                                <div className="bg-holo-cyan h-full w-[98%] [box-shadow:0_0_10px_var(--hud-glow)] relative">
                                    <div className="absolute top-0 left-0 h-full w-full bg-white/30 animate-[scanline_1s_linear_infinite]"></div>
                                </div>
                            </div>
                        </div>
                        
                         <div className="grid grid-cols-2 gap-2 mt-2">
                             <div className="bg-white/5 p-1 text-center border border-white/10">
                                 <div className="text-[8px] text-gray-400">经度</div>
                                 <div className="font-mono text-xs text-holo-cyan">116.4074</div>
                             </div>
                             <div className="bg-white/5 p-1 text-center border border-white/10">
                                 <div className="text-[8px] text-gray-400">纬度</div>
                                 <div className="font-mono text-xs text-holo-cyan">39.9042</div>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
            {/* Decorator Lines */}
            <svg className="absolute -left-4 top-0 w-4 h-full overflow-visible">
                 <path d="M 4,0 L 0,10 L 0,150" fill="none" stroke="#FF2A2A" strokeWidth="1" />
            </svg>
          </div>
      )}
    </div>
  );
};

export default HUDOverlay;
