import { i18n } from '../i18n.js';

export class BioInspector {
  constructor(socketClient, renderer) {
    this.client = socketClient;
    this.renderer = renderer;
    this.panel = document.getElementById('bio-inspector');
    this.closeBtn = document.getElementById('bio-close-btn');
    this.feedBtn = document.getElementById('btn-feed-target');
    this.trackBtn = document.getElementById('btn-track-target');

    this.selectedId = null;
    this.isTracking = false;
    this.lastProfile = null;

    this.setupListeners();
  }

  setupListeners() {
    this.closeBtn?.addEventListener('click', () => this.close());
    
    this.feedBtn?.addEventListener('click', () => {
      if (this.selectedId) {
        const org = this.renderer.currEntities.get(this.selectedId);
        if (org) {
          this.client.sendInteraction('nutrient_drop', org.x, org.y);
          this.renderer.addRipple(org.x, org.y, 'rgba(0, 255, 136, 0.85)', 70);
        }
      }
    });

    this.trackBtn?.addEventListener('click', () => {
      this.isTracking = !this.isTracking;
      this.renderer.camera.trackedEntityId = this.isTracking ? this.selectedId : null;
      this.trackBtn.style.borderColor = this.isTracking ? 'var(--accent-cyan)' : 'var(--border-subtle)';
    });

    window.addEventListener('aetheon-lang-changed', () => {
      if (this.lastProfile && this.selectedId) {
        this.updateProfile(this.lastProfile);
      }
    });
  }

  select(organismId) {
    this.selectedId = organismId;
    this.panel.classList.remove('hidden');
    // Request full profile from server
    this.client.sendInspect(organismId);
  }

  close() {
    this.selectedId = null;
    this.isTracking = false;
    this.lastProfile = null;
    this.renderer.camera.trackedEntityId = null;
    this.panel.classList.add('hidden');
  }

  updateProfile(profile) {
    if (!profile || profile.id !== this.selectedId) return;
    this.lastProfile = profile;
    const isRu = i18n.getLang() === 'ru';

    const badgeDot = document.getElementById('bio-badge-dot');
    const speciesName = document.getElementById('bio-species-name');
    const commonName = document.getElementById('bio-common-name');
    const status = document.getElementById('bio-status');
    const energyFill = document.getElementById('bio-energy-fill');
    const energyText = document.getElementById('bio-energy-text');
    const generation = document.getElementById('bio-generation');
    const age = document.getElementById('bio-age');
    const diet = document.getElementById('bio-diet');
    const offspring = document.getElementById('bio-offspring');

    const hDeg = Math.round(profile.hue * 360);
    if (badgeDot) {
      badgeDot.style.background = `hsl(${hDeg}, 90%, 60%)`;
      badgeDot.style.boxShadow = `0 0 10px hsl(${hDeg}, 90%, 60%)`;
    }

    if (speciesName) speciesName.textContent = profile.speciesName || 'Aetheobiont';

    const common = isRu 
      ? (profile.speciesNameRu || profile.speciesNameEn || profile.speciesName)
      : (profile.speciesNameEn || profile.speciesName);
    if (commonName) commonName.textContent = common;

    if (status) {
      let statusText = isRu ? '🌾 Мирно пасётся' : '🌾 Grazing peacefully';
      let statusClass = 'status-grazing';

      if (profile.behaviorType === 'hunting') {
        statusText = isRu ? '🗡️ Выслеживает добычу' : '🗡️ Stalking prey';
        statusClass = 'status-hunting';
      } else if (profile.behaviorType === 'mitosis') {
        statusText = isRu ? '🧬 Деление клетки (митоз)' : '🧬 Preparing for mitosis';
        statusClass = 'status-mitosis';
      } else if (profile.behaviorType === 'starving') {
        statusText = isRu ? '⚠️ Голодает, ищет пищу' : '⚠️ Starving, seeking food';
        statusClass = 'status-starving';
      } else if (profile.behaviorType === 'filtering') {
        statusText = isRu ? '🕸️ Фильтрует взвесь' : '🕸️ Filtering substrate';
        statusClass = 'status-filtering';
      } else {
        statusText = isRu ? '🌾 Мирно пасётся' : '🌾 Grazing peacefully';
        statusClass = 'status-grazing';
      }

      status.textContent = statusText;
      status.className = `vital-val status-pill ${statusClass}`;
    }

    if (diet) {
      let dietText = isRu ? '🌾 Пастбищник' : '🌾 Grazer';

      if (profile.dietType === 'hunter') {
        dietText = isRu ? '🗡️ Вершинный хищник' : '🗡️ Apex Hunter';
      } else if (profile.dietType === 'filter') {
        dietText = isRu ? '🕸️ Фильтратор' : '🕸️ Filter Feeder';
      } else {
        dietText = isRu ? '🌾 Пастбищник' : '🌾 Grazer';
      }

      diet.textContent = dietText;
    }

    if (energyFill && energyText) {
      const pct = Math.min(100, Math.round((profile.energy / profile.maxEnergy) * 100));
      energyFill.style.width = `${pct}%`;
      energyText.textContent = `${pct}%`;
    }

    if (generation) generation.textContent = `#${profile.generation}`;
    if (age) {
      const s = profile.ageSeconds % 60;
      const m = Math.floor(profile.ageSeconds / 60);
      age.textContent = `${m}${i18n.t('unit_minutes')} ${s}${i18n.t('unit_seconds')}`;
    }

    if (offspring) offspring.textContent = `${profile.childrenCount} ${i18n.t('unit_children')}`;
  }
}
