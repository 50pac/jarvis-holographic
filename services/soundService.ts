export class SoundService {
  private static context: AudioContext | null = null;
  private static gainNode: GainNode | null = null;
  private static analyser: AnalyserNode | null = null;
  private static micStream: MediaStream | null = null;
  private static micSource: MediaStreamAudioSourceNode | null = null;
  private static selectedVoice: SpeechSynthesisVoice | null = null;
  private static voicesCache: SpeechSynthesisVoice[] | null = null;
  private static voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
  static initialize() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
      this.gainNode.gain.value = 0.15; // Master volume
      
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  // Connect Microphone to Analyser for visualization
  static async startMicAnalysis() {
    this.initialize();
    if (!this.context || !this.analyser) return;

    if (this.micStream) {
      this.stopMicAnalysis();
    }

    const deviceId = await SoundService.getFirstAudioInputId();
    const baseConstraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId ? { deviceId: { ideal: deviceId } } : {})
      } as MediaTrackConstraints
    };

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia(baseConstraints);
      this.micSource = this.context.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);
    } catch (firstErr) {
      try {
        await new Promise(r => setTimeout(r, 300));
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micSource = this.context.createMediaStreamSource(this.micStream);
        this.micSource.connect(this.analyser);
      } catch (err) {
        console.error("Microphone access denied for visualization", err);
      }
    }
  }

  static stopMicAnalysis() {
      if (this.micStream) {
          this.micStream.getTracks().forEach(track => track.stop());
          this.micStream = null;
      }
      if (this.micSource) {
          this.micSource.disconnect();
          this.micSource = null;
      }
  }

  static getAnalyserData(dataArray: Uint8Array) {
      if (this.analyser) {
          this.analyser.getByteFrequencyData(dataArray);
      }
  }

  private static async getFirstAudioInputId(): Promise<string | null> {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return null;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const input = devices.find(d => d.kind === 'audioinput' && d.deviceId);
      return input ? input.deviceId : null;
  }

  // Text-to-Speech implementation (Promise based)
  static async speak(text: string): Promise<void> {
    await this.preloadVoices();
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = 1;
        utterance.rate = 1.0;
        utterance.pitch = 0.9;
        const voices = this.voicesCache || window.speechSynthesis.getVoices();
        const preferredVoice = this.selectedVoice || this.choosePreferredVoice(voices);
        if (preferredVoice) utterance.voice = preferredVoice;

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          resolve();
        };

        const est = Math.min(30000, Math.max(2000, text.length * 120));
        const timer = setTimeout(() => {
          finish();
        }, est);

        utterance.onend = () => {
          clearTimeout(timer);
          finish();
        };
        utterance.onerror = (e: any) => {
          clearTimeout(timer);
          console.error("TTS Error", e);
          finish();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("TTS Start Error", err);
        resolve();
      }
    });
  }

  static async preloadVoices(): Promise<void> {
    if (!('speechSynthesis' in window)) return;
    if (this.voicesCache && this.voicesCache.length) return;
    if (!this.voicesReady) {
      const synth = window.speechSynthesis;
      const existing = synth.getVoices();
      if (existing && existing.length) {
        this.voicesReady = Promise.resolve(existing);
      } else {
        this.voicesReady = new Promise<SpeechSynthesisVoice[]>((res) => {
          const handler = () => {
            const list = synth.getVoices();
            if (list && list.length) {
              synth.onvoiceschanged = null as any;
              res(list);
            }
          };
          synth.onvoiceschanged = handler as any;
          const iv = setInterval(() => {
            const list = synth.getVoices();
            if (list && list.length) {
              clearInterval(iv);
              synth.onvoiceschanged = null as any;
              res(list);
            }
          }, 100);
          setTimeout(() => {
            clearInterval(iv);
            res(existing || []);
          }, 3000);
        });
      }
    }
    const voices = await this.voicesReady!;
    this.voicesCache = voices;
    this.selectedVoice = this.choosePreferredVoice(voices);
  }

  private static choosePreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    return voices.find(voice => voice.lang.toLowerCase().startsWith('zh')) ?? voices[0] ?? null;
  }
}
