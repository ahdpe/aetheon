import { escapeHtml } from './safeHtml.js';
import { i18n } from '../i18n.js';
import { getSpeciesMorphology, drawCellMembranePath, drawCellMarkings, drawFlagellum, drawAntennae } from '../gl/morphology.js';

export class CodexModal {
  constructor(socketClient) {
    this.client = socketClient;
    this.dialog = document.getElementById('codex-dialog');
    this.openBtn = document.getElementById('btn-codex');
    this.closeBtn = document.getElementById('codex-close-btn');
    this.speciesGrid = document.getElementById('species-grid');

    // Filter toolbar elements
    this.filterBar = document.getElementById('codex-filter-bar');
    this.searchInput = document.getElementById('codex-search');
    this.searchClearBtn = document.getElementById('codex-search-clear');
    this.countAll = document.getElementById('count-all');
    this.countAlive = document.getElementById('count-alive');
    this.countHunter = document.getElementById('count-hunter');
    this.countGrazer = document.getElementById('count-grazer');
    this.countFilter = document.getElementById('count-filter');
    this.countExtinct = document.getElementById('count-extinct');
    this.countDynasties = document.getElementById('count-dynasties');

    this.currentFilter = 'all';
    this.offset = 0;
    this.meta = null;
    this.searchQuery = '';
    this.allSpecies = [];
    this.allDynasties = [];
    this.activeSpecies = [];
    this.animFrameId = null;

    this.setupListeners();
  }

