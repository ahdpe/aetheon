import {makeResourceRecharge} from './habitats.js';
export function createChemicalGridClass(CONFIG, random) {
class ChemicalGrid {
  constructor(size = CONFIG.GRID_SIZE) {
    this.size = size;
    this.cellCount = size * size;
    
    // Primary chemical channels (Float32Array for maximum SIMD/V8 optimization)
    this.nutrients = new Float32Array(this.cellCount);
    this.waste = new Float32Array(this.cellCount);
    this.signal = new Float32Array(this.cellCount);
    this.substrate = new Float32Array(this.cellCount); // Bio-calcite mineral reefs (Stigmergy)
    
    // Scratch buffers for double-buffering diffusion
    this.nextNutrients = new Float32Array(this.cellCount);
    this.nextWaste = new Float32Array(this.cellCount);
    this.nextSignal = new Float32Array(this.cellCount);
    this.nextSubstrate = new Float32Array(this.cellCount);
    this.recharge = makeResourceRecharge(size,CONFIG.WORLD_SIZE);
    
    // Primary hydrothermal vents (mineral/energy sources) with tectonic micro-drift
    this.vents = [];
    this.ephemeralFumaroles = [];
    this.initVents();
    this.seedInitialConditions();
  }

  initVents() {
    // Symmetrically arranged vents in a regular pentagon inside the circular chamber
    const cx = this.size * 0.5;
    const cy = this.size * 0.5;
    const ventDist = 350 * this.size / CONFIG.WORLD_SIZE;

    const ventHues = [0.12, 0.52, 0.95, 0.38, 0.78]; // Amber, Cyan, Rose, Phosphor, Violet

    this.vents = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI * 0.5; // Top vent at 12 o'clock
      const vx = Math.round(cx + Math.cos(angle) * ventDist);
      const vy = Math.round(cy + Math.sin(angle) * ventDist);
      this.vents.push({
        id: `primary_vent_${i + 1}`,
        x: vx,
        y: vy,
        baseX: vx,
        baseY: vy,
        driftPhase: i * 1.256,
        driftSpeed: 0.00012 + i * 0.00004,
        radius: 7,
        power: 0.70,
        hue: ventHues[i]
      });
    }
  }

  seedInitialConditions() {
    // Seed ambient nutrients across the manifold
    for (let i = 0; i < this.cellCount; i++) {
      this.nutrients[i] = 0.15 + random() * 0.1;
      this.waste[i] = 0.0;
      this.signal[i] = 0.0;
      this.substrate[i] = 0.0;
    }
  }

  // 10 Hz step: 2D Laplacian diffusion with reflective zero-flux boundaries + active hydrothermal recharge
  step(ventFactors = null, tick = 0) {
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
    const sub = this.substrate;
    const nextNut = this.nextNutrients;
    const nextWst = this.nextWaste;
    const nextSig = this.nextSignal;
    const nextSub = this.nextSubstrate;

    // Vectorized 2D stencil with zero-flux Neumann reflective boundaries
    for (let y = 0; y < N; y++) {
      const ym1 = Math.max(0, y - 1) * N;
      const y0 = y * N;
      const yp1 = Math.min(N - 1, y + 1) * N;

      for (let x = 0; x < N; x++) {
        const xm1 = Math.max(0, x - 1);
        const xp1 = Math.min(N - 1, x + 1);
        const idx = y0 + x;

        // Impede fluid diffusion through dense bio-calcite reefs
        const reefImpede = Math.max(0.12, 1.0 - sub[idx] * 0.88);
        const effDiffN = diffN * reefImpede;
        const effDiffW = diffW * reefImpede;

        // Nutrients diffusion + steady ambient chemosynthetic replenishment
        const avgN = (nut[ym1 + x] + nut[yp1 + x] + nut[y0 + xm1] + nut[y0 + xp1]) * 0.25;
        let nVal = (nut[idx] + effDiffN * (avgN - nut[idx])) * decayN + this.recharge[idx];
        if (nVal > 2.0) nVal = 2.0;
        nextNut[idx] = nVal;

        // Waste diffusion
        const avgW = (wst[ym1 + x] + wst[yp1 + x] + wst[y0 + xm1] + wst[y0 + xp1]) * 0.25;
        let wVal = (wst[idx] + effDiffW * (avgW - wst[idx])) * decayW;
        if (wVal < 0.0001) wVal = 0;
        else if (wVal > 2.0) wVal = 2.0;
        nextWst[idx] = wVal;

        // Signal diffusion
        const avgS = (sig[ym1 + x] + sig[yp1 + x] + sig[y0 + xm1] + sig[y0 + xp1]) * 0.25;
        let sVal = (sig[idx] + diffS * (avgS - sig[idx])) * decayS;
        if (sVal < 0.0001) sVal = 0;
        else if (sVal > 2.0) sVal = 2.0;
        nextSig[idx] = sVal;

        // Substrate: differential erosion & biogenic calcite crystallization
        const avgSub = (sub[ym1 + x] + sub[yp1 + x] + sub[y0 + xm1] + sub[y0 + xp1]) * 0.25;
        const curSub = sub[idx];
        // In open waters (<0.22), hydrodynamic currents dissolve loose silt rapidly (preventing flat flooding);
        // within established coral reefs (>0.38), calcite crystals bind tightly and erode very slowly
        const erosion = curSub > 0.38 ? 0.999988 : (curSub > 0.18 ? 0.99992 : 0.99968);
        let subVal = (curSub + 0.003 * (avgSub - curSub)) * erosion;
        if (subVal < 0.012) subVal = 0.0;
        else if (subVal > 1.0) subVal = 1.0;
        nextSub[idx] = subVal;
      }
    }

    // Swap buffers
    this.nutrients.set(nextNut);
    this.waste.set(nextWst);
    this.signal.set(nextSig);
    this.substrate.set(nextSub);

    // 1. Slow tectonic drift of the 5 primary hydrothermal vents
    if (tick) {
      for (let v = 0; v < this.vents.length; v++) {
        const vent = this.vents[v];
        if (vent.baseX !== undefined) {
          const t = tick * vent.driftSpeed + vent.driftPhase;
          vent.x = Math.max(14, Math.min(N - 15, Math.round(vent.baseX + Math.cos(t) * 3.8)));
          vent.y = Math.max(14, Math.min(N - 15, Math.round(vent.baseY + Math.sin(t * 1.3) * 3.8)));
        }
      }
    }

    // 2. Primary thermal vents continuous nutrient injection (modulated by climate vent factors)
    for (let v = 0; v < this.vents.length; v++) {
      const vent = this.vents[v];
      const r = vent.radius;
      const vFactor = (ventFactors && ventFactors[v] !== undefined) ? ventFactors[v] : 1.0;
      const pow = vent.power * 0.2 * vFactor;
      
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

    // 3. Ephemeral benthic fumaroles (occasional thermal fissures that erupt for 20-35 min)
    if (random() < 0.00008 && this.ephemeralFumaroles.length < 2) {
      const angle = random() * Math.PI * 2;
      const dist = (0.12 + random() * 0.32) * N;
      const fx = Math.max(12, Math.min(N - 13, Math.round(N * 0.5 + Math.cos(angle) * dist)));
      const fy = Math.max(12, Math.min(N - 13, Math.round(N * 0.5 + Math.sin(angle) * dist)));
      this.ephemeralFumaroles.push({
        id: `fum_${Date.now()}_${Math.floor(random() * 1000)}`,
        x: fx,
        y: fy,
        radius: 5,
        power: 0.65,
        hue: (0.08 + random() * 0.85) % 1.0,
        life: 0,
        maxLife: 15000 + Math.floor(random() * 9000)
      });
    }

    for (let f = this.ephemeralFumaroles.length - 1; f >= 0; f--) {
      const fum = this.ephemeralFumaroles[f];
      fum.life++;
      const lifeRatio = fum.life / fum.maxLife;
      const intensity = lifeRatio < 0.15 ? (lifeRatio / 0.15) : (lifeRatio > 0.75 ? (1.0 - lifeRatio) / 0.25 : 1.0);
      const r = fum.radius;
      const pow = fum.power * 0.22 * intensity;

      const minY = Math.max(0, fum.y - r);
      const maxY = Math.min(N - 1, fum.y + r);
      const minX = Math.max(0, fum.x - r);
      const maxX = Math.min(N - 1, fum.x + r);

      for (let vy = minY; vy <= maxY; vy++) {
        const dy = vy - fum.y;
        const row = vy * N;
        for (let vx = minX; vx <= maxX; vx++) {
          const dx = vx - fum.x;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= r * r) {
            const factor = Math.exp(-dist2 / (r * 1.4));
            const idx = row + vx;
            this.nutrients[idx] = Math.min(2.2, this.nutrients[idx] + pow * factor);
            // Volcanic mineral mound precipitation beneath fumarole
            if (random() < 0.08) {
              this.substrate[idx] = Math.min(1.0, this.substrate[idx] + 0.0035 * factor * intensity);
            }
          }
        }
      }

      if (fum.life >= fum.maxLife) {
        this.ephemeralFumaroles.splice(f, 1);
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

  // Continuous bilinear sampling of a specific chemical channel
  sampleVal(wx, wy, channel = 'nutrients') {
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

    const arr = this[channel];
    const N = this.size;
    const v00 = arr[y0 * N + x0];
    const v10 = arr[y0 * N + x1];
    const v01 = arr[y1 * N + x0];
    const v11 = arr[y1 * N + x1];

    return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
  }

  // Isotropic bilinear sampling and symmetric central difference gradients
  // Completely eliminates directional bias and self-induced diagonal drift
  sample(wx, wy) {
    const nut = this.sampleVal(wx, wy, 'nutrients');
    const wst = this.sampleVal(wx, wy, 'waste');
    const sig = this.sampleVal(wx, wy, 'signal');

    // Symmetric central difference with span delta = 16 μm (~1.5 grid cells)
    const delta = 16.0;
    const nutX1 = this.sampleVal(wx + delta, wy, 'nutrients');
    const nutX0 = this.sampleVal(wx - delta, wy, 'nutrients');
    const nutY1 = this.sampleVal(wx, wy + delta, 'nutrients');
    const nutY0 = this.sampleVal(wx, wy - delta, 'nutrients');

    const wstX1 = this.sampleVal(wx + delta, wy, 'waste');
    const wstX0 = this.sampleVal(wx - delta, wy, 'waste');
    const wstY1 = this.sampleVal(wx, wy + delta, 'waste');
    const wstY0 = this.sampleVal(wx, wy - delta, 'waste');

    const inv2D = 1.0 / (2.0 * delta);

    return {
      nutrient: nut,
      waste: wst,
      signal: sig,
      gradNutrientX: (nutX1 - nutX0) * inv2D * 18.0,
      gradNutrientY: (nutY1 - nutY0) * inv2D * 18.0,
      gradWasteX: (wstX1 - wstX0) * inv2D * 18.0,
      gradWasteY: (wstY1 - wstY0) * inv2D * 18.0
    };
  }

  // Smooth bilinear consumption of nutrients and excretion of waste + signal
  consumeAndExcrete(wx, wy, amount, wasteRatio = 0.5, signalAmount = 0.1) {
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

    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;

    const avail = this.nutrients[i00] * w00 + this.nutrients[i10] * w10 + this.nutrients[i01] * w01 + this.nutrients[i11] * w11;
    const consumed = Math.min(avail, amount);

    if (consumed > 0 && avail > 0) {
      const frac = consumed / avail;
      this.nutrients[i00] = Math.max(0, this.nutrients[i00] - this.nutrients[i00] * w00 * frac);
      this.nutrients[i10] = Math.max(0, this.nutrients[i10] - this.nutrients[i10] * w10 * frac);
      this.nutrients[i01] = Math.max(0, this.nutrients[i01] - this.nutrients[i01] * w01 * frac);
      this.nutrients[i11] = Math.max(0, this.nutrients[i11] - this.nutrients[i11] * w11 * frac);

      const wasteTotal = consumed * wasteRatio;
      this.waste[i00] = Math.min(2.0, this.waste[i00] + wasteTotal * w00);
      this.waste[i10] = Math.min(2.0, this.waste[i10] + wasteTotal * w10);
      this.waste[i01] = Math.min(2.0, this.waste[i01] + wasteTotal * w01);
      this.waste[i11] = Math.min(2.0, this.waste[i11] + wasteTotal * w11);

      if (signalAmount > 0) {
        this.signal[i00] = Math.min(2.0, this.signal[i00] + signalAmount * w00);
        this.signal[i10] = Math.min(2.0, this.signal[i10] + signalAmount * w10);
        this.signal[i01] = Math.min(2.0, this.signal[i01] + signalAmount * w01);
        this.signal[i11] = Math.min(2.0, this.signal[i11] + signalAmount * w11);
      }
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

  // Inject bioluminescent signal / alarm cloud
  injectSignal(wx, wy, amount = 0.8, radius = 22) {
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
          this.signal[idx] = Math.min(2.5, this.signal[idx] + amount * factor);
        }
      }
    }
  }

  // Deposit bio-calcite mineral into substrate (Stigmergy / Reef building)
  depositSubstrate(wx, wy, amount = 0.05, radius = 12) {
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
          const factor = Math.exp(-dist2 / (gridR * 1.1));
          const idx = row + x;
          const existing = this.substrate[idx];
          // Positive feedback: biomineralization nucleates and binds strongly where reefs already start
          const bindAffinity = existing > 0.22 ? 1.5 : 0.85;
          this.substrate[idx] = Math.min(1.0, existing + amount * factor * bindAffinity);
        }
      }
    }
  }

  // Get combined dynamic primary vents and active ephemeral fumaroles for rendering
  getVentsState() {
    const list = this.vents.map(v => ({
      id: v.id,
      x: v.x,
      y: v.y,
      radius: v.radius,
      power: v.power,
      hue: v.hue,
      isEphemeral: false
    }));

    for (let i = 0; i < this.ephemeralFumaroles.length; i++) {
      const f = this.ephemeralFumaroles[i];
      const lifeRatio = f.life / f.maxLife;
      const intensity = lifeRatio < 0.15 ? (lifeRatio / 0.15) : (lifeRatio > 0.75 ? (1.0 - lifeRatio) / 0.25 : 1.0);
      list.push({
        id: f.id,
        x: f.x,
        y: f.y,
        radius: f.radius,
        power: f.power * intensity,
        hue: f.hue,
        isEphemeral: true,
        intensity
      });
    }

    return list;
  }

  // Sample continuous substrate density at world coordinates [0, WORLD_SIZE)
  getSubstrate(wx, wy) {
    const scale = this.size / CONFIG.WORLD_SIZE;
    const gx = wx * scale;
    const gy = wy * scale;

    const x0 = Math.max(0, Math.min(this.size - 2, Math.floor(gx)));
    const y0 = Math.max(0, Math.min(this.size - 2, Math.floor(gy)));
    const fx = gx - x0;
    const fy = gy - y0;

    const N = this.size;
    const i00 = y0 * N + x0;
    const i10 = i00 + 1;
    const i01 = (y0 + 1) * N + x0;
    const i11 = i01 + 1;

    const sub = this.substrate;
    return (
      sub[i00] * (1 - fx) * (1 - fy) +
      sub[i10] * fx * (1 - fy) +
      sub[i01] * (1 - fx) * fy +
      sub[i11] * fx * fy
    );
  }

  // Substrate gradient vector for physical deflection of organisms from reefs
  getSubstrateGradient(wx, wy) {
    const scale = this.size / CONFIG.WORLD_SIZE;
    const gx = wx * scale;
    const gy = wy * scale;
    const x = Math.max(1, Math.min(this.size - 2, Math.round(gx)));
    const y = Math.max(1, Math.min(this.size - 2, Math.round(gy)));
    const N = this.size;
    const sub = this.substrate;

    const dx = (sub[y * N + (x + 1)] - sub[y * N + (x - 1)]) * 0.5;
    const dy = (sub[(y + 1) * N + x] - sub[(y - 1) * N + x]) * 0.5;
    return { dx, dy };
  }

  // Metric for ecological reports: percentage of manifold covered by reefs (>0.25 density)
  getReefCoverage() {
    let reefCells = 0;
    for (let i = 0; i < this.cellCount; i++) {
      if (this.substrate[i] > 0.25) reefCells++;
    }
    return Math.round((reefCells / this.cellCount) * 1000) / 10;
  }

  // Compress chemical field into a 48x48/64x64 Uint8Array thumbnail (RGBA: nut, waste, signal, substrate)
  getThumbnail(targetSize = 48) {
    const step = this.size / targetSize;
    const out = new Uint8Array(targetSize * targetSize * 4); // R: nutrient, G: waste, B: signal, A: substrate
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
        out[ptr++] = Math.min(255, Math.floor(this.substrate[idx] * 255 * mask));
      }
    }
    return out;
  }
}

return ChemicalGrid;
}
