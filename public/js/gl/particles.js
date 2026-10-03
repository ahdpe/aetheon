import { OCEAN_GEOMETRY } from '../shared/habitats.js';
import { insideFocus } from './observation.js';

export class ParticleSystem {
  constructor(count = 450, worldSize = OCEAN_GEOMETRY.worldSize, chamber = { cx: OCEAN_GEOMETRY.cx, cy: OCEAN_GEOMETRY.cy, r: OCEAN_GEOMETRY.radius }, random = Math.random) {
    this.count = count;
    this.worldSize = worldSize;
    this.chamber = chamber;
    this.random=random;
    this.elapsed=0;
    
    // Float arrays for particle properties
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.depth = new Float32Array(count); // 0.2 (background blur) to 1.0 (foreground)
    this.hue = new Float32Array(count);

    this.init();
  }

  setChamber(chamber) {
    this.chamber = chamber;
  }

  init() {
    const cx = this.chamber.cx;
    const cy = this.chamber.cy;
    const r = this.chamber.r;

    for (let i = 0; i < this.count; i++) {
      const ang = this.random() * Math.PI * 2;
      const dist = Math.sqrt(this.random()) * (r - 12);
      this.x[i] = cx + Math.cos(ang) * dist;
      this.y[i] = cy + Math.sin(ang) * dist;
      this.vx[i] = (this.random() - 0.5) * 0.4;
      this.vy[i] = (this.random() - 0.5) * 0.4;
      this.depth[i] = 0.2 + this.random() * 0.8;
      this.size[i] = 1.0 + this.depth[i] * 2.2;
      this.alpha[i] = 0.15 + this.depth[i] * 0.45;
      this.hue[i] = 0.5 + (this.random() - 0.5) * 0.2; // Cyan/blue
    }
  }

  advance(elapsedMs, organisms) {
    this.elapsed+=Math.max(0,Math.min(100,elapsedMs));
    const interval=1000/30;
    while(this.elapsed+1e-8>=interval) {
      this.step(organisms);this.elapsed=Math.max(0,this.elapsed-interval);
    }
  }

  // Update particles with gentle fluid drift and organism wakes
  step(organisms) {
    const cx = this.chamber.cx;
    const cy = this.chamber.cy;
    const r = this.chamber.r;

    for (let i = 0; i < this.count; i++) {
      // Fluid movement
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
      if(this.terrain){
        const t=this.terrain,ix=Math.max(0,Math.min(t.size-1,Math.round(this.x[i]/t.spacing))),iy=Math.max(0,Math.min(t.size-1,Math.round(this.y[i]/t.spacing))),cell=iy*t.size+ix;
        this.x[i]+=t.currentX[cell]/3;this.y[i]+=t.currentY[cell]/3;
      }

      // Soft reflection at circular chamber boundary
      const dx = this.x[i] - cx;
      const dy = this.y[i] - cy;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist > r - 4) {
        this.x[i] = cx + (dx / dist) * (r - 5);
        this.y[i] = cy + (dy / dist) * (r - 5);
        this.vx[i] *= -0.5;
        this.vy[i] *= -0.5;
      }

      // Gentle damping + brownian motion
      this.vx[i] = this.vx[i] * 0.98 + (this.random() - 0.5) * 0.04;
      this.vy[i] = this.vy[i] * 0.98 + (this.random() - 0.5) * 0.04;
    }

    // Organisms stir nearby particles (sub-sampled for high performance)
    if (organisms && organisms.length > 0) {
      const stepCheck = Math.max(1, Math.floor(organisms.length / 30));
      for (let o = 0; o < organisms.length; o += stepCheck) {
        const org = organisms[o];
        const ox = org.x;
        const oy = org.y;
        const r2 = (org.size * 2.2) * (org.size * 2.2);

        // Push nearby particles
        for (let p = 0; p < this.count; p += 6) {
          const dx = this.x[p] - ox;
          const dy = this.y[p] - oy;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0.1) {
            const force = (1.0 - Math.sqrt(d2) / (org.size * 2.2)) * 0.7;
            this.vx[p] += (org.vx * 0.35 + (dx / Math.sqrt(d2)) * 0.4) * force;
            this.vy[p] += (org.vy * 0.35 + (dy / Math.sqrt(d2)) * 0.4) * force;
          }
        }
      }
    }
  }

  // Draw particles to Canvas context using high-performance batched paths
  draw(ctx, camera, focus = null) {
    const w = camera.viewportW;
    const h = camera.viewportH;
    const camX = camera.x;
    const camY = camera.y;
    const zoom = camera.zoom;
    const halfW = w * 0.5;
    const halfH = h * 0.5;

    ctx.save();

    // Pass 1: Background ambient drift particles (soft cyan)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    for (let i = 0; i < this.count; i++) {
      if (this.depth[i] >= 0.6) continue;
      const sx = (this.x[i] - camX) * zoom + halfW;
      const sy = (this.y[i] - camY) * zoom + halfH;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      if(focus&&!insideFocus(sx,sy,focus))continue;
      const r = Math.max(0.6, this.size[i] * zoom);
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
    }
    ctx.fill();

    // Pass 2: Foreground luminous micro-spores (bright cyan/white)
    ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
    ctx.beginPath();
    for (let i = 0; i < this.count; i++) {
      if (this.depth[i] < 0.6) continue;
      const sx = (this.x[i] - camX) * zoom + halfW;
      const sy = (this.y[i] - camY) * zoom + halfH;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      if(focus&&!insideFocus(sx,sy,focus))continue;
      const r = Math.max(0.8, this.size[i] * zoom);
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.restore();
  }
}
