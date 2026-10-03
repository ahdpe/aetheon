import { i18n } from '../i18n.js';
const COPY={
 en:{button:'Living habitats',title:'Every body has a price',intro:'The same inherited traits shape the cell you see and change its chances of survival. Offspring inherit small mutations; successful families leave more descendants.',
 traits:[['Shell','Reduces bite damage, but slows swimming and costs energy.'],['Flagella','More propulsion and more upkeep.'],['Elongation','Changes the silhouette, propulsion and feeding surface.'],['Sensing','A wider chemical and neighbour horizon costs energy.']],
 flora:'A garden that can be eaten',plantText:'Plants use light and finite dissolved nutrients or recycled waste to grow. Grazing removes real biomass. Dense, branching plants shelter small cells. Living plants send out mutated offspring; exhausted and ageing plants disappear.',
 patches:'Living groves',births:'Plant births',biomass:'Plant biomass',go:'Visit a living grove',empty:'No living groves remain. Extinction does not create replacement plants.',
 habitats:[['The inner basin','Dimmer light and stronger circulating water.'],['The meadow ring','More light supports plant growth and grazing.'],['The shallow rim','Gentler currents, farther from the food vents.'],['Twilight backwater','A dimmer, quieter inlet.'],['Outer frontier','New water beyond the former chamber edge.']],
 limits:'This is a finite evolving ecosystem powered by vents and light. Animal reseeding and scripted climate crises still exist. A long term increase in diversity remains an experiment.',close:'Close habitats',generation:'Generation',descendants:'Inherited plant bodies',height:'Height',branching:'Branching',defense:'Defense',parent:'Parent',biomassUnit:'biomass units'},
 ru:{button:'Живые местообитания',title:'У каждого тела есть цена',intro:'Одни и те же наследуемые признаки определяют вид клетки и её возможности выжить. Потомки получают небольшие мутации; успешные семьи оставляют больше потомства.',
 traits:[['Оболочка','Снижает урон от укусов, но замедляет плавание и требует энергии.'],['Жгутики','Больше тяги и больше затрат на содержание.'],['Вытянутость','Меняет силуэт, тягу и поверхность питания.'],['Чувствительность','Расширяет восприятие химии и соседей, расходуя энергию.']],
 flora:'Сад, который можно съесть',plantText:'Растения используют свет и конечный запас растворённой пищи или переработанных отходов. Выпас уменьшает биомассу. Густые ветвистые заросли укрывают небольшие клетки. Живые растения расселяют потомков с мутациями; истощённые и стареющие исчезают.',
 patches:'Живых зарослей',births:'Рождений растений',biomass:'Биомасса растений',go:'Посетить живую заросль',empty:'Живых зарослей больше нет. После вымирания новые растения автоматически не возникают.',
 habitats:[['Внутренняя котловина','Меньше света, сильнее круговое течение.'],['Кольцо лугов','Больше света для роста растений и выпаса.'],['Мелководный край','Слабее течение, дальше от источников пищи.'],['Сумеречная заводь','Менее освещённая и более спокойная вода.'],['Внешняя отмель','Новые воды за прежним краем чаши.']],
 limits:'Это конечная развивающаяся экосистема с притоком энергии от источников и света. Подселение животных и заданные климатические кризисы пока сохраняются. Рост разнообразия на длинном сроке остаётся экспериментом.',close:'Закрыть местообитания',generation:'Поколение',descendants:'Наследуемые формы растений',height:'Высота',branching:'Ветвление',defense:'Защита',parent:'Родитель',biomassUnit:'ед. биомассы'}
};
export class EcologyPanel {
 constructor(app) {
  this.app=app;this.data=null;this.groveIndex=0;
  this.button=document.createElement('button');this.button.className='ecology-button';
  this.app.observatory.toolbar.after(this.button);
  this.dialog=document.createElement('dialog');this.dialog.className='family-dialog ecology-dialog';this.dialog.setAttribute('aria-labelledby','ecology-title');
  document.body.append(this.dialog);
  this.button.addEventListener('click',()=>{this.render();this.dialog.showModal();});
  this.dialog.addEventListener('click',e=>{const action=e.target.closest('button')?.dataset.ecology;
    if(action==='close') this.dialog.close();if(action==='visit') this.visit(Number(e.target.closest('button')?.dataset.grove));
    if(action==='remains') {
      const p=[...this.app.renderer.serverRemains].sort((a,b)=>b.remaining-a.remaining)[0];
      if(p){this.dialog.close();this.app.remainsPanel.select(p.id,true);}
    }
  });
  window.addEventListener('aetheon-lang-changed',()=>this.render());this.render();
 }
 update(data) {this.data=data;if(this.dialog.open) this.render();}
 visit(id) {
  const patches=[...this.app.renderer.algaeIsles].sort((a,b)=>b.d-a.d);if(!patches.length) return;
  const p=patches.find(p=>p.id===id)??patches[this.groveIndex++%patches.length];this.app.inspector.close();this.dialog.close();
  const c=this.app.renderer.camera;c.trackedEntityId=null;c.targetX=p.x;c.targetY=p.y;c.targetZoom=2.8;
  this.app.observatory.toast(`${i18n.getLang()==='ru'?'Заросль':'Grove'} #${p.id} · ${i18n.getLang()==='ru'?'поколение':'generation'} ${p.generation}`);
 }
 render() {
  const t=COPY[i18n.getLang()]??COPY.en,d=this.data,scroll=this.dialog.scrollTop,ru=i18n.getLang()==='ru',rem=d?.remains;
  const focused=document.activeElement?.closest('button'),action=this.dialog.contains(focused)?focused?.dataset.ecology:null,grove=focused?.dataset.grove;
  const plants=[...this.app.renderer.algaeIsles].sort((a,b)=>b.generation-a.generation||b.d-a.d).slice(0,3);
  this.button.textContent=`❋ ${t.button}`;
  this.dialog.innerHTML=`<div class="family-header"><div><span class="welcome-eyebrow">AETHEON · ECOLOGY</span><h2 id="ecology-title">${t.title}</h2></div><button class="close-btn" data-ecology="close" aria-label="${t.close}">×</button></div><p>${t.intro}</p>
    <div class="ecology-traits">${t.traits.map(([title,text])=>`<div><strong>${title}</strong><p>${text}</p></div>`).join('')}</div>
    <h3>${t.flora}</h3><p>${t.plantText}</p><div class="family-metrics">${[[d?.plants,t.patches],[d?.floraBirths,t.births],[d?.biomass,t.biomass]].map(([n,label])=>`<div><strong>${n??'—'}</strong><span>${label}</span></div>`).join('')}</div>
    <button class="observer-primary" data-ecology="visit" ${!this.app.renderer.algaeIsles.length?'disabled':''}>${t.go} →</button>${d?.plants===0?`<p>${t.empty}</p>`:''}
    <h3>${t.descendants}</h3><div class="grove-records">${plants.map(p=>`<button class="grove-record" data-ecology="visit" data-grove="${p.id}" style="--plant-hue:${Math.round(p.h*360)}"><strong>❋ #${p.id} · ${t.generation} ${p.generation}</strong><span>${p.biomass} ${t.biomassUnit} · ${t.parent}: ${p.parentId?'#'+p.parentId:'—'}</span><small>${t.height} ${Math.round(p.height*100)}% · ${t.branching} ${Math.round(p.branching*100)}% · ${t.defense} ${Math.round(p.defense*100)}%</small></button>`).join('')}</div>
    <section class="ecology-remains"><h3>${ru?'След жизни на дне':'Life leaves a trace'}</h3><p>${ru?'Погибшая клетка сохраняет узнаваемую оболочку на 1–5 минут модельного времени: прочные оболочки разлагаются дольше. Её конечный запас органики съедают соседние клетки или разложение возвращает его в воду. Съеденная пустая оболочка тоже постепенно исчезает.':'A dead cell keeps its recognizable membrane for 1–5 model minutes: stronger shells decay more slowly. Nearby cells can eat its finite organic reserve; decay returns the rest to the water. An eaten, empty membrane also gradually disappears.'}</p>
      <div class="family-metrics">${[[rem?.count,ru?'Останков':'Bodies'],[rem?Math.round(rem.dissolved):null,ru?'Возвращено воде':'Returned to water'],[rem?Math.round(rem.scavenged):null,ru?'Съедено клетками':'Scavenged by cells']].map(([n,label])=>`<div><strong>${n??'—'}</strong><span>${label}</span></div>`).join('')}</div>
      <button class="observer-primary" data-ecology="remains" ${!this.app.renderer.serverRemains.length?'disabled':''}>${ru?'Найти останки':'Find a body'} →</button>
      <p class="family-note">${ru?'Счётчики органики ведутся с начала этого этапа. Это условные единицы модели. Одновременно сохраняется до 96 тел; при массовой гибели остаток старейших тел сразу переходит в воду, если в ней есть место.':'Organic counters begin with this stage, in model units. Up to 96 bodies are retained; during mass death, the oldest bodies release their remaining reserve immediately, subject to water capacity.'}</p></section>
    <div class="ecology-habitats">${t.habitats.map(([title,text],i)=>`<div class="habitat-${i}"><strong>${title}</strong><p>${text}</p></div>`).join('')}</div><p class="family-note">${t.limits}</p>`;
  if(action) this.dialog.querySelector(`[data-ecology="${action}"]${grove?`[data-grove="${grove}"]`:grove===undefined?':not([data-grove])':''}`)?.focus({preventScroll:true});
  this.dialog.scrollTop=scroll;
 }
}
