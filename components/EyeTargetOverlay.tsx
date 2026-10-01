import React, { useEffect, useRef } from 'react';
import { FaceLandmarkerService } from '../services/faceLandmarkerService';

interface Props { active: boolean; }

const EyeTargetOverlay: React.FC<Props> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const initRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const w = window.innerWidth; const h = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let running = true;
    const loop = async () => {
      if (!running) return;
      tRef.current += 0.016;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hudRgb = getComputedStyle(document.documentElement).getPropertyValue('--hud-primary-rgb').trim().split(/\s+/).join(',') || '0,240,255';
      const NEON_CYAN = `rgba(${hudRgb},0.9)`;
      const NEON_CYAN_SOFT = `rgba(${hudRgb},0.35)`;

      if (active) {
        if (!initRef.current) {
          try { await FaceLandmarkerService.initialize(); initRef.current = true; } catch {}
        }
        const video = document.querySelector('video') as HTMLVideoElement | null;
        if (video && initRef.current) {
          const rect = canvas.getBoundingClientRect();
          const wCss = rect.width; const hCss = rect.height;
          const vw = Math.max(1, video.videoWidth || 1280); const vh = Math.max(1, video.videoHeight || 720);
          const scale = Math.max(wCss / vw, hCss / vh);
          const dispW = vw * scale; const dispH = vh * scale;
          const offX = (wCss - dispW) * 0.5; const offY = (hCss - dispH) * 0.5;
          const mat = getComputedStyle(video).transform;
          const isMirrored = !!mat && mat !== 'none' && mat.startsWith('matrix(') && mat.split(',')[0].includes('-1');

          const eye = FaceLandmarkerService.detectRightIris(video);
          if (eye.rightIrisCenter) {
            const cxPix = eye.rightIrisCenter.x * vw;
            const cyPix = eye.rightIrisCenter.y * vh;
            const cx = isMirrored ? offX + (dispW - cxPix * scale) : offX + cxPix * scale;
            const cy = offY + cyPix * scale;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const t = tRef.current;
            const r1 = 24, r2 = 34, r3 = 46;
            const pulse = 1 + 0.06 * Math.sin(t * 2.0);
            const drawRing = (r: number, rot: number, width: number, glow: number) => {
              ctx.beginPath();
              ctx.arc(cx, cy, r, 0, Math.PI * 2);
              ctx.strokeStyle = NEON_CYAN;
              ctx.lineWidth = width;
              ctx.shadowBlur = glow;
              ctx.shadowColor = NEON_CYAN;
              ctx.stroke();

              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(rot);
              ctx.beginPath();
              ctx.strokeStyle = NEON_CYAN_SOFT;
              ctx.lineWidth = 3;
              ctx.shadowBlur = glow * 0.8;
              ctx.shadowColor = NEON_CYAN;
              ctx.arc(0, 0, r + 6, 0, Math.PI * 0.6);
              ctx.stroke();
              ctx.restore();
            };

            drawRing(r1 * pulse, t * 1.2, 2.2, 18);
            drawRing(r2, -t * 0.8, 2, 16);
            drawRing(r3 * (1 + 0.03 * Math.sin(t * 3.2)), t * 0.5, 1.6, 14);

            const cycle = (t % 2.4) / 2.4;
            const rippleR = 52 + cycle * 46;
            ctx.beginPath();
            ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${hudRgb},${0.55 * (1 - cycle)})`;
            ctx.lineWidth = 8 * (1 - cycle);
            ctx.shadowBlur = 28 * (1 - cycle);
            ctx.shadowColor = NEON_CYAN;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * 1.8);
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${hudRgb},${0.3 + 0.2 * Math.sin(t * 6)})`;
            ctx.lineWidth = 3;
            ctx.arc(0, 0, r2 + 12, 0, Math.PI * 1.3);
            ctx.stroke();
            ctx.restore();

            ctx.shadowBlur = 12;
            ctx.shadowColor = NEON_CYAN;
            ctx.strokeStyle = NEON_CYAN;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx - 60, cy);
            ctx.lineTo(cx + 60, cy);
            ctx.moveTo(cx, cy - 60);
            ctx.lineTo(cx, cy + 60);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [active]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-30 pointer-events-none" />;
};

export default EyeTargetOverlay;
