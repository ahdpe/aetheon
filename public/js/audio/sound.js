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
    this.droneGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.setupDrone();
  }

  setupDrone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // 3 subharmonic oscillators
    const freqs = [55.0, 82.4, 110.0];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 0.8, t);

      // Lowpass resonant filter with LFO
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, t);
      filter.Q.setValueAtTime(3.5, t);

      // LFO for filter breath
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.06 + idx * 0.02, t);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(60, t);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      osc.connect(filter);
      filter.connect(this.droneGain);
      osc.start();
    });
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
