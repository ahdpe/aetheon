export class ParticleSystem {
  constructor(count = 1200, worldSize = 1000.0) {
    this.count = count;
    this.worldSize = worldSize;
    
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

  init() {
    for (let i = 0; i < this.count; i++) {
      this.x[i] = Math.random() * this.worldSize;
      this.y[i] = Math.random() * this.worldSize;
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
    const WS = this.worldSize;

    for (let i = 0; i < this.count; i++) {
      // Ambient fluid currents
      this.x[i] = (this.x[i] + this.vx[i] + WS) % WS;
      this.y[i] = (this.y[i] + this.vy[i] + WS) % WS;

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
          let dx = this.x[p] - ox;
          let dy = this.y[p] - oy;
          if (dx > WS * 0.5) dx -= WS;
          else if (dx < -WS * 0.5) dx += WS;
          if (dy > WS * 0.5) dy -= WS;
          else if (dy < -WS * 0.5) dy += WS;

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
