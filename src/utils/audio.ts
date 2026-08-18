// Web Audio API Synthesizer for UI audio effects, background music, and haptic feedback

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgMusicEnabled: boolean = true;
  private soundEffectsEnabled: boolean = true;
  private hapticEnabled: boolean = true;

  private bgOsc1: OscillatorNode | null = null;
  private bgOsc2: OscillatorNode | null = null;
  private bgGainNode: GainNode | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBgMusic();
    } else if (this.bgMusicEnabled) {
      this.startBgMusic();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setSoundEffectsEnabled(enabled: boolean) {
    this.soundEffectsEnabled = enabled;
  }

  public getSoundEffectsEnabled(): boolean {
    return this.soundEffectsEnabled;
  }

  public setHapticEnabled(enabled: boolean) {
    this.hapticEnabled = enabled;
  }

  public getHapticEnabled(): boolean {
    return this.hapticEnabled;
  }

  public setBgMusicEnabled(enabled: boolean) {
    this.bgMusicEnabled = enabled;
    if (enabled && !this.isMuted) {
      this.startBgMusic();
    } else {
      this.stopBgMusic();
    }
  }

  public getBgMusicEnabled(): boolean {
    return this.bgMusicEnabled;
  }

  public triggerHaptic(duration: number | number[] = 30) {
    if (this.hapticEnabled && typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {
        // Haptics not supported or blocked
      }
    }
  }

  public startBgMusic() {
    if (!this.bgMusicEnabled || this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.bgOsc1) return; // Already playing

      const now = this.ctx.currentTime;
      this.bgOsc1 = this.ctx.createOscillator();
      this.bgOsc2 = this.ctx.createOscillator();
      this.bgGainNode = this.ctx.createGain();

      this.bgOsc1.type = 'sine';
      this.bgOsc1.frequency.setValueAtTime(130.81, now); // C3 chord tone

      this.bgOsc2.type = 'triangle';
      this.bgOsc2.frequency.setValueAtTime(196.00, now); // G3 chord tone

      // Soft background volume
      this.bgGainNode.gain.setValueAtTime(0.015, now);

      this.bgOsc1.connect(this.bgGainNode);
      this.bgOsc2.connect(this.bgGainNode);
      this.bgGainNode.connect(this.ctx.destination);

      this.bgOsc1.start(now);
      this.bgOsc2.start(now);
    } catch (e) {
      console.warn('BG music playback error', e);
    }
  }

  public stopBgMusic() {
    try {
      if (this.bgOsc1) {
        this.bgOsc1.stop();
        this.bgOsc1.disconnect();
        this.bgOsc1 = null;
      }
      if (this.bgOsc2) {
        this.bgOsc2.stop();
        this.bgOsc2.disconnect();
        this.bgOsc2 = null;
      }
      if (this.bgGainNode) {
        this.bgGainNode.disconnect();
        this.bgGainNode = null;
      }
    } catch (e) {
      console.warn('BG music stop error', e);
    }
  }

  public playClick() {
    this.triggerHaptic(15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCoin() {
    this.triggerHaptic([30, 40, 50]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      osc2.frequency.setValueAtTime(1975.53, now);
      osc2.frequency.setValueAtTime(2637.02, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playWinFanfare() {
    this.triggerHaptic([50, 50, 100, 150]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCountdownTick() {
    this.triggerHaptic(10);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playSpinWhoosh() {
    this.triggerHaptic(20);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playBallClick() {
    this.triggerHaptic(15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.015);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.015);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCheer() {
    this.triggerHaptic([40, 60, 80, 100]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playLightningZap() {
    this.triggerHaptic([30, 50, 70, 90]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Electric saw/zap wave
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio lightning zap error', e);
    }
  }

  public playSpinTick() {
    this.triggerHaptic(10);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCarRollingSound() {
    this.triggerHaptic(8);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220 + Math.random() * 120, now);
      osc.frequency.exponentialRampToValueAtTime(450 + Math.random() * 150, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playLoudWinSound() {
    this.triggerHaptic([80, 100, 120, 200, 300]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // High Loud Fanfare Chords (C Major, G Major, High C Octave Burst)
      const chordNotes = [
        [261.63, 329.63, 392.00, 523.25],          // C4 major chord
        [392.00, 493.88, 587.33, 783.99],          // G4 major chord
        [523.25, 659.25, 783.99, 1046.50, 1318.51] // C5 major climax chord
      ];

      chordNotes.forEach((chord, chordIdx) => {
        const startTime = now + chordIdx * 0.18;
        chord.forEach((freq) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = chordIdx === 2 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          // Loud clear gain volume
          gain.gain.setValueAtTime(0.28, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.65);
        });
      });

      // High celebratory synth chime arpeggio
      const chimes = [1046.50, 1318.51, 1567.98, 2093.00, 2637.02];
      chimes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.55 + idx * 0.08);

        gain.gain.setValueAtTime(0.3, now + 0.55 + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + 0.55 + idx * 0.08);
        osc.stop(now + 0.55 + idx * 0.08 + 0.45);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCardDeal() {
    this.triggerHaptic(12);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      // Card friction whoosh (filtered white noise burst)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.06);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.07);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playCardFlip() {
    this.triggerHaptic(18);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Crisp card slap/snap
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playChipPlace() {
    this.triggerHaptic(15);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Ceramic casino chip click (dual high resonance tones)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2400, now);
      osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.035);
      osc2.frequency.setValueAtTime(3600, now);
      osc2.frequency.exponentialRampToValueAtTime(2800, now + 0.035);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.035);
      osc2.stop(now + 0.035);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playBetsClosed() {
    this.triggerHaptic([40, 80, 40]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Low resonant casino gong / bell
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playLossSound() {
    this.triggerHaptic([30, 60]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.35);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playDragonRoar() {
    this.triggerHaptic([60, 40, 80]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Deep, mystical Dragon roar sound with brass frequency sweeps
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.exponentialRampToValueAtTime(280, now + 0.25);
      osc1.frequency.exponentialRampToValueAtTime(80, now + 0.7);

      osc2.frequency.setValueAtTime(90, now);
      osc2.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      osc2.frequency.exponentialRampToValueAtTime(60, now + 0.7);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.75);
      osc2.stop(now + 0.75);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playTigerRoar() {
    this.triggerHaptic([50, 40, 90]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Fierce predatory growl / strike tone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 0.3);
      osc1.frequency.exponentialRampToValueAtTime(70, now + 0.65);

      osc2.frequency.setValueAtTime(340, now);
      osc2.frequency.exponentialRampToValueAtTime(200, now + 0.25);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.65);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playChipSelect() {
    this.playClick();
  }

  public playChipPlacement() {
    this.playChipPlace();
  }

  public playWinCoin() {
    this.playCoin();
  }

  public playError() {
    this.triggerHaptic([50, 50]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(120, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  public playTieGong() {
    this.triggerHaptic([100, 50, 100]);
    if (this.isMuted || !this.soundEffectsEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Resonant harmonized oriental temple bell
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc3.frequency.setValueAtTime(783.99, now); // G5

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
      osc3.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }
}

export const soundFx = new SoundManager();
