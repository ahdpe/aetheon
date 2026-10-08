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
    this.scanBtn = document.getElementById('btn-ai-scan-target');
    this.scanLabel = document.getElementById('btn-ai-scan-label');

    this.aiCard = document.getElementById('bio-ai-card');
    this.aiMoniker = document.getElementById('bio-ai-moniker');
    this.aiStatusBadge = document.getElementById('bio-ai-status-badge');
    this.aiStory = document.getElementById('bio-ai-story');
    this.aiTags = document.getElementById('bio-ai-tags');
    this.isScanning = false;

    this.anatomyPanel=document.createElement('div');this.anatomyPanel.className='anatomy-card';
    this.panel.querySelector('.inspector-vitals').after(this.anatomyPanel);
    this.selectedId = null;
    this.isTracking = false;
    this.lastProfile = null;

    this.followBar = document.createElement('aside');
    this.followBar.className = 'cell-follow-bar glass-panel';
    this.followBar.hidden = true;
    this.followLabel = document.createElement('span');
    this.followDetails = document.createElement('button');
    this.followStop = document.createElement('button');
    this.followBar.append(this.followLabel, this.followDetails, this.followStop);
    document.body.append(this.followBar);
    this.followDetails.addEventListener('click', () => {
      if (this.selectedId) this.select(this.selectedId);
    });
    this.followStop.addEventListener('click', () => this.close());

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
      if (this.isTracking) this.stopTracking();
      else this.startTracking();
    });

    this.scanBtn?.addEventListener('click', () => {
      if (this.selectedId) {
        this.requestBioScan(this.selectedId);
      }
    });

    this.diveBtn?.addEventListener('click', async () => {
      if (this.selectedId) {
        if (this.renderer.pilotedIds && (this.renderer.pilotedIds.has(this.selectedId) || this.renderer.pilotedIds.has(Number(this.selectedId)))) {
          return;
        }
        this.renderer.camera.trackedEntityId = this.selectedId;
        this.isTracking = true;
        this.panel.classList.add('hidden');
        this.followBar.hidden = true;
        const engine = await this.client.getDiveEngine();
        if (engine) {
          engine.enter(this.selectedId);
        }
      }
    });

    window.addEventListener('aetheon-lang-changed', () => {
      this.syncTrackingUI();
      if (this.lastProfile && this.selectedId) {
        this.updateProfile(this.lastProfile);
      }
    });
  }

  select(organismId) {
    this.client.remainsPanel?.close();
    if (this.selectedId !== organismId) this.stopTracking();
    this.selectedId = organismId;
    this.lastProfile = null;
    this.isScanning = false;
    if (this.scanBtn) {
      this.scanBtn.disabled = false;
      this.scanBtn.style.opacity = '1.0';
    }
    if (this.scanLabel) this.scanLabel.textContent = i18n.t('btn_ai_scan');
    if (this.aiCard) this.aiCard.classList.add('hidden');
    this.anatomyPanel.textContent='';
    this.client.observatory?.onProfile(null);
    this.panel.classList.remove('hidden');
    this.syncTrackingUI();
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
        this.diveBtn.innerHTML = `<span>🤿</span> <span>${isRu ? 'Погрузиться внутрь (3D)' : 'Dive Inside (3D)'}</span>`;
      }
    }

    // Request full profile from server
    this.client.sendInspect(organismId);
  }

  close() {
    this.selectedId = null;
    this.stopTracking();
    this.lastProfile = null;
    this.isScanning = false;
    if (this.aiCard) this.aiCard.classList.add('hidden');
    this.anatomyPanel.textContent='';
    this.client.observatory?.onProfile(null);
    this.renderer.camera.trackedEntityId = null;
    this.panel.classList.add('hidden');
  }

  startTracking() {
    if (!this.selectedId) return;
    this.isTracking = true;
    this.renderer.camera.trackedEntityId = this.selectedId;
    if (window.matchMedia('(max-width: 640px)').matches) this.panel.classList.add('hidden');
    this.syncTrackingUI();
  }

  stopTracking() {
    this.isTracking = false;
    this.renderer.camera.trackedEntityId = null;
    this.syncTrackingUI();
  }

  syncTrackingUI() {
    const ru = i18n.getLang() === 'ru';
    this.trackBtn.textContent = this.isTracking ? (ru ? '⏹ Остановить слежение' : '⏹ Stop following') : i18n.t('btn_track');
    this.trackBtn.setAttribute('aria-pressed', String(this.isTracking));
    this.trackBtn.style.borderColor = this.isTracking ? 'var(--accent-cyan)' : 'var(--border-subtle)';
    this.followBar.hidden = !this.isTracking || !this.panel.classList.contains('hidden');
    this.followLabel.textContent = `${ru ? '🎯 Следим' : '🎯 Following'} · #${this.selectedId}\n${ru ? 'Касание океана — стоп' : 'Tap the ocean to stop'}`;
    this.followDetails.textContent = ru ? 'Карточка' : 'Details';
    this.followStop.textContent = ru ? 'Стоп' : 'Stop';
    this.followBar.title = ru ? 'Коснитесь океана, чтобы остановить слежение' : 'Tap the ocean to stop following';
    if (this.scanLabel && !this.isScanning) {
      this.scanLabel.textContent = i18n.t('btn_ai_scan');
    }
  }

  requestBioScan(id) {
    if (!id || this.isScanning) return;
    this.isScanning = true;
    const isRu = i18n.getLang() === 'ru';
    if (this.scanLabel) this.scanLabel.textContent = i18n.t('btn_ai_scan_loading');
    if (this.scanBtn) {
      this.scanBtn.disabled = true;
      this.scanBtn.style.opacity = '0.65';
    }

    if (this.aiCard) {
      this.aiCard.classList.remove('hidden');
      if (this.aiMoniker) this.aiMoniker.textContent = isRu ? 'Хроника особи' : 'Specimen Chronicle';
      if (this.aiStatusBadge) this.aiStatusBadge.textContent = isRu ? 'Анализ нейросетью…' : 'Neural scan…';
      if (this.aiStory) this.aiStory.textContent = isRu 
        ? '🔬 Venice AI считывает генетический след, трофику и манёвры клетки…' 
        : '🔬 Venice AI is reading genetic history, trophic habits and maneuvers…';
      if (this.aiTags) this.aiTags.innerHTML = '';
    }

    this.client.sendBioScan(id);
  }

  onBioScanResult(msg) {
    this.isScanning = false;
    const isRu = i18n.getLang() === 'ru';
    if (this.scanBtn) {
      this.scanBtn.disabled = false;
      this.scanBtn.style.opacity = '1.0';
    }
    if (this.scanLabel) {
      this.scanLabel.textContent = i18n.t('btn_ai_scan');
    }

    if (!msg || msg.id !== this.selectedId) return;

    if (msg.success && msg.scan) {
      if (this.aiCard) this.aiCard.classList.remove('hidden');
      if (this.aiMoniker) this.aiMoniker.textContent = msg.scan.name || (isRu ? `Особь #${msg.id}` : `Specimen #${msg.id}`);
      if (this.aiStatusBadge) this.aiStatusBadge.textContent = isRu ? (msg.scan.statusTitleRu || 'Исследовано') : (msg.scan.statusTitleEn || 'Inspected');
      if (this.aiStory) this.aiStory.textContent = isRu ? msg.scan.bioRu : (msg.scan.bioEn || msg.scan.bioRu);
      if (this.aiTags) {
        const traits = Array.isArray(msg.scan.traits) ? msg.scan.traits : [];
        this.aiTags.innerHTML = traits.map(t => `<span class="ai-tag">🏷️ ${escapeHtml(t)}</span>`).join('');
      }
    } else {
      if (this.aiCard) this.aiCard.classList.remove('hidden');
      if (this.aiStory) this.aiStory.textContent = msg.error || (isRu ? 'Скан временно недоступен.' : 'Scan temporarily unavailable.');
    }
  }

  updateProfile(profile) {
    if (!profile || profile.id !== this.selectedId) return;
    this.lastProfile = profile;
    if (profile.aiBioScan && this.aiCard && !this.isScanning) {
      this.onBioScanResult({ id: profile.id, success: true, scan: profile.aiBioScan });
    }
    const isRu = i18n.getLang() === 'ru';
    const labels=isRu?{elongation:'Вытянутость',shell:'Оболочка',flagella:'Жгутики',sensing:'Чувствительность'}:{elongation:'Elongation',shell:'Shell',flagella:'Flagella',sensing:'Sensing'};
    const habitats=isRu?{basin:'Внутренняя котловина',meadow:'Кольцо лугов',shoal:'Мелководный край',shadow:'Сумеречная заводь',frontier:'Внешняя отмель'}:{basin:'Inner basin',meadow:'Meadow ring',shoal:'Shallow rim',shadow:'Twilight backwater',frontier:'Outer frontier'};
    this.anatomyPanel.innerHTML=profile.anatomy?`<strong>${isRu?'Наследуемое тело':'Inherited body'}</strong><div>${Object.entries(labels).map(([k,label])=>`<span>${label}<b>${Math.round(profile.anatomy[k]*100)}%</b></span>`).join('')}</div><small>${habitats[profile.habitat]??''} · ${isRu?'развитие тела требует энергии':'body development costs energy'}</small>`:'';

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

    if (speciesName) speciesName.textContent = profile.familyName || profile.speciesName || 'Aetheobiont';

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
        this.diveBtn.innerHTML = `<span>🤿</span> <span>${isRu ? 'Погрузиться внутрь (3D)' : 'Dive Inside (3D)'}</span>`;
      }
    }
  }
}
