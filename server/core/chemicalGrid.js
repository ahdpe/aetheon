import { CONFIG } from '../config.js';

export class ChemicalGrid {
  constructor(size = CONFIG.GRID_SIZE) {
    this.size = size;
    this.cellCount = size * size;
    
    // Primary chemical channels (Float32Array for maximum SIMD/V8 optimization)
    this.nutrients = new Float32Array(this.cellCount);
    this.waste = new Float32Array(this.cellCount);
    this.signal = new Float32Array(this.cellCount);
    
    // Scratch buffers for double-buffering diffusion
    this.nextNutrients = new Float32Array(this.cellCount);
    this.nextWaste = new Float32Array(this.cellCount);
    this.nextSignal = new Float32Array(this.cellCount);
    
    // Fixed hydrothermal vents (mineral/energy sources)
    this.vents = [];
    this.initVents();
    this.seedInitialConditions();
  }

  initVents() {
    // Symmetrically arranged vents in a regular pentagon inside the circular chamber
    const cx = this.size * 0.5;
    const cy = this.size * 0.5;
    const ventDist = this.size * 0.25; // ~32 grid units from center (chamber R is ~56.7)

    const ventHues = [0.12, 0.52, 0.95, 0.38, 0.78]; // Amber, Cyan, Rose, Phosphor, Violet

    this.vents = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI * 0.5; // Top vent at 12 o'clock
      const vx = Math.round(cx + Math.cos(angle) * ventDist);
      const vy = Math.round(cy + Math.sin(angle) * ventDist);
      this.vents.push({
        x: vx,
        y: vy,
        radius: 7,
        power: 0.70,
        hue: ventHues[i]
      });
    }
  }

  seedInitialConditions() {
    // Seed ambient nutrients across the manifold
    for (let i = 0; i < this.cellCount; i++) {
      this.nutrients[i] = 0.15 + Math.random() * 0.1;
      this.waste[i] = 0.0;
      this.signal[i] = 0.0;
    }
  }

  // 10 Hz step: 2D Laplacian diffusion with reflective zero-flux boundaries + active hydrothermal recharge
  step() {
    const N = this.size;
    const diffN = CONFIG.DIFFUSION_RATE_NUTRIENT;
    const diffW = CONFIG.DIFFUSION_RATE_WASTE;
    const diffS = CONFIG.DIFFUSION_RATE_SIGNAL;
    
    const decayN = 1.0 - CONFIG.DECAY_RATE_NUTRIENT;
    const decayW = 1.0 - CONFIG.DECAY_RATE_WASTE;
    const decayS = 1.0 - CONFIG.DECAY_RATE_SIGNAL;

    const nut = this.nutrients;
    const wst = this.waste;
    const sig = this.signal;
    const nextNut = this.nextNutrients;
    const nextWst = this.nextWaste;
    const nextSig = this.nextSignal;

    // Vectorized 2D stencil with zero-flux Neumann reflective boundaries
    for (let y = 0; y < N; y++) {
      const ym1 = Math.max(0, y - 1) * N;
      const y0 = y * N;
      const yp1 = Math.min(N - 1, y + 1) * N;

      for (let x = 0; x < N; x++) {
        const xm1 = Math.max(0, x - 1);
        const xp1 = Math.min(N - 1, x + 1);
        const idx = y0 + x;

        // Nutrients diffusion + steady ambient chemosynthetic replenishment
        const avgN = (nut[ym1 + x] + nut[yp1 + x] + nut[y0 + xm1] + nut[y0 + xp1]) * 0.25;
        let nVal = (nut[idx] + diffN * (avgN - nut[idx])) * decayN + 0.004;
        if (nVal > 2.0) nVal = 2.0;
        nextNut[idx] = nVal;

        // Waste diffusion
        const avgW = (wst[ym1 + x] + wst[yp1 + x] + wst[y0 + xm1] + wst[y0 + xp1]) * 0.25;
        let wVal = (wst[idx] + diffW * (avgW - wst[idx])) * decayW;
        if (wVal < 0.0001) wVal = 0;
        else if (wVal > 2.0) wVal = 2.0;
        nextWst[idx] = wVal;

        // Signal diffusion
        const avgS = (sig[ym1 + x] + sig[yp1 + x] + sig[y0 + xm1] + sig[y0 + xp1]) * 0.25;
        let sVal = (sig[idx] + diffS * (avgS - sig[idx])) * decayS;
        if (sVal < 0.0001) sVal = 0;
        else if (sVal > 2.0) sVal = 2.0;
        nextSig[idx] = sVal;
      }
    }

    // Swap buffers
    this.nutrients.set(nextNut);
    this.waste.set(nextWst);
    this.signal.set(nextSig);

    // Thermal vents continuous nutrient injection
    for (let v = 0; v < this.vents.length; v++) {
      const vent = this.vents[v];
      const r = vent.radius;
      const pow = vent.power * 0.2;
      
      const minY = Math.max(0, vent.y - r);
      const maxY = Math.min(N - 1, vent.y + r);
      const minX = Math.max(0, vent.x - r);
      const maxX = Math.min(N - 1, vent.x + r);

      for (let vy = minY; vy <= maxY; vy++) {
        const dy = vy - vent.y;
        const row = vy * N;
        for (let vx = minX; vx <= maxX; vx++) {
          const dx = vx - vent.x;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= r * r) {
            const factor = Math.exp(-dist2 / (r * 1.5));
            const idx = row + vx;
            this.nutrients[idx] = Math.min(2.0, this.nutrients[idx] + pow * factor);
          }
        }
      }
    }
  }

  // Convert continuous world coords [0, WORLD_SIZE) into grid cell index
  worldToGrid(wx, wy) {
    const scale = this.size / CONFIG.WORLD_SIZE;
    const clampedX = Math.max(0, Math.min(CONFIG.WORLD_SIZE - 0.01, wx));
    const clampedY = Math.max(0, Math.min(CONFIG.WORLD_SIZE - 0.01, wy));
    const gx = clampedX * scale;
    const gy = clampedY * scale;
    return { gx, gy, ix: Math.floor(gx), iy: Math.floor(gy) };
  }

  // Bilinear sampling of chemical concentrations at arbitrary continuous world coordinates
  sample(wx, wy) {
    const scale = this.size / CONFIG.WORLD_SIZE;
    const clampedX = Math.max(0, Math.min(CONFIG.WORLD_SIZE - 0.01, wx));
    const clampedY = Math.max(0, Math.min(CONFIG.WORLD_SIZE - 0.01, wy));
    const x = clampedX * scale;
    const y = clampedY * scale;

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(this.size - 1, x0 + 1);
    const y1 = Math.min(this.size - 1, y0 + 1);

    const fx = x - x0;
    const fy = y - y0;

    const N = this.size;
    const i00 = y0 * N + x0;
    const i10 = y0 * N + x1;
    const i01 = y1 * N + x0;
    const i11 = y1 * N + x1;

    // Bilinear interpolation weights
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;

    return {
      nutrient: this.nutrients[i00] * w00 + this.nutrients[i10] * w10 + this.nutrients[i01] * w01 + this.nutrients[i11] * w11,
      waste: this.waste[i00] * w00 + this.waste[i10] * w10 + this.waste[i01] * w01 + this.waste[i11] * w11,
      signal: this.signal[i00] * w00 + this.signal[i10] * w10 + this.signal[i01] * w01 + this.signal[i11] * w11,
      // Gradient vector of nutrients (for chemotaxis steering)
      gradNutrientX: (this.nutrients[i10] - this.nutrients[i00]),
      gradNutrientY: (this.nutrients[i01] - this.nutrients[i00]),
      gradWasteX: (this.waste[i10] - this.waste[i00]),
      gradWasteY: (this.waste[i01] - this.waste[i00])
    };
  }

  // Consume nutrients at a continuous world point and excrete waste + signal
  consumeAndExcrete(wx, wy, amount, wasteRatio = 0.5, signalAmount = 0.1) {
    const { ix, iy } = this.worldToGrid(wx, wy);
    const idx = iy * this.size + ix;
    
    const available = this.nutrients[idx];
    const consumed = Math.min(available, amount);
    this.nutrients[idx] -= consumed;
    
    // Excrete waste (byproduct of metabolism)
    this.waste[idx] = Math.min(2.0, this.waste[idx] + consumed * wasteRatio);
    
    // Emit luminescence/signal trail
    if (signalAmount > 0) {
      this.signal[idx] = Math.min(2.0, this.signal[idx] + signalAmount);
    }
    
    return consumed;
  }

  // Inject external disturbance (from visitor clicks/touch gestures)
  injectDrop(wx, wy, nutrientAmount = 1.0, radius = 25) {
    const scale = this.size / CONFIG.WORLD_SIZE;
    const gridR = Math.max(2, Math.ceil(radius * scale));
    const { ix: cx, iy: cy } = this.worldToGrid(wx, wy);
    const N = this.size;

    const minY = Math.max(0, cy - gridR);
    const maxY = Math.min(N - 1, cy + gridR);
    const minX = Math.max(0, cx - gridR);
    const maxX = Math.min(N - 1, cx + gridR);

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const row = y * N;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dist2 = dx * dx + dy * dy;
        if (dist2 <= gridR * gridR) {
          const factor = Math.exp(-dist2 / (gridR * 1.2));
          const idx = row + x;
          this.nutrients[idx] = Math.min(2.5, this.nutrients[idx] + nutrientAmount * factor);
        }
      }
    }
  }

  // Compress chemical field into a 48x48/64x64 Uint8Array thumbnail for ultra-lean WebSocket broadcast
  getThumbnail(targetSize = 48) {
    const step = this.size / targetSize;
    const out = new Uint8Array(targetSize * targetSize * 3); // R: nutrient, G: waste, B: signal
    let ptr = 0;
    
    const thumbCenter = targetSize * 0.5;
    const thumbRadius = (CONFIG.CHAMBER_RADIUS / CONFIG.WORLD_SIZE) * targetSize;

    for (let ty = 0; ty < targetSize; ty++) {
      const sy = Math.floor(ty * step) * this.size;
      const dy = ty - thumbCenter;
      for (let tx = 0; tx < targetSize; tx++) {
        const dx = tx - thumbCenter;
        const dist = Math.hypot(dx, dy);

        // Circular chamber mask: fade to black outside droplet
        let mask = 1.0;
        if (dist > thumbRadius) {
          mask = Math.max(0, 1.0 - (dist - thumbRadius) * 0.8);
        }

        const sx = Math.floor(tx * step);
        const idx = sy + sx;
        out[ptr++] = Math.min(255, Math.floor(this.nutrients[idx] * 128 * mask));
        out[ptr++] = Math.min(255, Math.floor(this.waste[idx] * 128 * mask));
        out[ptr++] = Math.min(255, Math.floor(this.signal[idx] * 128 * mask));
      }
    }
    return out;
  }
}
