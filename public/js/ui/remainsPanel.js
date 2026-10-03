import {i18n} from '../i18n.js';

export class RemainsPanel {
  constructor(app) {
    this.app=app;this.id=null;
    this.card=document.createElement('aside');this.card.className='remains-card glass-panel';this.card.hidden=true;
    document.body.append(this.card);
    this.card.addEventListener('click',e=>{if(e.target.closest('button'))this.close();});
    window.addEventListener('aetheon-lang-changed',()=>this.update());
    window.addEventListener('keydown',e=>{if(e.key==='Escape')this.close();});
  }
  select(id,visit=false) {
    const p=this.app.renderer.serverRemains.find(p=>p.id===id);if(!p)return;
    this.app.inspector.close();this.id=id;this.app.renderer.selectedRemainsId=id;
    if(visit) {const c=this.app.renderer.camera;c.targetX=p.x;c.targetY=p.y;c.targetZoom=3.8;}
    this.update();
  }
  close() {this.id=null;this.app.renderer.selectedRemainsId=null;this.card.hidden=true;}
  update() {
    if(this.id===null)return;
    const p=this.app.renderer.serverRemains.find(p=>p.id===this.id);
    if(!p){this.close();return;}
    const ru=i18n.getLang()==='ru',seconds=Math.ceil((p.maxAge-p.age)/10),minutes=Math.floor(seconds/60),rest=seconds%60;
    this.card.hidden=false;
    const closeFocused=this.card.contains(document.activeElement)&&document.activeElement?.tagName==='BUTTON';
    this.card.innerHTML=`<button class="close-btn" aria-label="${ru?'Закрыть останки':'Close remains'}">×</button>
      <span class="remains-eyebrow">${ru?'ЖИЗНЬ ВОЗВРАЩАЕТСЯ В ОКЕАН':'LIFE RETURNS TO THE OCEAN'}</span>
      <strong>${ru?'Останки клетки':'Cell remains'} #${p.sourceId}</strong>
      <p>${ru?'Поколение':'Generation'} ${p.generation} · ${p.cause==='predation'?(ru?'после охоты':'after predation'):(ru?'после гибели':'after death')}</p>
      <div class="remains-meters"><span>${ru?'Органики осталось':'Organic reserve'} <b>${Math.round(p.remaining*100)}%</b></span><span>${ru?'Съедено':'Scavenged'} <b>${Math.round(p.eaten*100)}%</b></span><span>${ru?'До распада':'Until breakdown'} <b>${minutes}:${String(rest).padStart(2,'0')}</b></span></div>
      <small>${ru?'Тело лежит на дне. Клетки могут есть его, а разложение постепенно возвращает питание в воду.':'The body rests on the seabed. Cells can eat it; decay gradually returns nutrients to the water.'}</small>`;
    if(closeFocused)this.card.querySelector('button')?.focus({preventScroll:true});
  }
}
