import React, { useEffect, useRef } from 'react';
import { MediaPipeService } from '../services/mediapipeService';
import { HandTrackingState, HandInteractionData } from '../types';

interface VideoFeedProps {
  onTrackingUpdate: (state: HandTrackingState) => void;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ onTrackingUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        });

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          
          // Robust video play handling
          try {
             await videoRef.current.play();
          } catch (e) {
             console.warn("Auto-play prevented, waiting for user interaction or metadata", e);
             await new Promise<void>((resolve) => {
                 if (!videoRef.current) return resolve();
                 videoRef.current.onloadeddata = () => {
                     videoRef.current?.play().then(() => resolve()).catch(() => resolve());
                 };
                 if (videoRef.current.readyState >= 2) resolve();
             });
          }
          
          console.log("Camera started, initializing tracking...");
          const recognizer = await MediaPipeService.initialize();
          
          const renderLoop = () => {
            if (!isMounted) return;

            if (videoRef.current && 
                videoRef.current.readyState >= 2 && 
                !videoRef.current.paused) {
              
              if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
                  lastVideoTimeRef.current = videoRef.current.currentTime;
                  
                  try {
                    const results = recognizer.recognizeForVideo(videoRef.current, Date.now());
                    
                    const newState: HandTrackingState = {
                      leftHand: null,
                      rightHand: null
                    };

                    if (results.landmarks) {
                      results.landmarks.forEach((landmarks, index) => {
                        const handednessCategory = results.handedness[index]?.[0];
                        const handedness = (handednessCategory?.categoryName || 'Right') as 'Left' | 'Right';
                        
                        // Calculate Pinch (Thumb tip 4, Index tip 8)
                        const thumbTip = landmarks[4];
                        const indexTip = landmarks[8];
                        const pinchDist = Math.sqrt(
                          Math.pow(thumbTip.x - indexTip.x, 2) + 
                          Math.pow(thumbTip.y - indexTip.y, 2)
                        );
                        const isPinching = pinchDist < 0.05;

                        const gestureCategory = results.gestures?.[index]?.reduce((best, category) =>
                          !best || category.score > best.score ? category : best, undefined as (typeof results.gestures)[number][number] | undefined);
                        let expansionFactor = 0;
                        let rotationControl = { x: 0, y: 0 };

                        if (handedness === 'Left') {
                            // Preserve the existing left-hand pinch/zoom mapping.
                            const minPinch = 0.02;
                            const maxPinch = 0.18;
                            const normalized = (pinchDist - minPinch) / (maxPinch - minPinch);
                            expansionFactor = Math.max(0, Math.min(1, normalized));
                        } else {
                            // Right Hand: 2D Rotation Control (Joystick style)
                            // Hand Center (Middle finger MCP index 9)
                            const handX = landmarks[9].x; 
                            const handY = landmarks[9].y;
                            
                            // X Axis: Left (-1) to Right (1) -> Controls Spin (Yaw)
                            const rotX = (handX - 0.5) * 2; 
                            
                            // Y Axis: Top (-1) to Bottom (1) -> Controls Tilt (Pitch)
                            // Note: In video coords, Y=0 is top.
                            const rotY = (handY - 0.5) * 2;

                            rotationControl = { x: rotX, y: rotY };
                        }

                        const handData: HandInteractionData = {
                          landmarks,
                          handedness,
                          gesture: gestureCategory?.categoryName,
                          gestureScore: gestureCategory?.score,
                          // A frontal palm has a strong plane normal toward the camera.
                          // MediaPipe handedness/mirroring varies, so this is a facing magnitude only.
                          palmNormalZ: (() => {
                            const a = landmarks[5], b = landmarks[17], c = landmarks[9], w = landmarks[0];
                            if (!a || !b || !c || !w) return undefined;
                            const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
                            const vx = c.x - w.x, vy = c.y - w.y, vz = c.z - w.z;
                            const nz = ux * vy - uy * vx;
                            const length = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, nz);
                            return length > 1e-6 ? -Math.abs(nz / length) : undefined;
                          })(),
                          isPinching,
                          pinchDistance: pinchDist,
                          expansionFactor,
                          combatExpansionFactor: (() => {
                            const wrist = landmarks[0];
                            if (!wrist) return undefined;
                            const distance = (point: typeof wrist) => Math.hypot(point.x - wrist.x, point.y - wrist.y);
                            const pairs = [[8, 6], [12, 10], [16, 14], [20, 18]] as const;
                            const extensions = pairs.map(([tip, joint]) => {
                              if (!landmarks[tip] || !landmarks[joint]) return null;
                              const ratio = distance(landmarks[tip]) / Math.max(0.001, distance(landmarks[joint]));
                              return Math.max(0, Math.min(1, (ratio - 1.05) / 0.45));
                            }).filter((value): value is number => value !== null);
                            return extensions.length === 4 ? extensions.reduce((sum, value) => sum + value, 0) / 4 : undefined;
                          })(),
                          rotationControl
                        };

                        if (handedness === 'Right') {
                          newState.rightHand = handData;
                        } else {
                          newState.leftHand = handData;
                        }
                      });
                    }

                    onTrackingUpdate(newState);

                  } catch (error) {
                    console.error("Tracking error:", error);
                  }
              }
            }
            requestRef.current = requestAnimationFrame(renderLoop);
          };
          
          renderLoop();
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onTrackingUpdate]);

  return (
    <video
      ref={videoRef}
      className="absolute top-0 left-0 w-full h-full object-cover opacity-40 contrast-125 brightness-75 filter grayscale-[0.3] pointer-events-none transform -scale-x-100"
      playsInline
      muted
      autoPlay
    />
  );
};

export default VideoFeed;
