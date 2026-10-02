import { i18n } from '../i18n.js';

const COPY = {
  en: { label:'View', focus:'Focus', wide:'Wide', hint:'Drag to explore · scroll or pinch to zoom',
    title:'Detailed life inside the lens; a quiet outline of the shared ocean outside. The entire ocean keeps evolving.',
    details:'in focus', visible:'on screen', ocean:'in the ocean', offline:'Reconnecting…' },
  ru: { label:'Обзор', focus:'Фокус', wide:'Весь экран', hint:'Тяните для обзора · колесо или щипок для масштаба',
    title:'В линзе — подробная жизнь, снаружи — спокойный контур общего океана. Весь мир продолжает развиваться.',
    details:'в области', visible:'на экране', ocean:'в океане', offline:'Восстанавливаем связь…' }
};

export class ObservationPanel {
  constructor(app) {
    this.app=app;
    this.panel=document.createElement('section');
    this.panel.className='observation-panel glass-panel';
    this.panel.innerHTML='<div class="observation-switch"><span></span><button data-focus="true"></button><button data-focus="false"></button></div><p class="observation-hint"></p><p class="observation-count"></p>';
    document.body.append(this.panel);
    let focus=true;
    try { focus=localStorage.getItem('aetheon_focus_v1')!=='off'; } catch {}
    this.app.renderer.focusEnabled=focus;
    this.panel.addEventListener('click',e=>{
      const button=e.target.closest('button[data-focus]');if(!button)return;
      this.app.renderer.focusEnabled=button.dataset.focus==='true';
      try {localStorage.setItem('aetheon_focus_v1',this.app.renderer.focusEnabled?'on':'off');}catch{}
      this.render();
    });
    window.addEventListener('aetheon-lang-changed',()=>this.render());
    setInterval(()=>{if(!document.hidden)this.updateCount();},1000);
    this.render();
  }
  copy() { return COPY[i18n.getLang()]??COPY.en; }
  render() {
    const t=this.copy(),focus=this.app.renderer.focusEnabled;
    this.panel.setAttribute('aria-label',t.label);this.panel.title=t.title;
    this.panel.querySelector('.observation-switch span').textContent=t.label;
    for(const b of this.panel.querySelectorAll('button')) {
      b.textContent=b.dataset.focus==='true'?t.focus:t.wide;
      b.setAttribute('aria-pressed',String((b.dataset.focus==='true')===focus));
    }
    this.panel.querySelector('.observation-hint').textContent=t.hint;
    this.updateCount();
  }
  updateCount() {
    const t=this.copy(),s=this.app.renderer.observationStats;
    this.panel.querySelector('.observation-count').textContent=!this.app.isConnected?t.offline:
      s?`${s.detailed} ${this.app.renderer.focusEnabled?t.details:t.visible} · ${this.app.renderer.currEntities.size} ${t.ocean}`:'…';
  }
}
