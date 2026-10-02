import { CONFIG } from '../config.js';

export class ClimateEngine {
  constructor() {
    this.ticks = 0;
    this.temperature = 0.55; // 0.0 (Deep Glacial) to 1.0 (Hydrothermal Surge)
    this.frost = 0.0;        // Current ice needle penetration inward from meniscus (0 to 115 μm)
    this.targetFrost = 0.0;
    this.season = 'temperate'; // 'glacial', 'temperate', 'hydrothermal_surge'
    
    // Per-vent dynamic oscillations (5 vents breathe with phase offsets)
    this.ventFactors = [1.0, 1.0, 1.0, 1.0, 1.0];
  }

  step(vents) {
    this.ticks++;

    // 1. Planetary Thermal Breathing Cycle (~18 minutes full cycle at 10 Hz)
    // T = 10,800 ticks. sin wave + gentle second harmonic + micro-drift
    const mainCycle = Math.sin(this.ticks * 0.00058);
    const harmonic = Math.sin(this.ticks * 0.0014) * 0.12;
    const microDrift = Math.sin(this.ticks * 0.0042) * 0.04;
    
    // Base temperature centered around 0.52, spanning 0.10 to 0.94
    this.temperature = Math.max(0.08, Math.min(0.96, 0.52 + 0.32 * mainCycle + harmonic + microDrift));

    // 2. Determine Planetary Season & Target Frost Penetration
    if (this.temperature < 0.38) {
      this.season = 'glacial';
      // Frost grows deeper the colder it gets below 0.38
      const coldness = (0.38 - this.temperature) / 0.30;
      this.targetFrost = Math.min(115.0, coldness * 115.0);
    } else if (this.temperature > 0.70) {
      this.season = 'hydrothermal_surge';
      this.targetFrost = 0.0; // Rapidly melts ice
    } else {
      this.season = 'temperate';
      this.targetFrost = 0.0;
    }

    // 3. Smooth Physical Ice Crystallization / Melting Rate
    // Freezing is gradual (dendritic growth); thawing in warm plumes is fast
    const rate = (this.targetFrost > this.frost) ? 0.05 : 0.20;
    this.frost += (this.targetFrost - this.frost) * rate;
    if (this.frost < 0.4) this.frost = 0.0;

    // 4. Modulate Hydrothermal Vents Power & Plumes
    const ventCount = vents ? vents.length : 5;
    for (let i = 0; i < ventCount; i++) {
      // Individual vent tidal oscillation with asymmetric phase offsets
      const ventPhase = this.ticks * 0.0016 + (i * 2 * Math.PI) / ventCount;
      const ventWave = 0.85 + 0.30 * Math.sin(ventPhase);
      const surgeMultiplier = 0.70 + this.temperature * 0.60;
      this.ventFactors[i] = Math.max(0.35, Math.min(1.85, ventWave * surgeMultiplier));
    }
  }

  // Effective physical chamber boundary (contracts when ice needles encroach)
  getEffectiveRadius(baseRadius = CONFIG.CHAMBER_RADIUS) {
    return Math.max(480.0, baseRadius - this.frost);
  }

  // Get compact state for broadcast packet (sent at 10 Hz)
  getBroadcastState() {
    return {
      temp: Math.round(this.temperature * 100) / 100,
      tempC: Math.round((14.0 + this.temperature * 28.0) * 10) / 10, // 14.0°C to 42.0°C
      season: this.season,
      frost: Math.round(this.frost * 10) / 10,
      vents: this.ventFactors.map(f => Math.round(f * 100) / 100)
    };
  }

  // Telemetry stats for AI naturalist & inspector
  getStats() {
    const tempC = Math.round((14.0 + this.temperature * 28.0) * 10) / 10;
    return {
      temperature: Math.round(this.temperature * 100) / 100,
      temperatureCelsius: tempC,
      season: this.season,
      frostPenetration: Math.round(this.frost * 10) / 10
    };
  }

  // Serialization for persistence snapshots
  toJSON() {
    return {
      ticks: this.ticks,
      temperature: this.temperature,
      frost: this.frost,
      season: this.season, targetFrost: this.targetFrost, ventFactors: this.ventFactors
    };
  }

  // Restoration from snapshot
  fromJSON(data) {
    if (!data) return;
    if (typeof data.ticks === 'number') this.ticks = data.ticks;
    if (typeof data.temperature === 'number') this.temperature = data.temperature;
    if (typeof data.frost === 'number') this.frost = data.frost;
    if (typeof data.season === 'string') this.season = data.season;
    this.targetFrost = data.targetFrost ?? 0;
    if (data.ventFactors) this.ventFactors = data.ventFactors.slice();
  }
}
