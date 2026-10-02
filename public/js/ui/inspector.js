import { escapeHtml } from './safeHtml.js';
import { i18n } from '../i18n.js';

export class BioInspector {
  constructor(socketClient, renderer) {
    this.client = socketClient;
    this.renderer = renderer;
    this.panel = document.getElementById('bio-inspector');
    this.closeBtn = document.getElementById('bio-close-btn');
    this.feedBtn = document.getElementById('btn-feed-target');
    this.trackBtn = document.getElementById('btn-track-target');
    this.diveBtn = document.getElementById('btn-dive-target');

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

    this.diveBtn?.addEventListener('click', async () => {
      if (this.selectedId) {
        if (this.renderer.pilotedIds && (this.renderer.pilotedIds.has(this.selectedId) || this.renderer.pilotedIds.has(Number(this.selectedId)))) {
          return;
        }
        this.renderer.camera.trackedEntityId = this.selectedId;
        this.isTracking = true;
        this.panel.classList.add('hidden');
        const engine = await this.client.getDiveEngine();
        if (engine) {
          engine.enter(this.selectedId);
        }
      }
    });

    window.addEventListener('aetheon-lang-changed', () => {
      if (this.lastProfile && this.selectedId) {
        this.updateProfile(this.lastProfile);
      }
    });
  }

  select(organismId) {
    this.selectedId = organismId;
    this.lastProfile = null;
    this.client.observatory?.onProfile(null);
    this.panel.classList.remove('hidden');
    document.getElementById('bio-species-name').textContent = `#${organismId}`;
    document.getElementById('bio-common-name').textContent = i18n.getLang() === 'ru' ? 'Читаем состояние клетки…' : 'Reading the living cell…';
    for (const id of ['bio-status','bio-energy-text','bio-generation','bio-age','bio-diet','bio-offspring','bio-stage']) document.getElementById(id).textContent = '—';
    document.getElementById('bio-energy-fill').style.width = '0%';
    document.getElementById('bio-founder-row').classList.add('hidden');

    // Immediately reflect pilot lock state
    if (this.diveBtn) {
      const isPiloted = this.renderer.pilotedIds && (this.renderer.pilotedIds.has(organismId) || this.renderer.pilotedIds.has(Number(organismId)));
      const isRu = i18n.getLang() === 'ru';
      if (isPiloted) {
        this.diveBtn.disabled = true;
        this.diveBtn.style.opacity = '0.55';
        this.diveBtn.style.cursor = 'not-allowed';
        this.diveBtn.title = isRu ? 'Организм уже управляется другим наблюдателем' : 'Organism is already piloted by another visitor';
        this.diveBtn.innerHTML = `<span>🔒</span> <span>${isRu ? 'Занят пилотом' : 'Occupied'}</span>`;
      } else {
        this.diveBtn.disabled = false;
        this.diveBtn.style.opacity = '1.0';
        this.diveBtn.style.cursor = 'pointer';
        this.diveBtn.title = '';
        this.diveBtn.innerHTML = `<span>🤿</span> <span>${isRu ? 'Войти в клетку (3D)' : 'Dive Inside (3D)'}</span>`;
      }
    }

    // Request full profile from server
    this.client.sendInspect(organismId);
  }

  close() {
    this.selectedId = null;
    this.isTracking = false;
    this.lastProfile = null;
    this.client.observatory?.onProfile(null);
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

    // Ontogenesis Development Stage
    const stage = document.getElementById('bio-stage');
    if (stage) {
      const maturity = profile.maturity !== undefined ? profile.maturity : 100;
      if (maturity < 45) {
        stage.innerHTML = `<span class="stage-juvenile">${isRu ? '🌱 Ювенил' : '🌱 Juvenile'} (${maturity}%)</span>`;
      } else if (maturity < 85) {
        stage.innerHTML = `<span class="stage-subadult">${isRu ? '🌿 Подрастающая' : '🌿 Subadult'} (${maturity}%)</span>`;
      } else {
        stage.innerHTML = `<span class="stage-adult">${isRu ? '🌳 Взрослая особь' : '🌳 Mature Adult'}</span>`;
      }
    }

    // Founder Dynasty Badge
    const founderRow = document.getElementById('bio-founder-row');
    const founderVal = document.getElementById('bio-founder');
    if (founderRow && founderVal) {
      if (profile.dynastyName) {
        founderRow.classList.remove('hidden');
        const genText = profile.dynastyGen > 1 ? ` • F${profile.dynastyGen}` : ` • F1 (${isRu ? 'Основатель' : 'Founder'})`;
        const countText = profile.dynastyLivingCount ? ` (${profile.dynastyLivingCount} ${isRu ? 'особ.' : 'living'})` : '';
        founderVal.innerHTML = `<span style="color:#fbbf24;font-weight:700;">👑 ${escapeHtml(profile.dynastyName)}</span><span style="opacity:0.85;font-size:0.88em;">${genText}${countText}</span>`;
      } else if (profile.isAvatarLineage) {
        founderRow.classList.remove('hidden');
        founderVal.textContent = `✨ ${isRu ? 'Потомок Аватара' : 'Avatar Lineage'}`;
      } else {
        founderRow.classList.add('hidden');
      }
    }

    if (this.diveBtn) {
      const isPiloted = this.renderer.pilotedIds && (this.renderer.pilotedIds.has(this.selectedId) || this.renderer.pilotedIds.has(Number(this.selectedId)));
      if (isPiloted) {
        this.diveBtn.disabled = true;
        this.diveBtn.style.opacity = '0.55';
        this.diveBtn.style.cursor = 'not-allowed';
        this.diveBtn.title = isRu ? 'Организм уже управляется другим наблюдателем' : 'Organism is already piloted by another visitor';
        this.diveBtn.innerHTML = `<span>🔒</span> <span>${isRu ? 'Занят пилотом' : 'Occupied'}</span>`;
      } else {
        this.diveBtn.disabled = false;
        this.diveBtn.style.opacity = '1.0';
        this.diveBtn.style.cursor = 'pointer';
        this.diveBtn.title = '';
        this.diveBtn.innerHTML = `<span>🤿</span> <span>${isRu ? 'Войти в клетку (3D)' : 'Dive Inside (3D)'}</span>`;
      }
    }
  }
}
