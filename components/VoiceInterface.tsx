import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3, AdditiveBlending, DoubleSide } from 'three';
import { SoundService } from '../services/soundService';

interface VoiceInterfaceProps {
  mode: 'listening' | 'processing' | 'speaking';
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ mode }) => {
  const meshRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const dataArray = useRef(new Uint8Array(128)); // Size for FFT

  useFrame((state, delta) => {
    // Get Audio Data
    SoundService.getAnalyserData(dataArray.current);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < dataArray.current.length; i++) {
        sum += dataArray.current[i];
    }
    const average = sum / dataArray.current.length;
    const volume = average / 255.0; // Normalized 0-1

    // Animation Logic
    const t = state.clock.elapsedTime;

    // 1. Core Sphere (The "Mic")
    if (coreRef.current) {
        // Base pulse
        let scale = 1 + Math.sin(t * 3) * 0.1;
        
        // Volume reaction (only if listening)
        if (mode === 'listening') {
            scale += volume * 1.5;
            coreRef.current.rotation.y += delta * 0.5;
            coreRef.current.rotation.z += delta * 0.2;
        } else if (mode === 'processing') {
            // Fast spin processing
            scale = 0.8;
            coreRef.current.rotation.y += delta * 5;
            coreRef.current.rotation.x += delta * 3;
        } else if (mode === 'speaking') {
            // Gentle pulse for speaking
            scale = 1 + Math.sin(t * 10) * 0.2;
        }

        coreRef.current.scale.setScalar(scale);
    }

    // 2. Outer Waveform Ring
    if (ringRef.current) {
        ringRef.current.rotation.z = -t * 0.2;
        
        // Modify geometry based on audio if listening
        if (mode === 'listening' && ringRef.current.geometry) {
            const positions = ringRef.current.geometry.attributes.position.array as Float32Array;
            // Simple visual jitter on the ring
            const jitter = volume * 0.2;
            ringRef.current.scale.set(1 + jitter, 1 + jitter, 1);
        } else {
             ringRef.current.scale.setScalar(1.5);
        }
        
        if (mode === 'processing') {
             ringRef.current.rotation.z -= delta * 2;
        }
    }

    // 3. Main Container Float
    if (meshRef.current) {
        meshRef.current.position.y = Math.sin(t) * 0.1;
    }
  });

  const getColor = () => {
      switch(mode) {
          case 'listening': return '#00F0FF'; // Cyan
          case 'processing': return '#FFFFFF'; // White/Blue
          case 'speaking': return '#00A3FF'; // Deep Blue
          default: return '#00F0FF';
      }
  };

  return (
    <group ref={meshRef} position={[0, 0, 2]}> 
      {/* Central Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshBasicMaterial 
            color={getColor()} 
            wireframe 
            transparent 
            opacity={0.6}
            blending={AdditiveBlending} 
        />
      </mesh>
      
      {/* Solid Core Glow */}
      <mesh scale={[0.2, 0.2, 0.2]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={getColor()} transparent opacity={0.8} blending={AdditiveBlending} />
      </mesh>

      {/* Outer Rings */}
      <mesh ref={ringRef} rotation={[Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.5, 0.52, 64]} />
        <meshBasicMaterial color={getColor()} transparent opacity={0.3} side={DoubleSide} blending={AdditiveBlending} />
      </mesh>
      
      {/* Decorative Rotating Ring */}
      <mesh rotation={[Math.PI/3, Math.PI/4, 0]}>
          <torusGeometry args={[0.6, 0.01, 16, 100]} />
          <meshBasicMaterial color={getColor()} transparent opacity={0.2} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
};

export default VoiceInterface;
