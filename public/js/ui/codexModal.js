import { i18n } from '../i18n.js';

export class CodexModal {
  constructor(socketClient) {
    this.client = socketClient;
    this.dialog = document.getElementById('codex-dialog');
    this.openBtn = document.getElementById('btn-codex');
    this.closeBtn = document.getElementById('codex-close-btn');

    this.tabSpeciesBtn = document.getElementById('tab-species-btn');
    this.tabJournalBtn = document.getElementById('tab-journal-btn');
    this.tabSpeciesContent = document.getElementById('tab-species-content');
    this.tabJournalContent = document.getElementById('tab-journal-content');

    this.speciesGrid = document.getElementById('species-grid');
    this.journalTimeline = document.getElementById('journal-timeline');

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

    this.tabSpeciesBtn?.addEventListener('click', () => this.switchTab('species'));
    this.tabJournalBtn?.addEventListener('click', () => this.switchTab('journal'));
  }

  open() {
    this.client.sendGetCodex();
    this.dialog.showModal();
  }

  close() {
    this.dialog.close();
  }

  switchTab(tab) {
    if (tab === 'species') {
      this.tabSpeciesBtn.classList.add('active');
      this.tabJournalBtn.classList.remove('active');
      this.tabSpeciesContent.classList.add('active');
      this.tabJournalContent.classList.remove('active');
    } else {
      this.tabJournalBtn.classList.add('active');
      this.tabSpeciesBtn.classList.remove('active');
      this.tabJournalContent.classList.add('active');
      this.tabSpeciesContent.classList.remove('active');
    }
  }

  renderData(speciesList, journalEntries) {
    const isRu = i18n.getLang() === 'ru';

    // 1. Render Species Grid
    if (this.speciesGrid && speciesList) {
      this.speciesGrid.innerHTML = '';
      speciesList.forEach(sp => {
        const card = document.createElement('div');
        card.className = 'species-card';

        const hDeg = Math.round(sp.hue * 360);
        const nameTitle = sp.nameLa || `Species #${sp.id}`;
        const nameCommon = isRu ? (sp.nameRu || sp.nameEn) : sp.nameEn;
        const desc = isRu ? (sp.descriptionRu || sp.descriptionEn) : sp.descriptionEn;
        const isExtinct = sp.extinctTime !== null && sp.population === 0;

        card.innerHTML = `
          <div class="species-card-head">
            <span class="species-badge-dot" style="background: hsl(${hDeg}, 85%, 60%); box-shadow: 0 0 8px hsl(${hDeg}, 85%, 60%);"></span>
            <div>
              <div class="card-title">${nameTitle}</div>
              <div class="card-common">${nameCommon}</div>
            </div>
          </div>
          <div class="card-desc">${desc}</div>
          <div class="card-stats">
            <span>${isExtinct ? '💀 ' + (isRu ? 'Вымер' : 'Extinct') : '🟢 ' + sp.population + ' ' + (isRu ? 'жив' : 'alive')}</span>
            <span>${isRu ? 'Всего:' : 'Total:'} ${sp.totalCount}</span>
          </div>
        `;
        this.speciesGrid.appendChild(card);
      });
    }

    // 2. Render Journal Timeline
    if (this.journalTimeline && journalEntries) {
      this.journalTimeline.innerHTML = '';
      journalEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = `journal-item ${entry.type === 'epoch' ? 'epoch' : ''}`;

        const title = isRu ? (entry.titleRu || entry.titleEn) : entry.titleEn;
        const content = isRu ? (entry.contentRu || entry.contentEn) : entry.contentEn;
        const timeStr = new Date(entry.timestamp).toLocaleTimeString();

        item.innerHTML = `
          <div class="journal-title">${title}</div>
          <div class="journal-content">${content}</div>
          <div class="journal-time">${timeStr}</div>
        `;
        this.journalTimeline.appendChild(item);
      });
    }
  }
}
