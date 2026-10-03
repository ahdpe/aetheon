import {i18n} from '../i18n.js';
import {HABITATS,OCEAN_GEOMETRY,RESOURCE_OASES,sampleHabitat} from '../shared/habitats.js';
import {makeTerrainCanvas,drawCurrentArrows} from '../gl/terrainDrawing.js';

const COPY={
 en:{button:'Ocean map',title:'An ocean worth exploring',intro:'Five connected habitats, one shared living world. Choose a place, look at who lives there, and build a body for its conditions.',
  visit:'Explore this place',design:'Build a body for this place',cells:'Cells',hunters:'Hunters',plants:'Groves',light:'Light at the selected point',food:'Dissolved food',waste:'Waste',flow:'Current at the selected point',
  basin:'Dimmer central waters with stronger circular currents.',meadow:'Light supports plants, grazing and competition.',shadow:'A twilight inlet with less light and slower currents. It provides no automatic protection.',shoal:'Gentler water away from the central vents.',frontier:'Newly opened water beyond the former edge. Five fertile oases are separated by poorer water. Living cells and plant descendants can gradually colonise it.',
  close:'Close ocean map',visited:'Places explored in this browser',legend:'Dots are living cells; green rings are plants; diamonds are thermal vents; dotted rings are recharge oases. The dashed inner circle marks the previous ocean edge. Shading and contours show relief; arrows show current direction. Click the map or choose a habitat.',
  trend:'Population over model time',empty:'There are no cells here right now. This is real empty space, not a new scene.',sync:'Connecting to the shared ocean…',offline:'Connection interrupted. These are the last received observations.',
  limits:'The water area is now 2.25× its previous size. Food recharge is shared between inner meadows and five outer oases, with poorer water between them. The number of animals and plants remains capped. The chart keeps the last 96 minute observations; it does not predict adaptation.',ago:'model minutes ago',now:'now',expansion:'Dashed chart line: water expansion; earlier counts cover the old area.',units:'Food and waste: regional mean concentration. Light, current and seabed: the selected point.',seabed:'Seabed',channel:'Curved trough',ridge:'Mineral ridge',slope:'Gentle slope',retention:'Food dispersal',basinFloor:'Depression',slow:'Slow',moderate:'Moderate',swift:'Stronger',retained:'Slower exchange',openWater:'Open exchange',terrainNote:'Ridges redirect currents; depressions slow food dispersal. Seabed depth changes the light available to plants. This is shared geological relief; living organisms have not carved these troughs.'},
 ru:{button:'Карта океана',title:'Океан, который хочется исследовать',intro:'Пять связанных местообитаний, один общий живой мир. Выберите место, узнайте, кто там живёт, и соберите тело для его условий.',
  visit:'Исследовать это место',design:'Создать тело для этого места',cells:'Клеток',hunters:'Хищников',plants:'Зарослей',light:'Свет в выбранной точке',food:'Растворённая пища',waste:'Отходы',flow:'Течение в выбранной точке',
  basin:'Более тёмные центральные воды с сильным круговым течением.',meadow:'Свет поддерживает растения, выпас и конкуренцию.',shadow:'Сумеречная заводь с меньшим количеством света и слабым течением. Автоматической защиты здесь нет.',shoal:'Более спокойная вода вдали от центральных источников.',frontier:'Открытые воды за прежним краем. Пять плодородных оазисов разделены бедными водами. Клетки и потомки растений могут постепенно осваивать их.',
  close:'Закрыть карту океана',visited:'Исследовано мест в этом браузере',legend:'Точки — живые клетки, зелёные кольца — растения, ромбы — термальные источники, пунктирные кольца — пищевые оазисы. Внутренняя окружность отмечает прежний край океана. Светотень и контуры показывают рельеф, стрелки — направление течения. Нажмите на карту или выберите местообитание.',
  trend:'Популяция во времени модели',empty:'Сейчас здесь нет клеток. Это настоящее пустое пространство, а не новая сцена.',sync:'Подключаемся к общему океану…',offline:'Связь прервана. Показаны последние полученные наблюдения.',
  limits:'Площадь воды выросла в 2,25 раза. Приток пищи распределён между внутренними лугами и пятью внешними оазисами, с бедными участками между ними. Число животных и растений остаётся ограниченным. График хранит последние 96 минутных наблюдений и не предсказывает адаптацию.',ago:'минут модели назад',now:'сейчас',expansion:'Пунктир на графике: расширение воды; прежние подсчёты охватывают старую площадь.',units:'Пища и отходы: средняя концентрация по участку. Свет, течение и дно: выбранная точка.',seabed:'Дно',channel:'Извилистая ложбина',ridge:'Минеральная гряда',slope:'Пологий склон',retention:'Рассеивание пищи',basinFloor:'Впадина',slow:'Слабое',moderate:'Умеренное',swift:'Более сильное',retained:'Замедленный обмен',openWater:'Свободный обмен',terrainNote:'Гряды направляют течение, а впадины замедляют рассеивание пищи. Глубина дна меняет доступный растениям свет. Это общая география мира; организмы пока не вырывают эти ложбины.'}
};

