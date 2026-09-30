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
      item.className = `journal-card ${isEpoch ? 'epoch' : ''} ${isSpecies ? 'species' : ''} ${highlightFirst && index === 0 ? 'card-incoming' : ''}`;

      const icon = entry.icon || (isEpoch ? '🌅' : (isSpecies ? '🧬' : '📜'));
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

      const badgeHtml = badge ? `<span class="journal-badge">${badge}</span>` : '';
      const insightHtml = insight ? `
        <div class="journal-insight-box">
          <span class="insight-lamp">💡</span>
          <div class="insight-body">
            <span class="insight-tag">${isRu ? 'Суть процесса:' : 'Key insight:'}</span>
            <span class="insight-text">${insight}</span>
          </div>
        </div>
      ` : '';

      item.innerHTML = `
        <div class="journal-card-header">
          <div class="journal-icon-wrap">
            <span class="journal-icon">${icon}</span>
          </div>
          <div class="journal-header-info">
            <div class="journal-meta-row">
              ${badgeHtml}
              <span class="journal-time">${timeStr}</span>
            </div>
            <div class="journal-title">${title || ''}</div>
          </div>
        </div>
        <div class="journal-story">${content || ''}</div>
        ${insightHtml}
      `;
      this.timeline.appendChild(item);
    });
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

      card.innerHTML = `
        <div class="atlas-card-header">
          <div class="atlas-day-pill">
            <span class="atlas-day-badge">${i18n.t('atlas_day_badge')} ${entry.day}</span>
            <span class="atlas-date">${entry.date || ''}</span>
          </div>
          <h3 class="atlas-day-title">${title}</h3>
        </div>

        <div class="atlas-map-container">
          <div class="atlas-map-view">
            ${entry.svgMap || ''}
          </div>
          <div class="atlas-map-caption">
            <span>🔬 ${i18n.t('atlas_survey_title')} • Ø 1240 μm</span>
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
          <div class="monograph-content">${summary}</div>
        </div>
      `;

      this.atlasPane.appendChild(card);
    });
  }
}
