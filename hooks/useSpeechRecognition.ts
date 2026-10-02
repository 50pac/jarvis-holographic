import { useEffect, useRef, useState } from 'react';
import type { SpeechRecognition, SpeechRecognitionEvent } from '../types/speechRecognition';

interface SpeechRecognitionOptions {
  enabled: boolean;
  onTranscript: (transcript: string) => void | Promise<void>;
  recognitionRef: React.MutableRefObject<SpeechRecognition | null>;
  speakingRef: React.MutableRefObject<boolean>;
  ttsEndAtRef: React.MutableRefObject<number>;
  lastSpokenRef: React.MutableRefObject<string>;
  processingRef: React.MutableRefObject<boolean>;
}

export function useSpeechRecognition({
  enabled, onTranscript, recognitionRef, speakingRef, ttsEndAtRef,
  lastSpokenRef, processingRef,
}: SpeechRecognitionOptions) {
  const [recognitionActive, setRecognitionActive] = useState(false);
  const shouldListenRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const handlerRef = useRef(onTranscript);
  handlerRef.current = onTranscript;

  useEffect(() => {
    if (!enabled) {
      setRecognitionActive(false);
      return;
    }

    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    const recognitionInstance: SpeechRecognition = new SpeechRecognitionConstructor();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'zh-CN';

    recognitionInstance.onresult = async (event: SpeechRecognitionEvent) => {
      if (!shouldListenRef.current || recognitionRef.current !== recognitionInstance) return;
      const lastResultIndex = event.results.length - 1;
      const alt = event.results[lastResultIndex][0];
      const transcriptRaw = alt.transcript;
      const now = Date.now();
      if (speakingRef.current || now - ttsEndAtRef.current < 1200) return;
      const norm = (s: string) => s.trim().toLowerCase().replace(/[\.,;!，。！？、]/g, '');
      if (lastSpokenRef.current && norm(transcriptRaw) === norm(lastSpokenRef.current)) return;
      await handlerRef.current(transcriptRaw);
    };

    recognitionInstance.onend = () => {
      if (!shouldListenRef.current || recognitionRef.current !== recognitionInstance) return;
      setRecognitionActive(false);
      if (restartTimeoutRef.current !== null) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (!processingRef.current && shouldListenRef.current) {
        restartTimeoutRef.current = window.setTimeout(() => {
          restartTimeoutRef.current = null;
          if (!shouldListenRef.current) return;
          try { recognitionInstance.start(); } catch {}
        }, 500);
      }
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech Error', event.error);
      if (event.error === 'not-allowed') {
        console.warn('Microphone permission denied');
      }
    };

    (recognitionInstance as SpeechRecognition & { onstart: () => void }).onstart = () => {
      if (!shouldListenRef.current || recognitionRef.current !== recognitionInstance) return;
      setRecognitionActive(true);
    };

    recognitionRef.current = recognitionInstance;
    shouldListenRef.current = true;
    try { recognitionInstance.start(); } catch {}

    return () => {
      shouldListenRef.current = false;
      if (restartTimeoutRef.current !== null) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      recognitionRef.current = null;
      recognitionInstance.abort();
    };
  }, [enabled, recognitionRef, speakingRef, ttsEndAtRef, lastSpokenRef, processingRef]);

  return { recognitionRef, recognitionActive };
}
