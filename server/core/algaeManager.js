import { CONFIG } from '../config.js';

/**
 * AETHEON Benthic Algae & Marine Sanctuaries Engine
 * Simulates living emerald phytobenthic thickets that produce nutrients,
 * prevent seafloor calcification (white bed flooding), and provide physical
 * shelter where grazers and juveniles can feed safely from apex hunters.
 */

export class AlgaeManager {
  constructor(worldSize = CONFIG.WORLD_SIZE, chamberRadius = CONFIG.CHAMBER_RADIUS) {
    this.worldSize = worldSize;
    this.chamberRadius = chamberRadius;
    this.cx = CONFIG.CHAMBER_CENTER_X;
    this.cy = CONFIG.CHAMBER_CENTER_Y;
    this.isles = [];
    this.nextId = 1;

    this.initDefaultIsles();
  }

  initDefaultIsles() {
    this.isles = [];
    const count = 8;
    // Disperse isles in the sublittoral photic zone (radius 180 to 450 from chamber center)
    const baseAngles = [0.35, 1.15, 1.95, 2.75, 3.55, 4.35, 5.15, 5.95];
    const baseDists = [240, 360, 210, 390, 280, 340, 220, 380];

    for (let i = 0; i < count; i++) {
      const angle = baseAngles[i] + (Math.random() - 0.5) * 0.3;
      const dist = baseDists[i] + (Math.random() - 0.5) * 40;
      const x = Math.round(this.cx + Math.cos(angle) * dist);
      const y = Math.round(this.cy + Math.sin(angle) * dist);
      const radius = 34.0 + Math.random() * 16.0; // 34 to 50 μm radius
      const hue = 0.38 + Math.random() * 0.08;   // Emerald to cyan-teal (136° to 165°)
      const frondCount = 10 + Math.floor(Math.random() * 8);

      this.isles.push({
        id: this.nextId++,
        x,
        y,
        radius,
        baseRadius: radius,
        density: 0.85 + Math.random() * 0.15, // 0.2 to 1.0 health
        hue: Math.round(hue * 1000) / 1000,
        frondCount,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // Check if a point is within any algae sanctuary
  isInsideShelter(wx, wy) {
    for (let i = 0; i < this.isles.length; i++) {
      const isle = this.isles[i];
      const dx = wx - isle.x;
      const dy = wy - isle.y;
      if (dx * dx + dy * dy <= isle.radius * isle.radius) {
        return isle;
      }
    }
    return null;
  }

  // Simulation tick update
  update(engine) {
    const grid = engine.grid;
    const organisms = engine.organisms;

    for (let i = 0; i < this.isles.length; i++) {
      const isle = this.isles[i];
      isle.phase += 0.012; // Natural swaying motion

      // 1. Slow photosynthetic regeneration
      if (isle.density < 1.0) {
        isle.density = Math.min(1.0, isle.density + 0.0008);
      }

      // 2. Continual localized oxygen/nutrient generation
      if (grid && grid.injectDrop && engine.ticks % 4 === 0) {
        grid.injectDrop(isle.x, isle.y, 0.06 * isle.density, Math.round(isle.radius * 0.7));
      }

      // 3. Seafloor anti-calcification: algae dissolve excess dead calcite silt in their radius
      if (grid && grid.substrate) {
        const { ix: cx, iy: cy } = grid.worldToGrid(isle.x, isle.y);
        const scale = grid.size / this.worldSize;
        const gridR = Math.ceil(isle.radius * scale);
        const N = grid.size;
        const minY = Math.max(0, cy - gridR);
        const maxY = Math.min(N - 1, cy + gridR);
        const minX = Math.max(0, cx - gridR);
        const maxX = Math.min(N - 1, cx + gridR);

        for (let gy = minY; gy <= maxY; gy++) {
          const dy = gy - cy;
          const row = gy * N;
          for (let gx = minX; gx <= maxX; gx++) {
            const dx = gx - cx;
            if (dx * dx + dy * dy <= gridR * gridR) {
              const idx = row + gx;
              // Prevent flat white calcification: keep substrate green and soft (< 0.15)
              if (grid.substrate[idx] > 0.14) {
                grid.substrate[idx] = Math.max(0.14, grid.substrate[idx] * 0.995);
              }
            }
          }
        }
      }
    }

    // 4. Organism interactions inside Algae Groves
    for (let o = 0; o < organisms.length; o++) {
      const org = organisms[o];
      const shelter = this.isInsideShelter(org.x, org.y);
      if (!shelter) continue;

      if (org.carnivory < 0.40) {
        // Grazers & filter-feeders: graze on phytobenthic biofilm
        const grazeAmount = 0.28 * shelter.density;
        org.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, org.energy + grazeAmount);
        // Calm fluid friction within fronds
        org.vx *= 0.97;
        org.vy *= 0.97;
      } else if (org.carnivory > 0.35 && org.size > 5.2) {
        // Large apex hunters: dense thicket acts as hydrodynamic drag & maze
        org.vx *= 0.74;
        org.vy *= 0.74;
      }
    }
  }

  // Compact payload for network broadcast
  getBroadcastState() {
    return this.isles.map(isle => ({
      id: isle.id,
      x: Math.round(isle.x),
      y: Math.round(isle.y),
      r: Math.round(isle.radius),
      radius: Math.round(isle.radius),
      d: Math.round(isle.density * 100) / 100,
      density: Math.round(isle.density * 100) / 100,
      h: Math.round(isle.hue * 100) / 100,
      hue: Math.round(isle.hue * 100) / 100,
      f: isle.frondCount,
      frondCount: isle.frondCount
    }));
  }

  toJSON() {
    return {
      isles: this.isles.map(isle => ({ ...isle })),
      nextId: this.nextId
    };
  }

  fromJSON(data) {
    if (data && Array.isArray(data.isles) && data.isles.length > 0) {
      this.isles = data.isles.map(isle => ({ ...isle }));
      this.nextId = data.nextId || (this.isles.length + 1);
    }
  }
}
