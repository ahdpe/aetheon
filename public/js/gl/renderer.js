import { ParticleSystem } from './particles.js';
import { getSpeciesMorphology, drawCellMembranePath, drawCellMarkings, drawFlagellum, drawAntennae } from './morphology.js';
import { OCEAN_GEOMETRY } from '../shared/habitats.js';
import { makeHabitatCanvas } from '../ui/geographyPanel.js';
import { ObservationBuffer, followGain, focusGeometry, insideFocus } from './observation.js';

export class OceanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.worldSize = OCEAN_GEOMETRY.worldSize;
    this.gridSize = OCEAN_GEOMETRY.gridSize;
    this.chamber = { cx: OCEAN_GEOMETRY.cx, cy: OCEAN_GEOMETRY.cy, r: OCEAN_GEOMETRY.radius };
    this.habitatCanvas=makeHabitatCanvas();
    
    // Camera centered on chamber
    this.camera = {
      x: OCEAN_GEOMETRY.cx,
      y: OCEAN_GEOMETRY.cy,
      zoom: window.innerWidth < 600 ? 1.8 : 1.6,
      targetX: OCEAN_GEOMETRY.cx,
      targetY: OCEAN_GEOMETRY.cy,
      targetZoom: window.innerWidth < 600 ? 1.8 : 1.6,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      trackedEntityId: null
    };

    // Interpolation state
    this.prevEntities = new Map();
    this.currEntities = new Map();
    this.prevTickTime = performance.now();
    this.currTickTime = performance.now();
    this.observation = new ObservationBuffer();
    this.renderedEntities = new Map();
    this.focusEnabled = true;
    this.lastFrameTime = null;
    
    // Ambient fluid particles
    this.particles = new ParticleSystem(600, this.worldSize, this.chamber);
    
    // Interaction ripples & food particles
    this.ripples = [];
    this.foodParticles = [];
    this.serverBlooms = [];
    this.colonyBonds = [];
    this.pilotedIds = new Set();
    this.climate = null;
    this.vents = [];
    this.algaeIsles = [];
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
    
    // A resize must preserve the visitor's chosen magnification.
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
    const ch = this.chamber;
    if (ch) {
      const dx = wx - ch.cx;
      const dy = wy - ch.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > ch.r - 12) {
        return; // Strictly inside droplet only!
      }
      const maxR = ch.r - 45;
      if (dist > maxR && dist > 0) {
        wx = ch.cx + (dx / dist) * maxR;
        wy = ch.cy + (dy / dist) * maxR;
      }
    }

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
    if (!rawThumb) return;
    const isRGBA = rawThumb.length >= 48 * 48 * 4;
    const isRGB = rawThumb.length >= 48 * 48 * 3;
    if (!isRGB) return;

    const data = this.thumbImgData.data;
    let srcPtr = 0;
    let dstPtr = 0;
    let maxSub = 0;

    for (let i = 0; i < 48 * 48; i++) {
      const nut = rawThumb[srcPtr++];
      const wst = rawThumb[srcPtr++];
      const sig = rawThumb[srcPtr++];
      const sub = isRGBA ? rawThumb[srcPtr++] : 0;
      if (sub > maxSub) maxSub = sub;

      if (sub > 35) {
        // Bio-calcite Coral Reef & Living Mineral Architecture (Stigmergy)
        // Elegant emerald-cyan bioluminescent reefs that contour benthic deposits without washing out the abyssal depths
        const subNorm = Math.min(1.0, (sub - 35) / 180);
        const reefR = Math.min(200, Math.floor(wst * 0.3 + subNorm * 45));
        const reefG = Math.min(240, Math.floor(nut * 0.5 + 60 + subNorm * 110));
        const reefB = Math.min(255, Math.floor(nut * 0.7 + 110 + subNorm * 105));
        const alpha = Math.min(115, Math.floor(25 + subNorm * 80));

        data[dstPtr++] = reefR;
        data[dstPtr++] = reefG;
        data[dstPtr++] = reefB;
        data[dstPtr++] = alpha;
      } else {
        // Ambient oceanic chemical field:
        // Bioluminescent nebulas that reveal chemical concentrations without washing out the abyssal ocean baseline
        const chemSum = nut * 0.5 + wst * 0.35 + sig * 0.7;
        const chemAlpha = Math.min(95, Math.floor(chemSum * 0.28));

        data[dstPtr++] = Math.min(220, Math.floor(wst * 0.5 + sig * 0.25));
        data[dstPtr++] = Math.min(240, Math.floor(nut * 0.55 + sig * 0.55));
        data[dstPtr++] = Math.min(255, Math.floor(nut * 0.8 + sig * 0.95 + 6));
        data[dstPtr++] = chemAlpha;
      }
    }
    this.hasReefs = maxSub > 50;
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
          carnivory: stride >= 10 ? raw[ptr + 9] : 0.1,
          anatomy:stride>=15?{elongation:raw[ptr+10],shell:raw[ptr+11],flagella:raw[ptr+12],sensing:raw[ptr+13]}:null,
          phase:stride>=15?raw[ptr+14]:0
        });
      }
    }
    this.observation.push(this.currEntities, this.currTickTime, packet.t);

    if (packet.blooms) {
      this.serverBlooms = packet.blooms;
    }

    if (packet.colonies) {
      this.colonyBonds = packet.colonies;
    }

    if (packet.pilots) {
      this.pilotedIds = new Set(packet.pilots.map(Number));
    }

    if (packet.climate) {
      this.climate = packet.climate;
    }

    if (packet.algae) {
      this.algaeIsles = packet.algae;
    }

    if (packet.thumbnail) {
      this.updateThumbnail(packet.thumbnail);
    }
  }

  resetStream() {
    this.observation.clear();
    this.currEntities = new Map();
    this.prevEntities = new Map();
    this.renderedEntities = new Map();
    this.lastFrameTime = null;
  }

  inObservationArea(x, y, margin = 0) {
    return !this.focusEnabled || insideFocus(x, y, focusGeometry(this.camera.viewportW, this.camera.viewportH), margin);
  }

  // Master render frame (runs at 60–120 FPS in requestAnimationFrame)
  render(time) {
    const ctx = this.ctx;
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;
    const dpr = this.dpr;
    const elapsedMs = this.lastFrameTime===null ? 1000/60 : Math.max(0, Math.min(100, time-this.lastFrameTime));
    this.lastFrameTime = time;
    this.frameUnits = elapsedMs / (1000/60);
    this.renderedEntities = this.observation.sample(time);
    const currentList = Array.from(this.renderedEntities.values());

    // Reset transform & scale for DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Camera glide & entity tracking
    if (this.camera.trackedEntityId) {
      const tracked = this.renderedEntities.get(this.camera.trackedEntityId);
      if (tracked) {
        this.camera.targetX = tracked.x;
        this.camera.targetY = tracked.y;
      }
    }

    const gain = followGain(elapsedMs, this.camera.trackedEntityId ? 120 : 180);
    this.camera.x += (this.camera.targetX - this.camera.x) * gain;
    this.camera.y += (this.camera.targetY - this.camera.y) * gain;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * gain;

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

    // 3.1. Deep oceanic living fluid baseline (guarantees vibrant oceanic blue from frame 1)
    const fluidGrad = ctx.createRadialGradient(chScreenX, chScreenY, chScreenR * 0.05, chScreenX, chScreenY, chScreenR);
    fluidGrad.addColorStop(0, '#042845');
    fluidGrad.addColorStop(0.55, '#02182b');
    fluidGrad.addColorStop(1.0, '#010c18');
    ctx.fillStyle = fluidGrad;
    ctx.fillRect(chScreenX - chScreenR, chScreenY - chScreenR, chScreenR * 2, chScreenR * 2);
    ctx.globalAlpha=0.15;
    ctx.drawImage(this.habitatCanvas,toScreenX(0),toScreenY(0),this.worldSize*camZoom,this.worldSize*camZoom);
    ctx.globalAlpha=1;

    // 3.2. Continuous living chemical substrate & reef matrix
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = this.isLabMode ? 0.70 : 0.42;
    
    const wsPix = this.worldSize * camZoom;
    const originX = toScreenX(0);
    const originY = toScreenY(0);

    ctx.drawImage(this.thumbCanvas, originX, originY, wsPix, wsPix);

    // Bioluminescent mineral bloom for calcified coral structures
    if (this.hasReefs && !this.isLabMode) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.12;
      ctx.drawImage(this.thumbCanvas, originX, originY, wsPix, wsPix);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 3.25. Living Benthic Algae Isles & Sanctuaries (Emerald phytobenthic thickets)
    ctx.globalAlpha = 1;
    this.drawAlgaeIsles(ctx, toScreenX, toScreenY, camZoom, time);

    // 3.3. Initial synchronization indicator if live entities have not yet streamed
    if (this.currEntities.size === 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.005);
      ctx.fillStyle = `rgba(56, 189, 248, ${(0.40 + pulse * 0.35).toFixed(2)})`;
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const isRu = (window.aetheonApp && window.aetheonApp.i18n && window.aetheonApp.i18n.getLang() === 'ru');
      ctx.fillText(isRu ? '◈ Синхронизация с биосферой капли...' : '◈ Synchronizing with living droplet...', chScreenX, chScreenY);
    }
    ctx.restore();

    // 4. Render Hydrothermal Vents (Modulated by Planetary Climate)
    const ventScale = this.worldSize / this.gridSize;
    for (let i = 0; i < this.vents.length; i++) {
      const vent = this.vents[i];
      const vFactor = (this.climate && this.climate.vents && this.climate.vents[i]) ? this.climate.vents[i] : 1.0;
      const vx = toScreenX(vent.x * ventScale);
      const vy = toScreenY(vent.y * ventScale);
      const vr = vent.radius * ventScale * camZoom * 1.5 * Math.sqrt(vFactor);

      const grad = ctx.createRadialGradient(vx, vy, 0, vx, vy, vr * 2);
      const hDeg = Math.round(vent.hue * 360);
      grad.addColorStop(0, `hsla(${hDeg}, 90%, 65%, ${(0.35 * Math.min(1.5, vFactor)).toFixed(2)})`);
      grad.addColorStop(0.5, `hsla(${hDeg}, 80%, 45%, ${(0.12 * Math.min(1.5, vFactor)).toFixed(2)})`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vx, vy, vr * 2, 0, Math.PI * 2);
      ctx.fill();

      // Convective thermal shimmer wave for surging vents
      if (vFactor > 1.05) {
        const pulseR = vr * (1.2 + 0.35 * Math.sin(time * 0.005 + i));
        ctx.strokeStyle = `hsla(${hDeg}, 95%, 75%, ${(0.22 * Math.min(1.0, vFactor - 1.0)).toFixed(2)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(vx, vy, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ephemeral benthic fumaroles: eruptive pulse rings and sparkling plume halo
      if (vent.isEphemeral) {
        const fumPulse = vr * (1.15 + 0.35 * Math.sin(time * 0.007 + i * 2.1));
        ctx.strokeStyle = `hsla(${hDeg}, 95%, 85%, ${(0.45 * (vent.intensity || 1.0)).toFixed(2)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(vx, vy, fumPulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `hsla(${hDeg}, 90%, 95%, ${(0.25 * (vent.intensity || 1.0)).toFixed(2)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(vx, vy, fumPulse * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Vent core orifice
      ctx.fillStyle = `hsla(${hDeg}, 95%, 75%, ${(0.80 * Math.min(1.2, vFactor)).toFixed(2)})`;
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
    const detailedList=currentList.filter(o=>this.inObservationArea(toScreenX(o.x),toScreenY(o.y),o.size*camZoom));
    this.particles.advance(elapsedMs, detailedList);
    this.particles.draw(ctx, this.camera, this.focusEnabled ? focusGeometry(w,h) : null);

    // 7. Render Organisms
    let detailed=0, peripheral=0;
    for (let i = 0; i < currentList.length; i++) {
      const curr = currentList[i];
      const sx = toScreenX(curr.x);
      const sy = toScreenY(curr.y);

      // Cull offscreen entities
      const radius = curr.size * camZoom;
      if (sx < -radius * 2 || sx > w + radius * 2 || sy < -radius * 2 || sy > h + radius * 2) {
        continue;
      }

      const heading = curr.heading;
      const isSelected = this.camera.trackedEntityId === curr.id;
      if (!isSelected && !this.inObservationArea(sx,sy,radius)) {
        peripheral++;
        // Peripheral life is a cheap, muted silhouette. No morphology/glow/cilia work.
        ctx.fillStyle='rgba(110,151,153,.24)';
        ctx.beginPath();ctx.arc(sx,sy,Math.max(1,radius*.65),0,Math.PI*2);ctx.fill();
      } else {
        detailed++;
        this.drawOrganism(ctx, sx, sy, radius, curr, heading, isSelected, time);
      }
    }
    this.observationStats={detailed,peripheral};

    // 7.2. Colony Intercellular Bonds (Multicellular Membrane Filaments)
    if (this.colonyBonds.length > 0) {
      this.renderColonyBonds(ctx, toScreenX, toScreenY, camZoom, time);
    }

    // 7.5. Render Nutrient Blooms & Floating Phytomanna Spores
    this.renderFoodBlooms(ctx, toScreenX, toScreenY, camZoom, time, currentList);

    // 8. Render Interaction Ripples
    for (let r = this.ripples.length - 1; r >= 0; r--) {
      const rip = this.ripples[r];
      rip.r += 1.8 * this.frameUnits;
      rip.alpha -= 0.025 * this.frameUnits;

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
      this.drawLabEntityOverlay(ctx, detailedList, toScreenX, toScreenY, 1);
    }
    if(this.focusEnabled) {
      const f=focusGeometry(w,h),shade=ctx.createRadialGradient(f.x,f.y,f.radius*.76,f.x,f.y,f.radius*1.22);
      shade.addColorStop(0,'rgba(2,8,16,0)');shade.addColorStop(.6,'rgba(2,8,16,.40)');shade.addColorStop(1,'rgba(2,8,16,.82)');
      ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(141,203,209,.13)';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);ctx.stroke();
    }
  }

  // Draw vibrant benthic algae isles with swaying fronds, radial filaments, and oxygen bubbles
  drawAlgaeIsles(ctx, toScreenX, toScreenY, camZoom, time) {
    if (!this.algaeIsles || this.algaeIsles.length === 0) return;

    for (let i = 0; i < this.algaeIsles.length; i++) {
      const isle = this.algaeIsles[i];
      const sx = toScreenX(isle.x);
      const sy = toScreenY(isle.y);
      const sr = isle.r * camZoom;

      if (sr < 2.0 || sx+sr*1.3<0 || sy+sr*1.3<0 || sx-sr*1.3>this.camera.viewportW || sy-sr*1.3>this.camera.viewportH) continue;
      const detailed=this.inObservationArea(sx,sy,sr);
      if(!detailed) {
        ctx.fillStyle='rgba(70,113,100,.18)';ctx.beginPath();ctx.arc(sx,sy,sr*.7,0,Math.PI*2);ctx.fill();continue;
      }

      const hDeg = Math.round((isle.h !== undefined ? isle.h : 0.40) * 360);
      const density = isle.d !== undefined ? isle.d : 0.85;

      // 1. Soft benthic chlorophyll bed (lush emerald halo)
      const grad = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr * 1.25);
      grad.addColorStop(0, `hsla(${hDeg}, 85%, 45%, ${(0.45 * density).toFixed(2)})`);
      grad.addColorStop(0.65, `hsla(${hDeg}, 80%, 35%, ${(0.22 * density).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // 2. Micro-fronds & swaying kelp filaments (visible at intermediate & high detail)
      if (sr > 10.0) {
        const frondCount = isle.f || 12;
        ctx.strokeStyle = `hsla(${hDeg}, 92%, 68%, ${(0.65 * density).toFixed(2)})`;
        ctx.lineWidth = Math.max(1.0, 1.5 * camZoom);
        ctx.lineCap = 'round';

        ctx.beginPath();
        for (let f = 0; f < frondCount; f++) {
          const angle = (f / frondCount) * Math.PI * 2 + (isle.id * 0.4);
          const frondLen = sr * (0.35 + 0.65 * (isle.height??0.65)) * (0.8 + 0.2 * Math.sin(f * 1.7 + isle.id));
          const wave = Math.sin(time * 0.003 + f * 0.8 + isle.id) * (sr * 0.22);

          const cx1 = sx + Math.cos(angle) * (sr * 0.22);
          const cy1 = sy + Math.sin(angle) * (sr * 0.22);

          const midX = sx + Math.cos(angle) * (frondLen * 0.6) + Math.cos(angle + Math.PI * 0.5) * wave;
          const midY = sy + Math.sin(angle) * (frondLen * 0.6) + Math.sin(angle + Math.PI * 0.5) * wave;

          const tipX = sx + Math.cos(angle) * frondLen + Math.cos(angle + Math.PI * 0.5) * (wave * 1.5);
          const tipY = sy + Math.sin(angle) * frondLen + Math.sin(angle + Math.PI * 0.5) * (wave * 1.5);

          ctx.moveTo(cx1, cy1);
          ctx.quadraticCurveTo(midX, midY, tipX, tipY);
          const branching=isle.branching??0.5;
          if(branching>0.28) for(let b=1;b<=2+Math.round(branching*2);b++) {
            const t=b/6,bx=cx1+(tipX-cx1)*t,by=cy1+(tipY-cy1)*t;
            const leaf=frondLen*0.2*branching;
            for(const side of [-1,1]) {
              ctx.moveTo(bx,by);
              ctx.quadraticCurveTo(bx+Math.cos(angle+side*1.2)*leaf,by+Math.sin(angle+side*1.2)*leaf,
                bx+Math.cos(angle+side*0.65)*leaf*1.4,by+Math.sin(angle+side*0.65)*leaf*1.4);
            }
          }
        }
        ctx.stroke();

        // 3. Bioluminescent oxygen / spore nodes
        ctx.fillStyle = `hsla(${hDeg+35},95%,75%,${density})`;
        for (let s = 0; s < 4; s++) {
          const sporeAngle = s * 1.57 + (time * 0.0006 + isle.id);
          const sporeDist = sr * (0.35 + 0.45 * Math.sin(time * 0.002 + s));
          const spX = sx + Math.cos(sporeAngle) * sporeDist;
          const spY = sy + Math.sin(sporeAngle) * sporeDist;
          ctx.beginPath();
          ctx.arc(spX, spY, Math.max(1.0, 1.4 * camZoom), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Render organic soft-body Aetheobiont with translucent membrane, species-specific morphotype, markings, and cilia
  drawOrganism(ctx, x, y, r, org, heading, isSelected, time, forceDetail = false) {
    const isPiloted = this.pilotedIds && (this.pilotedIds.has(org.id) || this.pilotedIds.has(Number(org.id)));
    const pulse = Math.sin(org.phase ?? (time*0.008+org.id)) * 0.08;
    const bodyR = Math.max(1.8, r * (1.0 + pulse));
    const hue = Math.round(org.hue * 360);
    const speed = Math.sqrt((org.vx || 0) * (org.vx || 0) + (org.vy || 0) * (org.vy || 0));
    const morph = getSpeciesMorphology(org.speciesId || 1, org.hue, org.carnivory || 0.1, org.size || 7, speed, org.anatomy);
    const isHunter = morph.isHunter;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);

    // =========================================================================
    // OPTICAL LOD TIER 0: Zoomed-out Microscopic Spores (bodyR < 4.8px)
    // Renders as a lightweight glowing bioluminescent spore with core nucleus.
    // Skips 20+ heavy Canvas path calls, bezier ribs, gradients, and cilia.
    // (Bypassed if forceDetail = true for high-res landscape snapshots)
    // =========================================================================
    if (bodyR < 4.8 && !isSelected && !isPiloted && !forceDetail) {
      const haloR = bodyR * (isHunter ? 2.4 : 1.9);

      // 1. Soft glowing halo
      ctx.fillStyle = `hsla(${hue}, ${isHunter ? '95%' : '80%'}, ${isHunter ? '55%' : '50%'}, 0.32)`;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Body membrane disc
      ctx.fillStyle = isHunter ? `hsla(${hue}, 90%, 46%, 0.88)` : `hsla(${hue}, 78%, 42%, 0.82)`;
      ctx.beginPath();
      ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
      ctx.fill();

      // 3. Bright nucleus
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.8, bodyR * 0.35), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    const rx = bodyR * morph.aspectX;
    const ry = bodyR * morph.aspectY;
    const isHighDetail = (bodyR >= 8.5) || isSelected || isPiloted || forceDetail;

    // A. Bioluminescent Halo
    const haloR = Math.max(rx, ry) * (isHunter ? 2.4 : 2.0);
    if (bodyR > 3.5 || isHunter) {
      const glowGrad = ctx.createRadialGradient(0, 0, bodyR * 0.4, 0, 0, haloR);
      glowGrad.addColorStop(0, `hsla(${hue}, 95%, ${isHunter ? '55%' : '50%'}, ${isHunter ? '0.35' : '0.22'})`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.fill();
    }

    // B. Trailing Propulsion Flagellum (whip)
    drawFlagellum(ctx, rx, ry, morph, speed, time, org.id);

    // C. Forward Sensory Antennules (only at high detail)
    if (isHighDetail) {
      drawAntennae(ctx, rx, ry, morph, time, org.id);
    }

    // D. Beating Cilia (whipping hairs along perimeter) - Only at high detail
    if (isHighDetail && bodyR > 4.5) {
      const ciliaCount = 4 + Math.round(morph.flagella*10);
      ctx.strokeStyle = `hsla(${hue}, 85%, 75%, 0.45)`;
      ctx.lineWidth = isHunter ? 1.3 : 1.0;
      ctx.beginPath();
      for (let c = 0; c < ciliaCount; c++) {
        const angle = (c / ciliaCount) * Math.PI * 2;
        const wave = Math.sin(time * 0.007 + angle * 3.0 + org.id) * (bodyR * 0.3);
        const ciliaLen = bodyR * (isHunter ? 0.48 : 0.38) + wave;

        const cx1 = Math.cos(angle) * (rx * 0.95);
        const cy1 = Math.sin(angle) * (ry * 0.95);
        const cx2 = Math.cos(angle) * (rx * 0.95 + ciliaLen);
        const cy2 = Math.sin(angle) * (ry * 0.95 + ciliaLen);

        ctx.moveTo(cx1, cy1);
        ctx.lineTo(cx2, cy2);
      }
      ctx.stroke();
    }

    // E. Translucent Viscoelastic Membrane
    ctx.fillStyle = isHunter ? `hsla(${hue}, 85%, 35%, 0.72)` : `hsla(${hue}, 75%, 35%, 0.65)`;
    ctx.strokeStyle = `hsla(${hue}, 95%, 72%, 0.90)`;
    ctx.lineWidth = 1 + morph.shell * 2.4;

    drawCellMembranePath(ctx, morph.shape, rx, ry, time, org.id);
    ctx.fill();

    // E.1. Nomarski DIC (Differential Interference Contrast) Optical Relief - Only at high detail
    if (isHighDetail && bodyR > 5.5) {
      const dicGrad = ctx.createLinearGradient(-rx * 0.75, -ry * 0.75, rx * 0.75, ry * 0.75);
      dicGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)'); // Upper-left refractive highlight
      dicGrad.addColorStop(0.38, 'transparent');
      dicGrad.addColorStop(0.68, 'transparent');
      dicGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');       // Lower-right differential shadow
      ctx.fillStyle = dicGrad;
      drawCellMembranePath(ctx, morph.shape, rx, ry, time, org.id);
      ctx.fill();
    }

    ctx.stroke();

    // F. Predatory Rostrum & Mandibles (Apex Hunter) - Only at high detail
    if (isHunter && isHighDetail) {
      ctx.fillStyle = `hsla(${morph.accentHue}, 100%, 70%, 0.95)`;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0;

      // Front predatory jaw spike
      ctx.beginPath();
      ctx.moveTo(rx * 0.85, -ry * 0.35);
      ctx.lineTo(rx + bodyR * 0.45, 0);
      ctx.lineTo(rx * 0.85, ry * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lateral hunting thorns
      ctx.beginPath();
      ctx.moveTo(rx * 0.2, -ry * 0.95);
      ctx.lineTo(rx * 0.5, -ry * 1.35);
      ctx.lineTo(rx * 0.4, -ry * 0.8);
      ctx.moveTo(rx * 0.2, ry * 0.95);
      ctx.lineTo(rx * 0.5, ry * 1.35);
      ctx.lineTo(rx * 0.4, ry * 0.8);
      ctx.fill();
    }

    // G. Distinctive Phenotypic Markings - Only at high detail
    if (isHighDetail) {
      drawCellMarkings(ctx, morph, rx, ry, hue, time, org.id);
    }

    // H. Internal Organelles & Nucleus
    ctx.fillStyle = `hsla(${(hue + 40) % 360}, 90%, 75%, 0.85)`;
    ctx.beginPath();
    ctx.arc(-rx * 0.22, 0, bodyR * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Core nucleolus
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-rx * 0.22, 0, bodyR * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // I. Targeting Reticle (if selected in Inspector or tracked from Codex)
    if (isSelected) {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      const targetR = Math.max(rx, ry) * 1.7;
      
      ctx.beginPath();
      ctx.arc(0, 0, targetR, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(-targetR - 5, 0); ctx.lineTo(-targetR + 5, 0);
      ctx.moveTo(targetR - 5, 0); ctx.lineTo(targetR + 5, 0);
      ctx.moveTo(0, -targetR - 5); ctx.lineTo(0, -targetR + 5);
      ctx.moveTo(0, targetR - 5); ctx.lineTo(0, targetR + 5);
      ctx.stroke();
    }

    // J. Piloted by Human Visitor Indicator (Dual Quantum Holographic Rings)
    if (isPiloted) {
      const rotAngle = time * 0.003;
      const beaconR = Math.max(rx, ry) * (1.85 + Math.sin(time * 0.008) * 0.15);

      ctx.save();
      ctx.rotate(rotAngle);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, beaconR, 0, Math.PI * 2);
      ctx.stroke();

      // Inner counter-rotating violet ring
      ctx.rotate(-rotAngle * 2.2);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, beaconR * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Orbiting beacon ticks
      for (let p = 0; p < 4; p++) {
        const pAng = rotAngle + (p * Math.PI * 0.5);
        const px = Math.cos(pAng) * beaconR;
        const py = Math.sin(pAng) * beaconR;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // If piloted, draw sleek unrotated overhead badge so it's always readable
    if (isPiloted) {
      ctx.save();
      const badgeY = y - Math.max(rx, ry) * 1.8 - 14;
      ctx.font = '600 10px monospace';
      const label = '👤 ПИЛОТ';
      const textW = ctx.measureText(label).width;
      const padX = 6;
      const padY = 3;
      const bW = textW + padX * 2;
      const bH = 16;
      const bX = x - bW * 0.5;
      const bY = badgeY - bH * 0.5;

      ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bX, bY, bW, bH, 4);
      } else {
        ctx.rect(bX, bY, bW, bH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, badgeY);
      ctx.restore();
    }
  }

  // Render intercellular membrane bonds between organisms in multicellular colonies
  renderColonyBonds(ctx, toScreenX, toScreenY, camZoom, time) {
    const w = this.camera.viewportW;
    const h = this.camera.viewportH;
    const bonds = this.colonyBonds;
    if (!bonds || bonds.length === 0) return;

    ctx.save();

    // Count bonds per organism for collective glow detection
    const bondCountMap = new Map();
    for (let i = 0; i < bonds.length; i++) {
      const bond = bonds[i];
      bondCountMap.set(bond.a, (bondCountMap.get(bond.a) || 0) + 1);
      bondCountMap.set(bond.b, (bondCountMap.get(bond.b) || 0) + 1);
    }

    // Sort bonds by distance to camera center for LOD
    const centerSX = w * 0.5;
    const centerSY = h * 0.5;
    const bondData = [];

    for (let i = 0; i < bonds.length; i++) {
      const bond = bonds[i];
      const orgA = this.renderedEntities.get(bond.a);
      const orgB = this.renderedEntities.get(bond.b);
      if (!orgA || !orgB) continue;

      const ax = toScreenX(orgA.x);
      const ay = toScreenY(orgA.y);
      const bx = toScreenX(orgB.x);
      const by = toScreenY(orgB.y);

      // Cull bonds entirely offscreen
      const midX = (ax + bx) * 0.5;
      const midY = (ay + by) * 0.5;
      if (midX < -100 || midX > w + 100 || midY < -100 || midY > h + 100) continue;
      if(!this.inObservationArea(midX,midY,30)) continue;

      const distToCenter = Math.hypot(midX - centerSX, midY - centerSY);
      bondData.push({ orgA, orgB, ax, ay, bx, by, midX, midY, distToCenter });
    }

    // Sort by distance to center
    bondData.sort((a, b) => a.distToCenter - b.distToCenter);
    const maxDetailed = 40;

    // Pass 1: Batch draw all basic membrane filaments
    ctx.lineWidth = Math.max(1.2, 1.8 * camZoom);
    ctx.lineCap = 'round';

    for (let i = 0; i < bondData.length; i++) {
      const bd = bondData[i];
      const avgHue = Math.round(((bd.orgA.hue + bd.orgB.hue) * 0.5) * 360);

      // Organic undulating bezier curve
      const dx = bd.bx - bd.ax;
      const dy = bd.by - bd.ay;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist; // perpendicular
      const ny = dx / dist;
      const wave = Math.sin(time * 0.004 + bd.orgA.id * 0.7) * Math.min(12, dist * 0.15);

      const cpx = bd.midX + nx * wave;
      const cpy = bd.midY + ny * wave;

      // Membrane glow
      ctx.strokeStyle = `hsla(${avgHue}, 80%, 60%, 0.35)`;
      ctx.lineWidth = Math.max(2.5, 3.5 * camZoom);
      ctx.beginPath();
      ctx.moveTo(bd.ax, bd.ay);
      ctx.quadraticCurveTo(cpx, cpy, bd.bx, bd.by);
      ctx.stroke();

      // Core filament
      ctx.strokeStyle = `hsla(${avgHue}, 90%, 75%, 0.55)`;
      ctx.lineWidth = Math.max(1.0, 1.5 * camZoom);
      ctx.beginPath();
      ctx.moveTo(bd.ax, bd.ay);
      ctx.quadraticCurveTo(cpx, cpy, bd.bx, bd.by);
      ctx.stroke();

      // Pass 2: Animated cytoplasmic flow dots (detailed, nearest bonds only)
      if (i < maxDetailed && dist > 8) {
        const dotCount = Math.min(4, Math.max(2, Math.floor(dist / 20)));
        for (let d = 0; d < dotCount; d++) {
          // Parametric position along bezier, animated
          const baseT = (d + 1) / (dotCount + 1);
          const flowT = (baseT + (time * 0.0008 + bd.orgA.id * 0.3) % 1.0) % 1.0;

          // Quadratic bezier point
          const t1 = 1 - flowT;
          const px = t1 * t1 * bd.ax + 2 * t1 * flowT * cpx + flowT * flowT * bd.bx;
          const py = t1 * t1 * bd.ay + 2 * t1 * flowT * cpy + flowT * flowT * bd.by;

          const dotR = Math.max(1.2, 2.0 * camZoom);
          ctx.fillStyle = `hsla(${(avgHue + 30) % 360}, 95%, 85%, 0.75)`;
          ctx.beginPath();
          ctx.arc(px, py, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Collective colony glow for organisms with 3+ bonds
      if (i < maxDetailed) {
        const countA = bondCountMap.get(bd.orgA.id) || 0;
        const countB = bondCountMap.get(bd.orgB.id) || 0;
        if (countA >= 3 || countB >= 3) {
          const glowOrg = countA >= countB ? bd.orgA : bd.orgB;
          const gx = countA >= countB ? bd.ax : bd.bx;
          const gy = countA >= countB ? bd.ay : bd.by;
          const glowR = Math.max(15, glowOrg.size * camZoom * 2.5);

          const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
          const glowHue = Math.round(glowOrg.hue * 360);
          grad.addColorStop(0, `hsla(${glowHue}, 90%, 70%, 0.18)`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(gx, gy, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Lab mode: colony bond telemetry labels
    if (this.isLabMode && bondData.length > 0) {
      ctx.font = '8px "JetBrains Mono", monospace';
      const labelLimit = Math.min(8, bondData.length);
      for (let i = 0; i < labelLimit; i++) {
        const bd = bondData[i];
        const label = `[BOND] Sp.${bd.orgA.speciesId}↔Sp.${bd.orgB.speciesId}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(6, 12, 26, 0.85)';
        ctx.fillRect(bd.midX - tw * 0.5 - 2, bd.midY - 6, tw + 4, 11);
        ctx.fillStyle = '#80ffcc';
        ctx.fillText(label, bd.midX - tw * 0.5, bd.midY + 3);
      }
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
      if(bx+br<0||by+br<0||bx-br>w||by-br>h||!this.inObservationArea(bx,by,br)) continue;

      // Soft ambient nutrient diffusion cloud or organic detritus cloud
      const isDetritus = (bloom.d === 1);
      const pulse = 1.0 + Math.sin(time * 0.005 + bloom.id) * 0.08;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br * pulse);
      if (isDetritus) {
        // Organic detritus cloud (warm amber / lipid breakdown halo)
        grad.addColorStop(0, 'rgba(245, 158, 11, 0.32)');
        grad.addColorStop(0.48, 'rgba(217, 119, 6, 0.12)');
        grad.addColorStop(1, 'transparent');
      } else {
        // Algal chlorophyll nutrient bloom
        grad.addColorStop(0, 'rgba(163, 230, 53, 0.25)');
        grad.addColorStop(0.5, 'rgba(132, 204, 22, 0.09)');
        grad.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, br * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Lab Mode Scientific HUD Reticle
      if (this.isLabMode) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.strokeStyle = isDetritus ? 'rgba(245, 158, 11, 0.75)' : 'rgba(163, 230, 53, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();

        ctx.setLineDash([]);
        // Center reticle
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = isDetritus ? '#f59e0b' : '#bef264';
        ctx.fill();

        // Label
        ctx.font = '9px "JetBrains Mono", monospace';
        const label = isDetritus
          ? `☠ ORGANIC DETRITUS [${Math.round(bloom.e)} cal] • NECROMASS`
          : `✦ NUTRIENT BLOOM [${Math.round(bloom.e)} cal] • ACTIVE ATTRACTOR`;
        ctx.fillStyle = 'rgba(6, 18, 10, 0.85)';
        const tw = ctx.measureText(label).width;
        ctx.fillRect(bx - tw * 0.5 - 4, by - br - 16, tw + 8, 14);
        ctx.strokeStyle = isDetritus ? 'rgba(245, 158, 11, 0.7)' : 'rgba(163, 230, 53, 0.7)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx - tw * 0.5 - 4, by - br - 16, tw + 8, 14);

        ctx.fillStyle = isDetritus ? '#fcd34d' : '#bef264';
        ctx.fillText(label, bx - tw * 0.5, by - br - 6);
        ctx.restore();
      }

      // Maintain floating particles around active bloom
      if (this.foodParticles.length < 24 && Math.random() < 1-Math.pow(.88,this.frameUnits)) {
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
          hue: isDetritus ? (0.10 + (Math.random() - 0.5) * 0.05) : (0.23 + (Math.random() - 0.5) * 0.06)
        });
      }
    }

    // B. Drifting Nutrient Spores Physics & Drawing
    for (let i = this.foodParticles.length - 1; i >= 0; i--) {
      const p = this.foodParticles[i];
      p.life+=this.frameUnits;
      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.foodParticles.splice(i, 1);
        continue;
      }

      // Physics damping & fluid drift
      p.vx *= Math.pow(.96,this.frameUnits);
      p.vy *= Math.pow(.96,this.frameUnits);
      const drift = time * 0.0012 + p.x * 0.01;
      p.x += (p.vx + Math.cos(drift) * 0.22)*this.frameUnits;
      p.y += (p.vy + Math.sin(drift) * 0.22)*this.frameUnits;

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

      // Grazing check against nearby organisms (optimized with fast bounding box check)
      let consumed = false;
      for (let o = 0; o < organisms.length; o++) {
        const org = organisms[o];
        const odx = org.x - p.x;
        if (odx > 28 || odx < -28) continue;
        const ody = org.y - p.y;
        if (ody > 28 || ody < -28) continue;
        const eatDist = (org.size + p.size) * 1.35;
        if (odx * odx + ody * ody < eatDist * eatDist) {
          consumed = true;
          if (Math.random() < 0.35) {
            this.addRipple(p.x, p.y, 'rgba(190, 242, 100, 0.75)', 24);
          }
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
      if(!this.inObservationArea(sx,sy))continue;

      // Opacity calculation (gentle fade in and fade out)
      const lifeRatio = p.life / p.maxLife;
      const fade = lifeRatio > 0.75 ? (1.0 - lifeRatio) / 0.25 : Math.min(1.0, p.life / 20);
      const alpha = p.alpha * fade;
      const sz = p.size * camZoom;

      // Bioluminescent Emerald Halo
      ctx.fillStyle = `rgba(132, 204, 22, ${(0.28 * alpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sz * 2.8, 0, Math.PI * 2);
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

    // 5. Dendritic Frost Crystals during Glacial Periods (Phase 3)
    if (this.climate && this.climate.frost > 0.5) {
      this.drawDendriticFrost(ctx, cx, cy, cr, zoom, this.climate.frost);
    }

    ctx.restore();
  }

  // Dendritic ice crystallization growing inward from the meniscus during glacial cooling
  drawDendriticFrost(ctx, cx, cy, cr, zoom, frost) {
    if (frost <= 0.5) return;

    ctx.save();
    const frostPix = frost * zoom;
    const spineCount = 64;
    const now = performance.now();

    // 1. Soft glacial ice-shelf halo ring
    const innerHaloR = Math.max(0, cr - frostPix * 1.15);
    const iceGrad = ctx.createRadialGradient(cx, cy, innerHaloR, cx, cy, cr);
    iceGrad.addColorStop(0, 'rgba(180, 240, 255, 0.0)');
    iceGrad.addColorStop(0.45, 'rgba(180, 245, 255, 0.14)');
    iceGrad.addColorStop(0.85, 'rgba(215, 250, 255, 0.36)');
    iceGrad.addColorStop(1.0, 'rgba(235, 255, 255, 0.55)');
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerHaloR, 0, Math.PI * 2, true);
    ctx.fill();

    // 2. Dendritic branching fractal needles
    ctx.lineCap = 'round';
    for (let k = 0; k < spineCount; k++) {
      const angle = (k / spineCount) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Procedural height noise with harmonic variations
      const noise = 0.72 + 0.28 * Math.sin(k * 4.3 + 1.1) + 0.14 * Math.sin(k * 8.9 + now * 0.001);
      const needleLen = frostPix * noise;
      if (needleLen < 2) continue;

      const baseX = cx + cosA * cr;
      const baseY = cy + sinA * cr;
      const tipX = cx + cosA * (cr - needleLen);
      const tipY = cy + sinA * (cr - needleLen);

      // Shimmering crystalline colors
      const shimmer = Math.sin(now * 0.003 + k * 1.7) * 0.15;
      ctx.strokeStyle = `rgba(224, 250, 255, ${(0.65 + shimmer).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.0, 1.6 * zoom);

      // Main needle
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Diamond-white needle tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(1.0, 1.4 * zoom), 0, Math.PI * 2);
      ctx.fill();

      // Lateral secondary branches at ±60° (hexagonal ice crystal lattice)
      if (needleLen > 12 * zoom) {
        const branchDist = needleLen * 0.45;
        const bMidX = cx + cosA * (cr - branchDist);
        const bMidY = cy + sinA * (cr - branchDist);
        const bLen = needleLen * 0.32;

        const ang1 = angle + Math.PI - Math.PI / 3;
        const ang2 = angle + Math.PI + Math.PI / 3;

        ctx.strokeStyle = `rgba(186, 230, 253, ${(0.45 + shimmer).toFixed(2)})`;
        ctx.lineWidth = Math.max(0.8, 1.1 * zoom);

        ctx.beginPath();
        ctx.moveTo(bMidX, bMidY);
        ctx.lineTo(bMidX + Math.cos(ang1) * bLen, bMidY + Math.sin(ang1) * bLen);
        ctx.moveTo(bMidX, bMidY);
        ctx.lineTo(bMidX + Math.cos(ang2) * bLen, bMidY + Math.sin(ang2) * bLen);
        ctx.stroke();
      }
    }
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
    ctx.fillText(`◈ PETRI BIO-CHAMBER: Ø ${Math.round(this.chamber.r*2)} μm [ACTIVE MENISCUS]`, cx - 135, cy - cr + 26);

    // 5. Hydrothermal Vents Isotherms in Lab Mode
    const ventScale = this.worldSize / this.gridSize;
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

    // 6. Dendritic Frost Crystals during Glacial Periods in Lab Mode
    if (this.climate && this.climate.frost > 0.5) {
      this.drawDendriticFrost(ctx, cx, cy, cr, zoom, this.climate.frost);
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

    if(!this.inObservationArea(screenX,screenY))return null;
    for (const org of this.renderedEntities.values()) {
      const sx = toScreenX(org.x);
      const sy = toScreenY(org.y);
      if(!this.inObservationArea(sx,sy))continue;
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

  // Convert world coordinates into screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.camera.x) * this.camera.zoom + this.camera.viewportW * 0.5,
      y: (worldY - this.camera.y) * this.camera.zoom + this.camera.viewportH * 0.5
    };
  }

  // Capture an authentic, high-resolution visual snapshot of the living droplet and its landscape
  // Capture high-fidelity authentic droplet landscape snapshot for Atlas & Journal (1:1 with live simulation)
  captureDropletSnapshot(targetSize = 560) {
    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = targetSize;
      snapCanvas.height = targetSize;
      const sCtx = snapCanvas.getContext('2d');
      if (!sCtx) return null;

      const time = performance.now();

      // 1. Dark abyssal void outside droplet
      sCtx.fillStyle = '#02040a';
      sCtx.fillRect(0, 0, targetSize, targetSize);

      const ch = this.chamber || { cx: OCEAN_GEOMETRY.cx, cy: OCEAN_GEOMETRY.cy, r: OCEAN_GEOMETRY.radius };
      const pad = 12;
      const center = targetSize * 0.5;
      const destR = center - pad;
      const scale = destR / ch.r;

      const toSnapX = (wx) => center + (wx - ch.cx) * scale;
      const toSnapY = (wy) => center + (wy - ch.cy) * scale;

      // 2. Circular clip for living fluid interior
      sCtx.save();
      sCtx.beginPath();
      sCtx.arc(center, center, destR, 0, Math.PI * 2);
      sCtx.clip();

      // 2.1. Deep oceanic living fluid baseline (exact match to live simulation)
      const fluidGrad = sCtx.createRadialGradient(center, center, destR * 0.05, center, center, destR);
      fluidGrad.addColorStop(0, '#042845');
      fluidGrad.addColorStop(0.55, '#02182b');
      fluidGrad.addColorStop(1.0, '#010c18');
      sCtx.fillStyle = fluidGrad;
      sCtx.fillRect(center - destR, center - destR, destR * 2, destR * 2);
      sCtx.globalAlpha=0.15;
      sCtx.drawImage(this.habitatCanvas,toSnapX(0),toSnapY(0),this.worldSize*scale,this.worldSize*scale);
      sCtx.globalAlpha=1;

      // 2.2. Living chemical substrate & reef matrix
      if (this.thumbCanvas) {
        sCtx.imageSmoothingEnabled = true;
        sCtx.imageSmoothingQuality = 'high';
        sCtx.globalAlpha = 0.42;
        const wsPix = (this.worldSize || OCEAN_GEOMETRY.worldSize) * scale;
        const originX = toSnapX(0);
        const originY = toSnapY(0);
        sCtx.drawImage(this.thumbCanvas, originX, originY, wsPix, wsPix);

        if (this.hasReefs) {
          sCtx.globalCompositeOperation = 'screen';
          sCtx.globalAlpha = 0.12;
          sCtx.drawImage(this.thumbCanvas, originX, originY, wsPix, wsPix);
          sCtx.globalCompositeOperation = 'source-over';
        }
        sCtx.globalAlpha = 1.0;
      }

      // 2.3. Hydrothermal Vents (Atmospheric thermal glow & bright orifice core)
      const ventScale = (this.worldSize || OCEAN_GEOMETRY.worldSize) / this.gridSize;
      const vents = this.vents || [];
      for (let i = 0; i < vents.length; i++) {
        const vent = vents[i];
        const vFactor = (this.climate && this.climate.vents && this.climate.vents[i]) ? this.climate.vents[i] : 1.0;
        const vx = toSnapX(vent.x * ventScale);
        const vy = toSnapY(vent.y * ventScale);
        const vr = (vent.radius || 7) * ventScale * scale * 1.5 * Math.sqrt(vFactor);
        const hDeg = Math.round((vent.hue !== undefined ? vent.hue : (i / 5)) * 360);

        const grad = sCtx.createRadialGradient(vx, vy, 0, vx, vy, vr * 2);
        grad.addColorStop(0, `hsla(${hDeg}, 90%, 65%, ${(0.35 * Math.min(1.5, vFactor)).toFixed(2)})`);
        grad.addColorStop(0.5, `hsla(${hDeg}, 80%, 45%, ${(0.12 * Math.min(1.5, vFactor)).toFixed(2)})`);
        grad.addColorStop(1, 'transparent');

        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.arc(vx, vy, vr * 2, 0, Math.PI * 2);
        sCtx.fill();

        // Convective thermal shimmer wave
        if (vFactor > 1.05) {
          const pulseR = vr * (1.2 + 0.35 * Math.sin(time * 0.005 + i));
          sCtx.strokeStyle = `hsla(${hDeg}, 95%, 75%, ${(0.22 * Math.min(1.0, vFactor - 1.0)).toFixed(2)})`;
          sCtx.lineWidth = 1.4;
          sCtx.beginPath();
          sCtx.arc(vx, vy, pulseR, 0, Math.PI * 2);
          sCtx.stroke();
        }

        // Vent core orifice
        sCtx.fillStyle = `hsla(${hDeg}, 95%, 75%, ${(0.80 * Math.min(1.2, vFactor)).toFixed(2)})`;
        sCtx.beginPath();
        sCtx.arc(vx, vy, Math.max(3, vr * 0.25), 0, Math.PI * 2);
        sCtx.fill();
      }

      sCtx.restore();

      // 3. Authentic Zen Meniscus (Surface tension refraction, dual rim, inner caustic highlight)
      this.drawZenMeniscus(sCtx, center, center, destR, targetSize, targetSize, scale);

      // 4. Floating Ambient Micro-Plankton / Phytomanna Spores
      if (this.particles && this.particles.x) {
        for (let p = 0; p < this.particles.count; p++) {
          const px = toSnapX(this.particles.x[p]);
          const py = toSnapY(this.particles.y[p]);
          const pDist = Math.hypot(px - center, py - center);
          if (pDist > destR - 4) continue;
          const pr = Math.max(0.6, (this.particles.size[p] || 1.2) * scale * 1.5);
          const pa = (this.particles.alpha[p] || 0.4) * 0.75;
          const ph = Math.round((this.particles.hue[p] || 0.5) * 360);
          sCtx.fillStyle = `hsla(${ph}, 75%, 70%, ${pa.toFixed(2)})`;
          sCtx.beginPath();
          sCtx.arc(px, py, pr, 0, Math.PI * 2);
          sCtx.fill();
        }
      }

      // 5. Active Nutrient Blooms & Detritus Clouds
      if (this.serverBlooms && this.serverBlooms.length > 0) {
        for (let b = 0; b < this.serverBlooms.length; b++) {
          const bloom = this.serverBlooms[b];
          const bx = toSnapX(bloom.x);
          const by = toSnapY(bloom.y);
          const br = Math.max(8, (bloom.r || 16) * scale);
          const isDetritus = (bloom.d === 1);
          const grad = sCtx.createRadialGradient(bx, by, 0, bx, by, br);
          if (isDetritus) {
            grad.addColorStop(0, 'rgba(245, 158, 11, 0.32)');
            grad.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)');
            grad.addColorStop(1, 'transparent');
          } else {
            grad.addColorStop(0, 'rgba(163, 230, 53, 0.25)');
            grad.addColorStop(0.5, 'rgba(132, 204, 22, 0.09)');
            grad.addColorStop(1, 'transparent');
          }
          sCtx.fillStyle = grad;
          sCtx.beginPath();
          sCtx.arc(bx, by, br, 0, Math.PI * 2);
          sCtx.fill();
        }
      }

      // 6. Intercellular Colony Membrane Bonds
      if (this.colonyBonds && this.colonyBonds.length > 0) {
        sCtx.strokeStyle = 'rgba(0, 240, 255, 0.50)';
        sCtx.lineWidth = 1.2;
        sCtx.beginPath();
        for (let b = 0; b < this.colonyBonds.length; b++) {
          const bond = this.colonyBonds[b];
          if (!bond) continue;
          const idA = bond.a !== undefined ? bond.a : bond[0];
          const idB = bond.b !== undefined ? bond.b : bond[1];
          const oA = this.currEntities.get(idA);
          const oB = this.currEntities.get(idB);
          if (oA && oB) {
            sCtx.moveTo(toSnapX(oA.x), toSnapY(oA.y));
            sCtx.lineTo(toSnapX(oB.x), toSnapY(oB.y));
          }
        }
        sCtx.stroke();
      }

      // 7. Living Organisms (Rendered via authentic drawOrganism with full morphology, flagella & halos)
      const entities = Array.from(this.currEntities.values());
      for (let i = 0; i < entities.length; i++) {
        const org = entities[i];
        const ox = toSnapX(org.x);
        const oy = toSnapY(org.y);
        const oRadius = Math.max(3.2, (org.size || 6.0) * scale * 1.55);
        const heading = (org.vx || org.vy) ? Math.atan2(org.vy, org.vx) : (org.heading || 0);

        this.drawOrganism(sCtx, ox, oy, oRadius, org, heading, false, time, true);
      }

      return snapCanvas.toDataURL('image/jpeg', 0.94);
    } catch (err) {
      console.warn('[OceanRenderer] captureDropletSnapshot error:', err);
      return null;
    }
  }
}
