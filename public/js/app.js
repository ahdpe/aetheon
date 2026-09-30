import { i18n } from './i18n.js';
import { sound } from './audio/sound.js';
import { OceanRenderer } from './gl/renderer.js';
import { BioInspector } from './ui/inspector.js';
import { CodexModal } from './ui/codexModal.js';
import { AboutModal } from './ui/aboutModal.js';
import { JournalDrawer } from './ui/journalDrawer.js';
import { InputController } from './ui/controls.js';

class AetheonApp {
  constructor() {
    this.canvas = document.getElementById('ocean-canvas');
    this.renderer = new OceanRenderer(this.canvas);
    this.socket = null;
    this.isConnected = false;
    this.journalEntries = [];

    // UI Modules
    this.inspector = new BioInspector(this, this.renderer);
    this.codexModal = new CodexModal(this);
    this.aboutModal = new AboutModal();
    this.journalDrawer = new JournalDrawer(this);
    this.controls = new InputController(this.canvas, this.renderer, this.inspector, this.codexModal, this, this.aboutModal);

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
      sound.playDroplet(isLab ? 1400 : 700);
      if (modeLabel) {
        modeLabel.textContent = isLab ? i18n.t('mode_zen') : i18n.t('mode_lab');
      }
      modeBtn.style.borderColor = isLab ? 'var(--accent-cyan)' : 'var(--border-subtle)';
      if (isLab) {
        this.updateLabTelemetry();
      }
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
      if (this.journalEntries && this.journalEntries.length > 0) {
        this.updateTicker(this.journalEntries[0]);
      }
      this.journalDrawer?.render();
      if (this.codexModal && this.codexModal.activeSpecies.length > 0) {
        this.codexModal.renderData(this.codexModal.activeSpecies);
      }
      if (this.lastStats) {
        this.updateStats(this.lastStats);
      }
    });
  }

  connectWebSocket() {
    let wsUrl;
    if (window.location.protocol === 'file:' || !window.location.host) {
      wsUrl = 'ws://localhost:3000';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let subpath = window.location.pathname.replace(/\/index\.html$/, '');
      if (!subpath.endsWith('/')) subpath += '/';
      wsUrl = `${protocol}//${window.location.host}${subpath}`;
    }

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
      if (msg.worldSize) {
        this.renderer.worldSize = msg.worldSize;
        if (this.renderer.particles) this.renderer.particles.worldSize = msg.worldSize;
      }
      if (msg.chamber) {
        this.renderer.setChamber(msg.chamber);
      }
      this.renderer.setVents(msg.vents);
      if (msg.thumbnail) this.renderer.updateThumbnail(msg.thumbnail);
      this.updateStats(msg.stats);
      this.updateVisitors(msg.visitors);
      if (msg.journal && msg.journal.length > 0) {
        this.journalEntries = msg.journal;
        this.updateTicker(msg.journal[0]);
        this.journalDrawer.setEntries(msg.journal);
      }
    } else if (msg.type === 'tick') {
      this.renderer.onServerTick(msg);
      if (msg.visitors !== undefined) this.updateVisitors(msg.visitors);
      if (msg.stats) this.updateStats(msg.stats);
      if (this.renderer.isLabMode) this.updateLabTelemetry();

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
      this.renderer.spawnFoodBloom(msg.x, msg.y);
    } else if (msg.type === 'inspect_result') {
      this.inspector.updateProfile(msg.profile);
    } else if (msg.type === 'codex_data') {
      this.codexModal.renderData(msg.species, msg.journal);
      if (msg.journal && msg.journal.length > 0) {
        this.journalEntries = msg.journal;
        this.journalDrawer.setEntries(msg.journal);
      }
    } else if (msg.type === 'journal_entry') {
      if (msg.entry) {
        this.journalEntries = this.journalEntries || [];
        this.journalEntries.unshift(msg.entry);
        this.updateTicker(msg.entry);
        this.journalDrawer.addLiveEntry(msg.entry);
        sound.playDroplet(1200);
      }
    }
  }

  updateStats(stats) {
    if (!stats) return;
    this.lastStats = stats;
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

  updateLabTelemetry() {
    const list = Array.from(this.renderer.currEntities.values());
    if (list.length === 0) return;

    let hunters = 0;
    let grazers = 0;
    const speciesCounts = new Map();

    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.carnivory > 0.4) hunters++;
      else grazers++;

      const spId = o.speciesId || 1;
      speciesCounts.set(spId, (speciesCounts.get(spId) || 0) + 1);
    }

    const total = list.length;
    const grazerPct = Math.round((grazers / total) * 100);
    const hunterPct = 100 - grazerPct;

    // Shannon Diversity Index H' = - sum(p_i * ln(p_i))
    let shannon = 0;
    for (const count of speciesCounts.values()) {
      const p = count / total;
      if (p > 0) shannon -= p * Math.log(p);
    }

    const trophicEl = document.getElementById('lab-trophic-ratio');
    const shannonEl = document.getElementById('lab-shannon-h');
    const isRu = i18n.getLang() === 'ru';

    if (trophicEl) {
      trophicEl.textContent = isRu 
        ? `${grazerPct}% ${i18n.t('grazers')} / ${hunterPct}% ${i18n.t('hunters')}`
        : `${grazerPct}% Grazers / ${hunterPct}% Hunters`;
    }
    if (shannonEl) {
      shannonEl.textContent = shannon.toFixed(2);
    }

    const climateEl = document.getElementById('lab-climate-text');
    if (climateEl && this.renderer.climate) {
      const c = this.renderer.climate;
      let seasonName = c.season.toUpperCase();
      if (isRu) {
        if (c.season === 'glacial') seasonName = 'ЛЕДНИК';
        else if (c.season === 'hydrothermal_surge') seasonName = 'ТЕРМАЛЬНЫЙ ВСПЛЕСК';
        else seasonName = 'ОПТИМУМ';
      }
      const frostInfo = c.frost > 1 ? ` • ${isRu ? 'ЛЕД' : 'ICE'} +${Math.round(c.frost)}μm` : '';
      climateEl.textContent = `${c.tempC}°C • ${seasonName}${frostInfo}`;
      climateEl.style.color = c.season === 'glacial' ? '#93c5fd' : (c.season === 'hydrothermal_surge' ? '#fdba74' : '#bef264');
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

  // Focus and track an active organism of the selected species in the ocean
  trackSpeciesInOcean(speciesId) {
    if (!this.renderer || !this.renderer.currEntities) return false;
    const orgs = Array.from(this.renderer.currEntities.values()).filter(o => o.speciesId === speciesId);
    if (!orgs.length) {
      console.warn(`[Aetheon] No active organisms found for species #${speciesId}`);
      return false;
    }

    // Pick a healthy, active specimen (highest energy)
    const target = orgs.sort((a, b) => b.energy - a.energy)[0];

    // Smooth camera transition to target
    this.renderer.camera.targetX = target.x;
    this.renderer.camera.targetY = target.y;
    this.renderer.camera.targetZoom = Math.max(1.4, this.renderer.camera.zoom);
    this.renderer.camera.trackedEntityId = target.id;

    // Highlight with targeting ripple pulses
    this.renderer.addRipple(target.x, target.y, 'rgba(0, 240, 255, 0.95)', 110);
    this.renderer.addRipple(target.x, target.y, 'rgba(255, 255, 255, 0.85)', 55);

    // Open inspector bio-card and set tracking state
    this.inspector.select(target.id);
    this.inspector.isTracking = true;
    if (this.inspector.trackBtn) {
      this.inspector.trackBtn.style.borderColor = 'var(--accent-cyan)';
    }

    sound.playDroplet(1500);
    return true;
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.aetheonApp = new AetheonApp();
});