  setupListeners() {
    this.openBtn?.addEventListener('click', () => this.open());
    this.closeBtn?.addEventListener('click', () => this.close());

    // Click outside backdrop to dismiss
    this.dialog?.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        this.close();
      }
    });

    this.dialog?.addEventListener('close', () => {
      this.stopAnimation();
    });

    // Filter chips click handling
    const chips = this.filterBar?.querySelectorAll('.codex-chip');
    chips?.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.getAttribute('data-filter') || 'all';
        this.offset = 0; this.requestPage();
      });
    });

    // Search input handling
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value || '';
      if (this.searchClearBtn) {
        this.searchClearBtn.classList.toggle('hidden', !this.searchQuery.trim());
      }
      this.offset = 0; clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.requestPage(), 550);
    });

    this.searchClearBtn?.addEventListener('click', () => {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchQuery = '';
        this.searchClearBtn.classList.add('hidden');
        this.offset = 0; this.requestPage();
      }
    });

    window.addEventListener('aetheon-lang-changed', () => {
      if (this.dialog?.open) {
        this.applyFilterAndRender();
      }
    });
  }

  requestPage() {
    clearTimeout(this.pageTimer);
    this.pageTimer = setTimeout(() => this.client.sendGetCodex({ filter: this.currentFilter, query: this.searchQuery, offset: this.offset }), 200);
  }
  renderPager() {
    if (!this.pager) {
      this.pager = document.createElement('div'); this.pager.className = 'codex-pager';
      this.speciesGrid.after(this.pager);
    }
    this.pager.replaceChildren();
    if (!this.meta || this.currentFilter === 'dynasties') return;
    const isRu = i18n.getLang() === 'ru';
    const text = document.createElement('span');
    text.textContent = `${this.meta.total ? this.meta.offset + 1 : 0}–${Math.min(this.meta.total, this.meta.offset + 48)} / ${this.meta.total}`;
    const prev = document.createElement('button'), next = document.createElement('button');
    prev.textContent = isRu ? '← Назад' : '← Previous'; next.textContent = isRu ? 'Далее →' : 'Next →';
    prev.disabled = this.meta.offset === 0; next.disabled = this.meta.offset + 48 >= this.meta.total;
    prev.onclick = () => { this.offset = Math.max(0, this.meta.offset - 48); this.requestPage(); };
    next.onclick = () => { this.offset = this.meta.offset + 48; this.requestPage(); };
    this.pager.append(prev, text, next);
    if (this.meta.legacyAliases) {
      const note = document.createElement('small');
      note.textContent = isRu ? `Одинаковые старые морфы объединены. ${this.meta.legacyAliases} прежних записей сохранены в архиве мира.` : `Identical legacy morphs are grouped. ${this.meta.legacyAliases} old labels remain in the world archive.`;
      note.style.flexBasis = '100%'; this.pager.append(note);
    }
  }

  open() {
    this.requestPage();
    this.dialog.showModal();
    this.startAnimation();
  }

  close() {
    this.stopAnimation();
    this.dialog.close();
  }

  startAnimation() {
    if (this.animFrameId) return;
    const loop = (time) => {
      this.animFrameId = requestAnimationFrame(loop);
      this.renderCanvasFrames(time);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stopAnimation() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  renderData(speciesList, journalEntries = null, dynasties = null, meta = null) {
    if (meta) this.meta = meta;
    if (speciesList) this.allSpecies = speciesList;
    if (dynasties) this.allDynasties = dynasties;
    this.updateFilterCounts();
    this.applyFilterAndRender();
    this.renderPager();
  }

  updateFilterCounts() {
    if (!this.allSpecies) return;
    const isFilter = (s) => (s.carnivory <= 0.35 && s.carnivory < 0.1 && (s.size || 3.5) > 4.0);
    const total = this.allSpecies.length;
    const alive = this.allSpecies.filter(s => s.population > 0 && !s.extinctTime).length;
    const hunter = this.allSpecies.filter(s => s.carnivory > 0.35).length;
    const filter = this.allSpecies.filter(isFilter).length;
    const grazer = this.allSpecies.filter(s => s.carnivory <= 0.35 && !isFilter(s)).length;
    const extinct = this.allSpecies.filter(s => s.extinctTime !== null || s.population === 0).length;
    const dynastiesCount = (this.allDynasties || []).length;

    for (const [name, value] of Object.entries({ All: total, Alive: alive, Hunter: hunter, Grazer: grazer, Filter: filter, Extinct: extinct })) {
      if (this[`count${name}`]) this[`count${name}`].textContent = this.meta?.counts?.[name.toLowerCase()] ?? value;
    }
    if (this.countDynasties) this.countDynasties.textContent = dynastiesCount;
  }

  applyFilterAndRender() {
    if (!this.speciesGrid || !this.allSpecies) return;
    const isRu = i18n.getLang() === 'ru';

    // If dynasties filter is active, delegate to renderDynasties
    if (this.currentFilter === 'dynasties') {
      this.renderDynasties();
      return;
    }

    const isFilterSp = (s) => (s.carnivory <= 0.35 && s.carnivory < 0.1 && (s.size || 3.5) > 4.0);

    // 1. Filter by category
    let list = this.allSpecies;
    if (this.currentFilter === 'alive') {
      list = list.filter(s => s.population > 0 && !s.extinctTime);
    } else if (this.currentFilter === 'hunter') {
      list = list.filter(s => s.carnivory > 0.35);
    } else if (this.currentFilter === 'grazer') {
      list = list.filter(s => s.carnivory <= 0.35 && !isFilterSp(s));
    } else if (this.currentFilter === 'filter') {
      list = list.filter(isFilterSp);
    } else if (this.currentFilter === 'extinct') {
      list = list.filter(s => s.extinctTime !== null || s.population === 0);
    }

    // 2. Filter by search query
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        (s.nameLa && s.nameLa.toLowerCase().includes(q)) ||
        (s.nameRu && s.nameRu.toLowerCase().includes(q)) ||
        (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
        (s.descriptionRu && s.descriptionRu.toLowerCase().includes(q)) ||
        (s.descriptionEn && s.descriptionEn.toLowerCase().includes(q))
      );
    }

    // Sort: alive first (by population desc), then extinct (by totalCount desc)
    const sorted = [...list].sort((a, b) => {
      const aAlive = (a.population > 0 && !a.extinctTime);
      const bAlive = (b.population > 0 && !b.extinctTime);
      if (aAlive !== bAlive) return bAlive ? 1 : -1;
      if (a.population !== b.population) return b.population - a.population;
      return b.totalCount - a.totalCount;
    });

    this.activeSpecies = sorted;
    this.speciesGrid.innerHTML = '';

    if (sorted.length === 0) {
      this.speciesGrid.innerHTML = `
        <div class="codex-empty-state">
          <span class="empty-emoji">🔍</span>
          <p class="empty-title">${isRu ? 'Видов по выбранному фильтру не найдено' : 'No species found for this filter'}</p>
          <span class="empty-desc">${isRu ? 'Попробуйте выбрать другой фильтр или сбросить поиск.' : 'Try another filter category or clear search.'}</span>
        </div>
      `;
      return;
    }

    sorted.forEach(sp => {
      const card = document.createElement('div');
      const isExtinct = sp.extinctTime !== null && sp.population === 0;
      const isHunter = (sp.carnivory > 0.35);
      const isFilter = (sp.carnivory < 0.1 && (sp.size || 3.5) > 4.0);
      
      card.className = `species-card ${isExtinct ? 'extinct' : ''} ${isHunter ? 'hunter-card' : ''}`;

      const hDeg = Math.round(sp.hue * 360);
      const nameTitle = sp.nameLa || `Species #${sp.id}`;
      const nameCommon = isRu ? (sp.nameRu || sp.nameEn) : sp.nameEn;
      const desc = isRu ? (sp.descriptionRu || sp.descriptionEn) : sp.descriptionEn;

      let dietIcon = '🌾';
      let dietLabel = isRu ? 'Пастбищник' : 'Grazer';
      let dietClass = 'grazer';

      if (isHunter) {
        dietIcon = '🗡️';
        dietLabel = isRu ? 'Хищник' : 'Apex Hunter';
        dietClass = 'hunter';
      } else if (isFilter) {
        dietIcon = '🕸️';
        dietLabel = isRu ? 'Фильтратор' : 'Filter Feeder';
        dietClass = 'filter';
      }

      const speedVal = (sp.speedMax || 1.8).toFixed(1);
      const sizeVal = (sp.size || 6.5).toFixed(1);
      const affinityVal = (sp.chemotaxisNutrient || 1.0).toFixed(1);

      card.innerHTML = `
        <div class="species-visual-container">
          <canvas class="species-canvas" width="140" height="140" data-species-id="${sp.id}" aria-label="${escapeHtml(nameTitle)} live microscope portrait"></canvas>
          <div class="species-lens-ring"></div>
          <div class="species-diet-badge ${dietClass}">${dietIcon} ${dietLabel}</div>
          ${isExtinct ? `<div class="species-extinct-tag">${isRu ? 'ВЫМЕРШИЙ' : 'EXTINCT'}</div>` : ''}
        </div>
        <div class="species-card-content">
          <div class="species-card-head">
            <span class="species-badge-dot" style="background: hsl(${hDeg}, 90%, 60%); box-shadow: 0 0 10px hsl(${hDeg}, 90%, 60%);"></span>
            <div class="species-title-wrap">
              <h3 class="card-title">${escapeHtml(nameTitle)}</h3>
              <div class="card-common">${escapeHtml(nameCommon)}</div>
            </div>
          </div>

          ${sp.founderName ? `
            <div class="species-founder-pill">
              <span class="founder-crown">👑</span>
              <span class="founder-label">${isRu ? 'Династия:' : 'Dynasty:'}</span>
              <strong class="founder-name">${escapeHtml(sp.founderName)}</strong>
            </div>
          ` : ''}

          <div class="species-traits-row">
            <span class="trait-chip" title="${isRu ? 'Размер клетки' : 'Cell scale'}">📏 ${sizeVal} μm</span>
            <span class="trait-chip" title="${isRu ? 'Скорость движения' : 'Velocity'}">⚡ ${speedVal}</span>
            <span class="trait-chip" title="${isRu ? 'Хемотаксис к пище' : 'Chemotaxis'}">🧲 ${affinityVal}</span>
          </div>

          <div class="card-desc">${escapeHtml(desc)}</div>

          <div class="card-stats">
            <span class="species-status-pill ${isExtinct ? 'status-extinct' : 'status-alive'}">
              ${isExtinct ? '💀 ' + (isRu ? 'Вымерший вид' : 'Extinct') : '🟢 ' + sp.population + ' ' + (isRu ? 'в чаше' : 'active')}
            </span>
            <span class="species-total-count">${sp.countingSince ? (isRu ? 'Рождений с обновления:' : 'Births since update:') : (isRu ? 'Рождений:' : 'Births:')} ${sp.totalCount}</span>
          </div>

          <div class="species-actions-row">
            <button class="species-track-btn ${isExtinct ? 'disabled' : ''}" data-species-id="${sp.id}" ${isExtinct ? 'disabled' : ''} title="${isExtinct ? (isRu ? 'Вид вымер' : 'Species is extinct') : (isRu ? 'Найти и следить за особью в чаше' : 'Track in Ocean')}">
              ${isExtinct ? '💀 ' + (isRu ? 'Вымер' : 'Extinct') : '🎯 ' + (isRu ? 'Найти и следить' : 'Track in Ocean')}
            </button>
          </div>
        </div>
      `;

      this.speciesGrid.appendChild(card);
    });

    // Attach click events for track buttons
    const trackBtns = this.speciesGrid.querySelectorAll('.species-track-btn:not(.disabled)');
    trackBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const spId = parseInt(btn.getAttribute('data-species-id'), 10);
        this.close();
        if (this.client && typeof this.client.trackSpeciesInOcean === 'function') {
          this.client.trackSpeciesInOcean(spId);
        }
      });
    });

    // Render microscope canvases for filtered species
    this.renderCanvasFrames(performance.now());
  }

  renderDynasties() {
    if (!this.speciesGrid) return;
    const isRu = i18n.getLang() === 'ru';
    this.speciesGrid.innerHTML = '';

    let list = this.allDynasties || [];
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(d => 
        (d.name && d.name.toLowerCase().includes(q)) || 
        (d.speciesNameRu && d.speciesNameRu.toLowerCase().includes(q)) ||
        (d.speciesNameEn && d.speciesNameEn.toLowerCase().includes(q)) ||
        (d.speciesNameLa && d.speciesNameLa.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      this.speciesGrid.innerHTML = `
        <div class="codex-empty-state">
          <span class="empty-emoji">👑</span>
          <p class="empty-title">${isRu ? 'Династии пока не основаны' : 'No dynasties established yet'}</p>
          <span class="empty-desc">${isRu ? 'Войдите в режим 3D-погружения и управляйте клеткой более 30 сек, чтобы основать свою семейную ветвь!' : 'Enter 3D dive mode and pilot an organism for 30s to found your lineage branch!'}</span>
        </div>
      `;
      return;
    }

    // Sort: active dynasties first (by currentCount desc), then extinct (by maxGen desc, peakCount desc)
    const sorted = [...list].sort((a, b) => {
      if (a.isExtinct !== b.isExtinct) return a.isExtinct ? 1 : -1;
      if (!a.isExtinct && a.currentCount !== b.currentCount) return b.currentCount - a.currentCount;
      if (a.maxGen !== b.maxGen) return b.maxGen - a.maxGen;
      return b.peakCount - a.peakCount;
    });

    sorted.forEach(dyn => {
      const card = document.createElement('div');
      const isAlive = !dyn.isExtinct && dyn.currentCount > 0;
      card.className = `species-card ${!isAlive ? 'extinct' : ''} dynasty-card`;
      const hDeg = Math.round((dyn.hue || 0.5) * 360);
      const spName = isRu ? (dyn.speciesNameRu || dyn.speciesNameLa) : (dyn.speciesNameEn || dyn.speciesNameLa);
      const lifetimeMins = Math.max(1, Math.round(((dyn.extinctAt || Date.now()) - dyn.foundedAt) / 60000));

      card.innerHTML = `
        <div class="species-visual-container" style="display:flex;align-items:center;justify-content:center;background:radial-gradient(circle, hsla(${hDeg}, 80%, 40%, 0.25) 0%, transparent 70%);">
          <div style="font-size: 3.5rem; text-shadow: 0 0 20px hsla(${hDeg}, 90%, 60%, 0.6); user-select: none;">👑</div>
          <div class="species-diet-badge ${isAlive ? 'grazer' : 'filter'}" style="top: 8px; left: 8px;">
            ${isAlive ? '🟢 ' + (isRu ? 'В ЧАШЕ' : 'ACTIVE') : '🏛️ ' + (isRu ? 'ЗАЛ СЛАВЫ' : 'HALL OF FAME')}
          </div>
          ${!isAlive ? `<div class="species-extinct-tag">${isRu ? 'ВЫМЕРШАЯ ВЕТВЬ' : 'EXTINCT BRANCH'}</div>` : ''}
        </div>
        <div class="species-card-content">
          <div class="species-card-head">
            <span class="species-badge-dot" style="background: hsl(${hDeg}, 90%, 60%); box-shadow: 0 0 10px hsl(${hDeg}, 90%, 60%);"></span>
            <div class="species-title-wrap">
              <h3 class="card-title" style="color: #fbbf24; font-size: 1.25rem;">👑 ${escapeHtml(dyn.name)}</h3>
              <div class="card-common">${escapeHtml(spName)} (${escapeHtml(dyn.speciesNameLa)})</div>
            </div>
          </div>

          <div class="species-traits-row">
            <span class="trait-chip" title="${isRu ? 'Поколение ветви' : 'Branch Generation'}">🧬 F${dyn.maxGen || 1}</span>
            <span class="trait-chip" title="${isRu ? 'Пик численности' : 'Peak Population'}">📈 ${dyn.peakCount || 1} ${isRu ? 'особ.' : 'peak'}</span>
            <span class="trait-chip" title="${isRu ? 'Время существования' : 'Branch Lifetime'}">⏱️ ${lifetimeMins} ${isRu ? 'мин.' : 'min'}</span>
          </div>

          <div class="card-desc" style="font-style: italic; color: rgba(255,255,255,0.75);">
            ${isAlive 
              ? (isRu ? `Живая генеалогическая ветвь. В чаше сейчас ${dyn.currentCount} потомков Наблюдателя.` : `Active genealogical branch. Currently ${dyn.currentCount} living descendants in the droplet.`)
              : (isRu ? `Династия завершила свой эволюционный цикл и навечно вписана в Летопись Зала Славы.` : `Dynasty has completed its evolutionary cycle and is permanently enshrined in the Hall of Fame.`)}
          </div>

          <div class="card-stats">
            <span class="species-status-pill ${isAlive ? 'status-alive' : 'status-extinct'}">
              ${isAlive ? `🟢 ${dyn.currentCount} ${isRu ? 'в чаше' : 'active'}` : `🏛️ ${isRu ? 'В Зале Славы' : 'Hall of Fame'}`}
            </span>
          </div>

          ${isAlive ? `
            <div class="species-actions-row">
              <button class="species-track-btn dynasty-track-btn" data-dynasty-name="${escapeHtml(dyn.name)}">
                🎯 ${isRu ? 'Найти и следить' : 'Track in Ocean'}
              </button>
            </div>
          ` : ''}
        </div>
      `;

      if (isAlive) {
        const trackBtn = card.querySelector('.dynasty-track-btn');
        trackBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.client && typeof this.client.sendTrackDynasty === 'function') {
            this.client.sendTrackDynasty(dyn.name);
          }
          this.close();
        });
      }

      this.speciesGrid.appendChild(card);
    });
  }

  renderCanvasFrames(time) {
    if (!this.dialog.open || !this.speciesGrid) return;
    const canvases = this.speciesGrid.querySelectorAll('.species-canvas');
    if (!canvases.length) return;

    for (let i = 0; i < canvases.length; i++) {
      const cvs = canvases[i];
      const spId = parseInt(cvs.getAttribute('data-species-id'), 10);
      const sp = this.activeSpecies.find(s => s.id === spId);
      if (!sp) continue;

      // Skip offscreen canvases to maintain high 60fps performance
      const rect = cvs.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

      const ctx = cvs.getContext('2d');
      if (!ctx) continue;

      this.drawSpeciesOrganism(ctx, cvs.width, cvs.height, sp, time);
    }
  }

  drawSpeciesOrganism(ctx, w, h, sp, time) {
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const isExtinct = sp.extinctTime !== null && sp.population === 0;
    const hue = Math.round(sp.hue * 360);
    const speedRate = Math.max(0.8, sp.speedMax || 1.8);
    const morph = getSpeciesMorphology(sp.id, sp.hue, sp.carnivory || 0.1, sp.size || 6.5, speedRate);
    const isHunter = morph.isHunter;

    // 1. Petri-Dish Lens Background with deep fluid vignette
    const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, cx);
    if (isExtinct) {
      bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      bgGrad.addColorStop(0.85, 'rgba(10, 15, 28, 0.98)');
      bgGrad.addColorStop(1, 'rgba(5, 8, 18, 1)');
    } else {
      bgGrad.addColorStop(0, `hsla(${hue}, 40%, 14%, 0.85)`);
      bgGrad.addColorStop(0.75, 'rgba(6, 12, 28, 0.95)');
      bgGrad.addColorStop(1, 'rgba(2, 6, 16, 1)');
    }
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fill();

    // Micro-particles floating in chamber
    const tSec = time * 0.001;
    ctx.fillStyle = isExtinct ? 'rgba(148, 163, 184, 0.15)' : `hsla(${hue}, 80%, 75%, 0.25)`;
    for (let p = 0; p < 4; p++) {
      const px = cx + Math.sin(tSec * 0.5 + p * 2.1 + sp.id) * (cx * 0.65);
      const py = cy + Math.cos(tSec * 0.6 + p * 1.7 + sp.id) * (cy * 0.65);
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Organism Motion Math (Swimming drift and rotation)
    const swimDriftX = isExtinct ? 0 : Math.cos(tSec * 1.2 + sp.id) * 4.5;
    const swimDriftY = isExtinct ? 0 : Math.sin(tSec * 1.4 + sp.id) * 4.5;
    const orgX = cx + swimDriftX;
    const orgY = cy + swimDriftY;
    const heading = isExtinct ? 0.3 : (tSec * 0.6 * speedRate + sp.id);

    // Body dimensions scaled by species genome and morphology aspect
    const baseR = Math.max(16, Math.min(30, (sp.size || 6.5) * 2.3));
    const pulse = isExtinct ? 0 : Math.sin(tSec * 3.0 + sp.id) * 0.08;
    const bodyR = baseR * (1.0 + pulse);
    const rx = bodyR * morph.aspectX;
    const ry = bodyR * morph.aspectY;

    ctx.save();
    ctx.translate(orgX, orgY);
    ctx.rotate(heading);

    // 3. Bioluminescent Halo
    const glowR = Math.max(rx, ry) * (isHunter ? 2.5 : 2.2);
    const glow = ctx.createRadialGradient(0, 0, bodyR * 0.4, 0, 0, glowR);
    if (isExtinct) {
      glow.addColorStop(0, 'rgba(100, 116, 139, 0.15)');
      glow.addColorStop(1, 'transparent');
    } else {
      glow.addColorStop(0, `hsla(${hue}, 95%, 55%, ${isHunter ? '0.35' : '0.25'})`);
      glow.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 4. Undulating Flagellum (whip)
    if (!isExtinct) {
      drawFlagellum(ctx, rx, ry, morph, speedRate, time, sp.id);
      drawAntennae(ctx, rx, ry, morph, time, sp.id);
    }

    // 5. Undulating Cilia
    if (!isExtinct) {
      const ciliaCount = isHunter ? 14 : Math.min(26, Math.floor(bodyR * 0.9) + 8);
      ctx.strokeStyle = isHunter ? `hsla(${hue}, 95%, 70%, 0.65)` : `hsla(${hue}, 85%, 80%, 0.55)`;
      ctx.lineWidth = isHunter ? 1.4 : 1.1;

      for (let c = 0; c < ciliaCount; c++) {
        const angle = (c / ciliaCount) * Math.PI * 2;
        const wave = Math.sin(time * 0.012 * speedRate + angle * 4.0 + sp.id) * (bodyR * 0.35);
        const cLen = bodyR * (isHunter ? 0.55 : 0.42) + wave;

        const x1 = Math.cos(angle) * (rx * 0.95);
        const y1 = Math.sin(angle) * (ry * 0.95);
        const x2 = Math.cos(angle) * (rx * 0.95 + cLen);
        const y2 = Math.sin(angle) * (ry * 0.95 + cLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // 6. Viscoelastic Translucent Membrane (Specific morphotype: vibrio / bacillus / coccus / raptor / ovoid)
    if (isExtinct) {
      ctx.fillStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 1.2;
    } else {
      ctx.fillStyle = isHunter ? `hsla(${hue}, 85%, 36%, 0.72)` : `hsla(${hue}, 75%, 38%, 0.65)`;
      ctx.strokeStyle = `hsla(${hue}, 95%, 75%, 0.95)`;
      ctx.lineWidth = isHunter ? 2.0 : 1.5;
    }

    drawCellMembranePath(ctx, isExtinct ? 'ovoid' : morph.shape, rx, ry, time, sp.id);
    ctx.fill();
    ctx.stroke();

    // 7. Predatory Rostrum & Mandibles (If Apex Hunter)
    if (isHunter && !isExtinct) {
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

    // 8. Surface Markings (Spots / Stripes / Spine / Twin Core)
    if (!isExtinct) {
      drawCellMarkings(ctx, morph, rx, ry, hue, time, sp.id);
    }

    // 9. Internal Organelles & Nucleus
    const nucleusR = bodyR * 0.34;
    const nX = -rx * 0.22;
    const nY = 0;

    const nGrad = ctx.createRadialGradient(nX, nY, 1, nX, nY, nucleusR);
    if (isExtinct) {
      nGrad.addColorStop(0, 'rgba(203, 213, 225, 0.7)');
      nGrad.addColorStop(1, 'rgba(71, 85, 105, 0.2)');
    } else {
      nGrad.addColorStop(0, `hsla(${(hue + 45) % 360}, 95%, 85%, 0.95)`);
      nGrad.addColorStop(0.7, `hsla(${(hue + 35) % 360}, 90%, 65%, 0.8)`);
      nGrad.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(nX, nY, nucleusR, 0, Math.PI * 2);
    ctx.fill();

    // Dense nucleolus core
    ctx.fillStyle = isExtinct ? 'rgba(255, 255, 255, 0.5)' : '#ffffff';
    ctx.beginPath();
    ctx.arc(nX, nY, nucleusR * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
