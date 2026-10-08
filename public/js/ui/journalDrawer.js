import { escapeHtml } from './safeHtml.js';
import { i18n } from '../i18n.js';
import { sound } from '../audio/sound.js';

export class JournalDrawer {
  constructor(app) {
    this.app = app;
    this.drawer = document.getElementById('journal-drawer');
    this.backdrop = document.getElementById('drawer-backdrop');
    this.timeline = document.getElementById('drawer-timeline');
    this.atlasPane = document.getElementById('drawer-atlas');
    this.expandBtn = document.getElementById('btn-expand-journal');
    this.closeBtn = document.getElementById('btn-close-journal');
    this.footer = document.getElementById('interactive-footer');
    this.topJournalBtn = document.getElementById('btn-journal');
    this.liveHeaderBtn = document.getElementById('btn-live-header');
    this.countBadge = document.getElementById('journal-count-badge');
    this.atlasBadge = document.getElementById('atlas-count-badge');
    this.unreadDot = document.getElementById('journal-unread-dot');
    this.openSpeciesBtn = document.getElementById('btn-open-codex-species');

    this.tabFeedBtn = document.getElementById('tab-journal-feed-btn');
    this.tabAtlasBtn = document.getElementById('tab-journal-atlas-btn');

    this.isOpen = false;
    this.activeTab = 'feed'; // 'feed' | 'atlas'
    this.entries = [];
    this.atlasEntries = [];

    this.setupListeners();
  }

