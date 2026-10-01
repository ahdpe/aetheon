import { i18n } from '../i18n.js';

export class DiveCockpitHUD {
  constructor(diveEngine) {
    this.engine = diveEngine;
    this.container = document.getElementById('dive-cockpit-hud');
    
    // Internal state
    this.steerX = 0;
    this.steerY = 0;
    this.keys = { w: false, a: false, s: false, d: false, space: false };
    this.lookYaw = 0;
    this.lookPitch = 0;

    // Mobile touch tracking
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.lookTouchId = null;
    this.lastTouchPos = { x: 0, y: 0 };

    this.ciliaCanvas = null;
    this.ciliaCtx = null;

    this.setupDOM();
    this.setupCiliaCanvas();
    this.setupInputListeners();
  }

  setupDOM() {
    if (!this.container) return;
    this.container.innerHTML = `
      <!-- Organic Lipid Membrane Vignette & Microscope Lens Aberration -->
      <div class="dive-vignette" id="dive-vignette"></div>

      <!-- Undulating Translucent Cellular Cilia Fringe on Viewport Rim -->
      <canvas class="dive-cilia-canvas" id="dive-cilia-canvas"></canvas>

      <!-- Center Reticle / Microscopic Sight -->
      <div class="dive-reticle" id="dive-reticle">
        <div class="reticle-dot"></div>
        <div class="reticle-circle"></div>
      </div>

      <!-- Top Bio-Cockpit Header Bar -->
      <div class="dive-top-bar glass-panel">
        <div class="dive-target-info">
          <span class="dive-species-dot" id="dive-species-dot"></span>
          <div>
            <div class="dive-species-title" id="dive-species-title">Aethenella luminosa</div>
            <div class="dive-species-sub" id="dive-species-sub">Luminous Grazer • Gen #42</div>
          </div>
        </div>

        <div class="dive-center-status">
          <span class="dive-trophic-pill" id="dive-trophic-pill">🌾 GRAZER</span>
          <span class="dive-threat-pill hidden" id="dive-threat-pill">⚠️ PREDATOR ALERT</span>
        </div>

        <div class="dive-header-actions">
          <button class="dive-exit-btn" id="dive-exit-btn" title="Exit to Orbit (ESC)">
            <span class="exit-icon">🛰️</span>
            <span class="exit-text" data-i18n="dive_exit">Всплыть (ESC)</span>
          </button>
        </div>
      </div>

      <!-- Chemical Gradient Compass (Navigating to Hydrothermal Hearth) -->
      <div class="dive-compass-wrap glass-panel" id="dive-compass-wrap">
        <div class="compass-label" data-i18n="chemotaxis_sensor">ХЕМОТАКСИС</div>
        <div class="compass-dial" id="dive-compass-dial">
          <div class="compass-needle" id="dive-compass-needle">▲</div>
        </div>
        <div class="compass-dist" id="dive-compass-dist">48 μm</div>
      </div>

      <!-- Control Key Hints (Desktop) -->
      <div class="dive-controls-hint glass-panel" id="dive-controls-hint">
        <span class="hint-key">WASD</span> <span data-i18n="dive_steer">Руление</span> • 
        <span class="hint-key">Мышь</span> <span data-i18n="dive_look">Обзор</span> • 
        <span class="hint-key">SPACE</span> <span data-i18n="dive_boost">Импульс</span> • 
        <span class="hint-key">F</span> <span data-i18n="dive_feed">Кормить</span>
      </div>

      <!-- Bottom Vitals Bar (Energy, Kuramoto rhythm, Speed) -->
      <div class="dive-bottom-bar glass-panel">
        <div class="dive-vital-item">
          <span class="vital-label" data-i18n="energy">ATP / ЭНЕРГИЯ</span>
          <div class="dive-energy-track">
            <div class="dive-energy-bar" id="dive-energy-bar" style="width: 80%;"></div>
          </div>
          <span class="vital-val" id="dive-energy-val">80%</span>
        </div>

        <div class="dive-vital-item">
          <span class="vital-label" data-i18n="ciliary_rhythm">РИТМ РЕСНИЧЕК</span>
          <div class="dive-kuramoto-pulse" id="dive-kuramoto-pulse">
            <span class="pulse-ring"></span>
            <span class="pulse-bpm" id="dive-kuramoto-bpm">1.8 Hz</span>
          </div>
        </div>

        <div class="dive-vital-item">
          <span class="vital-label" data-i18n="speed">СКОРОСТЬ</span>
          <span class="vital-val-mono" id="dive-speed-val">1.4 μm/s</span>
        </div>
      </div>

      <!-- Mobile Virtual Joystick (Touch devices) -->
      <div class="dive-joystick-zone" id="dive-joystick-zone">
        <div class="dive-joystick-base" id="dive-joystick-base">
          <div class="dive-joystick-knob" id="dive-joystick-knob"></div>
        </div>
      </div>

      <!-- Mobile Boost Button -->
      <button class="dive-mobile-boost-btn" id="dive-mobile-boost-btn" title="Boost">
        ⚡
      </button>

      <!-- Cinematic Event Flash Overlays -->
      <div class="dive-event-overlay" id="dive-event-overlay"></div>
    `;

    this.exitBtn = document.getElementById('dive-exit-btn');
    this.exitBtn?.addEventListener('click', () => {
      this.engine.exit();
    });

    const boostBtn = document.getElementById('dive-mobile-boost-btn');
    boostBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.engine.triggerBoost();
    });
  }

  setupCiliaCanvas() {
    this.ciliaCanvas = document.getElementById('dive-cilia-canvas');
    if (!this.ciliaCanvas) return;
    this.ciliaCtx = this.ciliaCanvas.getContext('2d');
    this.resizeCiliaCanvas();
    window.addEventListener('resize', () => this.resizeCiliaCanvas());
  }

  resizeCiliaCanvas() {
    if (!this.ciliaCanvas) return;
    this.ciliaCanvas.width = window.innerWidth;
    this.ciliaCanvas.height = window.innerHeight;
  }

  // Draw beating translucent cilia along the edges of the screen in sync with Kuramoto phase
  drawCilia(phase, speed) {
    if (!this.ciliaCtx || !this.ciliaCanvas) return;
    const ctx = this.ciliaCtx;
    const w = this.ciliaCanvas.width;
    const h = this.ciliaCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const ciliaCount = 56;
    const baseLength = 28 + Math.min(22, speed * 8.0);
    const strokeCol = 'rgba(0, 240, 255, 0.28)';

    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';

    // Draw around the 4 borders of the screen
    for (let i = 0; i < ciliaCount; i++) {
      const frac = i / ciliaCount;
      const ciliaPhase = phase + frac * Math.PI * 4;
      const wave = Math.sin(ciliaPhase) * 14.0;

      let sx = 0, sy = 0, ex = 0, ey = 0;

      if (frac < 0.25) {
        // Top edge
        const t = frac / 0.25;
        sx = t * w;
        sy = 0;
        ex = sx + wave;
        ey = baseLength + Math.abs(Math.sin(ciliaPhase)) * 8;
      } else if (frac < 0.5) {
        // Right edge
        const t = (frac - 0.25) / 0.25;
        sx = w;
        sy = t * h;
        ex = w - (baseLength + Math.abs(Math.sin(ciliaPhase)) * 8);
        ey = sy + wave;
      } else if (frac < 0.75) {
        // Bottom edge
        const t = (frac - 0.5) / 0.25;
        sx = (1 - t) * w;
        sy = h;
        ex = sx - wave;
        ey = h - (baseLength + Math.abs(Math.sin(ciliaPhase)) * 8);
      } else {
        // Left edge
        const t = (frac - 0.75) / 0.25;
        sx = 0;
        sy = (1 - t) * h;
        ex = baseLength + Math.abs(Math.sin(ciliaPhase)) * 8;
        ey = sy - wave;
      }

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) * 0.5 + wave * 0.5, (sy + ey) * 0.5, ex, ey);
      ctx.stroke();
    }
  }

  setupInputListeners() {
    // 1. Keyboard WASD / Arrows
    window.addEventListener('keydown', (e) => {
      if (!this.engine.isActive) return;
      if (e.key === 'Escape') {
        this.engine.exit();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'ц' || e.key === 'ArrowUp') {
        this.keys.w = true;
        e.preventDefault();
      }
      if (k === 'a' || k === 'ф' || e.key === 'ArrowLeft') {
        this.keys.a = true;
        e.preventDefault();
      }
      if (k === 's' || k === 'ы' || e.key === 'ArrowDown') {
        this.keys.s = true;
        e.preventDefault();
      }
      if (k === 'd' || k === 'в' || e.key === 'ArrowRight') {
        this.keys.d = true;
        e.preventDefault();
      }
      if (e.key === ' ') {
        this.keys.space = true;
        this.engine.triggerBoost();
        e.preventDefault();
      }
      if (k === 'f' || k === 'а') {
        this.engine.triggerFeedDrop();
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.engine.isActive) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'ц' || e.key === 'ArrowUp') this.keys.w = false;
      if (k === 'a' || k === 'ф' || e.key === 'ArrowLeft') this.keys.a = false;
      if (k === 's' || k === 'ы' || e.key === 'ArrowDown') this.keys.s = false;
      if (k === 'd' || k === 'в' || e.key === 'ArrowRight') this.keys.d = false;
      if (e.key === ' ') this.keys.space = false;
    });

    // 2. Mouse Freelook Drag
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    window.addEventListener('mousedown', (e) => {
      if (!this.engine.isActive) return;
      if (e.target.closest('#dive-exit-btn') || e.target.closest('#dive-mobile-boost-btn')) return;
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.engine.isActive || !isMouseDown) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      this.lookYaw -= dx * 0.006;
      this.lookPitch = Math.max(-1.35, Math.min(1.35, this.lookPitch - dy * 0.004));
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    // 3. Mobile Touch Controls (Dual-zone: Left joystick, Right swipe look)
    const joyBase = document.getElementById('dive-joystick-base');
    const joyKnob = document.getElementById('dive-joystick-knob');

    window.addEventListener('touchstart', (e) => {
      if (!this.engine.isActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < window.innerWidth * 0.45 && !this.joystickActive) {
          // Left side: Joystick
          this.joystickActive = true;
          this.joystickTouchId = touch.identifier;
          this.joystickOrigin = { x: touch.clientX, y: touch.clientY };
          if (joyBase) {
            joyBase.style.display = 'block';
            joyBase.style.left = `${touch.clientX - 50}px`;
            joyBase.style.top = `${touch.clientY - 50}px`;
          }
        } else if (this.lookTouchId === null && touch.clientX >= window.innerWidth * 0.45) {
          // Right side: Swipe look
          this.lookTouchId = touch.identifier;
          this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!this.engine.isActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          const dx = touch.clientX - this.joystickOrigin.x;
          const dy = touch.clientY - this.joystickOrigin.y;
          const dist = Math.hypot(dx, dy);
          const maxR = 40;
          const clampedDist = Math.min(maxR, dist);
          const angle = Math.atan2(dy, dx);

          const kx = Math.cos(angle) * clampedDist;
          const ky = Math.sin(angle) * clampedDist;
          if (joyKnob) {
            joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
          }

          this.steerX = kx / maxR;
          this.steerY = ky / maxR;
        } else if (touch.identifier === this.lookTouchId) {
          const ldx = touch.clientX - this.lastTouchPos.x;
          const ldy = touch.clientY - this.lastTouchPos.y;
          this.lastTouchPos = { x: touch.clientX, y: touch.clientY };

          this.lookYaw -= ldx * 0.007;
          this.lookPitch = Math.max(-1.35, Math.min(1.35, this.lookPitch - ldy * 0.005));
        }
      }
    }, { passive: true });

    const handleTouchEnd = (e) => {
      if (!this.engine.isActive) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.steerX = 0;
          this.steerY = 0;
          if (joyKnob) joyKnob.style.transform = 'translate(0, 0)';
          if (joyBase) joyBase.style.display = 'none';
        } else if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
    this.resizeCiliaCanvas();
    i18n.applyTranslations();
  }

  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
    this.keys = { w: false, a: false, s: false, d: false, space: false };
    this.steerX = 0;
    this.steerY = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
  }

  // Update telemetry display every frame
  update(org, currentHeading, nearestVent, nearestPredatorDist, time) {
    if (!org) return;
    const isRu = i18n.getLang() === 'ru';
    const totalYaw = currentHeading + this.lookYaw;

    // 1. Keyboard steering accumulation
    if (!this.joystickActive) {
      let sx = 0;
      let sy = 0;
      if (this.keys.w) {
        sx += Math.cos(totalYaw);
        sy += Math.sin(totalYaw);
      }
      if (this.keys.s) {
        sx -= Math.cos(totalYaw) * 0.6;
        sy -= Math.sin(totalYaw) * 0.6;
      }
      if (this.keys.a) {
        sx += Math.cos(totalYaw - Math.PI * 0.5) * 0.8;
        sy += Math.sin(totalYaw - Math.PI * 0.5) * 0.8;
      }
      if (this.keys.d) {
        sx += Math.cos(totalYaw + Math.PI * 0.5) * 0.8;
        sy += Math.sin(totalYaw + Math.PI * 0.5) * 0.8;
      }
      this.steerX = sx;
      this.steerY = sy;
    }

    // 2. Draw live beating cellular cilia
    const currentSpeed = Math.hypot(org.vx || 0, org.vy || 0);
    this.drawCilia(org.phase || (time * 0.005), currentSpeed);

    // 3. Telemetry DOM updates
    const title = document.getElementById('dive-species-title');
    const sub = document.getElementById('dive-species-sub');
    const dot = document.getElementById('dive-species-dot');
    const trophic = document.getElementById('dive-trophic-pill');
    const threat = document.getElementById('dive-threat-pill');
    const energyBar = document.getElementById('dive-energy-bar');
    const energyVal = document.getElementById('dive-energy-val');
    const bpmVal = document.getElementById('dive-kuramoto-bpm');
    const speedVal = document.getElementById('dive-speed-val');
    const compassNeedle = document.getElementById('dive-compass-needle');
    const compassDist = document.getElementById('dive-compass-dist');

    const hue = Math.round((org.hue || 0.5) * 360);
    if (dot) {
      dot.style.background = `hsl(${hue}, 95%, 60%)`;
      dot.style.boxShadow = `0 0 10px hsl(${hue}, 95%, 60%)`;
    }

    const app = this.engine.app;
    const lastProf = app?.inspector?.lastProfile;
    const isMatchingProf = lastProf && lastProf.id === org.id;

    // Look up species info from codex cache or lastProfile
    const sp = isMatchingProf 
      ? lastProf 
      : app?.codexModal?.allSpecies?.find(s => s.id === org.speciesId);

    const latinName = sp ? (sp.nameLa || sp.speciesName || `Species #${org.speciesId}`) : `Aetheobiont #${org.speciesId || 1}`;
    const commonName = isRu 
      ? (sp?.nameRu || sp?.speciesNameRu || 'Эфиробионт') 
      : (sp?.nameEn || sp?.speciesNameEn || 'Aetheobiont');
    const gen = isMatchingProf ? (lastProf.generation || 1) : 1;

    if (title) title.textContent = latinName;
    if (sub) {
      sub.textContent = `${commonName} • ${isRu ? 'Поколение' : 'Gen'} #${gen}`;
    }

    if (trophic) {
      if (org.carnivory > 0.35) {
        trophic.textContent = isRu ? '🗡️ ХИЩНИК' : '🗡️ HUNTER';
        trophic.className = 'dive-trophic-pill pill-hunter';
      } else if (org.carnivory < 0.1 && (org.size || 6) > 4.2) {
        trophic.textContent = isRu ? '🕸️ ФИЛЬТРАТОР' : '🕸️ FILTER-FEEDER';
        trophic.className = 'dive-trophic-pill pill-filter';
      } else {
        trophic.textContent = isRu ? '🌾 ПАСТБИЩНИК' : '🌾 GRAZER';
        trophic.className = 'dive-trophic-pill pill-grazer';
      }
    }

    // Predator alert flare
    if (threat) {
      if (org.carnivory <= 0.35 && nearestPredatorDist !== null && nearestPredatorDist < 75.0) {
        threat.classList.remove('hidden');
        threat.textContent = `${isRu ? '⚠️ ХИЩНИК' : '⚠️ HUNTER'} ${Math.round(nearestPredatorDist)}μm`;
      } else {
        threat.classList.add('hidden');
      }
    }

    // Energy / ATP bar
    const energyPct = Math.min(100, Math.max(0, Math.round((org.energy / 180.0) * 100)));
    if (energyBar) {
      energyBar.style.width = `${energyPct}%`;
      energyBar.style.background = energyPct < 25 ? '#ef4444' : (energyPct < 55 ? '#f59e0b' : '#10b981');
    }
    if (energyVal) energyVal.textContent = `${energyPct}%`;

    // Speed
    if (speedVal) speedVal.textContent = `${currentSpeed.toFixed(1)} μm/s`;

    // Kuramoto Ciliary Frequency
    const freq = (org.ciliaryFrequency || 0.25) * 4.0;
    if (bpmVal) bpmVal.textContent = `${freq.toFixed(1)} Hz`;

    // Chemical Compass (scaled correctly to 2D world coordinates!)
    if (nearestVent && compassNeedle && compassDist) {
      const ventScale = 1400 / 128; // 10.9375
      const vwx = (nearestVent.x !== undefined ? nearestVent.x : 64) * ventScale;
      const vwy = (nearestVent.y !== undefined ? nearestVent.y : 64) * ventScale;

      const vdx = vwx - org.x;
      const vdy = vwy - org.y;
      const ventAngle = Math.atan2(vdy, vdx);
      const relAngle = ventAngle - totalYaw;
      compassNeedle.style.transform = `rotate(${relAngle}rad)`;
      const vdist = Math.hypot(vdx, vdy);
      compassDist.textContent = `${Math.round(vdist)} μm`;
    }
  }

  // Cinematic Flash Events
  flashFeeding() {
    const el = document.getElementById('dive-event-overlay');
    if (!el) return;
    el.className = 'dive-event-overlay flash-feed';
    setTimeout(() => { el.className = 'dive-event-overlay'; }, 450);
  }

  flashRupture() {
    const el = document.getElementById('dive-event-overlay');
    if (!el) return;
    el.className = 'dive-event-overlay flash-rupture';
  }

  flashMitosis() {
    const el = document.getElementById('dive-event-overlay');
    if (!el) return;
    el.className = 'dive-event-overlay flash-mitosis';
    setTimeout(() => { el.className = 'dive-event-overlay'; }, 600);
  }
}
