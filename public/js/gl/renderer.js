import { ParticleSystem } from './particles.js';

export class OceanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.worldSize = 1000.0;
    
    // Camera
    this.camera = {
      x: 500.0,
      y: 500.0,
      zoom: 1.0,
      targetX: 500.0,
      targetY: 500.0,
      targetZoom: 1.0,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      trackedEntityId: null
    };

    // Interpolation state
    this.prevEntities = new Map();
    this.currEntities = new Map();
    this.prevTickTime = performance.now();
    this.currTickTime = performance.now();
    
    // Ambient fluid particles
    this.particles = new ParticleSystem(1000, this.worldSize);
    
    // Interaction ripples
    this.ripples = [];
    this.vents = [];
    this.isLabMode = false;
    
    // Chemical thumbnail buffer for fluid field
    this.thumbCanvas = document.createElement('canvas');
    this.thumbCanvas.width = 48;
    this.thumbCanvas.height = 48;
    this.thumbCtx = this.thumbCanvas.getContext('2d');
    this.thumbImgData = this.thumbCtx.createImageData(48, 48);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.camera.viewportW = w;
    this.camera.viewportH = h;
    
    // Default zoom adjusted for screen size
    if (w < 600) {
      this.camera.targetZoom = 0.85;
    }
  }

  setLabMode(enabled) {
    this.isLabMode = enabled;
  }

  setVents(vents) {
    this.vents = vents || [];
  }

  addRipple(x, y, color = 'rgba(0, 240, 255, 0.7)', maxR = 60) {
    this.ripples.push({
      x, y,
      r: 4,
      maxR,
      alpha: 1.0,
      color
    });
  }

  updateThumbnail(rawThumb) {
    if (!rawThumb || rawThumb.length < 48 * 48 * 3) return;
    const data = this.thumbImgData.data;
    let srcPtr = 0;
    let dstPtr = 0;

    for (let i = 0; i < 48 * 48; i++) {
      const nut = rawThumb[srcPtr++];
      const wst = rawThumb[srcPtr++];
      const sig = rawThumb[srcPtr++];

      // Map chemicals to oceanic palette:
      // Nutrients: Cyan/Emerald glow
      // Waste: Deep violet/rust
      // Signal: Electric bioluminescent highlight
      data[dstPtr++] = Math.min(255, wst * 1.2 + sig * 0.4);       // R
      data[dstPtr++] = Math.min(255, nut * 0.9 + sig * 0.6);       // G
      data[dstPtr++] = Math.min(255, nut * 1.4 + sig * 1.2 + 25);  // B
      data[dstPtr++] = 120; // Translucent fluid overlay
    }
    this.thumbCtx.putImageData(this.thumbImgData, 0, 0);
  }

  onServerTick(packet) {
    this.prevTickTime = this.currTickTime;
    this.currTickTime = performance.now();

    // Advance entity maps
    this.prevEntities = this.currEntities;
    this.currEntities = new Map();

    const raw = packet.orgs;
    if (raw && packet.n > 0) {
      const stride = Math.round(raw.length / packet.n);
      for (let i = 0; i < packet.n; i++) {
        const ptr = i * stride;
        const id = raw[ptr];
        this.currEntities.set(id, {
          id,
          x: raw[ptr + 1],
          y: raw[ptr + 2],
          vx: raw[ptr + 3],
          vy: raw[ptr + 4],
          energy: raw[ptr + 5],
          size: raw[ptr + 6],
          hue: raw[ptr + 7],
          speciesId: stride >= 9 ? raw[ptr + 8] : 1,
          carnivory: stride >= 10 ? raw[ptr + 9] : 0.1
        });
      }
    }

    if (packet.thumbnail) {
      this.updateThumbnail(packet.thumbnail);
    }
  }

  // Master render frame (runs at 60–120 FPS in requestAnimationFrame)
  render(time) {
    const ctx = this.ctx;
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;
    const dpr = this.dpr;

    // Reset transform & scale for DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Camera glide & entity tracking
    if (this.camera.trackedEntityId) {
      const tracked = this.currEntities.get(this.camera.trackedEntityId);
      if (tracked) {
        this.camera.targetX = tracked.x;
        this.camera.targetY = tracked.y;
      }
    }

    this.camera.x += (this.camera.targetX - this.camera.x) * 0.08;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.08;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.08;

    // 2. Clear canvas with deep abyssal gradient
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // World transform helper
    const toScreenX = (wx) => (wx - this.camera.x) * this.camera.zoom + w * 0.5;
    const toScreenY = (wy) => (wy - this.camera.y) * this.camera.zoom + h * 0.5;

    // 3. Render continuous fluid substrate field (scaled thumbnail)
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = this.isLabMode ? 0.70 : 0.35;
    
    // Draw chemical fluid across 4 quadrants to handle wrapping
    const camZoom = this.camera.zoom;
    const wsPix = this.worldSize * camZoom;
    const originX = toScreenX(0);
    const originY = toScreenY(0);

    ctx.drawImage(this.thumbCanvas, originX, originY, wsPix, wsPix);
    ctx.restore();

    // 4. Render Hydrothermal Vents
    const ventScale = this.worldSize / 128;
    for (let i = 0; i < this.vents.length; i++) {
      const vent = this.vents[i];
      const vx = toScreenX(vent.x * ventScale);
      const vy = toScreenY(vent.y * ventScale);
      const vr = vent.radius * ventScale * camZoom * 1.5;

      const grad = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr * 2);
      const hDeg = Math.round(vent.hue * 360);
      grad.addColorStop(0, `hsla(${hDeg}, 90%, 65%, 0.35)`);
      grad.addColorStop(0.5, `hsla(${hDeg}, 80%, 45%, 0.12)`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vx, vy, vr * 2, 0, Math.PI * 2);
      ctx.fill();

      // Vent core orifice
      ctx.fillStyle = `hsla(${hDeg}, 95%, 75%, 0.8)`;
      ctx.beginPath();
      ctx.arc(vx, vy, Math.max(3, vr * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }

    // 4.5. If Lab Mode, draw analysis counting chamber grid and reactor boundaries
    if (this.isLabMode) {
      this.drawLabGrid(ctx, toScreenX, toScreenY);
    }

    // 5. Ambient fluid micro-plankton
    const currentList = Array.from(this.currEntities.values());
    this.particles.step(currentList);
    this.particles.draw(ctx, this.camera);

    // 6. Compute interpolation factor alpha between 10 Hz ticks (clamped to prevent freezing or jumps)
    const tickDelta = Math.max(10, Math.min(250, this.currTickTime - this.prevTickTime));
    const elapsed = Math.max(0, time - this.currTickTime);
    const alpha = Math.min(1.2, elapsed / tickDelta);

    // 7. Render Organisms
    for (let i = 0; i < currentList.length; i++) {
      const curr = currentList[i];
      const prev = this.prevEntities.get(curr.id) || curr;

      // Handle toroidal wrapping interpolation
      let ix = prev.x + (curr.x - prev.x) * alpha;
      let iy = prev.y + (curr.y - prev.y) * alpha;
      if (Math.abs(curr.x - prev.x) > this.worldSize * 0.5) ix = curr.x;
      if (Math.abs(curr.y - prev.y) > this.worldSize * 0.5) iy = curr.y;

      const sx = toScreenX(ix);
      const sy = toScreenY(iy);

      // Cull offscreen entities
      const radius = curr.size * camZoom;
      if (sx < -radius * 2 || sx > w + radius * 2 || sy < -radius * 2 || sy > h + radius * 2) {
        continue;
      }

      const heading = Math.atan2(curr.vy, curr.vx);
      const isSelected = this.camera.trackedEntityId === curr.id;

      this.drawOrganism(ctx, sx, sy, radius, curr, heading, isSelected, time);
    }

    // 8. Render Interaction Ripples
    for (let r = this.ripples.length - 1; r >= 0; r--) {
      const rip = this.ripples[r];
      rip.r += 1.8;
      rip.alpha -= 0.025;

      if (rip.alpha <= 0 || rip.r >= rip.maxR) {
        this.ripples.splice(r, 1);
        continue;
      }

      const rx = toScreenX(rip.x);
      const ry = toScreenY(rip.y);
      const rad = rip.r * camZoom;

      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.strokeStyle = rip.color.replace('0.7', rip.alpha.toFixed(2));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 9. Research Lab Overlays (Telemetry tags, velocity vector arrows, sensory radii)
    if (this.isLabMode) {
      this.drawLabEntityOverlay(ctx, currentList, toScreenX, toScreenY, alpha);
    }
  }

  // Render organic soft-body Aetheobiont with translucent membrane and beating cilia
  drawOrganism(ctx, x, y, r, org, heading, isSelected, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);

    const hue = Math.round(org.hue * 360);
    const isHunter = org.hue < 0.2 || org.hue > 0.9;
    const pulse = Math.sin(time * 0.008 + org.id) * 0.15;
    const bodyR = Math.max(3.5, r * (1.0 + pulse));

    // A. Bioluminescent Halo
    const glowGrad = ctx.createRadialGradient(0, 0, bodyR * 0.5, 0, 0, bodyR * 2.4);
    glowGrad.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.25)`);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // B. Beating Cilia (whipping hairs along perimeter)
    const ciliaCount = Math.max(8, Math.floor(bodyR * 1.4));
    ctx.strokeStyle = `hsla(${hue}, 80%, 75%, 0.45)`;
    ctx.lineWidth = 1.0;
    
    for (let c = 0; c < ciliaCount; c++) {
      const angle = (c / ciliaCount) * Math.PI * 2;
      const wave = Math.sin(time * 0.015 + angle * 3.0 + org.id) * (bodyR * 0.35);
      const ciliaLen = bodyR * 0.45 + wave;

      const cx1 = Math.cos(angle) * bodyR;
      const cy1 = Math.sin(angle) * bodyR;
      const cx2 = Math.cos(angle) * (bodyR + ciliaLen);
      const cy2 = Math.sin(angle) * (bodyR + ciliaLen);

      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }

    // C. Translucent Viscoelastic Membrane
    ctx.fillStyle = `hsla(${hue}, 75%, 35%, 0.65)`;
    ctx.strokeStyle = `hsla(${hue}, 95%, 70%, 0.85)`;
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    // Oval swimming deformation along heading
    ctx.ellipse(0, 0, bodyR * 1.25, bodyR * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // D. Internal Organelles & Nucleus
    ctx.fillStyle = `hsla(${(hue + 40) % 360}, 90%, 75%, 0.85)`;
    ctx.beginPath();
    ctx.arc(-bodyR * 0.25, 0, bodyR * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Small vacuoles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(bodyR * 0.35, -bodyR * 0.2, bodyR * 0.18, 0, Math.PI * 2);
    ctx.arc(bodyR * 0.25, bodyR * 0.25, bodyR * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // E. Targeting Reticle (if selected in Inspector)
    if (isSelected) {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      const targetR = bodyR * 1.8;
      
      ctx.beginPath();
      ctx.arc(0, 0, targetR, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(-targetR - 4, 0); ctx.lineTo(-targetR + 4, 0);
      ctx.moveTo(targetR - 4, 0); ctx.lineTo(targetR + 4, 0);
      ctx.moveTo(0, -targetR - 4); ctx.lineTo(0, -targetR + 4);
      ctx.moveTo(0, targetR - 4); ctx.lineTo(0, targetR + 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  // High-precision Hemocytometer / Counting Chamber grid & thermal isotherms
  drawLabGrid(ctx, toScreenX, toScreenY) {
    ctx.save();
    const zoom = this.camera.zoom;
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;
    const WS = this.worldSize;

    // 1. Minor grid (every 50 world units)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let u = 0; u <= WS; u += 50) {
      if (u % 200 === 0) continue; // Skip major lines
      const sx = toScreenX(u);
      if (sx >= -10 && sx <= w + 10) {
        ctx.beginPath();
        ctx.moveTo(sx, toScreenY(0));
        ctx.lineTo(sx, toScreenY(WS));
        ctx.stroke();
      }
      const sy = toScreenY(u);
      if (sy >= -10 && sy <= h + 10) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(0), sy);
        ctx.lineTo(toScreenX(WS), sy);
        ctx.stroke();
      }
    }

    // 2. Major grid (every 200 world units) with measurement ticks & coordinate tags
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.font = '9px "JetBrains Mono", monospace';

    for (let u = 0; u <= WS; u += 200) {
      const sx = toScreenX(u);
      if (sx >= -10 && sx <= w + 10) {
        ctx.beginPath();
        ctx.moveTo(sx, toScreenY(0));
        ctx.lineTo(sx, toScreenY(WS));
        ctx.stroke();
        ctx.fillText(`${u}μm`, sx + 4, toScreenY(0) + 14);
      }
      const sy = toScreenY(u);
      if (sy >= -10 && sy <= h + 10) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(0), sy);
        ctx.lineTo(toScreenX(WS), sy);
        ctx.stroke();
        ctx.fillText(`${u}μm`, toScreenX(0) + 6, sy - 4);
      }
    }

    // 3. Canonical Reactor Bounds with Corner Brackets
    const rx0 = toScreenX(0);
    const ry0 = toScreenY(0);
    const rx1 = toScreenX(WS);
    const ry1 = toScreenY(WS);
    const rw = rx1 - rx0;
    const rh = ry1 - ry0;

    // Glowing border frame
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx0, ry0, rw, rh);

    // High-tech corner brackets
    const bLen = Math.max(12, 22 * zoom);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(rx0, ry0 + bLen); ctx.lineTo(rx0, ry0); ctx.lineTo(rx0 + bLen, ry0);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(rx1 - bLen, ry0); ctx.lineTo(rx1, ry0); ctx.lineTo(rx1, ry0 + bLen);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(rx0, ry1 - bLen); ctx.lineTo(rx0, ry1); ctx.lineTo(rx0 + bLen, ry1);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(rx1 - bLen, ry1); ctx.lineTo(rx1, ry1); ctx.lineTo(rx1, ry1 - bLen);
    ctx.stroke();

    // Chamber identification badge
    ctx.fillStyle = '#00f0ff';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('◈ CANONICAL BIO-REACTOR: 1000 × 1000 μm [CHAMBER ALPHA]', rx0 + 12, ry0 - 8);

    // 4. Hydrothermal Vents Isotherms in Lab Mode
    const ventScale = WS / 128;
    for (let v = 0; v < this.vents.length; v++) {
      const vent = this.vents[v];
      const vx = toScreenX(vent.x * ventScale);
      const vy = toScreenY(vent.y * ventScale);
      const vr = vent.radius * ventScale * zoom;

      // Concentric isotherm contours
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.45)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.arc(vx, vy, vr * 1.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(vx, vy, vr * 2.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 170, 0, 0.85)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`VENT #${v + 1} [82°C]`, vx + vr * 0.5, vy - vr * 1.3);
    }

    ctx.restore();
  }

  // Draw Research Lab overlays: velocity vector arrows, sensory bubbles, telemetry data tags
  drawLabEntityOverlay(ctx, organisms, toScreenX, toScreenY, alpha) {
    ctx.save();
    const zoom = this.camera.zoom;
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;
    const WS = this.worldSize;

    // 1. Batch Velocity Vector Lines (2 draw calls total instead of 2000!)
    ctx.lineWidth = 1.6;
    
    // Grazers batch (neon green)
    ctx.strokeStyle = '#00ffaa';
    ctx.beginPath();
    for (let i = 0; i < organisms.length; i++) {
      const curr = organisms[i];
      if (curr.carnivory > 0.4) continue;
      const prev = this.prevEntities.get(curr.id) || curr;
      let ix = prev.x + (curr.x - prev.x) * alpha;
      let iy = prev.y + (curr.y - prev.y) * alpha;
      if (Math.abs(curr.x - prev.x) > WS * 0.5) ix = curr.x;
      if (Math.abs(curr.y - prev.y) > WS * 0.5) iy = curr.y;
      const sx = toScreenX(ix);
      const sy = toScreenY(iy);
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

      const speed = Math.hypot(curr.vx, curr.vy);
      const arrowLen = Math.max(8, speed * 18 * zoom);
      const angle = Math.atan2(curr.vy, curr.vx);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * arrowLen, sy + Math.sin(angle) * arrowLen);
    }
    ctx.stroke();

    // Hunters batch (neon red)
    ctx.strokeStyle = '#ff4d4d';
    ctx.beginPath();
    for (let i = 0; i < organisms.length; i++) {
      const curr = organisms[i];
      if (curr.carnivory <= 0.4) continue;
      const prev = this.prevEntities.get(curr.id) || curr;
      let ix = prev.x + (curr.x - prev.x) * alpha;
      let iy = prev.y + (curr.y - prev.y) * alpha;
      if (Math.abs(curr.x - prev.x) > WS * 0.5) ix = curr.x;
      if (Math.abs(curr.y - prev.y) > WS * 0.5) iy = curr.y;
      const sx = toScreenX(ix);
      const sy = toScreenY(iy);
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

      const speed = Math.hypot(curr.vx, curr.vy);
      const arrowLen = Math.max(12, speed * 22 * zoom);
      const angle = Math.atan2(curr.vy, curr.vx);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * arrowLen, sy + Math.sin(angle) * arrowLen);
    }
    ctx.stroke();

    // 2. High-Detail Telemetry Tags & Sensory Bubbles (LOD: closest 25 to viewport center)
    const centerX = w * 0.5;
    const centerY = h * 0.5;
    const candidates = [];

    for (let i = 0; i < organisms.length; i++) {
      const curr = organisms[i];
      const prev = this.prevEntities.get(curr.id) || curr;
      let ix = prev.x + (curr.x - prev.x) * alpha;
      let iy = prev.y + (curr.y - prev.y) * alpha;
      if (Math.abs(curr.x - prev.x) > WS * 0.5) ix = curr.x;
      if (Math.abs(curr.y - prev.y) > WS * 0.5) iy = curr.y;
      const sx = toScreenX(ix);
      const sy = toScreenY(iy);
      if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;

      const dCenter = Math.hypot(sx - centerX, sy - centerY);
      candidates.push({ curr, sx, sy, dCenter });
    }

    // Sort by distance to center
    candidates.sort((a, b) => a.dCenter - b.dCenter);
    const detailCount = Math.min(25, candidates.length);

    ctx.font = '9px "JetBrains Mono", monospace';

    for (let k = 0; k < detailCount; k++) {
      const { curr, sx, sy } = candidates[k];
      const isHunter = curr.carnivory > 0.4;

      // Sensory Field
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.arc(sx, sy, curr.size * 3.5 * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = isHunter ? 'rgba(255, 77, 77, 0.35)' : 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Telemetry Data Tag Badge
      ctx.setLineDash([]);
      const tagText = `${isHunter ? '▲' : '●'} Sp.${curr.speciesId || 1} • ${Math.round(curr.energy)}E`;
      const textWidth = ctx.measureText(tagText).width;
      const tagX = sx - textWidth * 0.5;
      const tagY = sy - curr.size * zoom - 8;

      ctx.fillStyle = 'rgba(6, 12, 26, 0.85)';
      ctx.fillRect(tagX - 3, tagY - 9, textWidth + 6, 12);
      ctx.strokeStyle = isHunter ? 'rgba(255, 77, 77, 0.5)' : 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(tagX - 3, tagY - 9, textWidth + 6, 12);

      ctx.fillStyle = isHunter ? '#ff8080' : '#80ffcc';
      ctx.fillText(tagText, tagX, tagY);
    }

    ctx.restore();
  }

  // Find organism closest to screen point (x, y)
  findOrganismAtScreenPoint(screenX, screenY, maxDistance = 35) {
    let closest = null;
    let minD2 = maxDistance * maxDistance;

    const toScreenX = (wx) => (wx - this.camera.x) * this.camera.zoom + this.camera.viewportW * 0.5;
    const toScreenY = (wy) => (wy - this.camera.y) * this.camera.zoom + this.camera.viewportH * 0.5;

    for (const org of this.currEntities.values()) {
      const sx = toScreenX(org.x);
      const sy = toScreenY(org.y);
      const dx = screenX - sx;
      const dy = screenY - sy;
      const d2 = dx * dx + dy * dy;

      if (d2 < minD2) {
        minD2 = d2;
        closest = org;
      }
    }
    return closest;
  }

  // Convert screen coordinates into world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.camera.viewportW * 0.5) / this.camera.zoom + this.camera.x,
      y: (screenY - this.camera.viewportH * 0.5) / this.camera.zoom + this.camera.y
    };
  }
}
