import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {RemainsManager,REMAINS_LIMIT,ORGANIC_TO_NUTRIENT} from '../public/js/shared/remains.js';
process.env.SNAPSHOT_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'aetheon-remains-test-')),'world.json');
process.env.VENICE_API_KEY='';
const {Organism}=await import('../server/core/organism.js');
const {SimulationEngine}=await import('../server/core/engine.js');
const {ChemicalGrid}=await import('../server/core/chemicalGrid.js');
const {getRandomState,setRandomState}=await import('../server/core/random.js');
const body=(energy=50)=>{const o=new Organism(1050,1050);o.energy=energy;return o;};
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('death leaves the original body once, without instant food or random detritus',()=>{
 const e=new SimulationEngine(),o=e.organisms[0],before=Array.from(e.grid.nutrients),rng=getRandomState();
 e.handleOrganismDeath(o);e.handleOrganismDeath(o);
 assert.equal(e.remains.items.length,1);assert.equal(e.remains.totals.deaths,1);assert.equal(e.nutrientBlooms.length,0);
 assert.deepEqual(Array.from(e.grid.nutrients),before);assert.equal(getRandomState(),rng);
 const p=e.remains.items[0];assert.equal(p.sourceId,o.id);assert.equal(p.size,o.size);assert.equal(p.heading,o.heading);
 for(const k of ['elongation','shell','flagella','sensing'])assert.equal(p.anatomy[k],o.body[k]);
 near(p.initialEnergy,Math.max(0,o.energy)+o.size*2);
});

test('a deceased colony member cannot transfer its recorded reserve back to the living',()=>{
 const e=new SimulationEngine(),dead=e.organisms[0],live=e.organisms[1];e.organisms=[dead,live];e.maxOrganisms=2;
 e.cataclysms.step=()=>{};e.cataclysms.isBiogenesisBlocked=()=>true;e.algae.update=()=>{};
 dead.energy=200;dead.fatalDamage=true;live.energy=20;dead.carnivory=live.carnivory=0;
 dead.step=live.step=()=>{};dead.canReproduce=live.canReproduce=()=>false;
 dead.x=live.x=1050;dead.y=live.y=1050;e.colonies.formBond(dead,live);
 e.step();assert.equal(live.energy,20);near(e.remains.items[0].energy,200+dead.size*2);
});

test('finite decay lasts one to five model minutes and cannot inject food after expiry',()=>{
 const m=new RemainsManager(),grid=new ChemicalGrid();grid.nutrients.fill(0);
 const soft=body(60);soft.body.shell=0;const p=m.add(soft,5,grid);assert.equal(p.maxAge,600);
 const hard=body(60);hard.body.shell=1;const q=m.add(hard,5,grid);assert.equal(q.maxAge,3000);
 for(let i=0;i<599;i++)m.step(grid);assert.equal(m.items.length,2);
 m.step(grid);assert.equal(m.items.length,1);assert.equal(m.items[0].id,q.id);
 for(let i=600;i<3000;i++)m.step(grid);assert.equal(m.items.length,0);
 const retained=grid.nutrients.reduce((a,b)=>a+b,0);assert.ok(retained<=m.totals.introduced*ORGANIC_TO_NUTRIENT+1e-5);
 const state=structuredClone(m.toJSON());m.step(grid);assert.deepEqual(m.toJSON(),state);near(m.getStats().balanceError,0);
});

test('scavenging debits the same reserve once, respects saturation, and favors carnivores',()=>{
 const m=new RemainsManager(),grid=new ChemicalGrid();grid.nutrients.fill(0);
 const p=m.add(body(40),0,grid),grazer=body(10),hunter=body(10);grazer.carnivory=0;hunter.carnivory=1;
 grazer.body.feeding=hunter.body.feeding=1;
 const before=p.energy;near(m.graze(p,grazer,250),.6);near(m.graze(p,hunter,250),.6);
 near(before-p.energy,1.2);assert.ok(hunter.energy>grazer.energy);
 const full=body(250),reserve=p.energy;assert.equal(m.graze(p,full,250),0);assert.equal(p.energy,reserve);
 for(let i=0;i<3000;i++) {grazer.energy=10;m.graze(p,grazer,250);m.step(grid);}
 near(m.getStats().balanceError,0);assert.equal(m.items.length,0);
 assert.ok(m.totals.dissolved+m.totals.scavenged<=m.totals.introduced+1e-6);
 assert.equal(m.graze(p,grazer,250),0);
});

