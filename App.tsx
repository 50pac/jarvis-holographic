import React, { useRef, useState, useCallback, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import VideoFeed from './components/VideoFeed';
import HolographicEarth from './components/HolographicEarth';
import HUDOverlay from './components/HUDOverlay';
import JarvisIntro from './components/JarvisIntro';
import VoiceInterface from './components/VoiceInterface';
import BootScreen from './components/BootScreen';
import { HandTrackingState, RegionName } from './types';
import { SoundService } from './services/soundService';
import { LLMService } from './services/llmService';
import HolographicSuit from './components/HolographicSuit';
import AMapView from './components/AMapView';
import ObjectScanOverlay from './components/ObjectScanOverlay';
import EyeTargetOverlay from './components/EyeTargetOverlay';
import type { SpeechRecognition, SpeechRecognitionEvent } from './types/speechRecognition';
import { isWakeWord, parseCommand } from './commands/commandParser';
import { useTypewriter } from './hooks/useTypewriter';
import { useBootSequence } from './hooks/useBootSequence';

type VoiceMode = 'idle' | 'listening' | 'processing' | 'speaking';

const App: React.FC = () => {
  const handTrackingRef = useRef<HandTrackingState>({
    leftHand: null,
    rightHand: null
  });

  const [currentRegion, setCurrentRegion] = useState<RegionName>(RegionName.ASIA);
  const { booted, introActive, bootStep, startSystem } = useBootSequence();

  // Voice Interaction State
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const processingRef = useRef(false); // To prevent multi-triggers
  const [recognitionActive, setRecognitionActive] = useState(false);
  const voiceModeRef = useRef<VoiceMode>('idle');
  const shouldListenRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const { chatText, chatRole, startTypewrite } = useTypewriter();
  const [showMark, setShowMark] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [eyeActive, setEyeActive] = useState(false);
  const [commandActive, setCommandActive] = useState(false);
  const [commandValue, setCommandValue] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const [suitCommand, setSuitCommand] = useState<{ type: 'stop' | 'reset' | 'fly' | 'landing' | null; tick: number }>({ type: null, tick: 0 });
  const mapControlRef = useRef<{ zoomIn: () => void; zoomOut: () => void; locateCity: (name: string) => void } | null>(null);
  const wakeSessionRef = useRef(false);
  const sessionExpiresAtRef = useRef<number>(0);
  const speakingRef = useRef(false);
  const lastSpokenRef = useRef('');
  const ttsEndAtRef = useRef(0);

  const setVoice = (mode: VoiceMode) => {
    voiceModeRef.current = mode;
    setVoiceMode(mode);
  };

  const handleTrackingUpdate = useCallback((newState: HandTrackingState) => {
    handTrackingRef.current = newState;
  }, []);

  const handleCommand = useCallback(async (raw: string) => {
    const transcript = raw.trim().toLowerCase();
    if (!transcript) return;

    if (processingRef.current) return;
    processingRef.current = true;

    startTypewrite('I', raw);

    const recognitionInstance = recognition;
    try { recognitionInstance?.stop(); } catch {}
    SoundService.stopMicAnalysis();

    const isWake = isWakeWord(transcript);

    if (voiceModeRef.current === 'idle' && !isWake && !commandActive) {
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (voiceModeRef.current === 'idle' && isWake) {
      await SoundService.speak('For you sir, always.');
      wakeSessionRef.current = true;
      sessionExpiresAtRef.current = Date.now() + 60000;
      setTimeout(() => {
        setVoice('listening');
      }, 1500);
      
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    const command = parseCommand(raw);

    if (command?.type === 'exit') {
      SoundService.playRelease();
      setVoice('idle');
      setScanActive(false);
      setEyeActive(false);
      setShowMark(false);
      setShowMap(false);
      wakeSessionRef.current = false;
      sessionExpiresAtRef.current = 0;
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'showMark') {
      SoundService.playImpact();
      setShowMark(true);
      setShowMap(true);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'hideMark') {
      SoundService.playRelease();
      setShowMark(false);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'suit') {
      setShowMark(true);
      setShowMap(command.action === 'fly');
      setSuitCommand(prev => ({ type: command.action, tick: prev.tick + 1 }));
      if (command.action === 'fly') SoundService.playImpact();
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'showMap') {
      setShowMap(true);
      setShowMark(false);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'hideMap') {
      setShowMap(false);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'scanOn') {
      setScanActive(true);
      setShowMap(false);
      setShowMark(false);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'scanOff') {
      setScanActive(false);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'eyeOn') {
      setEyeActive(true);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'eyeOff') {
      setEyeActive(false);
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'zoom') {
      if (command.direction === 'in') mapControlRef.current?.zoomIn();
      if (command.direction === 'out') mapControlRef.current?.zoomOut();
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    if (command?.type === 'locate') {
      const city = command.city;
      if (!showMap) {
        setShowMap(true);
        setShowMark(false);
        setTimeout(() => mapControlRef.current?.locateCity(city), 300);
      } else {
        mapControlRef.current?.locateCity(city);
      }
      setVoice('listening');
      processingRef.current = false;
      try { recognitionInstance?.start(); } catch {}
      return;
    }

    {
      const now = Date.now();
      const inSession = wakeSessionRef.current && now < sessionExpiresAtRef.current;
      if (!commandActive && !inSession) {
        if (isWake) {
          wakeSessionRef.current = true;
          sessionExpiresAtRef.current = now + 60000;
          setVoice('listening');
          processingRef.current = false;
          try { recognitionInstance?.start(); } catch {}
          return;
        }
        setVoice('listening');
        processingRef.current = false;
        try { recognitionInstance?.start(); } catch {}
        return;
      }
      if (inSession) {
        sessionExpiresAtRef.current = now +60000;
      }
    }

    SoundService.playLock();
    setVoice('processing');
    const responseText = await LLMService.generateResponse(transcript);
    setVoice('speaking');
    startTypewrite('J', responseText);
    speakingRef.current = true;
    lastSpokenRef.current = responseText;
    await SoundService.speak(responseText);
    speakingRef.current = false;
    ttsEndAtRef.current = Date.now();
    {
      const now = Date.now();
      const stillActive = wakeSessionRef.current && now < sessionExpiresAtRef.current;
      setVoice(stillActive ? 'listening' : 'idle');
    }
    processingRef.current = false;
    try { recognitionInstance?.start(); } catch {}
  }, [recognition]);

  // Initialize Services
  useEffect(() => {
     LLMService.initialize();
  }, []);

  // --- Voice Logic ---
  useEffect(() => {
    if (!booted) return;

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Speech Recognition not supported in this browser.");
        return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true; // Keep listening for wake word
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-US';
    //recognitionInstance.lang = 'zh-CN';

    recognitionInstance.onresult = async (event: SpeechRecognitionEvent) => {
        const lastResultIndex = event.results.length - 1;
        const alt = event.results[lastResultIndex][0];
        const transcriptRaw = alt.transcript;
        const confidence = typeof alt.confidence === 'number' ? alt.confidence : 1;
        const now = Date.now();
        if (speakingRef.current || now - ttsEndAtRef.current < 1200) return;
        const norm = (s: string) => s.trim().toLowerCase().replace(/[\.,;!，。！？、]/g, '');
        if (lastSpokenRef.current && norm(transcriptRaw) === norm(lastSpokenRef.current)) return;
        const isWakeCandidate = isWakeWord(transcriptRaw);
        const short = transcriptRaw.trim().length < 3;
        if (!isWakeCandidate && short && confidence < 0.6) return;
        await handleCommand(transcriptRaw);
    };

    recognitionInstance.onend = () => {
        setRecognitionActive(false);
        if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
        if (!processingRef.current && shouldListenRef.current) {
            restartTimeoutRef.current = window.setTimeout(() => {
                try { recognitionInstance.start(); } catch {}
            }, 500);
        }
    };

    recognitionInstance.onerror = (event: any) => {
        console.error("Speech Error", event.error);
        if (event.error === 'not-allowed') {
            console.warn("Microphone permission denied");
        }
    };

    (recognitionInstance as any).onstart = () => {
        setRecognitionActive(true);
    };

    setRecognition(recognitionInstance);
    shouldListenRef.current = true;
    try { recognitionInstance.start(); } catch {}

    return () => {
        shouldListenRef.current = false;
        if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
        recognitionInstance.abort();
    };
  }, [booted]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    const iv = window.setInterval(() => {
      const now = Date.now();
      const inSession = wakeSessionRef.current && now < sessionExpiresAtRef.current;
      if (!inSession && voiceModeRef.current === 'listening' && !speakingRef.current) {
        setVoice('idle');
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (!commandActive) {
          setCommandActive(true);
          setCommandValue('');
          setTimeout(() => commandInputRef.current?.focus(), 0);
        } else {
          if (commandValue.trim().length) {
            handleCommand(commandValue);
          }
          setCommandActive(false);
          setCommandValue('');
        }
      }
      if (e.key === 'Escape' && commandActive) {
        setCommandActive(false);
        setCommandValue('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandActive, commandValue, handleCommand]);


  // Render Boot Screen
  if (!booted && !introActive) {
      return <BootScreen bootStep={bootStep} onStart={startSystem} />;
  }

  // Render Intro Screen
  if (introActive) {
      return <JarvisIntro />;
  }

  // Render Main App
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden animate-flash">
      {/* 1. Background Camera Layer */}
      <VideoFeed onTrackingUpdate={handleTrackingUpdate} />
      <ObjectScanOverlay active={scanActive} />
      <EyeTargetOverlay active={eyeActive || scanActive} />

      {showMap && (
        <AMapView handTrackingRef={handTrackingRef} ref={mapControlRef} command={suitCommand} />
      )}

      {/* 2. 3D Scene Layer (Earth & Voice Interface) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Canvas 
            camera={{ position: [0, 0, 5], fov: 45 }} 
            gl={{ alpha: true, antialias: false }} 
            dpr={[1, 1.5]} 
        >
            <Suspense fallback={null}>
              {voiceMode == 'idle' && !showMark && !showMap && (
                <HolographicEarth 
                    handTrackingRef={handTrackingRef} 
                    setRegion={setCurrentRegion}
                />
              )}
              
              {voiceMode !== 'idle' && (
                  <VoiceInterface mode={voiceMode === 'speaking' ? 'speaking' : voiceMode === 'processing' ? 'processing' : 'listening'} />
              )}

              {showMark && (
                 <group position={[0,0,0]}>
                   <HolographicSuit handTrackingRef={handTrackingRef} command={suitCommand} />
                 </group>
              )}
            </Suspense>
        </Canvas>
      </div>

      {/* 3. UI/HUD Layer */}
      <HUDOverlay 
        handTrackingRef={handTrackingRef} 
        currentRegion={currentRegion}
        voiceMode={voiceMode}
        recognitionActive={recognitionActive}
        showMark={showMark}
      />
      
      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-40 text-center">
        {voiceMode !== 'idle' && (
          <div className="text-holo-cyan font-display tracking-[0.2em] animate-pulse mb-2">
            {voiceMode === 'listening' && "LISTENING..."}
            {voiceMode === 'processing' && "PROCESSING..."}
            {voiceMode === 'speaking' && "SPEAKING..."}
          </div>
        )}
        {(voiceMode === 'listening' || voiceMode === 'speaking') && (
          <div className="min-w-[320px] max-w-[720px] mx-auto px-4 py-2 bg-black/60 border border-holo-cyan/40 rounded-md backdrop-blur-sm text-white font-mono text-sm">
            <span className="text-holo-cyan mr-2 text-xl">{chatRole === 'I' ? 'I:' : chatRole === 'J' ? 'J:' : ''}</span>
            <span className="text-holo-blue/90 text-xl">{chatText}</span>
          </div>
        )}
        {commandActive && (
          <div className="mt-4 min-w-[360px] max-w-[720px] mx-auto px-4 py-2 bg-black/70 border border-holo-cyan/50 rounded-md backdrop-blur text-white font-mono text-sm">
            <input
              ref={commandInputRef}
              value={commandValue}
              onChange={(e) => setCommandValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (commandValue.trim().length) {
                    handleCommand(commandValue);
                  }
                  setCommandActive(false);
                  setCommandValue('');
                }
              }}
              placeholder="输入命令，例如：hello jarvis / show mark / over"
              className="w-full bg-transparent outline-none text-holo-blue/90 placeholder:text-gray-400"
            />
            <div className="text-[10px] text-gray-500 mt-1">回车打开/提交，Esc 关闭</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
