import {createOrganismClass} from './organismCore.js';
import {createChemicalGridClass} from './chemicalCore.js';
import {createColonyClass} from './colonyCore.js';
import {SpatialHash} from './spatialHash.js';
import {designGenome,NURSERY_PRESETS,TRIAL_PHYSICS} from './nurseryDesign.js';
import {habitatReleasePoint} from './habitats.js';

export function createTrial(design,habitat='meadow',sample=[],seed=0xae7e00) {
 let state=seed>>>0;
 const random=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
 const O=createOrganismClass(TRIAL_PHYSICS,random),Grid=createChemicalGridClass(TRIAL_PHYSICS,random),Colony=createColonyClass(TRIAL_PHYSICS);
 const grid=new Grid(),hash=new SpatialHash(TRIAL_PHYSICS.WORLD_SIZE,35),colonies=new Colony();
 const {x,y}=habitatReleasePoint(habitat,-Math.PI/2),founder=new O(x,y,designGenome(design));
 founder.trialFamily=true;let orgs=[founder],ticks=0,births=0,peak=1,maxGeneration=1;
 const samples=sample.length?sample:Array.from({length:12},(_,i)=>designGenome(i<9?NURSERY_PRESETS.grazer:i<11?NURSERY_PRESETS.weaver:NURSERY_PRESETS.hunter));
 for(let i=0;i<24;i++){
  const angle=i*Math.PI*2/24,dist=40+(i%4)*40;
  const org=new O(x+Math.cos(angle)*dist,y+Math.sin(angle)*dist,samples[i%samples.length]);
  orgs.push(org);
 }
 const neighbors=[];
 return {
  step(){
   ticks++;grid.step(null,ticks);hash.clear();for(const o of orgs)hash.insert(o);
   const dead=new Set(),parents=[],children=[];
   for(const o of orgs){
    if(dead.has(o.id))continue;
    const radius=(o.carnivory>.35?Math.max(55,o.size*8):Math.max(38,o.size*5))*o.body.senseRadius;
    hash.query(o.x,o.y,radius,neighbors);o.step(grid,neighbors,[],TRIAL_PHYSICS.CHAMBER_RADIUS,1);
    if(o.isDead()){dead.add(o.id);continue;}
    if(o.carnivory>.35)for(const p of neighbors){if(dead.has(p.id))continue;const strike=o.attemptPredation(p,grid,null);if(strike){if(strike.killed)dead.add(p.id);break;}}
    if(o.canReproduce())parents.push(o);
   }
   const candidates=parents.filter(o=>!dead.has(o.id)&&!o.isDead()&&o.canReproduce());
   for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
   for(const o of candidates.slice(0,Math.max(0,64-(orgs.length-dead.size)))){
    const child=o.reproduce(o.speciesId);child.trialFamily=o.trialFamily;
    if(child.trialFamily){births++;maxGeneration=Math.max(maxGeneration,child.generation);}
    children.push(child);
    if(o.genome.adhesion+o.genome.phaseCoupling*.3>.65&&o.carnivory<.4)colonies.formBond(o,child);
   }
   colonies.applyBondPhysics(new Map(orgs.map(o=>[o.id,o])));
   for(const id of dead)colonies.removeOrganism(id);
   orgs=orgs.filter(o=>!dead.has(o.id)).concat(children);
   peak=Math.max(peak,orgs.filter(o=>o.trialFamily).length);
  },
  snapshot(){const family=orgs.filter(o=>o.trialFamily);return {ticks,seconds:ticks/10,living:family.length,births,peak,maxGeneration,
   meanEnergy:family.length?family.reduce((sum,o)=>sum+o.energy,0)/family.length:0,total:orgs.length,
   cells:orgs.map(o=>({id:o.id,x:o.x,y:o.y,size:o.size,hue:o.hue,carnivory:o.carnivory,phase:o.phase,heading:o.heading,
    energy:o.energy,anatomy:o.body,own:!!o.trialFamily})),vents:grid.vents.map(v=>({x:v.x*TRIAL_PHYSICS.WORLD_SIZE/grid.size,y:v.y*TRIAL_PHYSICS.WORLD_SIZE/grid.size}))};}
 };
}
