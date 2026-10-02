import { sound } from '../audio/sound.js';
import { i18n } from '../i18n.js';

export class InputController {
  constructor(canvas, renderer, inspector, codexModal, socketClient, aboutModal = null) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.inspector = inspector;
    this.codexModal = codexModal;
    this.client = socketClient;
    this.aboutModal = aboutModal;

    // Multi-pointer state tracking for pan & pinch gestures
    this.activePointers = new Map(); // pointerId -> { id, x, y, startX, startY, startTime, pointerType }

    // Single pointer pan state
    this.camStartX = 0;
    this.camStartY = 0;
    this.hasMovedSignificantly = false;

    // Two-finger pinch state
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1.0;
    this.pinchAnchorWorld = { x: 700.0, y: 700.0 };

    // 30-second feeding cooldown & subtle hint tooltip
    this.lastFeedTime = 0;
    this.feedCooldownMs = 30000;
    this.cooldownHintEl = null;
    this.cooldownHintTimer = null;

    this.setupListeners();
  }

  setupListeners() {
    // 1. Pointer Down (Mouse click or finger contact)
    this.canvas.addEventListener('pointerdown', (e) => {
      // Prevent browser default behavior
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {}

      const now = performance.now();
      this.activePointers.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        startTime: now,
        pointerType: e.pointerType
      });

      if (this.activePointers.size === 1) {
        // Starting single-finger or mouse pan
        this.hasMovedSignificantly = false;
        this.camStartX = this.renderer.camera.targetX;
        this.camStartY = this.renderer.camera.targetY;
      } else if (this.activePointers.size === 2) {
        // Transition into two-finger pinch-to-zoom mode
        this.hasMovedSignificantly = true; // Two fingers never trigger a single-tap action
        this.initPinch();
      }
    });

    // 2. Pointer Move (Single-finger / mouse pan OR two-finger pinch-to-zoom)
    const onPointerMove = (e) => {
      if (!this.activePointers.has(e.pointerId)) return;

      const p = this.activePointers.get(e.pointerId);
      p.x = e.clientX;
      p.y = e.clientY;

      if (this.activePointers.size === 1) {
        // --- SINGLE POINTER PAN (Drag & Hold) ---
        const dx = p.x - p.startX;
        const dy = p.y - p.startY;
        const threshold = p.pointerType === 'touch' ? 7 : 4;

        if (Math.hypot(dx, dy) > threshold) {
          this.hasMovedSignificantly = true;
          this.inspector.stopTracking();

          const zoom = this.renderer.camera.zoom || 1.0;
          const targetX = this.camStartX - dx / zoom;
          const targetY = this.camStartY - dy / zoom;

          this.applyCameraBounds(targetX, targetY, p.pointerType === 'touch');
        }
      } else if (this.activePointers.size >= 2) {
        // --- TWO FINGER PINCH-TO-ZOOM & PAN ---
        this.hasMovedSignificantly = true;
        this.inspector.stopTracking();

        const pointers = Array.from(this.activePointers.values()).slice(0, 2);
        const p1 = pointers[0];
        const p2 = pointers[1];

        const currDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const currMidX = (p1.x + p2.x) * 0.5;
        const currMidY = (p1.y + p2.y) * 0.5;

        if (this.pinchStartDist > 10) {
          const scale = currDist / this.pinchStartDist;
          const minZoom = 0.28;
          const maxZoom = 4.80;
          const newZoom = Math.max(minZoom, Math.min(maxZoom, this.pinchStartZoom * scale));

          this.renderer.camera.targetZoom = newZoom;
          // Snappy zoom responsiveness on mobile
          this.renderer.camera.zoom += (newZoom - this.renderer.camera.zoom) * 0.35;

          // Focal-point anchored pan: keep the world point between fingers locked to finger midpoint
          const w = this.renderer.camera.viewportW;
          const h = this.renderer.camera.viewportH;
          const z = this.renderer.camera.zoom;

          const targetX = this.pinchAnchorWorld.x - (currMidX - w * 0.5) / z;
          const targetY = this.pinchAnchorWorld.y - (currMidY - h * 0.5) / z;

          this.applyCameraBounds(targetX, targetY, true);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);

    // 3. Pointer Up & Cancel (Release or lift finger)
    const onPointerEnd = (e) => {
      if (!this.activePointers.has(e.pointerId)) return;

      try {
        if (this.canvas.hasPointerCapture?.(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      const p = this.activePointers.get(e.pointerId);
      const wasOnlyPointer = this.activePointers.size === 1;
      this.activePointers.delete(e.pointerId);

      // Tap detection: only if single pointer, moved less than threshold, and duration < 450ms
      if (e.type === 'pointerup' && wasOnlyPointer && !this.hasMovedSignificantly && p) {
        const elapsed = performance.now() - p.startTime;
        if (elapsed < 450) {
          this.handleTap(p.x, p.y);
        }
      }

      // If one finger remains on screen after pinch, smoothly continue single-finger pan
      if (this.activePointers.size === 1) {
        const remaining = Array.from(this.activePointers.values())[0];
        remaining.startX = remaining.x;
        remaining.startY = remaining.y;
        this.camStartX = this.renderer.camera.targetX;
        this.camStartY = this.renderer.camera.targetY;
        this.hasMovedSignificantly = true; // Prevent lift of 2nd finger from triggering a tap
      } else if (this.activePointers.size === 0) {
        this.hasMovedSignificantly = false;
      }
    };

    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);

    // 4. Mouse Wheel Zoom (Anchored to cursor position)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const oldZoom = this.renderer.camera.targetZoom;
      const minZoom = 0.28;
      const maxZoom = 4.80;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, oldZoom * zoomFactor));

      if (Math.abs(newZoom - oldZoom) > 0.001) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const w = this.renderer.camera.viewportW;
        const h = this.renderer.camera.viewportH;

        // World coordinate under cursor before zoom
        const wx = (mouseX - w * 0.5) / oldZoom + this.renderer.camera.targetX;
        const wy = (mouseY - h * 0.5) / oldZoom + this.renderer.camera.targetY;

        // Reposition camera so cursor stays pinned to the exact world point
        const targetX = wx - (mouseX - w * 0.5) / newZoom;
        const targetY = wy - (mouseY - h * 0.5) / newZoom;

        this.renderer.camera.targetZoom = newZoom;
        this.applyCameraBounds(targetX, targetY, false);
      }
    }, { passive: false });

    // 5. iOS Safari gesture & scroll suppressors
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault(); // Prevent Safari native page pinch zoom
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault(); // Prevent elastic overscroll bounce
    }, { passive: false });

    this.canvas.addEventListener('gesturestart', (e) => e.preventDefault());
    this.canvas.addEventListener('gesturechange', (e) => e.preventDefault());
    this.canvas.addEventListener('gestureend', (e) => e.preventDefault());

    // 6. Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('dialog[open]')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Do not trigger 2D modals when piloting in 3D Dive mode (prevents 'A' key conflict)
      if (this.client.diveEngine && this.client.diveEngine.isActive) return;

      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        const toggleBtn = document.getElementById('btn-mode-toggle');
        toggleBtn?.click();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
        this.codexModal.open();
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
        this.aboutModal ? this.aboutModal.open() : document.getElementById('btn-about')?.click();
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
        const audioBtn = document.getElementById('btn-audio');
        audioBtn?.click();
      } else if (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') {
        const langBtn = document.getElementById('btn-lang');
        langBtn ? langBtn.click() : i18n.toggleLang();
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'о' || e.key === 'О') {
        this.client.journalDrawer?.toggle();
      } else if (e.key === 'Escape') {
        this.inspector.close();
        this.codexModal.close();
        this.aboutModal?.close();
        this.client.journalDrawer?.close();
      }
    });
  }

  initPinch() {
    const pointers = Array.from(this.activePointers.values()).slice(0, 2);
    const p1 = pointers[0];
    const p2 = pointers[1];

    this.pinchStartDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    this.pinchStartZoom = this.renderer.camera.targetZoom;

    const midX = (p1.x + p2.x) * 0.5;
    const midY = (p1.y + p2.y) * 0.5;
    this.pinchAnchorWorld = this.renderer.screenToWorld(midX, midY);
  }

  applyCameraBounds(targetX, targetY, isDirectTouch = false) {
    const cx = this.renderer.chamber?.cx ?? 700.0;
    const cy = this.renderer.chamber?.cy ?? 700.0;
    const maxPan = (this.renderer.chamber?.r ?? 650.0) + 200.0;
    const distFromCenter = Math.hypot(targetX - cx, targetY - cy);

    let finalX = targetX;
    let finalY = targetY;
    if (distFromCenter > maxPan) {
      finalX = cx + ((targetX - cx) / distFromCenter) * maxPan;
      finalY = cy + ((targetY - cy) / distFromCenter) * maxPan;
    }

    this.renderer.camera.targetX = finalX;
    this.renderer.camera.targetY = finalY;

    if (isDirectTouch) {
      // Direct touch tracking gives immediate 1:1 physical feel under the finger
      this.renderer.camera.x += (finalX - this.renderer.camera.x) * 0.35;
      this.renderer.camera.y += (finalY - this.renderer.camera.y) * 0.35;
    }
  }

  handleTap(screenX, screenY) {
    // A stopping tap is consumed: it must not feed or immediately select another cell.
    if (this.renderer.camera.trackedEntityId) {
      this.inspector.close();
      return;
    }
    // The dark periphery is context, not an invisible interaction target.
    if(!this.renderer.inObservationArea(screenX,screenY)) {
      this.client.observatory.toast(i18n.getLang()==='ru'?'Перетащите нужное место в центр линзы или выберите «Весь экран».':'Drag this place into the lens, or choose Wide view.');
      return;
    }
    // 1. Check if user tapped directly on an organism (touch target radius 38px for easier mobile selection)
    const hit = this.renderer.findOrganismAtScreenPoint(screenX, screenY, 38);
    if (hit) {
      this.inspector.select(hit.id);
      sound.playDroplet(1100);
      return;
    }

    // 2. Otherwise, drop nutrient into the petri chamber!
    const worldPt = this.renderer.screenToWorld(screenX, screenY);
    const ch = this.renderer.chamber || { cx: 700, cy: 700, r: 620 };
    const dx = worldPt.x - ch.cx;
    const dy = worldPt.y - ch.cy;
    const dist = Math.hypot(dx, dy);

    // If tapped outside the liquid droplet, do not drop food into the void!
    if (dist > ch.r - 12) {
      // Gentle subtle optical refraction ripple on the glass wall without food
      this.renderer.addRipple(worldPt.x, worldPt.y, 'rgba(0, 240, 255, 0.35)', 35);
      sound.playDroplet(380);
      return;
    }

    // 30-second feeding cooldown check
    const now = Date.now();
    const elapsed = now - this.lastFeedTime;
    if (elapsed < this.feedCooldownMs) {
      const remainingSec = Math.ceil((this.feedCooldownMs - elapsed) / 1000);
      this.showFeedCooldownHint(screenX, screenY, remainingSec);
      this.renderer.addRipple(worldPt.x, worldPt.y, 'rgba(245, 158, 11, 0.20)', 18);
      sound.playDroplet(420);
      return;
    }

    this.lastFeedTime = now;

    // Clamp near-edge drops smoothly inward to (ch.r - 45) so food lands in open swimming waters
    let wx = worldPt.x;
    let wy = worldPt.y;
    const maxDropR = ch.r - 45;
    if (dist > maxDropR && dist > 0) {
      wx = ch.cx + (dx / dist) * maxDropR;
      wy = ch.cy + (dy / dist) * maxDropR;
    }

    // Immediately spawn food bloom locally for 0ms instant feedback
    this.renderer.spawnFoodBloom(wx, wy);

    // Send to server
    this.client.sendInteraction('nutrient_drop', wx, wy);

    // Audio chirp
    sound.playDroplet(650 + Math.random() * 200);
  }

  showFeedCooldownHint(screenX, screenY, remainingSec) {
    if (this.cooldownHintTimer) {
      clearTimeout(this.cooldownHintTimer);
    }
    if (!this.cooldownHintEl) {
      this.cooldownHintEl = document.createElement('div');
      this.cooldownHintEl.className = 'feed-cooldown-hint';
      document.body.appendChild(this.cooldownHintEl);
    }

    const isRu = (i18n.getLang() === 'ru');
    this.cooldownHintEl.textContent = isRu 
      ? `Подкормка: еще ${remainingSec} сек` 
      : `Feeding ready in ${remainingSec}s`;

    // Position subtly near pointer, staying within viewport
    const pad = 14;
    let posX = screenX + 14;
    let posY = screenY - 26;
    if (posX + 180 > window.innerWidth) posX = screenX - 180;
    if (posY < pad) posY = screenY + 20;

    this.cooldownHintEl.style.left = `${posX}px`;
    this.cooldownHintEl.style.top = `${posY}px`;
    this.cooldownHintEl.classList.remove('fade-out');
    // Force DOM reflow to restart animation smoothly
    void this.cooldownHintEl.offsetWidth;

    this.cooldownHintTimer = setTimeout(() => {
      if (this.cooldownHintEl) {
        this.cooldownHintEl.classList.add('fade-out');
      }
    }, 1100);
  }
}
