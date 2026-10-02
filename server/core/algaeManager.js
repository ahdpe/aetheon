import { random } from './random.js';
import { CONFIG } from '../config.js';
import { sampleHabitat } from '../../public/js/shared/habitats.js';

export const FLORA_LIMIT = 32;
const clamp = x => Math.max(0, Math.min(1, x));
export class AlgaeManager {
  constructor() {
    this.isles=[];this.nextId=1;
    this.totals={births:0,deaths:0,grazed:0,minerals:0};
    const distances=[240,360,210,390,280,340,220,380];
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4+0.35, d=distances[i];
      this.isles.push(this.makePlant({id:this.nextId++,x:700+Math.cos(a)*d,y:700+Math.sin(a)*d,
        baseRadius:34+random()*16,hue:0.28+random()*0.25,frondCount:10+Math.floor(random()*8),density:0.9}));
    }
  }
  makePlant(saved) {
    const g=saved.genome ?? {height:clamp((saved.frondCount??12)/22), branching:clamp(((saved.id*0.37)%1)), defense:clamp(0.15+(saved.id*0.13)%0.6)};
    const genome=Object.fromEntries(['height','branching','defense'].map(k=>[k,clamp(g[k])]));
    const baseRadius=saved.baseRadius??saved.radius??40, capacity=baseRadius*baseRadius*0.14;
    const plant={...saved,genome,baseRadius,capacity,biomass:saved.biomass??capacity*(saved.density??0.9),
      age:saved.age??0,lastSpore:saved.lastSpore??0,generation:saved.generation??1,parentId:saved.parentId??0,phase:saved.phase??0};
    this.develop(plant);return plant;
  }
  develop(p) {
    p.density=clamp(p.biomass/p.capacity);
    p.radius=p.baseRadius*(0.2+0.8*Math.sqrt(p.density));
    p.frondCount=6+Math.round(p.genome.branching*14);
  }
  isInsideShelter(x,y) {
    for(const p of this.isles) if(p.density>0.05 && (x-p.x)**2+(y-p.y)**2<=p.radius**2) return p;
    return null;
  }
  graze(p,org) {
    if(org.carnivory>=0.4 || org.energy>=CONFIG.MAX_ORGANISM_ENERGY) return 0;
    const efficiency=3.2*(1-p.genome.defense*0.65)*(1-org.carnivory)**2;
    const bite=Math.min(p.biomass,0.10*(org.body?.feeding??1),(CONFIG.MAX_ORGANISM_ENERGY-org.energy)/efficiency);
    p.biomass-=bite;org.energy+=bite*efficiency;this.totals.grazed+=bite;
    this.develop(p);return bite;
  }
  update(engine) {
    const {grid,ticks}=engine;
    for(const p of this.isles) {
      p.age++;p.phase=(p.phase+0.012)%(Math.PI*2);
      const env=sampleHabitat(p.x,p.y);
      // Roots remove finite dissolved nutrients or waste minerals; light supplies external energy.
      // Taller branching plants collect more, but maintain more tissue and shade one another.
      let crowd=0;
      for(const other of this.isles) if(other!==p && Math.hypot(p.x-other.x,p.y-other.y)<p.baseRadius+other.baseRadius) crowd+=other.density*0.25;
      const light=env.light/(1+crowd)*(0.7+0.3*p.genome.height);
      if(p.biomass<p.capacity) {
        let consumed=0;
        for(let root=0;root<4;root++) {
          const a=root*Math.PI/2, reach=p.baseRadius*(0.5+0.5*p.genome.branching);
          const x=p.x+Math.cos(a)*reach,y=p.y+Math.sin(a)*reach;
          const amount=0.018*(0.7+p.genome.branching)*Math.min(1,(p.capacity-p.biomass)/2);
          consumed+=grid.consumeAndExcrete(x,y,amount,0,0);
          const index=grid.worldToGrid(x,y),cell=index.iy*grid.size+index.ix;
          const recycled=Math.min(grid.waste[cell],amount*0.5);
          grid.waste[cell]-=recycled;consumed+=recycled;
        }
        this.totals.minerals+=consumed;
        p.biomass=Math.min(p.capacity,p.biomass+consumed*3.5*light);
      }
      p.biomass=Math.max(0,p.biomass-(0.004+0.006*p.genome.height+0.005*p.genome.branching+0.004*p.genome.defense));
      if(p.age>18000+12000*p.genome.defense) p.biomass=0;
      this.develop(p);
      // Living roots slowly dissolve calcite, proportional to tissue still alive.
      if(ticks%10===0 && p.density>0.1) {
        const {ix,iy}=grid.worldToGrid(p.x,p.y),index=iy*grid.size+ix;
        grid.substrate[index]*=1-0.002*p.density;
      }
    }
    // Rotate grazing priority without additional random calls.
    const orgs=engine.organisms;
    for(let i=0;i<orgs.length;i++) {
      const org=orgs[(i+ticks)%orgs.length];if(org.isDead()) continue;
      const p=this.isInsideShelter(org.x,org.y);if(!p) continue;
      this.graze(p,org);
      const drag=1-0.12*p.density*p.genome.branching*(0.5+org.size/9.5);
      org.vx*=drag;org.vy*=drag;
    }
    this.isles=this.isles.filter(p=>{if(p.biomass<=0){this.totals.deaths++;return false;}return true;});
    // Colonisation is descent from living plants. There is no automatic reseeding after extinction.
    for(const p of [...this.isles]) {
      if(this.isles.length>=FLORA_LIMIT) break;
      if(p.biomass<p.capacity*0.72 || p.age<1200 || ticks-p.lastSpore<1800) continue;
      p.lastSpore=ticks;
      const a=random()*Math.PI*2, dist=75+random()*100*(0.5+p.genome.height);
      const env=sampleHabitat(p.x,p.y),x=p.x+Math.cos(a)*dist+env.currentX*150,y=p.y+Math.sin(a)*dist+env.currentY*150;
      if(Math.hypot(x-CONFIG.CHAMBER_CENTER_X,y-CONFIG.CHAMBER_CENTER_Y)>CONFIG.CHAMBER_RADIUS-50 || this.isles.some(o=>Math.hypot(x-o.x,y-o.y)<(p.baseRadius+o.baseRadius)*0.7)) continue;
      const genome=Object.fromEntries(Object.entries(p.genome).map(([k,v])=>[k,clamp(v+(random()-0.5)*0.16)]));
      const biomass=p.biomass*0.18;p.biomass-=biomass;
      const child=this.makePlant({id:this.nextId++,x,y,genome,baseRadius:Math.max(25,Math.min(65,p.baseRadius+(random()-0.5)*4)),
        hue:(p.hue+(random()-0.5)*0.045+1)%1,biomass:biomass*0.9,generation:p.generation+1,parentId:p.id,lastSpore:ticks});
      this.isles.push(child);this.totals.births++;this.develop(p);
    }
  }
  getBroadcastState() {
    return this.isles.map(p=>({id:p.id,x:Math.round(p.x),y:Math.round(p.y),r:Math.round(p.radius),radius:Math.round(p.radius),
      d:Math.round(p.density*100)/100,density:Math.round(p.density*100)/100,h:Math.round(p.hue*100)/100,hue:Math.round(p.hue*100)/100,
      f:p.frondCount,frondCount:p.frondCount,height:p.genome.height,branching:p.genome.branching,defense:p.genome.defense,
      biomass:Math.round(p.biomass),generation:p.generation,parentId:p.parentId}));
  }
  toJSON(){return {version:1,isles:this.isles.map(p=>({...p,genome:{...p.genome}})),nextId:this.nextId,totals:{...this.totals}};}
  fromJSON(data) {
    if(data && Array.isArray(data.isles)) {
      this.isles=data.isles.map(p=>this.makePlant(p));
      this.nextId=Math.max(data.nextId??1,...this.isles.map(p=>p.id+1));
      this.totals={births:0,deaths:0,grazed:0,minerals:0,...data.totals};
    }
  }
}
