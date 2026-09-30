import { ParticleSystem } from './particles.js';

export class OceanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.worldSize = 1400.0;
    this.chamber = { cx: 700.0, cy: 700.0, r: 620.0 };
    
    // Camera centered on chamber
    this.camera = {
      x: 700.0,
      y: 700.0,
      zoom: 1.0,
      targetX: 700.0,
      targetY: 700.0,
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
    this.particles = new ParticleSystem(1000, this.worldSize, this.chamber);
    
    // Interaction ripples & food particles
    this.ripples = [];
    this.foodParticles = [];
    this.serverBlooms = [];
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

  setChamber(chamber) {
    if (!chamber) return;
    this.chamber = chamber;
    if (this.particles) {
      this.particles.setChamber(chamber);
    }
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

  // Spawn rich glowing phytomanna / nutrient spore cluster
  spawnFoodBloom(wx, wy, count = 24) {
    const hueBase = 0.23; // Emerald-golden bioluminescent nutrition
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.0 + 0.4;
      const dist = Math.random() * 22;
      this.foodParticles.push({
        x: wx + Math.cos(angle) * dist,
        y: wy + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2.8 + 2.5,
        alpha: 1.0,
        maxLife: Math.random() * 500 + 750, // ~15-20 seconds of active floating food
        life: 0,
        hue: hueBase + (Math.random() - 0.5) * 0.08
      });
    }

    // Emerald feeding pulse ripple
    this.addRipple(wx, wy, 'rgba(163, 230, 53, 0.95)', 95);
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

    if (packet.blooms) {
      this.serverBlooms = packet.blooms;
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
    const camZoom = this.camera.zoom;

    // Chamber screen geometry
    const ch = this.chamber;
    const chScreenX = toScreenX(ch.cx);
    const chScreenY = toScreenY(ch.cy);
    const chScreenR = ch.r * camZoom;

    // 3. Render continuous fluid substrate field (clipped to circular chamber)
    ctx.save();
    ctx.beginPath();
    ctx.arc(chScreenX, chScreenY, chScreenR, 0, Math.PI * 2);
    ctx.clip();

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = this.isLabMode ? 0.70 : 0.35;
    
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

    // 4.5. Render Chamber Boundary (Meniscus in Zen mode, Polar counting chamber in Lab mode)
    if (this.isLabMode) {
      this.drawLabGrid(ctx, toScreenX, toScreenY, chScreenX, chScreenY, chScreenR);
    } else {
      this.drawZenMeniscus(ctx, chScreenX, chScreenY, chScreenR, w, h, camZoom);
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

      // Smooth continuous interpolation without wrapping jumps
      const ix = prev.x + (curr.x - prev.x) * alpha;
      const iy = prev.y + (curr.y - prev.y) * alpha;

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

    // 7.5. Render Nutrient Blooms & Floating Phytomanna Spores
    this.renderFoodBlooms(ctx, toScreenX, toScreenY, camZoom, time, currentList);

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

  // Render active nutrient blooms and floating phytomanna food particles
  renderFoodBlooms(ctx, toScreenX, toScreenY, camZoom, time, organisms) {
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;

    // A. Render Active Server Nutrient Blooms (Bioluminescent clouds)
    for (let b = 0; b < this.serverBlooms.length; b++) {
      const bloom = this.serverBlooms[b];
      const bx = toScreenX(bloom.x);
      const by = toScreenY(bloom.y);
      const br = bloom.r * camZoom;

      // Soft ambient nutrient diffusion cloud
      const pulse = 1.0 + Math.sin(time * 0.005 + bloom.id) * 0.08;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br * pulse);
      grad.addColorStop(0, 'rgba(163, 230, 53, 0.25)');
      grad.addColorStop(0.5, 'rgba(132, 204, 22, 0.09)');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, br * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Lab Mode Scientific HUD Reticle
      if (this.isLabMode) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();

        ctx.setLineDash([]);
        // Center reticle
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#bef264';
        ctx.fill();

        // Label
        ctx.font = '9px "JetBrains Mono", monospace';
        const label = `✦ NUTRIENT BLOOM [${Math.round(bloom.e)} cal] • ACTIVE ATTRACTOR`;
        ctx.fillStyle = 'rgba(6, 18, 10, 0.85)';
        const tw = ctx.measureText(label).width;
        ctx.fillRect(bx - tw * 0.5 - 4, by - br - 16, tw + 8, 14);
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.7)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx - tw * 0.5 - 4, by - br - 16, tw + 8, 14);

        ctx.fillStyle = '#bef264';
        ctx.fillText(label, bx - tw * 0.5, by - br - 6);
        ctx.restore();
      }

      // Maintain floating particles around active bloom
      if (this.foodParticles.length < 20 && Math.random() < 0.12) {
        const ang = Math.random() * Math.PI * 2;
        const d = Math.random() * bloom.r * 0.65;
        this.foodParticles.push({
          x: bloom.x + Math.cos(ang) * d,
          y: bloom.y + Math.sin(ang) * d,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2.5 + 2.0,
          alpha: 1.0,
          maxLife: 450,
          life: 0,
          hue: 0.23 + (Math.random() - 0.5) * 0.06
        });
      }
    }

    // B. Drifting Nutrient Spores Physics & Drawing
    for (let i = this.foodParticles.length - 1; i >= 0; i--) {
      const p = this.foodParticles[i];
      p.life++;
      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.foodParticles.splice(i, 1);
        continue;
      }

      // Physics damping & fluid drift
      p.vx *= 0.96;
      p.vy *= 0.96;
      const drift = time * 0.0012 + p.x * 0.01;
      p.x += p.vx + Math.cos(drift) * 0.22;
      p.y += p.vy + Math.sin(drift) * 0.22;

      // Soft bounce on chamber boundary
      const ch = this.chamber;
      if (ch) {
        const dx = p.x - ch.cx;
        const dy = p.y - ch.cy;
        const dist = Math.hypot(dx, dy);
        if (dist > ch.r - 8) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.x = ch.cx + nx * (ch.r - 8);
          p.y = ch.cy + ny * (ch.r - 8);
          p.vx -= nx * 0.5;
          p.vy -= ny * 0.5;
        }
      }

      // Grazing check against nearby organisms
      let consumed = false;
      for (let o = 0; o < organisms.length; o++) {
        const org = organisms[o];
        const odx = org.x - p.x;
        const ody = org.y - p.y;
        const eatDist = (org.size + p.size) * 1.1;
        if (odx * odx + ody * ody < eatDist * eatDist) {
          consumed = true;
          break;
        }
      }

      if (consumed) {
        this.foodParticles.splice(i, 1);
        continue;
      }

      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

      // Opacity calculation (gentle fade in and fade out)
      const lifeRatio = p.life / p.maxLife;
      const fade = lifeRatio > 0.75 ? (1.0 - lifeRatio) / 0.25 : Math.min(1.0, p.life / 20);
      const alpha = p.alpha * fade;
      const sz = p.size * camZoom;

      // Bioluminescent Emerald Halo
      const haloGrad = ctx.createRadialGradient(sx, sy, sz * 0.2, sx, sy, sz * 3.2);
      haloGrad.addColorStop(0, `rgba(190, 242, 100, ${(0.65 * alpha).toFixed(2)})`);
      haloGrad.addColorStop(0.5, `rgba(132, 204, 22, ${(0.22 * alpha).toFixed(2)})`);
      haloGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sz * 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Crystalline nutrient core
      ctx.fillStyle = `rgba(254, 252, 232, ${(0.95 * alpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.4, sz * 0.65), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Beautiful living surface tension meniscus & dark optical field
  drawZenMeniscus(ctx, cx, cy, cr, w, h, zoom) {
    ctx.save();
    // 1. Dark mask outside droplet (vignette cutout)
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(cx, cy, cr, 0, Math.PI * 2, true);
    ctx.fillStyle = '#02040a';
    ctx.fill();

    // 2. Living Meniscus: Surface tension ring with organic optical refraction
    const innerR = Math.max(0, cr - 16 * zoom);
    const outerR = cr + 5 * zoom;
    const meniscusGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    meniscusGrad.addColorStop(0, 'rgba(0, 240, 255, 0.0)');
    meniscusGrad.addColorStop(0.65, 'rgba(0, 240, 255, 0.12)');
    meniscusGrad.addColorStop(0.95, 'rgba(0, 240, 255, 0.42)');
    meniscusGrad.addColorStop(1.0, 'rgba(0, 240, 255, 0.0)');
    ctx.fillStyle = meniscusGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Crisp meniscus rim
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.stroke();

    // 4. Subtle inner caustic highlight
    ctx.beginPath();
    ctx.arc(cx, cy, cr - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  // High-precision Hemocytometer / Circular Petri Counting Chamber
  drawLabGrid(ctx, toScreenX, toScreenY, cx, cy, cr) {
    ctx.save();
    const zoom = this.camera.zoom;
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;

    // 1. Dark mask outside chamber
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(cx, cy, cr, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(2, 4, 10, 0.92)';
    ctx.fill();

    // 2. Concentric Range Rings (every 150 μm from center)
    ctx.font = '9px "JetBrains Mono", monospace';
    const rings = [150, 300, 450, 600];
    for (let i = 0; i < rings.length; i++) {
      const radiusWorld = rings[i];
      const radiusPix = radiusWorld * zoom;
      
      ctx.beginPath();
      ctx.arc(cx, cy, radiusPix, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();

      // Range label
      ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.fillText(`r = ${radiusWorld} μm`, cx + radiusPix + 4, cy - 4);
    }
    ctx.setLineDash([]);

    // 3. Polar degree ray spokes (every 30 degrees)
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(cx + cosA * (cr - 25), cy + sinA * (cr - 25));
      ctx.lineTo(cx + cosA * cr, cy + sinA * cr);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Degree label
      if (deg % 60 === 0) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
        ctx.fillText(`${deg}°`, cx + cosA * (cr - 38) - 8, cy + sinA * (cr - 38) + 3);
      }
    }

    // 4. Outer Chamber Rim & Precision Measurement Caliper Marks
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 4 Crosshair cardinal calipers
    const calLen = 14 * zoom;
    const cardinals = [
      { a: 0 },
      { a: Math.PI * 0.5 },
      { a: Math.PI },
      { a: Math.PI * 1.5 }
    ];

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    for (const c of cardinals) {
      const rx = cx + Math.cos(c.a) * cr;
      const ry = cy + Math.sin(c.a) * cr;
      ctx.beginPath();
      ctx.moveTo(rx - Math.cos(c.a) * calLen, ry - Math.sin(c.a) * calLen);
      ctx.lineTo(rx + Math.cos(c.a) * 8, ry + Math.sin(c.a) * 8);
      ctx.stroke();
    }

    // Chamber identification badge
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('◈ PETRI BIO-CHAMBER: Ø 1240 μm [ACTIVE MENISCUS]', cx - 135, cy - cr + 26);

    // 5. Hydrothermal Vents Isotherms in Lab Mode
    const ventScale = this.worldSize / 128;
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

    // 1. Batch Velocity Vector Lines (2 draw calls total instead of 2000!)
    ctx.lineWidth = 1.6;
    
    // Grazers batch (neon green)
    ctx.strokeStyle = '#00ffaa';
    ctx.beginPath();
    for (let i = 0; i < organisms.length; i++) {
      const curr = organisms[i];
      if (curr.carnivory > 0.4) continue;
      const prev = this.prevEntities.get(curr.id) || curr;
      const ix = prev.x + (curr.x - prev.x) * alpha;
      const iy = prev.y + (curr.y - prev.y) * alpha;
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
      const ix = prev.x + (curr.x - prev.x) * alpha;
      const iy = prev.y + (curr.y - prev.y) * alpha;
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
      const ix = prev.x + (curr.x - prev.x) * alpha;
      const iy = prev.y + (curr.y - prev.y) * alpha;
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
    const placedLabels = [];

    for (let k = 0; k < candidates.length; k++) {
      if (placedLabels.length >= 20) break;
      const { curr, sx, sy } = candidates[k];

      // Avoid overlapping labels
      let collides = false;
      for (let p = 0; p < placedLabels.length; p++) {
        if (Math.hypot(sx - placedLabels[p].sx, sy - placedLabels[p].sy) < 40) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
      placedLabels.push({ sx, sy });

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
