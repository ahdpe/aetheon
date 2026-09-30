export class ParticleSystem {
  constructor(count = 1000, worldSize = 1400.0, chamber = { cx: 700.0, cy: 700.0, r: 620.0 }) {
    this.count = count;
    this.worldSize = worldSize;
    this.chamber = chamber;
    
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
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * (r - 12);
      this.x[i] = cx + Math.cos(ang) * dist;
      this.y[i] = cy + Math.sin(ang) * dist;
      this.vx[i] = (Math.random() - 0.5) * 0.4;
      this.vy[i] = (Math.random() - 0.5) * 0.4;
      this.depth[i] = 0.2 + Math.random() * 0.8;
      this.size[i] = 1.0 + this.depth[i] * 2.5;
      this.alpha[i] = 0.15 + this.depth[i] * 0.45;
      this.hue[i] = 0.5 + (Math.random() - 0.5) * 0.2; // Cyan/blue
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
      this.vx[i] = this.vx[i] * 0.98 + (Math.random() - 0.5) * 0.04;
      this.vy[i] = this.vy[i] * 0.98 + (Math.random() - 0.5) * 0.04;
    }

    // Organisms stir nearby particles
    if (organisms && organisms.length > 0) {
      const stepCheck = Math.max(1, Math.floor(organisms.length / 50));
      for (let o = 0; o < organisms.length; o += stepCheck) {
        const org = organisms[o];
        const ox = org.x;
        const oy = org.y;
        const r2 = (org.size * 2.5) * (org.size * 2.5);

        // Push nearby particles
        for (let p = 0; p < this.count; p += 4) {
          const dx = this.x[p] - ox;
          const dy = this.y[p] - oy;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0.1) {
            const force = (1.0 - Math.sqrt(d2) / (org.size * 2.5)) * 0.8;
            this.vx[p] += (org.vx * 0.4 + (dx / Math.sqrt(d2)) * 0.5) * force;
            this.vy[p] += (org.vy * 0.4 + (dy / Math.sqrt(d2)) * 0.5) * force;
          }
        }
      }
    }
  }

  // Draw particles to Canvas context
  draw(ctx, camera) {
    ctx.save();
    for (let i = 0; i < this.count; i++) {
      const sx = (this.x[i] - camera.x) * camera.zoom + camera.viewportW * 0.5;
      const sy = (this.y[i] - camera.y) * camera.zoom + camera.viewportH * 0.5;

      // Cull offscreen
      if (sx < -20 || sx > camera.viewportW + 20 || sy < -20 || sy > camera.viewportH + 20) {
        continue;
      }

      const r = this.size[i] * camera.zoom;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.6, r), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${Math.round(this.hue[i] * 360)}, 85%, 65%, ${this.alpha[i]})`;
      ctx.fill();
    }
    ctx.restore();
  }
}
