import { i18n } from '../i18n.js';
import { escapeHtml } from './safeHtml.js';

const COPY = {
  en: {
    start:'Start here', tour:'Find a living story', mine:'My families',
    title:'One ocean. A life of its own.',
    intro:'These cells seek food, compete and reproduce with mutations. Everyone visits the same ocean, which keeps evolving while you are away.',
    invitation:'Choose a cell, watch its family and return to meet its descendants.',
    later:'Just watch', watch:'Watch this family', families:'Your field notebook',
    empty:'Choose a cell and press “Watch this family”. Your notebook stays in this browser; you can keep three families.',
    loading:'Reading the family…', missing:'This family is no longer in the bounded history archive. Its current state is unknown.',
    living:'Living now', births:'Recorded births', since:'Births since your last visit', generations:'Generations beyond founder',
    extinct:'No living descendants', active:'Family continues', focus:'Visit a living descendant', forget:'Remove from notebook',
    genetic:'Inherited genome traits', geneNote:'Values describe genes in model units, not measured motion.', first:'When you first watched', founderTraits:'Founder’s recorded traits', now:'Living family average',
    size:'Adult size', speedMax:'Maximum speed', carnivory:'Predatory tendency', adhesion:'Cell adhesion', metabolismEfficiency:'Metabolic efficiency', chemotaxisNutrient:'Nutrient sensitivity',
    elongation:'Elongation', shell:'Shell', flagella:'Flagella', sensing:'Sensing',
    ancestry:'Recent recorded members', founder:'Founder', parent:'parent', gen:'generation', alive:'living', dead:'died', baseline:'already alive when records began',
    note:'Family records begin with observation, not with the birth of the ocean. Recent ancestry and extinct families have a bounded archive. Missing links are left unknown.',
    saved:'Saved in this browser', last:'At your last visit', members:'living members', choose:'Choose a family below to check its current state.', olderNodes:'Older individual records have left the recent ancestry window.', cellGone:'This cell is no longer present in the living ocean.',
    close:'Close field notebook', offline:'Reconnecting to the shared ocean…', online:'Connected to the shared ocean',
    birthTour:'A recent birth: this cell inherited a mutated genome from its parent.',
    hunterTour:'Follow a hunter. Its motion comes from sensing nearby prey, chemistry and the cost of moving.',
    familyTour:'A family with living descendants. Open its card to see what reproduction has changed.',
    cellTour:'Follow a living cell. Open its card to discover what it senses and which family it belongs to.',
    waitTour:'Waiting for living cells to arrive…', oldest:'Three families saved. The oldest bookmark was replaced.',
    started:'Family observation began', unknown:'unknown', change:'A change in the average is an observation, not proof that a trait is advantageous.'
  },
  ru: {
    start:'С чего начать', tour:'Найти живую историю', mine:'Мои семьи',
    title:'Один океан. Собственная жизнь.',
    intro:'Эти клетки ищут пищу, конкурируют и размножаются с мутациями. Все посетители видят один океан, который продолжает меняться, пока вас нет.',
    invitation:'Выберите клетку, наблюдайте за её семьёй и вернитесь познакомиться с потомками.',
    later:'Просто смотреть', watch:'Наблюдать семью', families:'Ваш полевой дневник',
    empty:'Выберите клетку и нажмите «Наблюдать семью». Дневник хранится в этом браузере; можно сохранить три семьи.',
    loading:'Читаем историю семьи…', missing:'Эта семья уже вышла за пределы ограниченного архива. Её текущее состояние неизвестно.',
    living:'Живых сейчас', births:'Записано рождений', since:'Рождений с прошлого визита', generations:'Поколений после основателя',
    extinct:'Живых потомков нет', active:'Семья продолжается', focus:'Найти живого потомка', forget:'Убрать из дневника',
    genetic:'Наследуемые признаки генома', geneNote:'Это значения генов в единицах модели, а не измерения движения.', first:'В начале вашего наблюдения', founderTraits:'Записанные свойства основателя', now:'Среднее живой семьи',
    size:'Взрослый размер', speedMax:'Предельная скорость', carnivory:'Склонность к хищничеству', adhesion:'Сцепление клеток', metabolismEfficiency:'Эффективность метаболизма', chemotaxisNutrient:'Чувствительность к пище',
    elongation:'Вытянутость', shell:'Оболочка', flagella:'Жгутики', sensing:'Чувствительность',
    ancestry:'Последние записанные особи', founder:'Основатель', parent:'родитель', gen:'поколение', alive:'жива', dead:'погибла', baseline:'жила до начала записи',
    note:'Семейная история начинается с наблюдения, а не с рождения океана. Архив последних предков и вымерших семей ограничен. Недостающие связи остаются неизвестными.',
    saved:'Сохранено в этом браузере', last:'При прошлом визите', members:'живых особей', choose:'Выберите семью ниже, чтобы проверить её состояние сейчас.', olderNodes:'Старые записи об отдельных клетках вышли за пределы окна последних предков.', cellGone:'Этой клетки больше нет в живом океане.',
    close:'Закрыть полевой дневник', offline:'Восстанавливаем связь с общим океаном…', online:'Подключено к общему океану',
    birthTour:'Недавнее рождение: клетка получила от родителя геном с мутациями.',
    hunterTour:'Следим за хищником. Его движение зависит от восприятия добычи, химии и затрат на движение.',
    familyTour:'Семья с живыми потомками. Откройте её карточку, чтобы увидеть изменения после размножения.',
    cellTour:'Следим за живой клеткой. В её карточке можно узнать, что она чувствует и к какой семье относится.',
    waitTour:'Ждём появления живых клеток…', oldest:'Сохранены три семьи. Самая старая закладка заменена.',
    started:'Начало наблюдения за семьёй', unknown:'неизвестен', change:'Изменение среднего — наблюдение, а не доказательство полезности признака.'
  }
};

