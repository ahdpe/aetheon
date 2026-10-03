import {CONFIG} from '../config.js';
import {HABITATS,OCEAN_GEOMETRY,sampleHabitat} from '../../public/js/shared/habitats.js';

export const GEOGRAPHY_HISTORY_LIMIT=96;
export class Geography {
 constructor(grid){
  this.state=null;this.latest=null;
  this.cellRegions=new Int8Array(grid.cellCount).fill(-1);
  this.areas=new Uint32Array(HABITATS.length);
  const scale=CONFIG.WORLD_SIZE/grid.size;
  for(let y=0;y<grid.size;y++)for(let x=0;x<grid.size;x++){
   const wx=x*scale,wy=y*scale;
   if(Math.hypot(wx-OCEAN_GEOMETRY.cx,wy-OCEAN_GEOMETRY.cy)>CONFIG.CHAMBER_RADIUS)continue;
   const i=HABITATS.findIndex(h=>h.id===sampleHabitat(wx,wy).id);
   this.cellRegions[y*grid.size+x]=i;this.areas[i]++;
  }
 }
 init(engine){
  this.state??={version:1,radius:CONFIG.CHAMBER_RADIUS,startedAtTick:engine.ticks,samples:[]};
  if(this.state.startedAtTick>engine.ticks||this.state.expandedAtTick>engine.ticks||this.state.samples.some(s=>s.tick>engine.ticks))throw new Error('Geography history is ahead of the world');
  this.measure(engine);
  if(!this.state.samples.length)this.record(engine.ticks);
 }
 measure(engine){
  const rows=HABITATS.map(h=>({id:h.id,cells:0,hunters:0,plants:0,biomass:0,nutrients:0,waste:0,reef:0}));
  for(const o of engine.organisms){if(o.isDead())continue;const r=rows[HABITATS.findIndex(h=>h.id===sampleHabitat(o.x,o.y).id)];r.cells++;if(o.carnivory>.35)r.hunters++;}
  for(const p of engine.algae.isles){const r=rows[HABITATS.findIndex(h=>h.id===sampleHabitat(p.x,p.y).id)];r.plants++;r.biomass+=p.biomass;}
  const grid=engine.grid;
  for(let cell=0;cell<this.cellRegions.length;cell++){
   const i=this.cellRegions[cell];if(i<0)continue;const r=rows[i];
   r.nutrients+=grid.nutrients[cell];r.waste+=grid.waste[cell];r.reef+=grid.substrate[cell];
  }
  for(let i=0;i<rows.length;i++){
   const r=rows[i],h=HABITATS[i],env=grid.terrain.sample(h.x,h.y);
   r.biomass=Math.round(r.biomass);
   for(const key of ['nutrients','waste','reef'])r[key]=Math.round(r[key]/Math.max(1,this.areas[i])*100)/100;
   r.light=Math.round(env.light*100);r.current=Math.round(Math.hypot(env.currentX,env.currentY)*1000)/1000;
  }
  this.latest={tick:engine.ticks,radius:CONFIG.CHAMBER_RADIUS,previousRadius:OCEAN_GEOMETRY.previousRadius,regions:rows};
 }
 record(tick){
  if(this.state.samples.at(-1)?.tick===tick)return;
  this.state.samples.push({tick,radius:CONFIG.CHAMBER_RADIUS,counts:this.latest.regions.map(r=>r.cells),plants:this.latest.regions.map(r=>r.plants)});
  if(this.state.samples.length>GEOGRAPHY_HISTORY_LIMIT)this.state.samples.shift();
 }
 step(engine){
  if(engine.ticks%20!==0)return;
  this.measure(engine);
  if(engine.ticks%600===0)this.record(engine.ticks);
 }
 broadcast(){return {...this.latest,startedAtTick:this.state.startedAtTick,expandedAtTick:this.state.expandedAtTick,history:this.state.samples};}
 toJSON(){return structuredClone(this.state);}
 fromJSON(data){
  if(data===undefined)return;
  if(!data||data.version!==1||data.radius!==CONFIG.CHAMBER_RADIUS||!Number.isSafeInteger(data.startedAtTick)||data.startedAtTick<0||
   (data.expandedAtTick!==undefined&&(!Number.isSafeInteger(data.expandedAtTick)||data.expandedAtTick<data.startedAtTick))||
   !Array.isArray(data.samples)||data.samples.length>GEOGRAPHY_HISTORY_LIMIT||data.samples.some((s,i)=>!Number.isSafeInteger(s.tick)||s.tick<data.startedAtTick||
    (s.radius!==undefined&&![680,CONFIG.CHAMBER_RADIUS].includes(s.radius))||
    (i>0&&s.tick<=data.samples[i-1].tick)||['counts','plants'].some(k=>!Array.isArray(s[k])||s[k].length!==HABITATS.length||s[k].some(n=>!Number.isSafeInteger(n)||n<0))))throw new Error('Invalid geography history');
  this.state=structuredClone(data);
 }
}
