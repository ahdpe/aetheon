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

    this.setupDOM();
    this.setupInputListeners();
  }

  setupDOM() {
    if (!this.container) return;
    this.container.innerHTML = `
      <!-- Organic Lipid Membrane Vignette -->
      <div class="dive-vignette" id="dive-vignette"></div>

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

      <!-- Chemical Gradient Compass (Navigating to Nutrient Hearth) -->
      <div class="dive-compass-wrap glass-panel" id="dive-compass-wrap">
        <div class="compass-label" data-i18n="chemotaxis_sensor">ХЕМОТАКСИС</div>
        <div class="compass-dial" id="dive-compass-dial">
          <div class="compass-needle" id="dive-compass-needle">▲</div>
        </div>
        <div class="compass-dist" id="dive-compass-dist">48 μm</div>
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

      <!-- Cinematic Event Flash Overlays -->
      <div class="dive-event-overlay" id="dive-event-overlay"></div>
    `;

    this.exitBtn = document.getElementById('dive-exit-btn');
    this.exitBtn?.addEventListener('click', () => {
      this.engine.exit();
    });
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
      if (k === 'w' || e.key === 'ArrowUp') this.keys.w = true;
      if (k === 'a' || e.key === 'ArrowLeft') this.keys.a = true;
      if (k === 's' || e.key === 'ArrowDown') this.keys.s = true;
      if (k === 'd' || e.key === 'ArrowRight') this.keys.d = true;
      if (e.key === ' ') {
        this.keys.space = true;
        this.engine.triggerBoost();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.engine.isActive) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') this.keys.w = false;
      if (k === 'a' || e.key === 'ArrowLeft') this.keys.a = false;
      if (k === 's' || e.key === 'ArrowDown') this.keys.s = false;
      if (k === 'd' || e.key === 'ArrowRight') this.keys.d = false;
      if (e.key === ' ') this.keys.space = false;
    });

    // 2. Mouse Freelook Drag
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    window.addEventListener('mousedown', (e) => {
      if (!this.engine.isActive) return;
      if (e.target.closest('#dive-exit-btn')) return;
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
      this.lookPitch = Math.max(-0.6, Math.min(0.6, this.lookPitch - dy * 0.004));
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    // 3. Mobile Touch Controls (Dual-zone: Left joystick, Right swipe look)
    const joyZone = document.getElementById('dive-joystick-zone');
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
          const dist = Math.sqrt(dx * dx + dy * dy);
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
          this.lookPitch = Math.max(-0.6, Math.min(0.6, this.lookPitch - ldy * 0.005));
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

    // 1. Keyboard steering accumulation
    if (!this.joystickActive) {
      let sx = 0;
      let sy = 0;
      if (this.keys.w) {
        sx += Math.cos(currentHeading + this.lookYaw);
        sy += Math.sin(currentHeading + this.lookYaw);
      }
      if (this.keys.s) {
        sx -= Math.cos(currentHeading + this.lookYaw) * 0.5;
        sy -= Math.sin(currentHeading + this.lookYaw) * 0.5;
      }
      if (this.keys.a) {
        sx += Math.cos(currentHeading + this.lookYaw - Math.PI * 0.5) * 0.7;
        sy += Math.sin(currentHeading + this.lookYaw - Math.PI * 0.5) * 0.7;
      }
      if (this.keys.d) {
        sx += Math.cos(currentHeading + this.lookYaw + Math.PI * 0.5) * 0.7;
        sy += Math.sin(currentHeading + this.lookYaw + Math.PI * 0.5) * 0.7;
      }
      this.steerX = sx;
      this.steerY = sy;
    }

    // 2. Telemetry DOM updates
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
    const spd = Math.sqrt((org.vx || 0) * (org.vx || 0) + (org.vy || 0) * (org.vy || 0));
    if (speedVal) speedVal.textContent = `${spd.toFixed(1)} μm/s`;

    // Kuramoto Ciliary Frequency
    const freq = (org.ciliaryFrequency || 0.25) * 4.0;
    if (bpmVal) bpmVal.textContent = `${freq.toFixed(1)} Hz`;

    // Chemical Compass
    if (nearestVent && compassNeedle && compassDist) {
      const vdx = nearestVent.x - org.x;
      const vdy = nearestVent.y - org.y;
      const ventAngle = Math.atan2(vdy, vdx);
      const relAngle = ventAngle - (currentHeading + this.lookYaw);
      compassNeedle.style.transform = `rotate(${relAngle}rad)`;
      const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
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