export const makeHabitatCanvas=makeTerrainCanvas;

export class GeographyPanel {
 constructor(app){
  this.app=app;this.data=null;this.selected='meadow';this.visited=new Set();
  this.button=document.createElement('button');this.button.className='hud-btn hud-btn-map';this.button.id='btn-ocean-map';document.getElementById('btn-codex').before(this.button);
  this.dialog=document.createElement('dialog');this.dialog.className='family-dialog geography-dialog';this.dialog.setAttribute('aria-labelledby','geography-title');document.body.append(this.dialog);
  this.terrain=makeTerrainCanvas(384,this.app.renderer.terrain,{atlas:true});
  this.button.addEventListener('click',()=>this.open());
  this.dialog.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(button.dataset.region){this.selected=button.dataset.region;this.selectedPoint=null;this.render();}
   const action=button.dataset.geography;
   if(action==='close')this.dialog.close();
   if(action==='visit')this.visit();
   if(action==='design'){this.dialog.close();const n=this.app.nurseryPanel;if(n.habitat!==this.selected){n.habitat=this.selected;n.resetTrial();}n.persist();n.open();}
  });
  this.dialog.addEventListener('pointerup',e=>{
   if(!e.target.matches('.geography-map'))return;
   const rect=e.target.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*OCEAN_GEOMETRY.worldSize,y=(e.clientY-rect.top)/rect.height*OCEAN_GEOMETRY.worldSize;
   if(Math.hypot(x-OCEAN_GEOMETRY.cx,y-OCEAN_GEOMETRY.cy)>OCEAN_GEOMETRY.radius)return;
   this.selected=sampleHabitat(x,y).id;this.selectedPoint={x,y};this.render();
  });
  window.addEventListener('aetheon-lang-changed',()=>this.render());this.render();
 }
 t(key){return (COPY[i18n.getLang()]??COPY.en)[key];}
 name(id){return HABITATS.find(h=>h.id===id)?.[i18n.getLang()==='ru'?'ru':'en']??id;}
 storageKey(){return `aetheon_explored_${this.app.observatory.worldId}`;}
 open(){
  try{const saved=JSON.parse(localStorage.getItem(this.storageKey())??'[]');this.visited=new Set(Array.isArray(saved)?saved.filter(id=>HABITATS.some(h=>h.id===id)):[]);}catch{this.visited=new Set();}
  this.app.observatory.dismissWelcome();this.render();this.dialog.showModal();
 }
 update(data){this.data=data;if(this.dialog.open)this.render();}
 visit(){
  const h=this.selectedPoint??HABITATS.find(h=>h.id===this.selected);this.app.inspector.close();this.dialog.close();
  const c=this.app.renderer.camera;c.targetX=h.x;c.targetY=h.y;c.targetZoom=this.selected==='frontier'?2.4:2.1;
  this.visited.add(this.selected);try{localStorage.setItem(this.storageKey(),JSON.stringify([...this.visited]));}catch{}
  this.app.observatory.toast(this.name(this.selected));
 }
 render(){
  this.button.innerHTML=`<span class="btn-icon">🗺</span><span class="btn-label">${this.t('button')}</span>`;this.button.title=this.t('button');this.button.setAttribute('aria-label',this.t('button'));
  const scroll=this.dialog.scrollTop,focus=document.activeElement,region=focus?.dataset.region,action=focus?.dataset.geography;
  const row=this.data?.regions.find(r=>r.id===this.selected),h=HABITATS.find(h=>h.id===this.selected);
  const point=this.selectedPoint??h,env=this.app.renderer.terrain.sample(point.x,point.y),speed=Math.hypot(env.currentX,env.currentY);
  this.dialog.innerHTML=`<div class="family-header"><div><span class="welcome-eyebrow">AETHEON · ATLAS</span><h2 id="geography-title">${this.t('title')}</h2></div><button class="close-btn" data-geography="close" aria-label="${this.t('close')}">×</button></div>
   <p>${this.t('intro')}</p><div class="geography-layout"><section class="geography-overview"><canvas class="geography-map" width="840" height="840" aria-label="${this.t('button')}"></canvas><p class="family-note">${this.t('legend')}</p><div class="geography-visited">${this.t('visited')} <strong>${this.visited.size} / 5</strong></div></section>
   <section class="geography-detail"><div class="geography-places">${HABITATS.map(h=>`<button data-region="${h.id}" aria-pressed="${this.selected===h.id}" style="--habitat-color:${h.color}"><span>${this.name(h.id)}</span><small>${this.data?.regions.find(r=>r.id===h.id)?.cells??'—'} · ${this.t('cells')}</small></button>`).join('')}</div>
   <h3 style="color:${h.color}">${this.name(this.selected)}</h3><p class="geography-description">${this.t(this.selected)}</p>
   <div class="family-metrics geography-counts">${['cells','hunters','plants'].map(k=>`<div><strong>${row?.[k]??'—'}</strong><span>${this.t(k)}</span></div>`).join('')}</div>
   <p class="family-note geography-terrain-note">${this.t('terrainNote')}</p><dl class="geography-conditions"><div><dt>${this.t('seabed')}</dt><dd>${this.t(env.landform==='basin'?'basinFloor':env.landform)}</dd></div><div><dt>${this.t('retention')}</dt><dd>${this.t(env.permeability<.5?'retained':'openWater')}</dd></div><div><dt>${this.t('light')}</dt><dd>${Math.round(env.light*100)}%</dd></div><div><dt>${this.t('flow')}</dt><dd>${this.t(speed<.04?'slow':speed<.10?'moderate':'swift')}</dd></div><div><dt>${this.t('food')}</dt><dd>${row?.nutrients??'—'}</dd></div><div><dt>${this.t('waste')}</dt><dd>${row?.waste??'—'}</dd></div></dl><p class="family-note">${this.t('units')}</p>
   <h4>${this.t('trend')}</h4><canvas class="geography-chart" width="800" height="220" aria-label="${this.t('trend')}"></canvas><p class="geography-trend-range family-note"></p>
   <div class="geography-actions"><button class="observer-primary" data-geography="visit">${this.t('visit')} →</button><button data-geography="design">${this.t('design')}</button></div>
   <p class="geography-status" role="status">${!this.app.isConnected?this.t('offline'):!row?this.t('sync'):row.cells===0?this.t('empty'):''}</p></section></div><p class="family-note">${this.t('limits')}</p>`;
  this.drawMap();this.drawChart();
  if(region)this.dialog.querySelector(`[data-region="${region}"]`)?.focus({preventScroll:true});else if(action)this.dialog.querySelector(`[data-geography="${action}"]`)?.focus({preventScroll:true});
  this.dialog.scrollTop=scroll;
 }
 drawMap(){
  const canvas=this.dialog.querySelector('.geography-map'),ctx=canvas.getContext('2d'),scale=canvas.width/OCEAN_GEOMETRY.worldSize;
  ctx.fillStyle='#04161f';ctx.fillRect(0,0,840,840);ctx.drawImage(this.terrain,0,0,840,840);
  drawCurrentArrows(ctx,this.app.renderer.terrain,scale);
  ctx.strokeStyle='#749994';ctx.lineWidth=2;ctx.setLineDash([6,10]);ctx.beginPath();ctx.arc(OCEAN_GEOMETRY.cx*scale,OCEAN_GEOMETRY.cy*scale,OCEAN_GEOMETRY.previousRadius*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#6bddb877';ctx.setLineDash([3,7]);
  for(const p of RESOURCE_OASES){ctx.beginPath();ctx.arc(p.x*scale,p.y*scale,p.radius*scale,0,Math.PI*2);ctx.stroke();}ctx.setLineDash([]);
  for(const p of this.app.renderer.algaeIsles){ctx.strokeStyle='#a0ffcc';ctx.beginPath();ctx.arc(p.x*scale,p.y*scale,Math.max(4,p.r*scale*.4),0,Math.PI*2);ctx.stroke();}
  for(const o of this.app.renderer.currEntities.values()){ctx.fillStyle=o.carnivory>.35?'#ffc38f':'#e3fff5';ctx.beginPath();ctx.arc(o.x*scale,o.y*scale,3,0,Math.PI*2);ctx.fill();}
  for(const v of this.app.renderer.vents){const x=v.x*this.app.renderer.worldSize/this.app.renderer.gridSize*scale,y=v.y*this.app.renderer.worldSize/this.app.renderer.gridSize*scale;ctx.fillStyle='#ffe8a5';ctx.beginPath();ctx.moveTo(x,y-6);ctx.lineTo(x+6,y);ctx.lineTo(x,y+6);ctx.lineTo(x-6,y);ctx.closePath();ctx.fill();}
  const h=this.selectedPoint??HABITATS.find(h=>h.id===this.selected);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.x*scale,h.y*scale,16,0,Math.PI*2);ctx.stroke();
 }
 drawChart(){
  const canvas=this.dialog.querySelector('.geography-chart'),ctx=canvas.getContext('2d'),index=HABITATS.findIndex(h=>h.id===this.selected);
  const points=(this.data?.history??[]).map(s=>({tick:s.tick,n:s.counts[index]}));
  const current=this.data?.regions[index];if(current&&points.at(-1)?.tick!==this.data.tick)points.push({tick:this.data.tick,n:current.cells});
  ctx.fillStyle='#091f29';ctx.fillRect(0,0,800,220);if(!points.length)return;
  const minTick=points[0].tick,maxTick=this.data.tick,max=Math.max(1,...points.map(p=>p.n));ctx.strokeStyle='#91d9c1';ctx.lineWidth=3;ctx.beginPath();
  points.forEach((p,i)=>{const x=30+(p.tick-minTick)/Math.max(1,maxTick-minTick)*740,y=185-p.n/max*150;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
  const expansion=this.data.expandedAtTick;
  if(expansion>=minTick&&expansion<=maxTick){const x=30+(expansion-minTick)/Math.max(1,maxTick-minTick)*740;ctx.strokeStyle='#efd39b';ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,190);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle='#a8c9c8';ctx.font='20px monospace';ctx.fillText(String(max),4,27);ctx.fillText('0',4,190);
  this.dialog.querySelector('.geography-trend-range').textContent=`${Math.round((maxTick-minTick)/600)} ${this.t('ago')} → ${this.t('now')}${expansion>=minTick&&expansion<=maxTick?' · '+this.t('expansion'):''}`;
 }
}
