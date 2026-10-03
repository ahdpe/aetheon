import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.SNAPSHOT_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'aetheon-ecology-')),'world.json');
process.env.VENICE_API_KEY='';
const {Organism}=await import('../server/core/organism.js');
const {SimulationEngine}=await import('../server/core/engine.js');
const {AlgaeManager,FLORA_LIMIT}=await import('../server/core/algaeManager.js');
const {ChemicalGrid}=await import('../server/core/chemicalGrid.js');
const {completeGenome,developBody}=await import('../public/js/shared/anatomy.js');
const {sampleHabitat}=await import('../public/js/shared/habitats.js');
const {getSpeciesMorphology}=await import('../public/js/gl/morphology.js');
const {setRandomState,getRandomState}=await import('../server/core/random.js');

test('body genes are inherited with bounded mutations; legacy development never consumes randomness',()=>{
 const parent=new Organism(700,700);const rng=getRandomState();
 const legacy={size:4,hue:.5,carnivory:.1,speedMax:2,adhesion:.4,chemotaxisNutrient:1};
 assert.deepEqual(completeGenome(legacy),completeGenome(legacy));assert.equal(getRandomState(),rng);
 parent.genome.mutationRate=0;const child=parent.reproduce(parent.speciesId);
 for(const k of ['elongation','shell','flagella','sensing']) assert.equal(child.genome[k],parent.genome[k]);
 parent.genome.mutationRate=.3;
 for(let i=0;i<100;i++) for(const k of ['elongation','shell','flagella','sensing']) assert.ok(parent.createMutatedGenome()[k]>=0&&parent.createMutatedGenome()[k]<=1);
 const a=getSpeciesMorphology(1,.4,.1,4,2,parent.genome),b=getSpeciesMorphology(999,.4,.1,4,2,parent.genome);
 assert.equal(a.shape,b.shape);assert.equal(a.aspectX,b.aspectX);
 assert.notEqual(getSpeciesMorphology(1,.4,.1,4,2,{...parent.genome,elongation:0}).shape,getSpeciesMorphology(1,.4,.1,4,2,{...parent.genome,elongation:1}).shape);
});

test('shell reduces bite damage at a swimming and energy cost; predator cannot bite each tick',()=>{
 const hunter=new Organism(700,700),bare=new Organism(702,700),armored=new Organism(702,700);
 hunter.carnivory=.9;hunter.size=7;bare.size=armored.size=6;bare.energy=armored.energy=200;bare.carnivory=armored.carnivory=0;
 bare.body=developBody({...bare.genome,shell:0});armored.body=developBody({...bare.genome,shell:1});
 const grid={consumeAndExcrete:()=>0};
 assert.equal(hunter.attemptPredation(bare,grid).killed,false);const bareDamage=200-bare.energy;
 assert.equal(hunter.attemptPredation(armored,grid),false);hunter.attackCooldown=0;
 assert.equal(hunter.attemptPredation(armored,grid).killed,false);
 assert.ok(200-armored.energy<bareDamage);assert.ok(armored.body.propulsion<bare.body.propulsion);assert.ok(armored.body.upkeep>bare.body.upkeep);
});

test('inherited propulsion affects actual movement and carnivory reduces dissolved-food assimilation',()=>{
 const base=new Organism(700,700),g={...base.genome,carnivory:0,flagella:0,shell:0,sensing:0};
 const run=(genome)=>{
  const o=new Organism(700,700,genome);o.vx=o.vy=0;o.heading=0;o.phase=0;o.energy=80;
  o.playerSteer={x:1,y:0,ticks:10,thrust:1};const grid=new ChemicalGrid(128);grid.nutrients.fill(2);
  o.step(grid,[],[],620,1);return o;
 };
 const quiet=run(g),propelled=run({...g,flagella:1});assert.ok(propelled.x>quiet.x);assert.ok(propelled.body.upkeep>quiet.body.upkeep);
 const hunter=run({...g,carnivory:.9});assert.ok(quiet.energy>hunter.energy+1);
});

test('plant grazing removes biomass and cannot give free energy from an exhausted or full feeding pair',()=>{
 const algae=new AlgaeManager(),p=algae.isles[0],org=new Organism(p.x,p.y);org.carnivory=0;org.energy=40;
 const biomass=p.biomass,energy=org.energy,taken=algae.graze(p,org);
 assert.ok(taken>0);assert.ok(Math.abs(biomass-p.biomass-taken)<1e-10);assert.ok(org.energy>energy);
 org.energy=250;assert.equal(algae.graze(p,org),0);
 p.biomass=0;org.energy=40;assert.equal(algae.graze(p,org),0);assert.equal(org.energy,40);
});

test('plants require finite minerals, die without them, and saved extinction is not reseeded',()=>{
 const algae=new AlgaeManager(),grid=new ChemicalGrid(128);grid.nutrients.fill(0);grid.waste.fill(0);
 const p=algae.isles[0];p.biomass=.001;algae.isles=[p];algae.update({grid,ticks:1,organisms:[]});
 assert.equal(algae.isles.length,0);assert.equal(algae.totals.deaths,1);
 const restored=new AlgaeManager();restored.fromJSON(algae.toJSON());assert.equal(restored.isles.length,0);
 for(let t=2;t<3000;t++) restored.update({grid,ticks:t,organisms:[]});
 assert.equal(restored.isles.length,0);
});