  setupListeners() {
    // 1. Expand from footer or button
    this.expandBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.footer?.addEventListener('click', (e) => {
      // If user clicks anywhere on the footer bar, expand
      if (!this.isOpen) {
        this.open();
      }
    });

    // 2. Expand from top header buttons
    this.topJournalBtn?.addEventListener('click', () => this.toggle());
    this.liveHeaderBtn?.addEventListener('click', () => this.toggle());

    // 3. Close button & backdrop
    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    this.backdrop?.addEventListener('click', () => this.close());

    // 4. Drawer Tabs Switching (Feed vs Atlas)
    this.tabFeedBtn?.addEventListener('click', () => this.switchTab('feed'));
    this.tabAtlasBtn?.addEventListener('click', () => this.switchTab('atlas'));

    // 5. Switch from Journal to Species Codex
    this.openSpeciesBtn?.addEventListener('click', () => {
      this.close();
      if (this.app?.codexModal) {
        this.app.codexModal.open();
        this.app.codexModal.switchTab('species');
      }
    });

    // 6. Keyboard shortcut: J
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'j' || e.key === 'J' || e.key === 'о' || e.key === 'О') {
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // 7. Mobile swipe down to close
    let touchStartY = 0;
    this.drawer?.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.drawer?.addEventListener('touchmove', (e) => {
      const touchY = e.touches[0].clientY;
      const diffY = touchY - touchStartY;
      // If at top of scroll and pulling down
      if (this.drawer.scrollTop <= 0 && diffY > 60) {
        this.close();
      }
    }, { passive: true });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.drawer?.classList.add('open');
    this.backdrop?.classList.add('open');
    this.footer?.classList.add('drawer-active');
    this.liveHeaderBtn?.classList.add('active');

    // Hide unread dot
    if (this.unreadDot) this.unreadDot.classList.add('hidden');

    sound.playDroplet(850);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.drawer?.classList.remove('open');
    this.backdrop?.classList.remove('open');
    this.footer?.classList.remove('drawer-active');
    this.liveHeaderBtn?.classList.remove('active');

    sound.playDroplet(550);
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  switchTab(tab) {
    this.activeTab = tab;
    if (tab === 'feed') {
      this.tabFeedBtn?.classList.add('active');
      this.tabAtlasBtn?.classList.remove('active');
      this.timeline?.classList.remove('hidden');
      this.atlasPane?.classList.add('hidden');
    } else {
      this.tabAtlasBtn?.classList.add('active');
      this.tabFeedBtn?.classList.remove('active');
      this.timeline?.classList.add('hidden');
      this.atlasPane?.classList.remove('hidden');
      this.renderAtlas();
    }
    sound.playDroplet(750);
  }

  setEntries(entries) {
    if (!Array.isArray(entries)) return;
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
    const seen = new Set();
    const clean = [];
    for (const e of entries) {
      const k = norm(e.titleEn || e.titleRu);
      if (!seen.has(k)) {
        seen.add(k);
        clean.push(e);
      }
    }
    this.entries = clean;
    this.updateCountBadge();
    if (this.activeTab === 'feed') {
      this.render();
    }
  }

  setAtlasEntries(entries) {
    if (!Array.isArray(entries)) return;
    this.atlasEntries = entries;
    if (this.atlasBadge) {
      this.atlasBadge.textContent = entries.length;
      this.atlasBadge.style.display = entries.length > 0 ? 'inline-flex' : 'none';
    }
    if (this.activeTab === 'atlas') {
      this.renderAtlas();
    }
  }

  addLiveEntry(entry) {
    if (!entry) return;
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
    const key = norm(entry.titleEn || entry.titleRu);
    if (this.entries.some(e => norm(e.titleEn || e.titleRu) === key)) {
      return; // Suppress duplicate
    }

    this.entries.unshift(entry);
    if (this.entries.length > 60) this.entries.pop();

    this.updateCountBadge();

    // Show unread indicator if closed
    if (!this.isOpen && this.unreadDot) {
      this.unreadDot.classList.remove('hidden');
    }

    if (this.activeTab === 'feed') {
      this.render(true); // render with animation
    }
  }

  updateCountBadge() {
    const count = this.entries.length;
    if (this.countBadge) {
      this.countBadge.textContent = count > 0 ? count : '';
      this.countBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  render(highlightFirst = false) {
    if (!this.timeline) return;
    const isRu = i18n.getLang() === 'ru';
    this.timeline.innerHTML = '';

    if (this.entries.length === 0) {
      this.timeline.innerHTML = `
        <div class="journal-empty-state">
          <span class="empty-icon">🌱</span>
          <p>${isRu ? 'Наблюдение за микромиром только началось...' : 'Observation of the primordial waters has just begun...'}</p>
        </div>
      `;
      return;
    }

    this.entries.forEach((entry, index) => {
      const item = document.createElement('div');
      const isEpoch = entry.type === 'epoch';
      const isSpecies = entry.type === 'species';
      const isCataclysm = entry.type === 'cataclysm';
      item.className = `journal-card ${isEpoch ? 'epoch' : ''} ${isSpecies ? 'species' : ''} ${isCataclysm ? 'cataclysm' : ''} ${highlightFirst && index === 0 ? 'card-incoming' : ''}`;

      const icon = entry.icon || (isEpoch ? '🌅' : (isSpecies ? '🧬' : (isCataclysm ? '💥' : '📜')));
      const badge = isRu ? (entry.badgeRu || entry.badgeEn) : (entry.badgeEn || entry.badgeRu);
      const title = isRu ? (entry.titleRu || entry.titleEn) : entry.titleEn;
      const content = isRu ? (entry.contentRu || entry.contentEn) : entry.contentEn;
      const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      let rawInsight = isRu ? (entry.insightRu || entry.insightEn) : (entry.insightEn || entry.insightRu);
      let insight = (rawInsight && rawInsight.trim().length > 0) ? rawInsight.trim() : null;

      // Clean redundant prefixes
      if (insight) {
        insight = insight.replace(/^(это значит,\s*что|это означает,\s*что|this means that,?\s*)/i, '').trim();
        if (insight.length > 0) {
          insight = insight.charAt(0).toUpperCase() + insight.slice(1);
        } else {
          insight = null;
        }
      }

      const badgeHtml = (badge ? `<span class="journal-badge">${escapeHtml(badge)}</span>` : '') + (entry.legacyUnverified ? `<span class="journal-badge">${isRu ? 'Архив: данные не проверены' : 'Archive: unverified data'}</span>` : '');
      const insightHtml = insight ? `
        <div class="journal-insight-box">
          <span class="insight-lamp">💡</span>
          <div class="insight-body">
            <span class="insight-tag">${isRu ? 'Суть процесса:' : 'Key insight:'}</span>
            <span class="insight-text">${escapeHtml(insight)}</span>
          </div>
        </div>
      ` : '';

      // Contextual Visual Illustration: If news is about a species/creature, show its micro-portrait!
      let visualHtml = '';
      const targetSpeciesId = entry.speciesId || entry.species?.id;
      if (isSpecies || entry.species) {
        visualHtml = this.renderOrganismPortraitSvg(entry.species || entry, isRu, targetSpeciesId);
      } else if (isCataclysm) {
        visualHtml = `
          <div class="journal-cataclysm-banner">
            <span class="cataclysm-banner-icon">${escapeHtml(icon)}</span>
            <span class="cataclysm-banner-text">${escapeHtml(badge)}</span>
          </div>
        `;
      }

      item.innerHTML = `
        <div class="journal-card-header">
          <div class="journal-icon-wrap">
            <span class="journal-icon">${escapeHtml(icon)}</span>
          </div>
          <div class="journal-header-info">
            <div class="journal-meta-row">
              ${badgeHtml}
              <span class="journal-time">${timeStr}</span>
            </div>
            <div class="journal-title">${escapeHtml(title || '')}</div>
          </div>
        </div>
        ${visualHtml}
        <div class="journal-story">${escapeHtml(content || '')}</div>
        ${insightHtml}
      `;

      // Attach click events for specimen tracking buttons in journal
      const trackBtn = item.querySelector('.journal-track-btn:not(.disabled)');
      if (trackBtn) {
        trackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const spId = parseInt(trackBtn.getAttribute('data-species-id'), 10);
          if (spId) {
            this.close();
            const app = this.app || window.aetheonApp;
            if (app && typeof app.trackSpeciesInOcean === 'function') {
              app.trackSpeciesInOcean(spId);
            }
          }
        });
      }

      this.timeline.appendChild(item);
    });
  }

  // Generate authentic micro-anatomical SVG portrait of a specimen
  renderOrganismPortraitSvg(species, isRu = true, speciesId = null) {
    if (!species) return '';
    const hue = Math.round((species.hue !== undefined ? species.hue : 0.52) * 360);
    const isHunter = (species.carnivory || 0) > 0.38;
    const size = Math.max(2.5, Math.min(9.5, species.size || 4.2));
    const speed = (species.speedMax || 1.8).toFixed(1);
    const sizeFormatted = size.toFixed(1);

    const rx = isHunter ? 38 : 32;
    const ry = isHunter ? 18 : 24;

    let flagellaSvg = '';
    if (isHunter) {
      flagellaSvg = `
        <path d="M 38 60 Q 15 50, 6 64 T -8 58" fill="none" stroke="hsla(${hue}, 85%, 75%, 0.85)" stroke-width="2.2" stroke-linecap="round" />
        <path d="M 40 64 Q 20 68, 8 76" fill="none" stroke="hsla(${hue}, 80%, 70%, 0.55)" stroke-width="1.6" />
      `;
    } else {
      flagellaSvg = `
        <path d="M 35 60 Q 18 52, 10 65 T 2 58" fill="none" stroke="hsla(${hue}, 85%, 75%, 0.8)" stroke-width="1.8" stroke-linecap="round" />
      `;
    }

    let ciliaSvg = '';
    const ciliaCount = isHunter ? 16 : 22;
    for (let i = 0; i < ciliaCount; i++) {
      const a = (i / ciliaCount) * Math.PI * 2;
      const cx1 = 70 + Math.cos(a) * rx;
      const cy1 = 60 + Math.sin(a) * ry;
      const cx2 = 70 + Math.cos(a) * (rx + 7);
      const cy2 = 60 + Math.sin(a) * (ry + 7);
      ciliaSvg += `<line x1="${cx1.toFixed(1)}" y1="${cy1.toFixed(1)}" x2="${cx2.toFixed(1)}" y2="${cy2.toFixed(1)}" stroke="hsla(${hue}, 80%, 80%, 0.45)" stroke-width="1.2" />`;
    }

    let hunterJaws = '';
    if (isHunter) {
      hunterJaws = `
        <polygon points="106,56 122,60 106,64" fill="hsla(${(hue + 30) % 360}, 95%, 65%, 0.95)" stroke="#ffffff" stroke-width="0.8" />
        <polygon points="86,40 96,33 93,42" fill="hsla(${hue}, 95%, 70%, 0.9)" />
        <polygon points="86,80 96,87 93,78" fill="hsla(${hue}, 95%, 70%, 0.9)" />
      `;
    }

    const nameStr = isRu ? (species.nameRu || species.nameLa || 'Экземпляр') : (species.nameEn || species.nameLa || 'Specimen');
    const badgeLabel = isRu ? '🔬 МИКРО-ПОРТРЕТ ОСОБИ' : '🔬 SPECIMEN PORTRAIT';
    const dietLabel = isHunter ? (isRu ? '⚔️ Хищник' : '⚔️ Predator') : (isRu ? '🌿 Продуцент' : '🌿 Grazer');

    const spId = speciesId || species.id;
    const renderer = this.app?.renderer || window.aetheonApp?.renderer;
    const liveCount = (renderer && renderer.currEntities && spId)
      ? Array.from(renderer.currEntities.values()).filter(o => o.speciesId === spId).length
      : 0;

    const isAlive = liveCount > 0;
    const statusHtml = isAlive
      ? `<span class="journal-species-status status-alive">🟢 ${isRu ? `В океане: ${liveCount} шт.` : `In ocean: ${liveCount}`}</span>`
      : `<span class="journal-species-status status-extinct" title="${isRu ? 'Особи этого вида погибли в ходе естественного отбора' : 'All specimens have perished in natural selection'}">💀 ${isRu ? 'Вымер в океане' : 'Extinct in ocean'}</span>`;

    const trackBtnHtml = spId ? (isAlive
      ? `<button class="journal-track-btn" data-species-id="${spId}" title="${isRu ? 'Найти и следить за особью в чаше' : 'Track specimen in ocean'}">
           <span>🎯</span> <span>${isRu ? 'Найти в чаше' : 'Track in Ocean'}</span>
         </button>`
      : `<button class="journal-track-btn disabled" disabled title="${isRu ? 'Этот вид вымер и больше не присутствует в толще воды' : 'This species has gone extinct'}">
           <span>💀</span> <span>${isRu ? 'Вид вымер' : 'Extinct'}</span>
         </button>`
    ) : '';

    return `
      <div class="journal-organism-portrait">
        <div class="portrait-lens">
          <svg viewBox="0 0 140 120" width="140" height="120" class="organism-svg-view">
            <defs>
              <radialGradient id="haloGrad_${species.id || hue}" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="hsla(${hue}, 95%, 60%, 0.35)" />
                <stop offset="100%" stop-color="transparent" />
              </radialGradient>
              <linearGradient id="dicGrad_${species.id || hue}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="rgba(255,255,255,0.4)" />
                <stop offset="40%" stop-color="transparent" />
                <stop offset="100%" stop-color="rgba(0,0,0,0.5)" />
              </linearGradient>
            </defs>
            <ellipse cx="70" cy="60" rx="${rx * 1.6}" ry="${ry * 1.6}" fill="url(#haloGrad_${species.id || hue})" />
            ${flagellaSvg}
            ${ciliaSvg}
            <ellipse cx="70" cy="60" rx="${rx}" ry="${ry}" fill="hsla(${hue}, 80%, 40%, 0.85)" stroke="hsla(${hue}, 95%, 75%, 0.95)" stroke-width="1.6" />
            <ellipse cx="70" cy="60" rx="${rx}" ry="${ry}" fill="url(#dicGrad_${species.id || hue})" />
            <circle cx="64" cy="58" r="${isHunter ? 7 : 9}" fill="hsla(${(hue + 40) % 360}, 90%, 70%, 0.85)" />
            <circle cx="62" cy="56" r="${isHunter ? 3 : 4}" fill="#ffffff" opacity="0.8" />
            ${hunterJaws}
          </svg>
        </div>
        <div class="portrait-details">
          <div class="portrait-badge">${badgeLabel}</div>
          <div class="portrait-title">${escapeHtml(nameStr)}</div>
          <div class="portrait-stats">
            <span>📏 Ø ${sizeFormatted} мкм</span>
            <span>⚡ ${speed} мкм/шаг</span>
            <span>${dietLabel}</span>
          </div>
          <div class="portrait-footer">
            ${statusHtml}
            ${trackBtnHtml}
          </div>
        </div>
      </div>
    `;
  }

  renderAtlas() {
    if (!this.atlasPane) return;
    const isRu = i18n.getLang() === 'ru';
    this.atlasPane.innerHTML = '';

    if (!this.atlasEntries || this.atlasEntries.length === 0) {
      this.atlasPane.innerHTML = `
        <div class="atlas-empty-state">
          <span class="empty-icon">🗺️</span>
          <p>${i18n.t('atlas_empty')}</p>
        </div>
      `;
      return;
    }

    this.atlasEntries.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'atlas-card glass-panel';

      const title = isRu ? (entry.titleRu || entry.titleEn) : entry.titleEn;
      const summary = isRu ? (entry.summaryRu || entry.summaryEn) : entry.summaryEn;
      const m = entry.metrics || {};
      const dominant = isRu ? (m.dominantSpeciesRu || m.dominantSpeciesEn) : m.dominantSpeciesEn;
      const apex = isRu ? (m.apexHunterRu || m.apexHunterEn) : m.apexHunterEn;

      // Check if client cached a screenshot for this Atlas day, or generate live authentic landscape snapshot
      const cacheKey = `aetheon_atlas_v6_day_${entry.day}`;
      let dayScreenshot = entry.screenshot;
      if (!dayScreenshot) {
        try {
          dayScreenshot = localStorage.getItem(cacheKey);
        } catch (_) {}
      }

      const renderer = this.app?.renderer || window.aetheonApp?.renderer;
      // Always capture fresh authentic snapshot if not cached in v6, or if viewing current active day
      if (renderer && (!dayScreenshot || entry.day === (this.atlasEntries[0]?.day || 1))) {
        const fresh = renderer.captureDropletSnapshot(560);
        if (fresh) {
          dayScreenshot = fresh;
          entry.screenshot = fresh;
          try {
            localStorage.setItem(cacheKey, fresh);
          } catch (_) {}
        }
      }

      card.innerHTML = `
        <div class="atlas-card-header">
          <div class="atlas-day-pill">
            <span class="atlas-day-badge">${i18n.t('atlas_day_badge')} ${entry.day}</span>
            <span class="atlas-date">${entry.date || ''}</span>
          </div>
          <h3 class="atlas-day-title">${escapeHtml(title)}</h3>
        </div>

        <div class="atlas-map-container">
          <div class="atlas-map-view">
            ${dayScreenshot ? `<img src="${dayScreenshot}" class="atlas-screenshot-img" alt="Day ${entry.day} Real Landscape Snapshot" />` : (entry.svgMap || '')}
          </div>
          <div class="atlas-map-caption">
            <span>🗺️ ${isRu ? 'КАРТА ЛАНДШАФТА И РИФОВ' : 'BENTHIC LANDSCAPE & REEF SURVEY'} • Ø 1240 мкм</span>
            <button class="atlas-refresh-cam-btn" data-day="${entry.day}" title="${isRu ? 'Сделать свежий снимок капли' : 'Take fresh droplet snapshot'}">
              <span>📷</span> ${isRu ? 'Свежий снимок' : 'Live Snapshot'}
            </button>
            <span>DAY ${entry.day}</span>
          </div>
        </div>

        <div class="atlas-metrics-grid">
          <div class="atlas-metric-chip">
            <span class="chip-icon">👥</span>
            <div class="chip-data">
              <span class="chip-val">${m.population || 280}</span>
              <span class="chip-lbl">${i18n.t('atlas_metric_pop')}</span>
            </div>
          </div>
          <div class="atlas-metric-chip">
            <span class="chip-icon">🧬</span>
            <div class="chip-data">
              <span class="chip-val">${m.speciesCount || 40}</span>
              <span class="chip-lbl">${i18n.t('atlas_metric_species')}</span>
            </div>
          </div>
          <div class="atlas-metric-chip">
            <span class="chip-icon">🪸</span>
            <div class="chip-data">
              <span class="chip-val">${m.reefCoverage || 0}%</span>
              <span class="chip-lbl">${i18n.t('atlas_metric_reefs')}</span>
            </div>
          </div>
          <div class="atlas-metric-chip">
            <span class="chip-icon">🔗</span>
            <div class="chip-data">
              <span class="chip-val">${m.coloniesCount || 0}</span>
              <span class="chip-lbl">${i18n.t('atlas_metric_colonies')}</span>
            </div>
          </div>
          <div class="atlas-metric-chip">
            <span class="chip-icon">👑</span>
            <div class="chip-data">
              <span class="chip-val">${dominant || '—'}</span>
              <span class="chip-lbl">${i18n.t('atlas_metric_dominant')}</span>
            </div>
          </div>
          <div class="atlas-metric-chip">
            <span class="chip-icon">🦈</span>
            <div class="chip-data">
              <span class="chip-val">${apex || '—'}</span>
              <span class="chip-lbl">${i18n.t('atlas_metric_apex')}</span>
            </div>
          </div>
        </div>

        <div class="atlas-monograph-box">
          <div class="monograph-header">
            <span class="monograph-icon">📜</span>
            <span class="monograph-author">${isRu ? 'Хроника эволюции от Venice AI' : 'Evolution Monograph by Venice AI'}</span>
          </div>
          <div class="monograph-content">${escapeHtml(summary)}</div>
        </div>
      `;

      const camBtn = card.querySelector('.atlas-refresh-cam-btn');
      if (camBtn) {
        camBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = this.app?.renderer || window.aetheonApp?.renderer;
          if (r) {
            camBtn.style.opacity = '0.5';
            camBtn.textContent = isRu ? '⏳ Снимок...' : '⏳ Snapping...';
            setTimeout(() => {
              const fresh = r.captureDropletSnapshot(560);
              if (fresh) {
                entry.screenshot = fresh;
                try {
                  localStorage.setItem(`aetheon_atlas_v6_day_${entry.day}`, fresh);
                } catch (_) {}
                const img = card.querySelector('.atlas-screenshot-img');
                if (img) img.src = fresh;
                else this.renderAtlas();
              }
              camBtn.style.opacity = '1';
              camBtn.innerHTML = `<span>📷</span> ${isRu ? 'Свежий снимок' : 'Live Snapshot'}`;
            }, 60);
          }
        });
      }

      this.atlasPane.appendChild(card);
    });
  }
}
