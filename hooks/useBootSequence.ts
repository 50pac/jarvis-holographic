import { useEffect, useRef, useState } from 'react';
import { SoundService } from '../services/soundService';

export const useBootSequence = () => {
  const [booted, setBooted] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const startedRef = useRef(false);
  const timeoutRefs = useRef<number[]>([]);

  useEffect(() => () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  }, []);

  const startSystem = () => {
    if (startedRef.current) return;
    startedRef.current = true;

    SoundService.initialize();
    SoundService.playBlip(); // Immediate feedback
    SoundService.playBootSequence();


    // Staggered animation state for loading bars
    setBootStep(1); // Initialize
    timeoutRefs.current.push(window.setTimeout(() => setBootStep(2), 800)); // Loading Modules
    timeoutRefs.current.push(window.setTimeout(() => setBootStep(3), 1800)); // Authentication

    // After text logs, show Jarvis Intro
    timeoutRefs.current.push(window.setTimeout(() => {
        setIntroActive(true);
        SoundService.preloadVoices();
        SoundService.speak("Hello. I am Jarvis.");

        // After Intro, show main app
        timeoutRefs.current.push(window.setTimeout(() => {
             setIntroActive(false);
             setBooted(true);
             SoundService.playAmbientHum();
        }, 2800)); // Intro duration
    }, 2500)); // Boot text logs duration
  };

  return { booted, introActive, bootStep, startSystem };
};
