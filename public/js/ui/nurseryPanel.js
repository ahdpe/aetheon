import {i18n} from '../i18n.js';
import {escapeHtml} from './safeHtml.js';
import {developBody} from '../shared/anatomy.js';
import {NURSERY_PRESETS,DESIGN_WEIGHTS,DESIGN_BUDGET,designCost,designGenome,validateDesign} from '../shared/nurseryDesign.js';
const COPY={
 en:{button:'Create life',title:'Give a new body a chance',intro:'Build a cell, try it in a small ocean, then introduce one founder into the shared world. Its descendants will inherit mutations and compete for food.',
  grazer:'Grazer',weaver:'Weaver',hunter:'Hunter',name:'Family name',body:'Shape & senses',strategy:'Way of life',size:'Size',speed:'Speed',elongation:'Elongation',shell:'Shell',flagella:'Flagella',sensing:'Sensing',adhesion:'Bonding',diet:'Hunting',hue:'Colour',
  budget:'Body budget',price:'Large, fast, armoured and sensitive bodies cannot all be maximised. Their actual energy costs continue after release.',basin:'Inner basin',meadow:'Meadow ring',shoal:'Shallow rim',habitat:'Starting habitat',
  trial:'Try this body',running:'Testing',ready:'Preview',minutes:'model seconds',living:'Living family members',births:'Births',generation:'Latest generation',energy:'Average energy',trialNote:'A three minute browser trial: the real cell, chemical, bite, division and colony rules, with 24 neighbours (genes from the living ocean while connected, reference bodies otherwise), and up to 64 cells. Fresh chemistry; no plants, detritus, visitor feeding or climate crises. This is a comparison, not a survival forecast.',
  notTried:'Try this design before deciding to release it.',changed:'Body changed. Run a new trial.',trialFailed:'This browser could not run the trial. Try again.',survived:'This family remains alive at the end of the trial.',extinctTrial:'This family died out during the trial. Try another combination, or release it knowing the risk.',
  release:'Release one founder',sending:'Submitting your founder…',policy:'Release changes the same ocean everyone visits. The family name becomes public. The founder gets the usual 60 energy, no protection and no guaranteed offspring. Descendants can form living colonies when their bonding traits permit it.',
  limits:'Up to 12 introductions per UTC day, 2 per browser and 6 per network address. At least 15 minutes between introductions; at most 4 wait in the queue. An eligible founder gets the first natural vacancy before ordinary births fill it. No living cell is removed to make room. An unreleased request expires after 6 hours; accepted requests use the daily allowance.',
  remaining:'World allowance today',visitorLeft:'Your allowance today',queue:'Waiting founders',readyWorld:'A vacant place is available.',full:'The ocean is full. Waiting for a natural vacancy.',climate:'Introductions wait until the climate crisis ends.',cooldown:'Next introduction in',seconds:'seconds',offline:'Reconnect to the ocean to request a release. Trials remain local.',receipt:'Your recent introductions',queued:'Waiting in the shared queue',released:'Introduced',expired:'Expired without introduction',watch:'Watch this family',unknown:'This family is outside the recent archive; its current state is unknown.',close:'Close nursery',
  errors:{invalid:'Use a valid name and a body within the budget.',cookie:'Allow this site to store its visitor identifier, then reload to release a founder.',daily:'Today’s world allowance has been used.',visitor:'Your daily allowance has been used.',address:'This network’s daily allowance has been used.',pending:'You already have a founder waiting.',queue:'The queue is full. Try again later.',save:'The ocean could not safely save the request. Nothing was admitted.'}},
 ru:{button:'Создать жизнь',title:'Дайте новому телу шанс',intro:'Соберите клетку, испытайте её в маленьком океане и выпустите одного основателя в общий мир. Его потомки будут наследовать мутации и конкурировать за пищу.',
  grazer:'Пастбищник',weaver:'Ткач',hunter:'Охотник',name:'Имя семьи',body:'Форма и восприятие',strategy:'Образ жизни',size:'Размер',speed:'Скорость',elongation:'Вытянутость',shell:'Оболочка',flagella:'Жгутики',sensing:'Чувствительность',adhesion:'Связи',diet:'Охота',hue:'Цвет',
  budget:'Бюджет тела',price:'Размер, скорость, защиту и чувствительность нельзя одновременно довести до максимума. После выпуска их содержание продолжает требовать энергии.',basin:'Внутренняя котловина',meadow:'Кольцо лугов',shoal:'Мелководный край',habitat:'Место выпуска',
  trial:'Испытать тело',running:'Испытание',ready:'Предпросмотр',minutes:'секунд модели',living:'Живых в семье',births:'Рождений',generation:'Последнее поколение',energy:'Средняя энергия',trialNote:'Три минуты модели в браузере: настоящие правила клеток, химии, укусов, деления и колоний, с 24 соседями (гены из живого океана при подключении, учебные тела без него), до 64 клеток. Химия начинается заново; растений, детрита, подкормки и климатических кризисов нет. Это сравнение, а не прогноз выживания.',
  notTried:'Испытайте это тело перед решением о выпуске.',changed:'Тело изменилось. Нужно новое испытание.',trialFailed:'Браузер не смог выполнить испытание. Попробуйте ещё раз.',survived:'К концу испытания семья продолжает жить.',extinctTrial:'Семья вымерла в испытании. Попробуйте другое сочетание или выпустите её, понимая риск.',
  release:'Выпустить основателя',sending:'Отправляем основателя…',policy:'Выпуск меняет общий океан для всех посетителей. Имя семьи станет публичным. Основатель получает обычные 60 энергии, без защиты и гарантированного потомства. Потомки могут образовывать живые колонии, если позволяют признаки связей.',
  limits:'До 12 выпусков за сутки UTC, 2 на браузер и 6 на сетевой адрес. Между выпусками не менее 15 минут, в очереди до 4 основателей. Готовая заявка получает первое естественно свободное место раньше обычных рождений. Живые клетки ради места не удаляются. Невыпущенная заявка истекает через 6 часов; принятые заявки расходуют суточный лимит.',
  remaining:'Выпусков осталось в мире',visitorLeft:'Ваш остаток на сегодня',queue:'Основателей в очереди',readyWorld:'В океане есть свободное место.',full:'Океан заполнен. Ожидаем естественного освобождения места.',climate:'Выпуски ждут окончания климатического кризиса.',cooldown:'Следующий выпуск через',seconds:'секунд',offline:'Для выпуска нужно подключение к океану. Испытания остаются локальными.',receipt:'Ваши недавние выпуски',queued:'Ожидает в общей очереди',released:'Выпущен',expired:'Заявка истекла без выпуска',watch:'Наблюдать семью',unknown:'Семья вышла из недавнего архива; её текущее состояние неизвестно.',close:'Закрыть питомник',
  errors:{invalid:'Нужно допустимое имя и тело в пределах бюджета.',cookie:'Разрешите сайту хранить идентификатор посетителя и обновите страницу для выпуска.',daily:'Суточный лимит мира исчерпан.',visitor:'Ваш суточный лимит исчерпан.',address:'Суточный лимит этой сети исчерпан.',pending:'Ваш основатель уже ожидает в очереди.',queue:'Очередь заполнена. Попробуйте позже.',save:'Океан не смог надёжно сохранить заявку. Она не принята.'}}
};
const validName=s=>/^[\p{L}\p{N}\p{M} ._'’-]{1,24}$/u.test(s.trim());
export class NurseryPanel {
 constructor(app){
  this.app=app;this.design={...NURSERY_PRESETS.grazer};this.name='Lumen';this.habitat='meadow';this.status=null;this.result=null;this.trialKey=null;this.pending=null;
  try{const d=JSON.parse(localStorage.getItem('aetheon_nursery_design'));if(d&&validateDesign(d.design)){this.design=d.design;this.name=typeof d.name==='string'?d.name.slice(0,24):'Lumen';this.habitat=['basin','meadow','shoal'].includes(d.habitat)?d.habitat:'meadow';}
   this.pending=JSON.parse(localStorage.getItem('aetheon_nursery_request'));}catch{}
  this.button=document.createElement('button');this.button.className='nursery-button';app.ecologyPanel.button.after(this.button);
  this.dialog=document.createElement('dialog');this.dialog.className='family-dialog nursery-dialog';this.dialog.setAttribute('aria-labelledby','nursery-title');document.body.append(this.dialog);
  this.button.addEventListener('click',()=>this.open());
  this.dialog.addEventListener('close',()=>{clearInterval(this.poll);cancelAnimationFrame(this.frame);if(this.running){this.result=null;this.trialKey=null;}this.worker?.terminate();this.worker=null;this.running=false;});
  this.dialog.addEventListener('input',e=>this.change(e));this.dialog.addEventListener('change',e=>{if(e.target.name==='habitat')this.change(e);});
  this.dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.nursery;
   if(a==='close')this.dialog.close();if(a==='trial')this.runTrial();if(a==='release')this.submit();
   if(a==='preset'){this.design={...NURSERY_PRESETS[b.dataset.preset]};this.resetTrial();this.persist();this.render();}
   if(a==='watch'){this.dialog.close();this.app.observatory.observe(Number(b.dataset.family));}
  });
  window.addEventListener('aetheon-lang-changed',()=>{this.button.textContent=`✧ ${this.t('button')}`;if(this.dialog.open)this.render();});
  this.button.textContent=`✧ ${this.t('button')}`;
 }
 t(key){return (COPY[i18n.getLang()]??COPY.en)[key];}
 persist(){try{localStorage.setItem('aetheon_nursery_design',JSON.stringify({design:this.design,name:this.name,habitat:this.habitat}));}catch{}}
 fingerprint(){return JSON.stringify([this.design,this.habitat]);}
 resetTrial(){this.worker?.terminate();this.worker=null;this.running=false;this.result=null;this.trialKey=null;this.trialError=false;}
 open(){this.render();this.dialog.showModal();this.requestStatus();clearInterval(this.poll);this.poll=setInterval(()=>this.requestStatus(),6000);this.animate();}
 requestStatus(){if(!this.app.isConnected)return;this.app.socket.send(JSON.stringify({type:'get_nursery'}));}
 change(e){
  if(e.target.dataset.gene){this.design[e.target.dataset.gene]=Number(e.target.value);this.resetTrial();this.updateEditor();}
  if(e.target.name==='familyName'){this.name=e.target.value;this.updateEditor();}
  if(e.target.name==='habitat'){this.habitat=e.target.value;this.resetTrial();this.updateEditor();}
  this.persist();
 }
 render(){
  const scroll=this.dialog.scrollTop,focused=document.activeElement?.closest('button'),action=this.dialog.contains(focused)?focused?.dataset.nursery:null,preset=focused?.dataset.preset;
  const t=COPY[i18n.getLang()]??COPY.en;
  const sliders=keys=>keys.map(k=>`<label class="nursery-slider"><span>${t[k]} <output data-value="${k}">${Math.round(this.design[k]*100)}%</output></span><input type="range" min="0" max="1" step="${k==='hue'?'0.01':'0.05'}" value="${this.design[k]}" data-gene="${k}" aria-label="${t[k]}"></label>`).join('');
  this.dialog.innerHTML=`<div class="family-header"><div><span class="welcome-eyebrow">AETHEON · NURSERY</span><h2 id="nursery-title">${t.title}</h2></div><button class="close-btn" data-nursery="close" aria-label="${t.close}">×</button></div><p>${t.intro}</p>
   <div class="nursery-layout"><div class="nursery-editor"><div class="nursery-presets">${Object.keys(NURSERY_PRESETS).map(k=>`<button data-nursery="preset" data-preset="${k}">${t[k]}</button>`).join('')}</div>
   <label class="nursery-name">${t.name}<input name="familyName" maxlength="24" value="${escapeHtml(this.name)}" autocomplete="off"></label>
   <h3>${t.body}</h3>${sliders(['elongation','shell','flagella','sensing'])}<h3>${t.strategy}</h3>${sliders(['size','speed','diet','adhesion','hue'])}
   <label class="nursery-name">${t.habitat}<select name="habitat">${['basin','meadow','shoal'].map(k=>`<option value="${k}" ${this.habitat===k?'selected':''}>${t[k]}</option>`).join('')}</select></label></div>
   <div class="nursery-experiment"><canvas class="nursery-canvas" width="800" height="400" aria-label="${t.ready}"></canvas><div class="nursery-budget"><span>${t.budget}</span><strong data-budget></strong><meter min="0" max="${DESIGN_BUDGET}" value="0"></meter><small>${t.price}</small></div>
   <button class="observer-primary" data-nursery="trial">${t.trial}</button><progress class="nursery-progress" max="1800" value="0" hidden></progress><p class="nursery-outcome" role="status" aria-live="polite"></p><div class="nursery-trial-metrics family-metrics"></div><p class="family-note">${t.trialNote}</p></div></div>
   <section class="nursery-release"><h3>${t.release}</h3><p>${t.policy}</p><div class="nursery-world-status"></div><button class="observer-primary" data-nursery="release">${t.release} →</button><p class="nursery-feedback" role="status"></p><p class="family-note">${t.limits}</p><h3>${t.receipt}</h3><div class="nursery-receipts"></div></section>`;
  this.updateEditor();this.renderStatus();this.renderTrial();
  if(action)this.dialog.querySelector(`[data-nursery="${action}"]${preset?`[data-preset="${preset}"]`:''}`)?.focus({preventScroll:true});
  this.dialog.scrollTop=scroll;
 }
 updateEditor(){
  const cost=designCost(this.design);this.dialog.querySelector('[data-budget]').textContent=`${cost.toFixed(2)} / ${DESIGN_BUDGET}`;
  const meter=this.dialog.querySelector('meter');meter.value=cost;meter.classList.toggle('over-budget',cost>DESIGN_BUDGET);
  for(const key of [...Object.keys(DESIGN_WEIGHTS),'hue'])this.dialog.querySelector(`[data-value="${key}"]`).textContent=`${Math.round(this.design[key]*100)}%`;
  this.dialog.querySelector('[data-nursery="trial"]').disabled=cost>DESIGN_BUDGET||this.running;
  this.updateRelease();this.renderTrial();
 }
 updateRelease(){const s=this.status;
  this.dialog.querySelector('[data-nursery="release"]').disabled=!this.app.isConnected||!s||s.dailyRemaining<=0||s.visitorRemaining<=0||
   s.records.some(r=>r.status==='queued')||this.pending||!validateDesign(this.design)||!validName(this.name)||this.trialKey!==this.fingerprint();
 }
 runTrial(){
  if(!validateDesign(this.design))return;this.resetTrial();this.running=true;const key=this.fingerprint();this.runId=crypto.randomUUID();
  try{
   this.worker=new Worker(new URL('./nurseryWorker.js',import.meta.url),{type:'module'});
   this.worker.onmessage=e=>{if(e.data.runId!==this.runId)return;
    if(e.data.type==='failed'){this.running=false;this.worker.terminate();this.worker=null;this.trialError=true;this.updateEditor();return;}
    this.result=e.data;if(e.data.type==='complete'){this.running=false;this.trialKey=key;this.worker.terminate();this.worker=null;}
    this.updateEditor();
   };
   this.worker.onerror=()=>{this.running=false;this.trialError=true;this.worker?.terminate();this.worker=null;this.updateEditor();};
   this.trialError=false;this.worker.postMessage({design:this.design,habitat:this.habitat,sample:this.status?.sample??[],runId:this.runId});
  }catch{this.running=false;this.trialError=true;}
  this.updateEditor();
 }
 renderTrial(){
  const r=this.result,progress=this.dialog.querySelector('progress');progress.hidden=!this.running;progress.value=r?.ticks??0;
  this.dialog.querySelector('.nursery-outcome').textContent=this.trialError?this.t('trialFailed'):this.running?`${this.t('running')} · ${r?.seconds??0} / 180 ${this.t('minutes')}`:
   r?this.t(r.living?'survived':'extinctTrial'):this.t('notTried');
  this.dialog.querySelector('.nursery-trial-metrics').innerHTML=r?[[r.living,'living'],[r.births,'births'],[r.maxGeneration,'generation'],[Math.round(r.meanEnergy),'energy']].map(([n,key])=>`<div><strong>${n}</strong><span>${this.t(key)}</span></div>`).join(''):'';
 }
 submit(){
  if(this.dialog.querySelector('[data-nursery="release"]').disabled)return;
  this.pending={type:'nursery_release',requestId:crypto.randomUUID(),name:this.name.trim(),design:{...this.design},habitat:this.habitat};
  this.lastRequestId=this.pending.requestId;
  this.savePending();this.sendPending();this.updateRelease();this.dialog.querySelector('.nursery-feedback').textContent=this.t('sending');
 }
 savePending(){try{if(this.pending)localStorage.setItem('aetheon_nursery_request',JSON.stringify(this.pending));else localStorage.removeItem('aetheon_nursery_request');}catch{}}
 sendPending(){if(this.app.isConnected&&this.pending&&Date.now()-(this.lastSend??0)>6000){this.lastSend=Date.now();this.app.socket.send(JSON.stringify(this.pending));}}
 onMessage(msg){
  if(msg.type==='nursery_status'){
   this.status=msg;
   if(this.pending&&msg.records.some(r=>r.requestId===this.pending.requestId)){this.lastRequestId=this.pending.requestId;this.pending=null;this.savePending();}
   else this.sendPending();
   if(this.dialog.open)this.renderStatus();
  }else if(msg.type==='nursery_result'&&this.pending?.requestId===msg.requestId){
   this.pending=null;this.savePending();
   const text=msg.ok?this.t(msg.record.status):(COPY[i18n.getLang()]??COPY.en).errors[msg.reason]??this.t('offline');
   this.app.observatory.toast(text);
   if(this.dialog.open){this.dialog.querySelector('.nursery-feedback').textContent=text;this.updateRelease();}
   this.requestStatus();
  }
 }
 renderStatus(){
  const focused=document.activeElement?.closest('[data-family]'),family=this.dialog.contains(focused)?focused?.dataset.family:null;
  const s=this.status;
  const receipt=s?.records.find(r=>r.requestId===this.lastRequestId);
  if(receipt)this.dialog.querySelector('.nursery-feedback').textContent=this.t(receipt.status);
   this.dialog.querySelector('.nursery-world-status').innerHTML=s?`<div class="family-metrics">${[[s.dailyRemaining,'remaining'],[s.visitorRemaining,'visitorLeft'],[s.queued,'queue']].map(([n,k])=>`<div><strong>${n}</strong><span>${this.t(k)}</span></div>`).join('')}</div><p>${s.reason==='cooldown'?`${this.t('cooldown')} ${s.waitSeconds} ${this.t('seconds')}`:s.reason==='daily'?this.t('errors').daily:this.t(s.reason==='ready'?'readyWorld':s.reason)}</p>`:`<p>${this.t('offline')}</p>`;
  if(s?.waitSeconds>0&&s.reason!=='cooldown')this.dialog.querySelector('.nursery-world-status').insertAdjacentHTML('beforeend',`<p>${this.t('cooldown')} ${s.waitSeconds} ${this.t('seconds')}</p>`);
  this.dialog.querySelector('.nursery-receipts').innerHTML=(s?.records??[]).slice().reverse().map(r=>`<article class="nursery-receipt"><strong>${escapeHtml(r.name)}</strong><span>${this.t(r.status)}${r.familyId?' · #'+r.familyId:''}</span>${r.family?`<small>${this.t('living')}: ${r.family.living} · ${this.t('births')}: ${r.family.births} · ${this.t('generation')}: ${r.family.maxGeneration}</small><button data-nursery="watch" data-family="${r.familyId}">${this.t('watch')}</button>`:r.status==='released'?`<small>${this.t('unknown')}</small>`:''}</article>`).join('');
  if(family)this.dialog.querySelector(`[data-family="${family}"]`)?.focus({preventScroll:true});
  this.updateRelease();
 }
 animate(){
  if(!this.dialog.open)return;const canvas=this.dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),time=performance.now(),w=800,h=400;
  ctx.clearRect(0,0,w,h);const bg=ctx.createRadialGradient(w/2,h/2,5,w/2,h/2,430);bg.addColorStop(0,'#103c46');bg.addColorStop(1,'#020f1a');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  if(this.result?.cells){
   ctx.strokeStyle='#557b88';ctx.beginPath();ctx.arc(400,200,177,0,Math.PI*2);ctx.stroke();
   for(const v of this.result.vents){ctx.fillStyle='#f3cf8455';ctx.beginPath();ctx.arc(400+(v.x-700)*.28,200+(v.y-700)*.28,7,0,Math.PI*2);ctx.fill();}
   for(const c of this.result.cells){const x=400+(c.x-700)*.28,y=200+(c.y-700)*.28;
    this.app.renderer.drawOrganism(ctx,x,y,Math.max(c.own?6:3,c.size*.7),c,c.heading,c.own,time,c.own);
   }
  }else{
   const d=this.design,body=developBody({...d,speedMax:1+2.5*d.speed}),org={id:1,speciesId:1,size:2.8+5.2*d.size,hue:d.hue,carnivory:d.diet*.9,phase:time*.003,anatomy:body};
   this.app.renderer.drawOrganism(ctx,400,200,65+d.size*35,org,-.15,false,time,true);
  }
  this.frame=requestAnimationFrame(()=>this.animate());
 }
}
