import { sound } from '../audio/sound.js';
import { i18n } from '../i18n.js';

export class InputController {
  constructor(canvas, renderer, inspector, codexModal, socketClient) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.inspector = inspector;
    this.codexModal = codexModal;
    this.client = socketClient;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.camStartX = 0;
    this.camStartY = 0;
    this.hasMovedSignificantly = false;

    this.setupListeners();
  }

  setupListeners() {
    // Pointer down (mouse or touch)
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.hasMovedSignificantly = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.camStartX = this.renderer.camera.targetX;
      this.camStartY = this.renderer.camera.targetY;
    });

    // Pointer move (drag canvas)
    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (Math.hypot(dx, dy) > 6) {
        this.hasMovedSignificantly = true;
        // Break tracking if user manual pans
        this.renderer.camera.trackedEntityId = null;

        const zoom = this.renderer.camera.zoom;
        const targetX = this.camStartX - dx / zoom;
        const targetY = this.camStartY - dy / zoom;

        // Soft clamp camera to keep chamber in view
        const cx = this.renderer.chamber?.cx || 700.0;
        const cy = this.renderer.chamber?.cy || 700.0;
        const maxPan = 750.0;
        const distFromCenter = Math.hypot(targetX - cx, targetY - cy);
        if (distFromCenter > maxPan) {
          this.renderer.camera.targetX = cx + ((targetX - cx) / distFromCenter) * maxPan;
          this.renderer.camera.targetY = cy + ((targetY - cy) / distFromCenter) * maxPan;
        } else {
          this.renderer.camera.targetX = targetX;
          this.renderer.camera.targetY = targetY;
        }
      }
    });

    // Pointer up (tap/click event)
    window.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      // If user tapped without dragging, trigger interaction!
      if (!this.hasMovedSignificantly) {
        this.handleTap(e.clientX, e.clientY);
      }
    });

    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.4, Math.min(2.8, this.renderer.camera.targetZoom * zoomFactor));
      this.renderer.camera.targetZoom = newZoom;
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        const toggleBtn = document.getElementById('btn-mode-toggle');
        toggleBtn?.click();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
        this.codexModal.open();
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
        const audioBtn = document.getElementById('btn-audio');
        audioBtn?.click();
      } else if (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') {
        i18n.toggleLang();
      } else if (e.key === 'Escape') {
        this.inspector.close();
        this.codexModal.close();
      }
    });
  }

  handleTap(screenX, screenY) {
    // 1. Check if user tapped directly on an organism
    const hit = this.renderer.findOrganismAtScreenPoint(screenX, screenY, 32);
    if (hit) {
      this.inspector.select(hit.id);
      sound.playDroplet(1100);
      return;
    }

    // 2. Otherwise, drop nutrient into the petri chamber!
    const worldPt = this.renderer.screenToWorld(screenX, screenY);
    const wx = worldPt.x;
    const wy = worldPt.y;

    // Send to server
    this.client.sendInteraction('nutrient_drop', wx, wy);

    // Audio chirp & visual water ripple
    sound.playDroplet(650 + Math.random() * 200);
    this.renderer.addRipple(wx, wy, 'rgba(0, 240, 255, 0.85)', 65);
  }
}
