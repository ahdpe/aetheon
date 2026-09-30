import { sound } from '../audio/sound.js';

export class DiveAudio {
  constructor() {
    this.isActive = false;
    this.ctx = null;
    
    // Nodes
    this.underwaterFilter = null;
    this.heartGain = null;
    this.heartOsc = null;
    this.whooshGain = null;
    this.whooshSource = null;
    this.ventGain = null;
    this.ventSource = null;

    this.lastHeartbeatTime = 0;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    
    // Try to get audio context from master sound engine
    sound.init();
    this.ctx = sound.ctx;
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      this.setupUnderwaterAmbience();
    } catch (e) {
      console.warn('[DiveAudio] Failed to setup underwater nodes:', e);
    }
  }

  setupUnderwaterAmbience() {
    if (!this.ctx || !sound.masterGain) return;
    const t = this.ctx.currentTime;

    // 1. Hydrodynamic Liquid Whoosh (Filtered noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.96 * b1 + white * 0.11;
      b2 = 0.86 * b2 + white * 0.25;
      output[i] = (b0 + b1 + b2) * 0.5;
    }

    this.whooshSource = this.ctx.createBufferSource();
    this.whooshSource.buffer = noiseBuffer;
    this.whooshSource.loop = true;

    const whooshFilter = this.ctx.createBiquadFilter();
    whooshFilter.type = 'lowpass';
    whooshFilter.frequency.setValueAtTime(280, t);

    this.whooshGain = this.ctx.createGain();
    this.whooshGain.gain.setValueAtTime(0.01, t);

    this.whooshSource.connect(whooshFilter);
    whooshFilter.connect(this.whooshGain);
    this.whooshGain.connect(sound.droneGain || sound.masterGain);
    this.whooshSource.start();

    // 2. Hydrothermal Vent Sizzle (Resonant boiling noise)
    this.ventSource = this.ctx.createBufferSource();
    this.ventSource.buffer = noiseBuffer;
    this.ventSource.loop = true;

    const ventFilter = this.ctx.createBiquadFilter();
    ventFilter.type = 'bandpass';
    ventFilter.frequency.setValueAtTime(650, t);
    ventFilter.Q.setValueAtTime(4.0, t);

    this.ventGain = this.ctx.createGain();
    this.ventGain.gain.setValueAtTime(0.0, t);

    this.ventSource.connect(ventFilter);
    ventFilter.connect(this.ventGain);
    this.ventGain.connect(sound.droneGain || sound.masterGain);
    this.ventSource.start();
  }

  // Update real-time acoustic dynamics every frame
  update(org, speed, nearestVentDist, ciliaryFreq) {
    if (!this.isActive || !this.ctx || sound.isMuted) return;
    const t = this.ctx.currentTime;

    // 1. Whoosh modulation by speed
    if (this.whooshGain) {
      const targetWhoosh = Math.min(0.25, Math.max(0.01, (speed / 3.0) * 0.22));
      this.whooshGain.gain.setTargetAtTime(targetWhoosh, t, 0.1);
    }

    // 2. Vent hiss modulation by proximity (< 180 um)
    if (this.ventGain) {
      const ventProx = Math.max(0.0, 1.0 - (nearestVentDist / 180.0));
      const targetVent = ventProx * ventProx * 0.18;
      this.ventGain.gain.setTargetAtTime(targetVent, t, 0.15);
    }

    // 3. Cellular Heartbeat pulse (Kuramoto rhythm)
    const bpmInterval = 1.0 / Math.max(0.2, ciliaryFreq || 0.8);
    if (t - this.lastHeartbeatTime > bpmInterval) {
      this.lastHeartbeatTime = t;
      this.playHeartbeatThud(t);
    }
  }

  playHeartbeatThud(t) {
    if (!this.ctx || sound.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(52.0, t);
      osc.frequency.exponentialRampToValueAtTime(32.0, t + 0.18);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(sound.masterGain);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch (e) {
      // AudioCtx edge case
    }
  }

  // Feeding event: crystalline nutrient uptake tone
  playFeedChime() {
    if (!this.ctx || sound.isMuted) return;
    const t = this.ctx.currentTime;
    try {
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);

        gain.gain.setValueAtTime(0.12, t + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(sound.sfxGain || sound.masterGain);

        osc.start(t + idx * 0.05);
        osc.stop(t + idx * 0.05 + 0.4);
      });
    } catch (e) {}
  }

  // Predator danger drone: ominous warning throb
  playPredatorWarning() {
    if (!this.ctx || sound.isMuted) return;
    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65.0, t);
      osc.frequency.linearRampToValueAtTime(50.0, t + 0.4);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sound.sfxGain || sound.masterGain);

      osc.start(t);
      osc.stop(t + 0.5);
    } catch (e) {}
  }

  // Membrane rupture / Death sound
  playRupture() {
    if (!this.ctx || sound.isMuted) return;
    const t = this.ctx.currentTime;
    try {
      // Low sub crash
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120.0, t);
      osc.frequency.exponentialRampToValueAtTime(20.0, t + 0.8);

      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(sound.masterGain);
      osc.start(t);
      osc.stop(t + 1.0);
    } catch (e) {}
  }

  stop() {
    this.isActive = false;
    try {
      if (this.whooshSource) {
        this.whooshSource.stop();
        this.whooshSource.disconnect();
        this.whooshSource = null;
      }
      if (this.ventSource) {
        this.ventSource.stop();
        this.ventSource.disconnect();
        this.ventSource = null;
      }
    } catch (e) {}
  }
}