export class Observatory {
  constructor(app) {
    this.app = app;
    this.bookmarks = [];
    this.activeId = null;
    this.family = null;
    this.pendingSave = null;
    this.worldId = null;
    this.lastRequest = 0;
    this.toolbar = document.createElement('nav');
    this.toolbar.className = 'observer-tools';
    this.toolbar.setAttribute('aria-label','Ocean exploration');
    document.body.append(this.toolbar);
    this.welcome = document.createElement('section');
    this.welcome.className = 'ocean-welcome glass-panel';
    this.welcome.hidden = true;
    document.body.append(this.welcome);
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'family-dialog glass-panel';
    this.dialog.setAttribute('aria-labelledby','family-title');
    document.body.append(this.dialog);
    this.notice = document.createElement('div');
    this.notice.className = 'ocean-notice';
    this.notice.setAttribute('role','status');
    this.notice.hidden = true;
    document.body.append(this.notice);
    this.watchBtn = document.createElement('button');
    this.watchBtn.className = 'action-btn action-btn-observe';
    this.watchBtn.disabled = true;
    document.querySelector('.inspector-actions')?.append(this.watchBtn);
    this.watchBtn.addEventListener('click', () => this.observe(this.app.inspector.lastProfile?.familyId));
    for (const surface of [this.toolbar,this.welcome,this.dialog]) surface.addEventListener('click', e => {
      const button=e.target.closest('button[data-action]');
      if (!button) return;
      this.act(button.dataset.action,Number(button.dataset.id));
    });
    this.dialog.addEventListener('close',()=>this.markSeen());
    window.addEventListener('aetheon-lang-changed',()=>this.render());
    setInterval(()=> { if(this.dialog.open && this.activeId && !document.hidden) this.request(this.activeId); },15000);
    this.render();
  }
  t(key) { return (COPY[i18n.getLang()] ?? COPY.en)[key]; }
  init(worldId) {
    if(this.worldId!==worldId) {
      this.worldId=worldId;
      this.activeId=null;this.family=null;this.pendingSave=null;this.received=false;
      try {
        const saved=JSON.parse(localStorage.getItem(this.storageKey()) ?? '[]');
        this.bookmarks=Array.isArray(saved) ? saved.filter(b=>Number.isSafeInteger(b.id)&&b.id>0).slice(-3) : [];
      } catch { this.bookmarks=[]; }
    }
    this.render();
    try { this.welcome.hidden=localStorage.getItem('aetheon_welcome_v2')==='seen'; } catch { this.welcome.hidden=false; }
    if(this.dialog.open && this.activeId) this.request(this.activeId);
  }
  storageKey() { return `aetheon_families_${this.worldId}`; }
  persist() { try { localStorage.setItem(this.storageKey(),JSON.stringify(this.bookmarks)); } catch {} }
  dismissWelcome() { this.welcome.hidden=true; try { localStorage.setItem('aetheon_welcome_v2','seen'); } catch {} }
  act(action,id) {
    if(action==='start') this.welcome.hidden=false;
    if(action==='tour') { this.dismissWelcome(); this.tour(); }
    if(action==='later') this.dismissWelcome();
    if(action==='mine') { this.activeId=null; this.family=null; this.renderDialog(); this.dialog.showModal(); }
    if(action==='open') { this.markSeen(); this.pendingSave=null; this.activeId=id; this.family=null; this.received=false; this.renderDialog(); this.request(id); }
    if(action==='close') this.dialog.close();
    if(action==='focus' && this.family?.focusId) { this.dialog.close(); this.app.focusOrganism(this.family.focusId, this.family.focusPosition); }
    if(action==='forget') { this.bookmarks=this.bookmarks.filter(b=>b.id!==id); this.persist(); if(this.activeId===id) {this.activeId=null;this.family=null;} this.renderDialog(); }
  }
  tour() {
    if(this.app.isConnected) this.app.socket.send(JSON.stringify({type:'get_tour'}));
    else this.toast(this.t('offline'));
  }
  onTour(msg) {
    if(msg.id && !this.app.focusOrganism(msg.id, msg.position)) {this.toast(this.t('cellGone'));return;}
    this.toast(this.t(msg.id ? ({birth:'birthTour',hunter:'hunterTour',family:'familyTour'}[msg.reason] ?? 'cellTour') : 'waitTour'));
  }
  onProfile(profile) { this.watchBtn.disabled=!profile?.familyId; }
  observe(id) {
    if(!Number.isSafeInteger(id)) return;
    this.activeId=id; this.family=null; this.pendingSave=id; this.received=false;
    this.app.inspector.close();
    this.renderDialog(); this.dialog.showModal(); this.request(id);
  }
  request(id) {
    clearTimeout(this.requestTimer);
    if(!this.app.isConnected) {this.toast(this.t('offline'));return;}
    const delay=Math.max(0,1100-(Date.now()-this.lastRequest));
    this.requestTimer=setTimeout(()=> {
      if(!this.app.isConnected || this.activeId!==id || !this.dialog.open) return;
      this.lastRequest=Date.now();
      this.app.socket.send(JSON.stringify({type:'get_family',id}));
    },delay);
  }
  onFamily(msg) {
    if(msg.id!==this.activeId) return;
    this.family=msg.family;
    this.received=true;
    if(this.pendingSave===msg.id && msg.family) {
      const f=msg.family;
      if(!this.bookmarks.some(b=>b.id===f.id)) {
        if(this.bookmarks.length===3) {this.bookmarks.shift();this.toast(this.t('oldest'));}
        this.bookmarks.push({id:f.id,name:f.nameLa,lastBirths:f.births,lastLiving:f.living,savedAt:Date.now(),baselineTraits:f.meanTraits});
        this.persist();
      }
      this.pendingSave=null;
    }
    this.renderDialog();
  }
  markSeen() {
    const bookmark=this.bookmarks.find(b=>b.id===this.family?.id);
    if(bookmark && this.family) {bookmark.lastBirths=this.family.births;bookmark.lastLiving=this.family.living;bookmark.lastSeenAt=Date.now();this.persist();}
  }
  toast(message) {
    this.notice.textContent=message;this.notice.hidden=false;
    clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>this.notice.hidden=true,6500);
  }
  render() {
    this.toolbar.innerHTML=`<button data-action="start">✦ ${this.t('start')}</button><button data-action="tour">◎ ${this.t('tour')}</button><button data-action="mine">♡ ${this.t('mine')}</button>`;
    this.welcome.innerHTML=`<span class="welcome-eyebrow">AETHEON · LIVE</span><h2>${this.t('title')}</h2><p>${this.t('intro')}</p><p>${this.t('invitation')}</p><div class="welcome-actions"><button class="observer-primary" data-action="tour">${this.t('tour')} →</button><button data-action="later">${this.t('later')}</button></div>`;
    this.watchBtn.textContent=`♡ ${this.t('watch')}`;
    this.renderDialog();
  }
  renderDialog() {
    const focused=document.activeElement?.closest('button'),focusAction=focused?.dataset.action,focusId=focused?.dataset.id;
    const restoreFocus=focused && this.dialog.contains(focused),scrollTop=this.dialog.scrollTop;
    const f=this.family, bookmark=this.bookmarks.find(b=>b.id===this.activeId);
    let detail=`<p class="family-empty">${this.t(this.bookmarks.length?'choose':'empty')}</p>`;
    if(this.activeId && !f) detail=`<p class="family-empty">${this.t(this.received?'missing':'loading')}</p>${bookmark?`<button data-action="forget" data-id="${bookmark.id}">${this.t('forget')}</button>`:''}`;
    if(f) {
      const initial=bookmark?.baselineTraits??f.founderTraits;
      const rows=[...new Set([...Object.keys(f.founderTraits),...Object.keys(f.meanTraits??{})])].map(key=> {
        const before=initial?.[key],now=f.meanTraits?.[key];
        return `<tr><th scope="row">${this.t(key)}</th><td>${Number.isFinite(before)?before.toFixed(2):'—'}</td><td>${Number.isFinite(now)?now.toFixed(2):'—'}</td></tr>`;
      }).join('');
      const members=f.nodes.slice(-8).reverse().map(n=>`<li><strong>#${n.id}</strong><span>${this.t('gen')} ${n.generation} · ${this.t('parent')} ${n.parentKnown?'#'+n.parentId:this.t('unknown')}</span><small>${this.t(n.diedTick===null?'alive':'dead')}${n.baseline?' · '+this.t('baseline'):''}</small></li>`).join('');
      const beyond=Math.max(0,f.maxGeneration-f.founderGeneration);
      detail=`<div class="family-heading"><span class="family-status ${f.living?'':'family-extinct'}">${this.t(f.living?'active':'extinct')}</span><h3>${escapeHtml(f.nameLa??'Aetheobiont')} <small>#${f.id}</small></h3><p>${this.t('founder')} #${f.founderId} · ${this.t('started')}: ${new Date(f.startedAt).toLocaleDateString(i18n.getLang()==='ru'?'ru':'en')}</p></div>
      <div class="family-metrics">${[[f.living,'living'],[f.births,'births'],[Math.max(0,f.births-(bookmark?.lastBirths??f.births)),'since'],[beyond,'generations']].map(([v,k])=>`<div><strong>${v}</strong><span>${this.t(k)}</span></div>`).join('')}</div>
      <div class="family-actions"><button data-action="focus" class="observer-primary" ${f.focusId?'':'disabled'}>${this.t('focus')} →</button>${bookmark?`<button data-action="forget" data-id="${f.id}">${this.t('forget')}</button>`:''}</div>
      <h4>${this.t('genetic')}</h4><p class="family-note">${this.t('geneNote')}</p><div class="family-table-wrap"><table><thead><tr><th></th><th>${this.t(bookmark?.baselineTraits?'first':'founderTraits')}</th><th>${this.t('now')}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="family-note">${this.t('change')}</p>
      <h4>${this.t('ancestry')}</h4>${members?`<ol class="family-members">${members}</ol>`:`<p class="family-note">${this.t('olderNodes')}</p>`}`;
    }
    const bookmarks=this.bookmarks.map(b=>`<button class="family-bookmark ${b.id===this.activeId?'selected':''}" data-action="open" data-id="${b.id}"><strong>${escapeHtml(b.name??'Aetheobiont')} #${b.id}</strong><span>${this.t('last')}: ${b.lastLiving??'—'} ${this.t('members')}</span></button>`).join('');
    this.dialog.innerHTML=`<div class="family-header"><div><span class="welcome-eyebrow">AETHEON · ${this.t('saved')}</span><h2 id="family-title">${this.t('families')}</h2></div><button class="close-btn" data-action="close" aria-label="${this.t('close')}">×</button></div><div class="family-bookmarks">${bookmarks}</div><div class="family-detail">${detail}</div><p class="family-note family-limits">${this.t('note')}</p>`;
    if(restoreFocus) [...this.dialog.querySelectorAll('button')].find(b=>b.dataset.action===focusAction && b.dataset.id===focusId)?.focus({preventScroll:true});
    this.dialog.scrollTop=scrollTop;
  }
}
