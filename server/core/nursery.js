import {randomBytes,createHash} from 'node:crypto';
import {Organism} from './organism.js';
import {random,getRandomState,setRandomState} from './random.js';
import {validateDesign,designGenome,HABITAT_RADII,DESIGN_BUDGET} from '../../public/js/shared/nurseryDesign.js';
import {habitatReleasePoint} from '../../public/js/shared/habitats.js';

export const NURSERY_LIMITS={daily:12,visitorDaily:2,addressDaily:6,pending:4,intervalMs:15*60*1000,expiryMs:6*60*60*1000};
const day=now=>new Date(now).toISOString().slice(0,10);
export const visitorCookie = cookie => /(?:^|;\s*)aetheon_visitor=([a-f0-9]{64})(?:;|$)/.exec(cookie??'')?.[1]??null;
export const newVisitorToken = () => randomBytes(32).toString('hex');
const cleanRecord = r => Object.fromEntries(['requestId','name','habitat','status','queuedAt','releasedAt','organismId','familyId','position'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));

export class Nursery {
 constructor() {this.salt=newVisitorToken();this.records=[];this.nextReleaseAt=0;this.introduced=0;this.retryAfter=0;}
 identity(token,address) {
  const hash=s=>createHash('sha256').update(this.salt+'\0'+s).digest('hex');
  return {visitor:token?hash('visitor:'+token):null,address:hash('address:'+address)};
 }
 prune(now) {
  for(const r of this.records) if(r.status==='queued'&&now-r.queuedAt>=NURSERY_LIMITS.expiryMs)r.status='expired';
  this.records=this.records.filter(r=>r.status==='queued'||now-r.queuedAt<3*86400000).slice(-64);
 }
 status(engine,identity,now=Date.now()) {
  const records=this.records.filter(r=>r.visitor===identity.visitor&&now-r.queuedAt<3*86400000);
  const queued=this.records.filter(r=>r.status==='queued'&&now-r.queuedAt<NURSERY_LIMITS.expiryMs).length;
  const today=this.records.filter(r=>r.day===day(now));
  const launched=this.records.filter(r=>r.status==='released'&&day(r.releasedAt)===day(now));
  const dailyRemaining=Math.max(0,NURSERY_LIMITS.daily-Math.max(today.length,launched.length));
  const reason=dailyRemaining===0?'daily':engine.organisms.length>=engine.maxOrganisms?'full':engine.cataclysms?.phase!=='dormant'?'climate':now<this.nextReleaseAt?'cooldown':'ready';
  return {limits:NURSERY_LIMITS,budget:DESIGN_BUDGET,dailyRemaining,
   visitorRemaining:Math.max(0,NURSERY_LIMITS.visitorDaily-Math.max(today.filter(r=>r.visitor===identity.visitor).length,launched.filter(r=>r.visitor===identity.visitor).length)),
   queued,reason,waitSeconds:Math.max(0,Math.ceil((this.nextReleaseAt-now)/1000)),introduced:this.introduced,
   records:records.slice(-6).map(r=>({...cleanRecord(r),status:r.status==='queued'&&now-r.queuedAt>=NURSERY_LIMITS.expiryMs?'expired':r.status,family: r.familyId ? (()=>{
    const f=engine.history.describe(r.familyId,engine.organisms,engine.ticks);
    return f?{living:f.living,births:f.births,maxGeneration:f.maxGeneration,focusId:f.focusId,focusPosition:f.focusPosition}:null;
   })():null})),sample:engine.organisms.filter(o=>!o.isDead()).filter((_,i)=>i%12===0).slice(0,24).map(o=>({...o.genome}))};
 }
 submit(engine,identity,msg,now=Date.now()) {
  if(!identity.visitor)return {ok:false,reason:'cookie'};
  const requestId=msg.requestId;
  if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId)||!validateDesign(msg.design)||!Object.hasOwn(HABITAT_RADII,msg.habitat)||
   typeof msg.name!=='string'||!/^[\p{L}\p{N}\p{M} ._'’-]{1,24}$/u.test(msg.name.trim()))return {ok:false,reason:'invalid'};
  const prior=this.records.find(r=>r.visitor===identity.visitor&&r.requestId===requestId);
  if(prior)return {ok:true,record:cleanRecord(prior)};
  const before=this.toJSON();this.prune(now);
  const today=this.records.filter(r=>r.day===day(now));
  const launched=this.records.filter(r=>r.status==='released'&&day(r.releasedAt)===day(now));
  const reason=Math.max(today.length,launched.length)>=NURSERY_LIMITS.daily?'daily':Math.max(today.filter(r=>r.visitor===identity.visitor).length,launched.filter(r=>r.visitor===identity.visitor).length)>=NURSERY_LIMITS.visitorDaily?'visitor':
   Math.max(today.filter(r=>r.address===identity.address).length,launched.filter(r=>r.address===identity.address).length)>=NURSERY_LIMITS.addressDaily?'address':this.records.some(r=>r.visitor===identity.visitor&&r.status==='queued')?'pending':
   this.records.filter(r=>r.status==='queued').length>=NURSERY_LIMITS.pending?'queue':null;
  if(reason)return {ok:false,reason};
  const record={requestId,name:msg.name.trim(),habitat:msg.habitat,design:{...msg.design},genome:designGenome(msg.design),visitor:identity.visitor,address:identity.address,
   day:day(now),queuedAt:now,status:'queued'};
  this.records.push(record);
  if(!engine.persistence.saveSnapshot(engine)){this.fromJSON(before);return {ok:false,reason:'save'};}
  return {ok:true,record:cleanRecord(record)};
 }
 ready(engine,now=Date.now()) {
  if(now<this.retryAfter||now<this.nextReleaseAt||engine.cataclysms?.phase!=='dormant')return null;
  const launched=this.records.filter(r=>r.status==='released'&&day(r.releasedAt)===day(now));
  if(launched.length>=NURSERY_LIMITS.daily)return null;
  return this.records.find(r=>r.status==='queued'&&now-r.queuedAt<NURSERY_LIMITS.expiryMs&&launched.filter(a=>a.visitor===r.visitor).length<NURSERY_LIMITS.visitorDaily&&launched.filter(a=>a.address===r.address).length<NURSERY_LIMITS.addressDaily)??null;
 }
 process(engine,now=Date.now()) {
  this.prune(now);
  if(engine.organisms.length>=engine.maxOrganisms)return;
  const record=this.ready(engine,now);
  if(!record)return;
  // A baseline and a paired commit make an introduction reversible on a failed save.
  if(!engine.persistence.saveSnapshot(engine)){this.retryAfter=now+30000;return;}
  const state=this.toJSON(),rng=getRandomState(),nextId=Organism.getNextId(),nextSpeciesId=engine.lineage.nextSpeciesId;
  const history=structuredClone(engine.history.toJSON()),catalog=structuredClone(engine.lineage.getCatalogSpecies());
  const point=habitatReleasePoint(record.habitat,random()*Math.PI*2);
  const org=new Organism(point.x,point.y,record.genome);
  org.speciesId=engine.lineage.evaluateSpeciation(org.genome,1);org.nurseryName=record.name;
  org.introducedAtTick=engine.ticks;engine.organisms.push(org);
  engine.history.addRoot(org,engine.ticks,'nursery');
  engine.history.families.get(org.id).displayName=record.name;
  engine.lineage.updatePopulations(engine.organisms);
  Object.assign(record,{status:'released',releasedAt:now,organismId:org.id,familyId:org.familyId,position:{x:org.x,y:org.y}});
  this.introduced++;this.nextReleaseAt=now+NURSERY_LIMITS.intervalMs;
  let committed=engine.persistence.saveSnapshot(engine);
  if(!committed)try{
   const saved=engine.persistence.read(engine.persistence.filePath);
   committed=saved.ticks===engine.ticks&&saved.organisms.some(o=>o.id===org.id)&&
    saved.nurseryState?.records.some(r=>r.visitor===record.visitor&&r.requestId===record.requestId&&r.status==='released'&&r.organismId===org.id);
  }catch{}
  if(!committed){
   engine.organisms.pop();engine.history.fromJSON(history);
   for(const id of engine.lineage.speciesMap.keys())if(id>=nextSpeciesId)engine.lineage.speciesMap.delete(id);
   for(const s of catalog)engine.lineage.speciesMap.set(s.id,s);
   engine.lineage.nextSpeciesId=nextSpeciesId;engine.lineage.rebuildIndex();
   Organism.setNextId(nextId);setRandomState(rng);this.fromJSON(state);this.retryAfter=now+30000;return;
  }
  engine.eventsBuffer.push({type:'introduction',id:org.id,x:org.x,y:org.y});
 }
 toJSON() {return structuredClone({version:1,salt:this.salt,records:this.records,nextReleaseAt:this.nextReleaseAt,introduced:this.introduced});}
 fromJSON(data) {
  if(!data)return;
  if(data.version!==1||typeof data.salt!=='string'||!/^[a-f0-9]{64}$/.test(data.salt)||!Array.isArray(data.records)||data.records.length>64||
   !Number.isFinite(data.nextReleaseAt)||data.nextReleaseAt<0||!Number.isSafeInteger(data.introduced)||data.introduced<0||
   !data.records.every(r=>r&&['queued','released','expired'].includes(r.status)&&/^[a-f0-9]{64}$/.test(r.visitor)&&/^[a-f0-9]{64}$/.test(r.address)&&
    Number.isFinite(r.queuedAt)&&r.queuedAt>=0&&r.day===day(r.queuedAt)&&Object.hasOwn(HABITAT_RADII,r.habitat)&&
    typeof r.name==='string'&&/^[\p{L}\p{N}\p{M} ._'’-]{1,24}$/u.test(r.name)&&validateDesign(r.design)&&r.genome&&
    Object.keys(r.genome).length===Object.keys(designGenome(r.design)).length&&Object.entries(designGenome(r.design)).every(([k,v])=>r.genome[k]===v)&&
    typeof r.requestId==='string'&&/^[a-f0-9-]{36}$/.test(r.requestId)&&
    (r.status!=='released'||(Number.isFinite(r.releasedAt)&&Number.isSafeInteger(r.organismId)&&r.organismId>0&&r.familyId===r.organismId)))||
   new Set(data.records.map(r=>r.visitor+':'+r.requestId)).size!==data.records.length)throw new Error('Invalid nursery state');
  this.salt=data.salt;this.records=structuredClone(data.records);this.nextReleaseAt=data.nextReleaseAt;this.introduced=data.introduced;
 }
}
