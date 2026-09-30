import { i18n } from './i18n.js';
import { sound } from './audio/sound.js';
import { OceanRenderer } from './gl/renderer.js';
import { BioInspector } from './ui/inspector.js';
import { CodexModal } from './ui/codexModal.js';
import { InputController } from './ui/controls.js';

class AetheonApp {
  constructor() {
    this.canvas = document.getElementById('ocean-canvas');
    this.renderer = new OceanRenderer(this.canvas);
    this.socket = null;
    this.isConnected = false;

    // UI Modules
    this.inspector = new BioInspector(this, this.renderer);
    this.codexModal = new CodexModal(this);
    this.controls = new InputController(this.canvas, this.renderer, this.inspector, this.codexModal, this);

    this.init();
  }

  init() {
    // 1. Setup localization
    i18n.applyTranslations();

    // 2. Setup HUD buttons
    this.setupHUD();

    // 3. Connect WebSocket
    this.connectWebSocket();

    // 4. Start 60-120 FPS render loop
    const frame = (time) => {
      this.renderer.render(time);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    // 5. Auto-fade onboarding hint
    setTimeout(() => {
      const hint = document.getElementById('interactive-hint');
      if (hint) hint.style.opacity = '0';
    }, 7000);
  }

  setupHUD() {
    // Mode toggle (Zen vs Lab)
    const modeBtn = document.getElementById('btn-mode-toggle');
    const modeLabel = document.getElementById('label-mode');
    let isLab = false;

    modeBtn?.addEventListener('click', () => {
      isLab = !isLab;
      this.renderer.setLabMode(isLab);
      document.body.classList.toggle('mode-lab', isLab);
      document.body.classList.toggle('mode-zen', !isLab);
      if (modeLabel) {
        modeLabel.textContent = isLab ? i18n.t('mode_zen') : i18n.t('mode_lab');
      }
      modeBtn.style.borderColor = isLab ? 'var(--accent-cyan)' : 'var(--border-subtle)';
    });

    // Sound toggle
    const audioBtn = document.getElementById('btn-audio');
    const iconSoundOff = document.getElementById('icon-sound-off');
    const iconSoundOn = document.getElementById('icon-sound-on');

    audioBtn?.addEventListener('click', () => {
      const isUnmuted = sound.toggleMute();
      iconSoundOff?.classList.toggle('hidden', isUnmuted);
      iconSoundOn?.classList.toggle('hidden', !isUnmuted);
      audioBtn.style.borderColor = isUnmuted ? 'var(--accent-cyan)' : 'var(--border-subtle)';
    });

    // Language toggle
    const langBtn = document.getElementById('btn-lang');
    langBtn?.addEventListener('click', () => {
      i18n.toggleLang();
      if (modeLabel) {
        modeLabel.textContent = isLab ? i18n.t('mode_zen') : i18n.t('mode_lab');
      }
    });
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log(`[Aetheon] Connecting to canonical world stream: ${wsUrl}`);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('[Aetheon] Connected to canonical world stream!');
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[Aetheon] WebSocket parse error:', err);
      }
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      console.warn('[Aetheon] Disconnected. Reconnecting in 2s...');
      setTimeout(() => this.connectWebSocket(), 2000);
    };

    this.socket.onerror = (err) => {
      console.error('[Aetheon] WebSocket error:', err);
    };
  }

  handleMessage(msg) {
    if (msg.type === 'init') {
      this.renderer.setVents(msg.vents);
      if (msg.thumbnail) this.renderer.updateThumbnail(msg.thumbnail);
      this.updateStats(msg.stats);
      this.updateVisitors(msg.visitors);
      if (msg.journal && msg.journal.length > 0) {
        this.updateTicker(msg.journal[0]);
      }
    } else if (msg.type === 'tick') {
      this.renderer.onServerTick(msg);
      if (msg.visitors !== undefined) this.updateVisitors(msg.visitors);
      if (msg.stats) this.updateStats(msg.stats);

      // Play audio events for nearby occurrences
      if (msg.events && msg.events.length > 0) {
        for (let i = 0; i < msg.events.length; i++) {
          const ev = msg.events[i];
          if (ev.type === 'birth' && Math.random() < 0.25) {
            sound.playMitosisPing();
          } else if (ev.type === 'predation' && Math.random() < 0.35) {
            sound.playPredationStrike();
          }
        }
      }
    } else if (msg.type === 'visitor_count') {
      this.updateVisitors(msg.count);
    } else if (msg.type === 'visitor_ripple') {
      // Another user tapped the water!
      this.renderer.addRipple(msg.x, msg.y, 'rgba(0, 240, 255, 0.65)', 50);
    } else if (msg.type === 'inspect_result') {
      this.inspector.updateProfile(msg.profile);
    } else if (msg.type === 'codex_data') {
      this.codexModal.renderData(msg.species, msg.journal);
    }
  }

  updateStats(stats) {
    if (!stats) return;
    const statOrg = document.getElementById('stat-organisms');
    const statSp = document.getElementById('stat-species');
    const statGen = document.getElementById('stat-generation');
    const liveIndicator = document.getElementById('live-indicator');

    if (statOrg) statOrg.textContent = stats.organismCount;
    if (statSp) statSp.textContent = stats.speciesCount;
    if (statGen) statGen.textContent = stats.generation;

    if (liveIndicator) {
      const isRu = i18n.getLang() === 'ru';
      liveIndicator.textContent = `LIVE • ${isRu ? 'ДЕНЬ' : 'DAY'} ${stats.ageDays + 1}`;
    }
  }

  updateVisitors(count) {
    const el = document.getElementById('visitor-count');
    if (el) el.textContent = count;
  }

  updateTicker(entry) {
    if (!entry) return;
    const epochEl = document.getElementById('ticker-epoch');
    const textEl = document.getElementById('ticker-text');
    const isRu = i18n.getLang() === 'ru';

    if (epochEl) {
      epochEl.textContent = isRu ? (entry.titleRu || entry.titleEn) : entry.titleEn;
    }
    if (textEl) {
      textEl.textContent = isRu ? (entry.contentRu || entry.contentEn) : entry.contentEn;
    }
  }

  // Outbound socket messages
  sendInteraction(action, x, y) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ type: 'interact', action, x, y }));
    }
  }

  sendInspect(id) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ type: 'inspect', id }));
    }
  }

  sendGetCodex() {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ type: 'get_codex' }));
    }
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new AetheonApp();
});