test('whole ingestion removes the transferred prey reserve before carcass accounting',()=>{
 const grid=new ChemicalGrid(),m=new RemainsManager(),hunter=body(20),prey=body(80);
 hunter.carnivory=1;hunter.size=10;prey.carnivory=0;prey.size=4;prey.body.shell=0;
 assert.equal(hunter.attemptPredation(prey,grid).killed,true);near(hunter.energy,80);near(prey.energy,20);
 assert.equal(prey.isDead(),true);assert.equal(prey.carcassFraction,.25);
 const p=m.add(prey,1,grid,'predation');near(p.energy,22);
 assert.equal(hunter.attemptPredation(prey,grid),false);
});

test('a mass-death cap returns remaining stock once, and saturated water is a sink',()=>{
 const grid=new ChemicalGrid(),m=new RemainsManager();grid.nutrients.fill(2);
 for(let i=0;i<REMAINS_LIMIT+30;i++)m.add(body(70),i,grid);
 assert.equal(m.items.length,REMAINS_LIMIT);assert.equal(m.totals.overflow,30);assert.equal(m.totals.dissolved,0);
 assert.ok(m.totals.dissipated>0);near(m.getStats().balanceError,0);
 for(let t=0;t<3000;t++)m.step(grid);
 assert.equal(m.items.length,0);near(m.totals.introduced,m.totals.dissipated);near(m.getStats().balanceError,0);
});

test('depositing a fixed total does not multiply it by area or grid resolution',()=>{
 for(const size of [128,192]) for(const radius of [5,40,100]) {
   const g=new ChemicalGrid(size);g.nutrients.fill(0);const accepted=g.depositNutrients(1050,1050,2,radius);
   near(g.nutrients.reduce((a,b)=>a+b,0),2);near(accepted,2);
 }
});

test('scavenging at zero distance leaves finite steering; dead cells cannot eat',()=>{
 const grid=new ChemicalGrid(),m=new RemainsManager(),o=body(20);grid.nutrients.fill(0);
 m.add(body(30),0,grid);o.carnivory=0;o.step(grid,[],[],1020,1,m);
 for(const k of ['x','y','vx','vy','energy'])assert.ok(Number.isFinite(o[k]));
 o.fatalDamage=true;const energy=m.items[0].energy;assert.equal(m.graze(m.items[0],o,250),0);assert.equal(m.items[0].energy,energy);
});

test('body reserves, identities and future recycling survive a real checkpoint',()=>{
 const clock=Date.now;Date.now=()=>2000000000000;
 try {
  setRandomState(4242);const e=new SimulationEngine();e.organisms[0].age=12001;e.step();
  assert.ok(e.remains.items.length>0);assert.equal(e.persistence.saveSnapshot(e),true);
  const describe=w=>({bodies:w.remains.toJSON(),orgs:w.organisms.map(({playerSteer,isPiloted,...o})=>o),
    fields:['nutrients','waste','signal','substrate'].map(k=>Array.from(w.grid[k])),rng:getRandomState()});
  for(let i=0;i<140;i++)e.step();const expected=describe(e);
  const restored=new SimulationEngine();for(let i=0;i<140;i++)restored.step();assert.deepEqual(describe(restored),expected);
 }finally{Date.now=clock;}
});

test('legacy checkpoint starts an empty ledger without changing living identity or chemistry',()=>{
 const e=new SimulationEngine();e.persistence.saveSnapshot(e);
 const saved=JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE));delete saved.remainsState;delete saved.checksum;
 saved.checksum=createHash('sha256').update(JSON.stringify(saved)).digest('hex');fs.writeFileSync(process.env.SNAPSHOT_FILE,JSON.stringify(saved));
 const rng=getRandomState(),ids=e.organisms.map(o=>o.id),chem=Array.from(e.grid.nutrients),restored=new SimulationEngine();
 assert.deepEqual(restored.organisms.map(o=>o.id),ids);assert.deepEqual(Array.from(restored.grid.nutrients),chem);assert.equal(getRandomState(),rng);
 assert.equal(restored.remains.items.length,0);assert.equal(restored.remains.startedAtTick,saved.ticks);
});

test('malformed or inflated organic reserves are rejected instead of quietly reseeded',()=>{
 const m=new RemainsManager(),grid=new ChemicalGrid();m.add(body(),1,grid);const data=structuredClone(m.toJSON());
 for(const corrupt of [d=>d.items[0].energy=-1,d=>d.items[0].energy=999,d=>d.items[0].anatomy.shell=NaN,d=>d.totals.introduced+=20,d=>d.items.push(d.items[0])]) {
  const d=structuredClone(data);corrupt(d);assert.throws(()=>new RemainsManager().fromJSON(d),/Invalid remains/);
 }
});
