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
    
    // Auto-unmute sound engine on 3D dive immersion
    sound.unmute();
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

    // 1. Hydrodynamic Liquid Whoosh (Filtered noise for fluid flow)
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

    this.whooshFilter = this.ctx.createBiquadFilter();
    this.whooshFilter.type = 'lowpass';
    this.whooshFilter.frequency.setValueAtTime(220, t);

    this.whooshGain = this.ctx.createGain();
    this.whooshGain.gain.setValueAtTime(0.015, t);

    this.whooshSource.connect(this.whooshFilter);
    this.whooshFilter.connect(this.whooshGain);
    this.whooshGain.connect(sound.droneGain || sound.masterGain);
    this.whooshSource.start();

    // 2. Hydrothermal Vent Effervescent Micro-bubbles (Soft warm champagne shimmer)
    this.ventSource = this.ctx.createBufferSource();
    this.ventSource.buffer = noiseBuffer;
    this.ventSource.loop = true;

    const ventFilter = this.ctx.createBiquadFilter();
    ventFilter.type = 'bandpass';
    ventFilter.frequency.setValueAtTime(820, t);
    ventFilter.Q.setValueAtTime(4.8, t);

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

    // 1. Soft fluid glide modulation by steering speed
    if (this.whooshGain && this.whooshFilter) {
      const spdNorm = Math.min(1.0, (speed || 0) / 3.2);
      const targetWhoosh = 0.015 + spdNorm * 0.12;
      const targetFreq = 180 + spdNorm * 260;
      this.whooshGain.gain.setTargetAtTime(targetWhoosh, t, 0.1);
      this.whooshFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);
    }

    // 2. Warm effervescent bubble shimmer by proximity (< 220 um)
    if (this.ventGain) {
      const ventProx = Math.max(0.0, 1.0 - (nearestVentDist / 220.0));
      const targetVent = ventProx * ventProx * 0.07;
      this.ventGain.gain.setTargetAtTime(targetVent, t, 0.15);
    }

    // 3. Cellular Heartbeat pulse (Soft, soothing Kuramoto hydrostatic pulse)
    const bpmInterval = 1.0 / Math.max(0.35, Math.min(2.2, ciliaryFreq || 1.0));
    if (t - this.lastHeartbeatTime > bpmInterval) {
      this.lastHeartbeatTime = t;
      this.playHeartbeatThud(t);
    }
  }

  playHeartbeatThud(t) {
    if (!this.ctx || sound.isMuted) return;
    try {
      // Soft, pillowy, deep hydrostatic pulse (relaxing warm sine, not abrasive)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(44.0, t);
      osc1.frequency.exponentialRampToValueAtTime(22.0, t + 0.22);

      gain1.gain.setValueAtTime(0.14, t);
      gain1.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);

      osc1.connect(gain1);
      gain1.connect(sound.masterGain);

      osc1.start(t);
      osc1.stop(t + 0.26);
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
