export class SoundService {
  private static context: AudioContext | null = null;
  private static gainNode: GainNode | null = null;
  private static analyser: AnalyserNode | null = null;
  private static micStream: MediaStream | null = null;
  private static micSource: MediaStreamAudioSourceNode | null = null;
  private static selectedVoice: SpeechSynthesisVoice | null = null;
  private static voicesCache: SpeechSynthesisVoice[] | null = null;
  private static voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
  private static thrusterLowOsc: OscillatorNode | null = null;
  private static thrusterHighOsc: OscillatorNode | null = null;
  private static thrusterNoise: AudioBufferSourceNode | null = null;
  private static thrusterNoiseGain: GainNode | null = null;
  private static thrusterGain: GainNode | null = null;
  private static thrusterFilter: BiquadFilterNode | null = null;
  private static beamOsc: OscillatorNode | null = null;
  private static beamNoise: AudioBufferSourceNode | null = null;
  private static beamNoiseGain: GainNode | null = null;
  private static beamFilter: BiquadFilterNode | null = null;
  private static beamGain: GainNode | null = null;

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
    if (!voices || !voices.length) return null;
    const byName = (k: string) => voices.find(v => v.name.toLowerCase().includes(k));
    const byLang = (k: string) => voices.find(v => (v.lang || '').toLowerCase().includes(k));
    return (
      voices.find(v => v.name.includes('Google UK English Male')) ||
      voices.find(v => v.name.includes('UK') && v.name.includes('English') && v.name.includes('Male')) ||
      byLang('en-gb') ||
      byLang('en-us') ||
      voices[0] ||
      null
    );
  }

  // Play a short high-pitched beep (UI hover/tick)
  static playBlip() {
    if (!this.context || !this.gainNode) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, this.context.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.05);

    osc.start();
    osc.stop(this.context.currentTime + 0.05);
  }

  // Play a mechanical lock/scan sound
  static playLock() {
    if (!this.context || !this.gainNode) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);

    osc.start();
    osc.stop(this.context.currentTime + 0.3);
  }

  static playArmorSwitch(sound: { pitch: number; duration: number; noise: number }) {
    if (!this.context || !this.gainNode) return;
    const context = this.context;
    const start = context.currentTime;
    const duration = Math.max(0.15, sound.duration);
    const pitch = Math.max(80, sound.pitch);

    const sweep = context.createOscillator();
    const sweepGain = context.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(pitch * 0.5, start);
    sweep.frequency.exponentialRampToValueAtTime(pitch * 2.2, start + duration * 0.72);
    sweep.frequency.exponentialRampToValueAtTime(pitch, start + duration);
    sweepGain.gain.setValueAtTime(0.001, start);
    sweepGain.gain.linearRampToValueAtTime(0.13, start + duration * 0.16);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    sweep.connect(sweepGain);
    sweepGain.connect(this.gainNode);
    sweep.start(start);
    sweep.stop(start + duration);

    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(Math.max(120, pitch), start);
    filter.frequency.exponentialRampToValueAtTime(pitch * 3, start + duration);
    noiseGain.gain.setValueAtTime(Math.max(0.001, sound.noise * 0.11), start);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gainNode);
    noise.start(start);
    noise.stop(start + duration);

    const lock = context.createOscillator();
    const lockGain = context.createGain();
    const lockAt = start + duration * 0.84;
    lock.type = 'square';
    lock.frequency.setValueAtTime(pitch * 0.75, lockAt);
    lock.frequency.exponentialRampToValueAtTime(Math.max(70, pitch * 0.22), lockAt + 0.09);
    lockGain.gain.setValueAtTime(0.13, lockAt);
    lockGain.gain.exponentialRampToValueAtTime(0.001, lockAt + 0.1);
    lock.connect(lockGain);
    lockGain.connect(this.gainNode);
    lock.start(lockAt);
    lock.stop(lockAt + 0.1);
  }

  // Play a release sound (reverse lock)
  static playRelease() {
    if (!this.context || !this.gainNode) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'square';
    osc.frequency.setValueAtTime(50, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.context.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.05, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.2);

    osc.start();
    osc.stop(this.context.currentTime + 0.2);
  }

  // Play a servo motor sound for expansion
  static playServo(intensity: number) {
    if (!this.context || !this.gainNode) return;
    
    if (intensity < 0.001) return; 

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'sawtooth';
    const jitter = Math.random() * 20; 
    osc.frequency.setValueAtTime(60 + (intensity * 1500) + jitter, this.context.currentTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + (intensity * 2000), this.context.currentTime);

    const vol = Math.min(0.2, 0.05 + (intensity * 2)); 
    gain.gain.setValueAtTime(vol, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.1);

    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }

  // Play a heavy data-load/switch sound
  static playMapSwitch() {
    if (!this.context || !this.gainNode) return;
    
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.gainNode);

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, this.context.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.5);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2000, this.context.currentTime);
    osc2.frequency.linearRampToValueAtTime(500, this.context.currentTime + 0.2);

    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.5);

    osc1.start();
    osc2.start();
    osc1.stop(this.context.currentTime + 0.5);
    osc2.stop(this.context.currentTime + 0.5);
  }

  static playImpact() {
    if (!this.context || !this.gainNode) return;
    const t = this.context.currentTime;

    const lowOsc = this.context.createOscillator();
    const lowGain = this.context.createGain();
    lowOsc.connect(lowGain);
    lowGain.connect(this.gainNode);
    lowOsc.type = 'sine';
    lowOsc.frequency.setValueAtTime(60, t);
    lowOsc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    lowGain.gain.setValueAtTime(0.0, t);
    lowGain.gain.linearRampToValueAtTime(0.35, t + 0.05);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    lowOsc.start(t);
    lowOsc.stop(t + 0.6);

    const noiseBuffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.5), this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(600, t);
    const noiseGain = this.context.createGain();
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.gainNode);
    const echoDelay = this.context.createDelay();
    echoDelay.delayTime.setValueAtTime(0.08, t);
    const echoFeedback = this.context.createGain();
    echoFeedback.gain.setValueAtTime(0.25, t);
    noiseGain.connect(echoDelay);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    const echoOut = this.context.createGain();
    echoOut.gain.setValueAtTime(0.15, t);
    echoDelay.connect(echoOut);
    echoOut.connect(this.gainNode);
    noiseGain.gain.setValueAtTime(0.0, t);
    noiseGain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noiseSource.start(t);
    noiseSource.stop(t + 0.3);

    const hiOsc = this.context.createOscillator();
    const hiGain = this.context.createGain();
    const hiFilter = this.context.createBiquadFilter();
    hiOsc.connect(hiFilter);
    hiFilter.connect(hiGain);
    const panner = this.context.createStereoPanner();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    hiGain.connect(panner);
    panner.connect(this.gainNode);
    lfo.frequency.setValueAtTime(6, t);
    lfoGain.gain.setValueAtTime(0.8, t);
    lfo.connect(lfoGain);
    lfoGain.connect(panner.pan);
    hiOsc.type = 'triangle';
    hiOsc.frequency.setValueAtTime(900, t);
    hiOsc.frequency.linearRampToValueAtTime(400, t + 0.25);
    hiFilter.type = 'highpass';
    hiFilter.frequency.setValueAtTime(300, t);
    hiGain.gain.setValueAtTime(0.0, t);
    hiGain.gain.linearRampToValueAtTime(0.2, t + 0.03);
    hiGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    hiOsc.start(t);
    hiOsc.stop(t + 0.3);
    lfo.start(t);
    lfo.stop(t + 0.3);
  }

  // Ambient background hum
  static playAmbientHum() {
    if (!this.context || !this.gainNode) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.connect(gain);
    gain.connect(this.gainNode);
    
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    gain.gain.value = 0.03; 
    
    osc.start();
  }
  
  static playBootSequence() {
     if (!this.context || !this.gainNode) return;
     const t = this.context.currentTime;
     
     const osc = this.context.createOscillator();
     const gain = this.context.createGain();
     osc.connect(gain);
     gain.connect(this.gainNode);
     
     osc.frequency.setValueAtTime(50, t);
     osc.frequency.exponentialRampToValueAtTime(800, t + 1.5);
     
     gain.gain.setValueAtTime(0, t);
     gain.gain.linearRampToValueAtTime(0.3, t + 0.5);
     gain.gain.linearRampToValueAtTime(0, t + 2.0);
     
     osc.start(t);
     osc.stop(t + 2.0);
  }

  static startThrusters() {
    if (!this.context || !this.gainNode) return;
    this.stopThrusters();
    const t = this.context.currentTime;
    this.thrusterGain = this.context.createGain();
    this.thrusterGain.gain.value = 0.0;
    this.thrusterGain.connect(this.gainNode);

    this.thrusterFilter = this.context.createBiquadFilter();
    this.thrusterFilter.type = 'lowpass';
    this.thrusterFilter.frequency.setValueAtTime(500, t);
    this.thrusterFilter.connect(this.thrusterGain);

    this.thrusterLowOsc = this.context.createOscillator();
    this.thrusterLowOsc.type = 'sawtooth';
    this.thrusterLowOsc.frequency.setValueAtTime(80, t);
    const lowGain = this.context.createGain();
    lowGain.gain.value = 0.0;
    this.thrusterLowOsc.connect(lowGain);
    lowGain.connect(this.thrusterFilter);

    this.thrusterHighOsc = this.context.createOscillator();
    this.thrusterHighOsc.type = 'triangle';
    this.thrusterHighOsc.frequency.setValueAtTime(600, t);
    const hiGain = this.context.createGain();
    hiGain.gain.value = 0.0;
    this.thrusterHighOsc.connect(hiGain);
    hiGain.connect(this.thrusterFilter);

    const noiseBuffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 1.0), this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.thrusterNoise = this.context.createBufferSource();
    this.thrusterNoise.buffer = noiseBuffer;
    this.thrusterNoise.loop = true;
    this.thrusterNoiseGain = this.context.createGain();
    this.thrusterNoiseGain.gain.value = 0.0;
    this.thrusterNoise.connect(this.thrusterNoiseGain);
    this.thrusterNoiseGain.connect(this.thrusterFilter);

    this.thrusterLowOsc.start(t);
    this.thrusterHighOsc.start(t);
    this.thrusterNoise.start(t);
  }

  static updateThrusters(speed: number) {
    if (!this.context) return;
    const t = this.context.currentTime;
    const s = Math.max(0, Math.min(2.5, speed));
    const lowFreq = 70 + s * 90;
    const hiFreq = 600 + s * 1200;
    const cutoff = 500 + s * 1500;
    const vol = 0.05 + s * 0.15;
    const noiseVol = 0.02 + s * 0.12;
    if (this.thrusterLowOsc) this.thrusterLowOsc.frequency.setValueAtTime(lowFreq, t);
    if (this.thrusterHighOsc) this.thrusterHighOsc.frequency.setValueAtTime(hiFreq, t);
    if (this.thrusterFilter) this.thrusterFilter.frequency.setValueAtTime(cutoff, t);
    if (this.thrusterGain) this.thrusterGain.gain.setTargetAtTime(vol, t, 0.05);
    if (this.thrusterNoiseGain) this.thrusterNoiseGain.gain.setTargetAtTime(noiseVol, t, 0.05);
  }

  static stopThrusters() {
    if (!this.context) return;
    const t = this.context.currentTime;
    if (this.thrusterGain) this.thrusterGain.gain.setTargetAtTime(0, t, 0.1);
    try { this.thrusterLowOsc?.stop(t + 0.2); } catch {}
    try { this.thrusterHighOsc?.stop(t + 0.2); } catch {}
    try { this.thrusterNoise?.stop(t + 0.2); } catch {}
    this.thrusterLowOsc = null;
    this.thrusterHighOsc = null;
    this.thrusterNoise = null;
    this.thrusterNoiseGain = null;
    this.thrusterGain = null;
    this.thrusterFilter = null;
  }

  static startBeamHum() {
    this.initialize();
    if (!this.context || !this.gainNode) return;
    this.stopBeamHum();
    const t = this.context.currentTime;
    this.beamGain = this.context.createGain();
    this.beamGain.gain.value = 0.0;
    this.beamGain.connect(this.gainNode);

    this.beamFilter = this.context.createBiquadFilter();
    this.beamFilter.type = 'bandpass';
    this.beamFilter.frequency.setValueAtTime(1400, t);
    this.beamFilter.Q.setValueAtTime(4, t);
    this.beamFilter.connect(this.beamGain);

    this.beamOsc = this.context.createOscillator();
    this.beamOsc.type = 'square';
    this.beamOsc.frequency.setValueAtTime(1200, t);
    const oscGain = this.context.createGain();
    oscGain.gain.value = 0.0;
    this.beamOsc.connect(oscGain);
    oscGain.connect(this.beamFilter);

    const noiseBuffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.5), this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.beamNoise = this.context.createBufferSource();
    this.beamNoise.buffer = noiseBuffer;
    this.beamNoise.loop = true;
    this.beamNoiseGain = this.context.createGain();
    this.beamNoiseGain.gain.value = 0.0;
    this.beamNoise.connect(this.beamNoiseGain);
    this.beamNoiseGain.connect(this.beamFilter);

    this.beamOsc.start(t);
    this.beamNoise.start(t);
  }

  static updateBeamHum(intensity: number) {
    if (!this.context) return;
    const t = this.context.currentTime;
    const s = Math.max(0, Math.min(1, intensity));
    const freq = 1000 + s * 1500;
    const cutoff = 1200 + s * 1200;
    const vol = 0.03 + s * 0.12;
    const noiseVol = 0.01 + s * 0.06;
    if (this.beamOsc) this.beamOsc.frequency.setValueAtTime(freq, t);
    if (this.beamFilter) this.beamFilter.frequency.setValueAtTime(cutoff, t);
    if (this.beamGain) this.beamGain.gain.setTargetAtTime(vol, t, 0.05);
    if (this.beamNoiseGain) this.beamNoiseGain.gain.setTargetAtTime(noiseVol, t, 0.05);
  }

  static stopBeamHum() {
    if (!this.context) return;
    const t = this.context.currentTime;
    try { if (this.beamGain) this.beamGain.gain.setTargetAtTime(0, t, 0.08); } catch {}
    try { this.beamOsc?.stop(t + 0.12); } catch {}
    try { this.beamNoise?.stop(t + 0.12); } catch {}
    this.beamOsc = null;
    this.beamNoise = null;
    this.beamNoiseGain = null;
    this.beamFilter = null;
    this.beamGain = null;
  }

  static playBlast() {
    this.initialize();
    if (!this.context || !this.gainNode) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const noiseBuf = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.15), this.context.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.context.createBufferSource();
    const noiseGain = this.context.createGain();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode);
    noise.connect(noiseGain);
    noiseGain.connect(this.gainNode);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(2800, t + 0.08);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.Q.value = 6;
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.buffer = noiseBuf;
    noiseGain.gain.setValueAtTime(0.0, t);
    noiseGain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.start(t);
    osc.start(t);
    osc.stop(t + 0.2);
    noise.stop(t + 0.2);
  }
}
