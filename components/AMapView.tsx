import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { HandTrackingState } from '../types';

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig?: { serviceHost: string };
  }
}

const AMapView = forwardRef<{ zoomIn: () => void; zoomOut: () => void; locateCity: (name: string) => void }, { handTrackingRef: React.MutableRefObject<HandTrackingState>, command?: { type: 'stop' | 'reset' | 'fly' | 'landing' | null; tick: number } }>(({ handTrackingRef, command }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const statusRef = useRef<'init' | 'loading' | 'ready' | 'error' | 'no_key'>('init');
  const rafRef = useRef<number | null>(null);
  const lastClosedLeftRef = useRef<boolean>(false);
  const lastIndexPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingActiveRef = useRef<boolean>(false);
  const leftStateRef = useRef<'idle' | 'closed' | 'open'>('idle');
  const leftHoldStartRef = useRef<number>(0);
  const leftTriggeredClosedRef = useRef<boolean>(false);
  const leftTriggeredOpenRef = useRef<boolean>(false);
  const pendingCityRef = useRef<string | null>(null);
  const lastZoomUpdateRef = useRef<number>(performance.now());
  const lastZoomLogRef = useRef<number>(performance.now());
  const lastStatusLogRef = useRef<number>(performance.now());
  const lastRotUpdateRef = useRef<number>(performance.now());
  const lastPanUpdateRef = useRef<number>(performance.now());
  const zoomReachedRef = useRef<boolean>(false);
  const zoomAnimatingRef = useRef<boolean>(false);
  const zoomAnimEndAtRef = useRef<number>(0);
  const zoomAnimStartAtRef = useRef<number>(0);
  const zoomStartValueRef = useRef<number>(4);
  const flightPendingAnimRef = useRef<boolean>(false);
  const zoomAnimTimeoutRef = useRef<number | null>(null);
  const apiWindowStartRef = useRef<number>(performance.now());
  const apiCountRef = useRef<number>(0);
  const apiBudgetRef = useRef<number>(20);
  const apiWindowMsRef = useRef<number>(1000);
  const flightActiveRef = useRef(false);
  const flightStartAtRef = useRef<number>(0);
  const flightZoomTargetRef = useRef<number>(18.5);
  const flightAngleRef = useRef<number>(0);
  const flightSpeedPxRef = useRef<number>(120); // pixels per second base
  const lastTsRef = useRef<number>(performance.now());
  const tileReadyCountRef = useRef<number>(0);
  const tileReadyRef = useRef<boolean>(false);
  const [mapVisible, setMapVisible] = useState<boolean>(false);
  const [mapStatus, setMapStatus] = useState<'init' | 'no_key' | 'error'>('init');
  const lastIdxLeftRef = useRef<number | null>(null);
  const lastIdxRightRef = useRef<number | null>(null);
  const rotVelRef = useRef<number>(0);
  const isMirroredRef = useRef<boolean>(false);

  const doLocateCity = (name: string) => {
    const map = mapRef.current;
    if (!map || !window.AMap || !name) return;
    window.AMap.plugin(['AMap.Geocoder'], () => {
      const geocoder = new window.AMap.Geocoder({ city: '全国' });
      geocoder.getLocation(name, (status: string, result: any) => {
        const list = result?.geocodes ?? [];
        if (status === 'complete' && list.length && list[0].location) {
          const loc = list[0].location;
          map.setZoomAndCenter?.(15, [loc.lng, loc.lat]);
        } else {
          const dict: Record<string, [number, number]> = {
            '北京': [116.407396, 39.9042],
            '上海': [121.473701, 31.230416],
            '广州': [113.264385, 23.12911],
            '深圳': [114.057868, 22.543099],
            '杭州': [120.15507, 30.27415],
            '成都': [104.066541, 30.572269],
            '重庆': [106.550464, 29.564711]
          };
          const k = name.replace(/市$/, '');
          if (dict[k]) {
            map.setZoomAndCenter?.(15, dict[k]);
          }
        }
      });
    });
  };

  const startZoomAnim = () => {
    const map = mapRef.current;
    if (!map || statusRef.current !== 'ready') return false;
    const z0 = map.getZoom?.() ?? 4;
    zoomStartValueRef.current = z0;
    flightPendingAnimRef.current = false;
    zoomAnimatingRef.current = false;
    return true;
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const map = mapRef.current;
      if (!map) return;
      const z = map.getZoom?.() ?? 4;
      map.setZoom?.(Math.min(z + 1, 20));
    },
    zoomOut: () => {
      const map = mapRef.current;
      if (!map) return;
      const z = map.getZoom?.() ?? 4;
      map.setZoom?.(Math.max(z - 1, 2));
    },
    locateCity: (name: string) => {
      if (mapRef.current && statusRef.current === 'ready') {
        doLocateCity(name);
      } else {
        pendingCityRef.current = name;
      }
    }
  }), []);

  useEffect(() => {
    let cancelled = false;
    const ensureScript = async () => {
      const response = await fetch('/api/config');
      if (!response.ok) throw new Error('AMap configuration request failed');
      const config: { amapKey?: string } = await response.json();
      if (cancelled) return;
      const key = config.amapKey || '';
      if (!key) {
        statusRef.current = 'no_key';
        setMapStatus('no_key');
        return;
      }
      if (window.AMap) return Promise.resolve();
      statusRef.current = 'loading';
      window._AMapSecurityConfig = { serviceHost: window.location.origin + '/_AMapService' };
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('AMap script load failed'));
        document.head.appendChild(script);
      });
    };

    ensureScript().then(() => {
      if (cancelled || !containerRef.current || !window.AMap) return;
      mapRef.current = new window.AMap.Map(containerRef.current, {
        viewMode: '3D',
        zoom: 4,
        center: [105, 35],
        pitch: 50,
        rotation: 0,
        mapStyle: 'amap://styles/darkblue',
      });
      try { mapRef.current?.setStatus?.({ animateEnable: false }); } catch {}
      try {
        tileReadyCountRef.current = 0;
        tileReadyRef.current = false;
        mapRef.current.on('complete', () => {
          tileReadyCountRef.current += 1;
          if (!tileReadyRef.current && tileReadyCountRef.current >= 1) {
            tileReadyRef.current = true;
            setMapVisible(true);
          }
        });
        mapRef.current.on('viewcomplete', () => {
          tileReadyCountRef.current += 1;
          if (!tileReadyRef.current && tileReadyCountRef.current >= 3) {
            tileReadyRef.current = true;
            setMapVisible(true);
          }
        });
      } catch {}
      window.AMap.plugin(['AMap.ControlBar'], () => {
        mapRef.current && mapRef.current.addControl(new window.AMap.ControlBar());
      });
      statusRef.current = 'ready';
      try {
        mapRef.current.setCenter?.([116.397428, 39.90923]);
        mapRef.current.setZoom?.(4, true);
      } catch {}
      if (flightActiveRef.current && flightPendingAnimRef.current) {
        startZoomAnim();
      }
    }).catch(() => {
      if (cancelled) return;
      statusRef.current = 'error';
      setMapStatus('error');
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const type = command?.type || null;
    const now = performance.now();
    if (type === 'fly') {
      flightActiveRef.current = true;
      flightStartAtRef.current = now;
      flightZoomTargetRef.current = 18.0;
      flightAngleRef.current = 0;
      flightPendingAnimRef.current = true;
      // Warm-up: center to Beijing at 12 to prime tiles
      const map = mapRef.current;
      if (map) {
        map.setCenter?.([116.397428, 39.90923]);
        map.setZoom?.(4, true);
        try { map.setPitch?.(78); } catch {}
        try { map.setRotation?.(0); } catch {}
      }
      if (zoomAnimTimeoutRef.current) {
        clearTimeout(zoomAnimTimeoutRef.current);
        zoomAnimTimeoutRef.current = null;
      }
      zoomAnimTimeoutRef.current = window.setTimeout(() => {
        if (flightActiveRef.current) startZoomAnim();
      }, 3000);
      lastZoomUpdateRef.current = now;
      lastZoomLogRef.current = now;
      lastRotUpdateRef.current = now;
      lastPanUpdateRef.current = now;
      zoomReachedRef.current = false;
    } else if (type === 'landing' || type === 'stop' || type === 'reset') {
      flightActiveRef.current = false;
      if (zoomAnimTimeoutRef.current) {
        clearTimeout(zoomAnimTimeoutRef.current);
        zoomAnimTimeoutRef.current = null;
      }
      const map = mapRef.current;
      if (map) {
        // soften pitch on exit
        map.setPitch?.(50);
      }
    }
  }, [command?.tick]);

  useEffect(() => {
    const loop = () => {
      const hands = handTrackingRef.current;
      const map = mapRef.current;
      const now = performance.now();
      let dt = Math.max(0, (now - lastTsRef.current) / 1000);
      dt = Math.min(dt, 0.06);
      lastTsRef.current = now;
      if (map && hands) {
        const apiCanCall = () => {
          const nowMs = performance.now();
          if (nowMs - apiWindowStartRef.current > apiWindowMsRef.current) {
            apiWindowStartRef.current = nowMs;
            apiCountRef.current = 0;
          }
          return apiCountRef.current < apiBudgetRef.current;
        };
        const apiMark = () => { apiCountRef.current += 1; };
        if (pendingCityRef.current && statusRef.current === 'ready') {
          doLocateCity(pendingCityRef.current);
          pendingCityRef.current = null;
        }
        if (flightActiveRef.current) {
          const currentZoom = map.getZoom?.() ?? 4;
          const elapsed = Math.max(0, (now - flightStartAtRef.current) / 1000);
          const desiredZoomRaw = Math.min(flightZoomTargetRef.current, 4 + elapsed * 1.1);
          if (!zoomReachedRef.current) {
            const desiredZoom = currentZoom + (desiredZoomRaw - currentZoom) * 0.35;
            if (apiCanCall() && (now - lastZoomUpdateRef.current) > 60 && Math.abs(desiredZoom - currentZoom) > 0.005) {
              map.setZoom?.(desiredZoom, true);
              apiMark();
              lastZoomUpdateRef.current = now;
            }
            if (desiredZoomRaw >= (flightZoomTargetRef.current - 0.05)) {
              zoomReachedRef.current = true;
              try { map.setPitch?.(78); } catch {}
              try { map.setRotation?.(0); } catch {}
            }
          } else {
            if (apiCanCall() && (now - lastZoomUpdateRef.current) > 400 && Math.abs(currentZoom - flightZoomTargetRef.current) > 0.02) {
              map.setZoom?.(flightZoomTargetRef.current, true);
              apiMark();
              lastZoomUpdateRef.current = now;
            }
          }
          if (!zoomAnimatingRef.current && currentZoom >= Math.floor(flightZoomTargetRef.current)) {
            zoomReachedRef.current = true;
          }
          if (now - lastZoomLogRef.current > 600) {
            const z = map.getZoom?.() ?? null;
            const targetForLog = zoomReachedRef.current ? flightZoomTargetRef.current : desiredZoomRaw;
            lastZoomLogRef.current = now;
          }
          let rot = map.getRotation?.() ?? 0;
          const w = window.innerWidth || 1920;
          const vid = document.querySelector('video') as HTMLVideoElement | null;
          if (vid) {
            const mat = getComputedStyle(vid).transform;
            const mir = !!mat && mat !== 'none' && mat.startsWith('matrix(') && mat.split(',')[0].includes('-1');
            isMirroredRef.current = mir;
          }
          let rotInput = 0;
          const l8 = (hands.leftHand && (hands.leftHand as any).landmarks && (hands.leftHand as any).landmarks[8]) || null;
          if (l8) {
            const xL = ((isMirroredRef.current ? (1 - l8.x) : l8.x)) * w;
            if (lastIdxLeftRef.current !== null) rotInput += (xL - lastIdxLeftRef.current) / w;
            lastIdxLeftRef.current = xL;
          }
          const r8 = (hands.rightHand && (hands.rightHand as any).landmarks && (hands.rightHand as any).landmarks[8]) || null;
          if (r8) {
            const xR = ((isMirroredRef.current ? (1 - r8.x) : r8.x)) * w;
            if (lastIdxRightRef.current !== null) rotInput += (xR - lastIdxRightRef.current) / w;
            lastIdxRightRef.current = xR;
          }
          rotVelRef.current = rotVelRef.current * 0.9 + rotInput * 0.6;
          const vel = rotVelRef.current;
          if (apiCanCall() && (now - lastRotUpdateRef.current) > 70 && Math.abs(vel) > 0.0006) {
            const nextRotRaw = (rot + vel * dt * 900) % 360;
            const nextRot = nextRotRaw < 0 ? nextRotRaw + 360 : nextRotRaw;
            map.setRotation?.(nextRot);
            apiMark();
            lastRotUpdateRef.current = now;
            rot = nextRot;
          }
          // continuous forward pan based on rotation
          if (now - lastPanUpdateRef.current > 100 && apiCanCall()) {
            const angRad = (rot * Math.PI) / 180;
            const center = map.getCenter?.();
            if (center && typeof center.getLng === 'function') {
              const lng = center.getLng();
              const lat = center.getLat();
              const base = zoomReachedRef.current ? 160 : 110;
              const speed = base * (0.82 + (Math.min(currentZoom, 18) - 4) / 28);
              const ds = speed * (now - lastPanUpdateRef.current) / 1000;
              const R = 6378137.0;
              // Move "backward" visually: push map content down by moving center north
              const dLat = (ds) / R * (180 / Math.PI);
              const dLng = 0;
              const next = [lng + dLng, lat + dLat] as [number, number];
              map.setCenter?.(next);
              apiMark();
            }
            lastPanUpdateRef.current = now;
          }
        } else {
          lastIdxLeftRef.current = null;
          lastIdxRightRef.current = null;
          rotVelRef.current = 0;
        }
        if (flightActiveRef.current && now - lastStatusLogRef.current > 1000) {
          const z = map.getZoom?.() ?? null;
          lastStatusLogRef.current = now;
        }
        const leftExp = hands.leftHand?.expansionFactor ?? null;
        if (leftExp !== null) {
          const isClosed = leftExp < 0.25;
          const isOpen = leftExp > 0.6;

          if (isClosed) {
            if (leftStateRef.current !== 'closed') {
              leftStateRef.current = 'closed';
              leftHoldStartRef.current = now;
              leftTriggeredClosedRef.current = false;
            } else if (!leftTriggeredClosedRef.current && now - leftHoldStartRef.current >= 500) {
              const currentZoom = map.getZoom?.() ?? 4;
              map.setZoom?.(Math.min(currentZoom + 1, 20));
              leftTriggeredClosedRef.current = true;
            }
          } else if (isOpen) {
            if (leftStateRef.current !== 'open') {
              leftStateRef.current = 'open';
              leftHoldStartRef.current = now;
              leftTriggeredOpenRef.current = false;
            } else if (!leftTriggeredOpenRef.current && now - leftHoldStartRef.current >= 500) {
              const currentZoom = map.getZoom?.() ?? 4;
              map.setZoom?.(Math.max(currentZoom - 1, 2));
              leftTriggeredOpenRef.current = true;
            }
          } else {
            if (leftStateRef.current !== 'idle') {
              leftStateRef.current = 'idle';
              leftHoldStartRef.current = 0;
              leftTriggeredClosedRef.current = false;
              leftTriggeredOpenRef.current = false;
            }
          }
          lastClosedLeftRef.current = isClosed;
        }

        const right = hands.rightHand;
        if (!flightActiveRef.current && right && typeof right.pinchDistance === 'number') {
          const strongPinch = right.pinchDistance < 0.045;
          if (strongPinch) {
            draggingActiveRef.current = true;
          } else {
            draggingActiveRef.current = false;
            lastIndexPosRef.current = null;
          }

          if (draggingActiveRef.current && right.landmarks && right.landmarks[8]) {
            const idx = right.landmarks[8];
            const x = ((isMirroredRef.current ? (1 - idx.x) : idx.x)) * (window.innerWidth || 1920);
            const y = idx.y * (window.innerHeight || 1080);
            const last = lastIndexPosRef.current;
            if (last) {
              const dx = x - last.x;
              const dy = y - last.y;
              const scale = 1.0;
              if (Math.abs(dx) + Math.abs(dy) > 0) {
                map.panBy?.(-dx * scale, -dy * scale);
              }
            }
            lastIndexPosRef.current = { x, y };
          }
        } else {
          draggingActiveRef.current = false;
          lastIndexPosRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handTrackingRef]);

  return (
    <div className={`absolute inset-0 z-9 ${mapVisible || mapStatus !== 'init' ? '' : 'opacity-0 pointer-events-none'}`}>
      <div ref={containerRef} className="w-full h-full" />
      {mapStatus === 'no_key' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 bg-black/70 text-holo-cyan border border-holo-cyan/40 rounded text-[12px]">
          未配置高德地图 Key，地图未加载
        </div>
      )}
      {mapStatus === 'error' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 bg-black/70 text-red-400 border border-red-400/40 rounded text-[12px]">
          地图脚本加载失败
        </div>
      )}
    </div>
  );
});

export default AMapView;
