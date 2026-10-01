import { Suspense } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import HolographicEarth from './HolographicEarth';
import HolographicSuit from './HolographicSuit';
import VoiceInterface from './VoiceInterface';
import type { HandTrackingState, RegionName } from '../types';
import type { SuitCommand, VoiceMode } from '../hooks/useVoiceCommands';

interface HolographicSceneProps {
  handTrackingRef: MutableRefObject<HandTrackingState>;
  setRegion: (region: RegionName) => void;
  voiceMode: VoiceMode;
  showMark: boolean;
  showMap: boolean;
  suitCommand: SuitCommand;
}

export default function HolographicScene({
  handTrackingRef, setRegion, voiceMode, showMark, showMap, suitCommand,
}: HolographicSceneProps) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          {voiceMode == 'idle' && !showMark && !showMap && (
            <HolographicEarth handTrackingRef={handTrackingRef} setRegion={setRegion} />
          )}

          {voiceMode !== 'idle' && (
            <VoiceInterface mode={voiceMode === 'speaking' ? 'speaking' : voiceMode === 'processing' ? 'processing' : 'listening'} />
          )}

          {showMark && (
            <group position={[0, 0, 0]}>
              <HolographicSuit handTrackingRef={handTrackingRef} command={suitCommand} />
            </group>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
