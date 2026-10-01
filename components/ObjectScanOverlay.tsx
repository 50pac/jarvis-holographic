import React, { useEffect, useRef } from 'react';
import { ObjectDetectionService } from '../services/objectDetectionService';

interface Props {
  active: boolean;
}

const KLEIN_BLUE = '#002FA7';
const ObjectScanOverlay: React.FC<Props> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let running = true;

    const loop = async () => {
      if (!running) return;
      if (!active) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (!initializedRef.current) {
        try {
          await ObjectDetectionService.initialize();
          initializedRef.current = true;
        } catch (e) {}
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hudRgb = getComputedStyle(document.documentElement).getPropertyValue('--hud-primary-rgb').trim().split(/\s+/).join(',') || '0,240,255';
      const NEON_CYAN = `rgba(${hudRgb},0.9)`;
      const NEON_CYAN_SOFT = `rgba(${hudRgb},0.35)`;

      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video && initializedRef.current) {
        try {
          const detections = ObjectDetectionService.detectForVideo(video as HTMLVideoElement);

          ctx.save();
          ctx.globalAlpha = 0.95;
          const rect = canvas.getBoundingClientRect();
          const wCss = rect.width;
          const hCss = rect.height;
          const vw = Math.max(1, video.videoWidth || 1280);
          const vh = Math.max(1, video.videoHeight || 720);
          const scale = Math.max(wCss / vw, hCss / vh);
          const dispW = vw * scale;
          const dispH = vh * scale;
          const offX = (wCss - dispW) * 0.5;
          const offY = (hCss - dispH) * 0.5;
          const mat = getComputedStyle(video).transform;
          const isMirrored = !!mat && mat !== 'none' && mat.startsWith('matrix(') && mat.split(',')[0].includes('-1');

          ctx.globalCompositeOperation = 'lighter';
          for (const d of detections) {
            let ox = d.boundingBox.originX;
            let oy = d.boundingBox.originY;
            let bw = d.boundingBox.width;
            let bh = d.boundingBox.height;
            if (bw <= 1 && bh <= 1) { ox *= vw; oy *= vh; bw *= vw; bh *= vh; }
            const x = isMirrored ? offX + (dispW - (ox + bw) * scale) : offX + ox * scale;
            const y = offY + oy * scale;
            const w = bw * scale;
            const h = bh * scale;

            ctx.setLineDash([]);
            ctx.strokeStyle = NEON_CYAN_SOFT;
            ctx.lineWidth = 6;
            ctx.shadowBlur = 28;
            ctx.shadowColor = NEON_CYAN;
            ctx.strokeRect(x, y, w, h);

            ctx.strokeStyle = NEON_CYAN;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 14;
            ctx.shadowColor = NEON_CYAN;
            ctx.strokeRect(x, y, w, h);

            ctx.shadowBlur = 0;
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = KLEIN_BLUE;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);

            ctx.setLineDash([]);
            const c = 14;
            ctx.beginPath();
            ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
            ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
            ctx.moveTo(x, y + h - c); ctx.lineTo(x, y + h); ctx.lineTo(x + c, y + h);
            ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - c);
            ctx.shadowBlur = 16;
            ctx.shadowColor = NEON_CYAN;
            ctx.strokeStyle = NEON_CYAN;
            ctx.lineWidth = 2;
            ctx.stroke();

            const name = d.categories[0]?.categoryName || 'Object';
            ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco';
            const pad = 4;
            const textW = ctx.measureText(name).width;
            ctx.shadowBlur = 12;
            ctx.shadowColor = NEON_CYAN;
            ctx.fillStyle = `rgba(${hudRgb},0.18)`;
            ctx.strokeStyle = NEON_CYAN_SOFT;
            ctx.beginPath();
            ctx.roundRect(x, Math.max(0, y - 18), textW + pad * 2, 16, 4);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(name, x + pad, Math.max(12, y - 6));
          }
          ctx.restore();
        } catch (e) {}
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20 pointer-events-none"
    />
  );
};

export default ObjectScanOverlay;
