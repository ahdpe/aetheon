export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.droneGain = null;
    this.sfxGain = null;
    this.pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; // C4, D4, E4, G4, A4, C5...
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Master gains
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.setupAmbientSoundscape();
  }

  setupAmbientSoundscape() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // 1. Warm Shimmering Ambient Pad Engine (F Lydian / D minor celestial modal space)
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.38, t);
    this.padGain.connect(this.droneGain || this.masterGain);

    // Resonant master lowpass filter for silky soft pads
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(560, t);
    this.padFilter.Q.setValueAtTime(1.8, t);
    this.padFilter.connect(this.padGain);

    // Filter breathing LFO (slow organic respiration)
    try {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.045, t); // ~22s cycle
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(160, t);
      lfo.connect(lfoGain);
      lfoGain.connect(this.padFilter.frequency);
      lfo.start();
    } catch (e) {}

    // 4 Ethereal Ambient Chords: Fmaj9 -> Dm11 -> Bbmaj7 -> Cmaj
    this.chords = [
      [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9 (F3, A3, C4, E4, G4)
      [146.83, 220.00, 261.63, 349.23, 440.00], // Dm11  (D3, A3, C4, F4, A4)
      [116.54, 174.61, 220.00, 293.66, 349.23], // Bbmaj7(Bb2, F3, A3, D4, F4)
      [130.81, 196.00, 261.63, 329.63, 392.00]  // Cmaj  (C3, G3, C4, E4, G4)
    ];
    this.chordIndex = 0;
    this.padVoices = [];

    const pans = [0, -0.42, 0.42, -0.22, 0.22];
    const initialChord = this.chords[0];

    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : (i % 2 === 0 ? 'triangle' : 'sine');
      // Subtle micro-detune for lush analog chorus shimmer
      const detune = (Math.random() - 0.5) * 1.2;
      osc.frequency.setValueAtTime(initialChord[i] + detune, t);

      const vGain = this.ctx.createGain();
      const baseVol = i === 0 ? 0.26 : 0.15;
      vGain.gain.setValueAtTime(baseVol, t);

      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(pans[i], t);
        osc.connect(vGain);
        vGain.connect(panner);
        panner.connect(this.padFilter);
      } else {
        osc.connect(vGain);
        vGain.connect(this.padFilter);
      }

      osc.start();
      this.padVoices.push({ osc, gain: vGain, baseVol });
    }

    // Start slow, seamless chord progression (every 11.5 seconds)
    this.startChordProgression();

    // 2. Generative Crystalline Water Bells
    this.bellGain = this.ctx.createGain();
    this.bellGain.gain.setValueAtTime(0.45, t);
    this.bellGain.connect(this.masterGain);
    this.startChimeLoop();

    // 3. Gentle Ocean Breath (Filtered soothing waves)
    this.setupWaveSwell();
  }

  startChordProgression() {
    if (this.chordInterval) clearInterval(this.chordInterval);
    this.chordInterval = setInterval(() => {
      if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
      this.chordIndex = (this.chordIndex + 1) % this.chords.length;
      const nextChord = this.chords[this.chordIndex];
      const t = this.ctx.currentTime;

      for (let i = 0; i < this.padVoices.length; i++) {
        const voice = this.padVoices[i];
        const targetFreq = nextChord[i];
        // Silky exponential frequency glide over 3.2 seconds
        voice.osc.frequency.setTargetAtTime(targetFreq, t, 3.2);

        // Soft volume respiration during transition
        voice.gain.gain.setTargetAtTime(voice.baseVol * 0.65, t, 1.2);
        voice.gain.gain.setTargetAtTime(voice.baseVol, t + 2.0, 2.5);
      }
    }, 11500);
  }

  startChimeLoop() {
    if (this.chimeTimeout) clearTimeout(this.chimeTimeout);

    const scheduleNext = () => {
      const nextDelay = 2800 + Math.random() * 3600; // 2.8s to 6.4s random intervals
      this.chimeTimeout = setTimeout(() => {
        if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
          this.playAmbientBell();
        }
        scheduleNext();
      }, nextDelay);
    };

    scheduleNext();
  }

  playAmbientBell() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Harmonic pentatonic bell frequencies (C5, D5, E5, G5, A5, C6, D6)
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
    const freq = notes[Math.floor(Math.random() * notes.length)];

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t);

      // Glass overtone for singing bowl / marimba chime
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.0 + (Math.random() - 0.5) * 1.5, t);

      const peakGain = 0.07 + Math.random() * 0.04;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(peakGain, t + 0.012); // Soft crystal strike
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8 + Math.random() * 1.2); // Long shimmering ring

      osc1.connect(gain);
      osc2.connect(gain);

      if (this.ctx.createStereoPanner) {
        const pan = this.ctx.createStereoPanner();
        pan.pan.setValueAtTime((Math.random() - 0.5) * 1.1, t);
        gain.connect(pan);
        pan.connect(this.bellGain);
      } else {
        gain.connect(this.bellGain);
      }

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 4.2);
      osc2.stop(t + 4.2);
    } catch (e) {}
  }

  setupWaveSwell() {
    try {
      const bufferSize = this.ctx.sampleRate * 3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.04;
        b1 = 0.96 * b1 + white * 0.08;
        b2 = 0.86 * b2 + white * 0.16;
        data[i] = (b0 + b1 + b2) * 0.30;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.022, this.ctx.currentTime);

      // Slow ocean respiration LFO (11s period)
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.09, this.ctx.currentTime);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.012, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.droneGain || this.masterGain);
      noiseSource.start();
    } catch (e) {}
  }

  toggleMute() {
    this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    const targetGain = this.isMuted ? 0.0 : 0.8;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
    return !this.isMuted;
  }

  unmute() {
    this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = false;
    this.masterGain.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.2);

    const btn = document.getElementById('sound-toggle');
    if (btn) {
      btn.classList.remove('muted');
      btn.innerHTML = '🔊';
      btn.title = 'Mute audio';
    }
    return true;
  }

  // Crystalline bell on cell division (Mitosis)
  playMitosisPing() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const note = this.pentatonicScale[Math.floor(Math.random() * this.pentatonicScale.length)];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, t);
    osc.frequency.exponentialRampToValueAtTime(note * 1.5, t + 0.3);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.95);
  }

  // Sub-bass resonance on predation strike
  playPredationStrike() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.4);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  // Water droplet chirp on user touch/click
  playDroplet(freq = 800) {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.12);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }
}

export const sound = new SoundEngine();
