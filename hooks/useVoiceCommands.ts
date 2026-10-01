import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { isWakeWord, parseCommand } from '../commands/commandParser';
import { LLMService } from '../services/llmService';
import { SoundService } from '../services/soundService';
import type { SpeechRecognition } from '../types/speechRecognition';
import { useArmor } from './useArmor';

export type VoiceMode = 'idle' | 'listening' | 'processing' | 'speaking';
export type SuitCommand = { type: 'stop' | 'reset' | 'fly' | 'landing' | null; tick: number };
export type MapControls = { zoomIn: () => void; zoomOut: () => void; locateCity: (name: string) => void };

interface VoiceCommandOptions {
  recognitionRef: MutableRefObject<SpeechRecognition | null>;
  commandActiveRef: MutableRefObject<boolean>;
  startTypewrite: (role: 'I' | 'J', text: string) => void;
}

export function useVoiceCommands({ recognitionRef, commandActiveRef, startTypewrite }: VoiceCommandOptions) {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const voiceModeRef = useRef<VoiceMode>('idle');
  const processingRef = useRef(false);
  const wakeSessionRef = useRef(false);
  const sessionExpiresAtRef = useRef(0);
  const speakingRef = useRef(false);
  const lastSpokenRef = useRef('');
  const ttsEndAtRef = useRef(0);
  const armor = useArmor({ startTypewrite, speakingRef, ttsEndAtRef });
  const [showMark, setShowMark] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const showMapRef = useRef(false);
  const [scanActive, setScanActive] = useState(false);
  const [eyeActive, setEyeActive] = useState(false);
  const [suitCommand, setSuitCommand] = useState<SuitCommand>({ type: null, tick: 0 });
  const mapControlRef = useRef<MapControls | null>(null);
  const timeoutRefs = useRef(new Set<number>());
  const mountedRef = useRef(true);

  voiceModeRef.current = voiceMode;
  showMapRef.current = showMap;

  const setVoice = useCallback((mode: VoiceMode) => {
    if (!mountedRef.current) return;
    voiceModeRef.current = mode;
    setVoiceMode(mode);
  }, []);

  const showArmorSuit = useCallback(() => setShowMark(true), []);

  const setMapVisible = (visible: boolean) => {
    showMapRef.current = visible;
    setShowMap(visible);
  };

  const schedule = (callback: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timeoutRefs.current.delete(id);
      if (mountedRef.current) callback();
    }, delay);
    timeoutRefs.current.add(id);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    LLMService.initialize();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const inSession = wakeSessionRef.current && now < sessionExpiresAtRef.current;
      if (!inSession && voiceModeRef.current === 'listening' && !speakingRef.current) {
        setVoice('idle');
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [setVoice]);

  const handleCommand = useCallback(async (raw: string) => {
    const transcript = raw.trim().toLowerCase();
    if (!transcript) return;

    if (processingRef.current) return;
    processingRef.current = true;

    try {
      startTypewrite('I', raw);
      try { recognitionRef.current?.stop(); } catch {}
      SoundService.stopMicAnalysis();

      const isWake = isWakeWord(transcript);

      if (voiceModeRef.current === 'idle' && !isWake && !commandActiveRef.current) {
        return;
      }

      if (voiceModeRef.current === 'idle' && isWake) {
        await SoundService.speak('For you sir, always.');
        if (!mountedRef.current) return;
        wakeSessionRef.current = true;
        sessionExpiresAtRef.current = Date.now() + 60000;
        schedule(() => setVoice('listening'), 1500);
        return;
      }

      const command = parseCommand(raw);

      if (command?.type === 'exit') {
        SoundService.playRelease();
        setVoice('idle');
        setScanActive(false);
        setEyeActive(false);
        setShowMark(false);
        setMapVisible(false);
        wakeSessionRef.current = false;
        sessionExpiresAtRef.current = 0;
        return;
      }

      if (command?.type === 'showMark') {
        SoundService.playImpact();
        setShowMark(true);
        setMapVisible(true);
        setVoice('listening');
        return;
      }

      if (command?.type === 'hideMark') {
        SoundService.playRelease();
        setShowMark(false);
        setVoice('listening');
        return;
      }

      if (command?.type === 'armorPicker') {
        armor.openPicker();
        setVoice('listening');
        return;
      }

      if (command?.type === 'armorSwitch') {
        if (command.target === 'next') armor.nextArmor();
        else if (command.target === 'prev') armor.prevArmor();
        else if (command.target === 'id') armor.selectArmor(command.id);
        showArmorSuit();
        setVoice('listening');
        return;
      }

      if (command?.type === 'suit') {
        setShowMark(true);
        setMapVisible(command.action === 'fly');
        setSuitCommand(prev => ({ type: command.action, tick: prev.tick + 1 }));
        if (command.action === 'fly') SoundService.playImpact();
        setVoice('listening');
        return;
      }

      if (command?.type === 'showMap') {
        setMapVisible(true);
        setShowMark(false);
        setVoice('listening');
        return;
      }

      if (command?.type === 'hideMap') {
        setMapVisible(false);
        setVoice('listening');
        return;
      }

      if (command?.type === 'scanOn') {
        setScanActive(true);
        setMapVisible(false);
        setShowMark(false);
        setVoice('listening');
        return;
      }

      if (command?.type === 'scanOff') {
        setScanActive(false);
        setVoice('listening');
        return;
      }

      if (command?.type === 'eyeOn') {
        setEyeActive(true);
        setVoice('listening');
        return;
      }

      if (command?.type === 'eyeOff') {
        setEyeActive(false);
        setVoice('listening');
        return;
      }

      if (command?.type === 'zoom') {
        if (command.direction === 'in') mapControlRef.current?.zoomIn();
        if (command.direction === 'out') mapControlRef.current?.zoomOut();
        setVoice('listening');
        return;
      }

      if (command?.type === 'locate') {
        const city = command.city;
        if (!showMapRef.current) {
          setMapVisible(true);
          setShowMark(false);
          schedule(() => mapControlRef.current?.locateCity(city), 300);
        } else {
          mapControlRef.current?.locateCity(city);
        }
        setVoice('listening');
        return;
      }

      {
        const now = Date.now();
        const inSession = wakeSessionRef.current && now < sessionExpiresAtRef.current;
        if (!commandActiveRef.current && !inSession) {
          if (isWake) {
            wakeSessionRef.current = true;
            sessionExpiresAtRef.current = now + 60000;
            setVoice('listening');
            return;
          }
          setVoice('listening');
          return;
        }
        if (inSession) {
          sessionExpiresAtRef.current = now + 60000;
        }
      }

      SoundService.playLock();
      setVoice('processing');
      const responseText = await LLMService.generateResponse(transcript);
      if (!mountedRef.current) return;
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
    } catch (error) {
      console.error('Voice command error', error);
      speakingRef.current = false;
      const now = Date.now();
      const inSession = wakeSessionRef.current && now < sessionExpiresAtRef.current;
      setVoice(inSession ? 'listening' : 'idle');
    } finally {
      processingRef.current = false;
      try { recognitionRef.current?.start(); } catch {}
    }
  }, [commandActiveRef, recognitionRef, startTypewrite, setVoice, armor.openPicker, armor.nextArmor, armor.prevArmor, armor.selectArmor, showArmorSuit]);

  return {
    voiceMode, handleCommand, processingRef, speakingRef, lastSpokenRef, ttsEndAtRef,
    showMark, showMap, scanActive, eyeActive, suitCommand, mapControlRef, armor, showArmorSuit,
  };
}