test('plant reproduction preserves actual parentage, mutates bodies, costs biomass and remains bounded',()=>{
 const algae=new AlgaeManager(),grid=new ChemicalGrid(128);grid.nutrients.fill(2);
 algae.isles=algae.isles.slice(0,1);const p=algae.isles[0];p.age=2000;p.biomass=p.capacity;
 setRandomState(1234);algae.update({grid,ticks:2000,organisms:[]});
 const child=algae.isles.find(o=>o.id!==p.id);assert.ok(child);assert.equal(child.parentId,p.id);assert.equal(child.generation,2);
 assert.notDeepEqual(child.genome,p.genome);assert.ok(p.biomass<p.capacity);assert.equal(algae.totals.births,1);
 for(let t=2001;t<12000;t++) {grid.nutrients.fill(2);algae.update({grid,ticks:t,organisms:[]});}
 assert.ok(algae.isles.length<=FLORA_LIMIT);assert.ok(algae.isles.length>1);
});

test('births use actual vacant slots; crowding neither kills existing cells nor lets a bitten parent split',()=>{
 const e=new SimulationEngine();e.cataclysms.step=()=>{};e.cataclysms.isBiogenesisBlocked=()=>true;e.algae.update=()=>{};
 e.organisms=e.organisms.slice(0,3);e.maxOrganisms=3;
 for(const o of e.organisms) {o.step=()=>{};o.carnivory=0;o.age=5000;o.energy=200;o.canReproduce=()=>o.energy>=100;}
 const ids=e.organisms.map(o=>o.id);e.step();assert.deepEqual(e.organisms.map(o=>o.id),ids);
 e.organisms[2].fatalDamage=true;e.step();assert.equal(e.organisms.length,3);assert.equal(e.recentWindow.births,1);
 const chosen=new Set();
 for(let seed=1;seed<=20;seed++){
   const a=e.organisms[0],b=e.organisms[1];e.organisms=[a,b];e.maxOrganisms=3;a.energy=b.energy=200;
   setRandomState(seed);e.step();chosen.add(e.organisms.at(-1).parentId);
 }
 assert.equal(chosen.size,2);
 const parent=e.organisms[0],attacker=e.organisms[1];e.organisms=[parent,attacker];e.maxOrganisms=3;
 parent.energy=200;parent.x=attacker.x=700;parent.y=attacker.y=700;
 attacker.carnivory=.9;attacker.canReproduce=()=>false;
 attacker.attemptPredation=prey=>{if(prey!==parent)return false;prey.energy=20;return {killed:false};};
 const births=e.recentWindow.births;e.step();assert.equal(e.recentWindow.births,births);
 assert.equal(e.organisms.length,2);
});

test('old plants senesce even when minerals remain abundant',()=>{
 const algae=new AlgaeManager(),grid=new ChemicalGrid(128);grid.nutrients.fill(2);
 const p=algae.isles[0];p.age=31000;algae.isles=[p];algae.update({grid,ticks:31000,organisms:[]});
 assert.equal(algae.isles.length,0);assert.equal(algae.totals.deaths,1);
});

test('new plant bodies, counters, ecology epoch and future evolution survive a full checkpoint',()=>{
 const clock=Date.now;Date.now=()=>2000000000000;
 try {
 const e=new SimulationEngine();e.algae.isles[0].age=2000;e.algae.isles[0].lastSpore=-2000;
 assert.equal(e.persistence.saveSnapshot(e),true);
 const describe=w=>({organisms:w.organisms.map(({playerSteer,isPiloted,...o})=>o),flora:w.algae.toJSON(),epoch:w.ecologyEpoch,
    history:w.history.toJSON(),fields:['nutrients','waste','signal','substrate'].map(k=>Array.from(w.grid[k])),rng:getRandomState()});
 for(let i=0;i<210;i++) e.step();const expected=describe(e);
 const restored=new SimulationEngine();for(let i=0;i<210;i++) restored.step();assert.deepEqual(describe(restored),expected);
 }finally{Date.now=clock;}
});

test('contrasting habitats use continuous light and current gradients',()=>{
 const basin=sampleHabitat(1050,1050),meadow=sampleHabitat(1390,1050),rim=sampleHabitat(1630,1050);
 assert.equal(basin.id,'basin');assert.equal(meadow.id,'meadow');assert.equal(rim.id,'shoal');assert.ok(meadow.light>basin.light&&meadow.light>rim.light);
 const a=sampleHabitat(1050+620*.3399,1050),b=sampleHabitat(1050+620*.3401,1050);
 assert.ok(Math.abs(a.light-b.light)<.002);assert.ok(Math.abs(a.currentY-b.currentY)<.002);
});
