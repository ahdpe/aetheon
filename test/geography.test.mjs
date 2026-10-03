import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
process.env.SNAPSHOT_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'aetheon-geography-')),'world.json');process.env.VENICE_API_KEY='';
const {SimulationEngine}=await import('../server/core/engine.js');
const {CONFIG}=await import('../server/config.js');
const {Organism}=await import('../server/core/organism.js');
const {getRandomState}=await import('../server/core/random.js');
const {OCEAN_GEOMETRY,HABITATS,sampleHabitat,habitatReleasePoint}=await import('../public/js/shared/habitats.js');
const {createOrganismClass}=await import('../public/js/shared/organismCore.js');
const {ChemicalGrid}=await import('../server/core/chemicalGrid.js');
const {Geography,GEOGRAPHY_HISTORY_LIMIT}=await import('../server/core/geography.js');
const {createTrial}=await import('../public/js/shared/nurseryTrial.js');
const {NURSERY_PRESETS,designGenome}=await import('../public/js/shared/nurseryDesign.js');

test('expanded water keeps grid resolution and offers a continuous darker, quieter inlet',()=>{
 assert.equal(CONFIG.WORLD_SIZE,2100);assert.equal(CONFIG.GRID_SIZE,192);assert.equal(CONFIG.CHAMBER_RADIUS,1020);
 assert.ok(OCEAN_GEOMETRY.radius**2/OCEAN_GEOMETRY.previousRadius**2===2.25);
 const shadow=sampleHabitat(780,1250),lit=sampleHabitat(1320,1250);
 assert.equal(shadow.id,'shadow');assert.equal(lit.id,'meadow');assert.ok(shadow.light<lit.light*.4);
 assert.ok(Math.hypot(shadow.currentX,shadow.currentY)<Math.hypot(lit.currentX,lit.currentY)*.4);
 assert.equal(sampleHabitat(1050,250).id,'frontier');
 const a=sampleHabitat(969.999,1350),b=sampleHabitat(970.001,1350);
 assert.ok(Math.abs(a.light-b.light)<.0001);
});

test('the extra annulus is physically inhabitable rather than only a larger picture',()=>{
 const g=designGenome(NURSERY_PRESETS.grazer),Old=createOrganismClass({...CONFIG,CHAMBER_RADIUS:680},()=>.5),New=createOrganismClass(CONFIG,()=>.5);
 const old=new Old(1870,1050,g),expanded=new New(1870,1050,g),grid=new ChemicalGrid();grid.nutrients.fill(2);
 old.step(grid,[],[],680,1);expanded.step(grid,[],[],1020,1);
 assert.ok(old.x<=1730);assert.ok(expanded.x>1730&&expanded.x<2070);assert.ok(!expanded.isDead());
});

test('each requested release habitat actually contains its release points',()=>{
 for(const h of HABITATS)for(let i=0;i<360;i++){
  const p=habitatReleasePoint(h.id,i*Math.PI/180);
  assert.equal(sampleHabitat(p.x,p.y).id,h.id);assert.ok(Math.hypot(p.x-1050,p.y-1050)<CONFIG.CHAMBER_RADIUS-12);
 }
 assert.throws(()=>habitatReleasePoint('invented',0));
});

test('regional census partitions actual living bodies and reads chemicals without spending random draws',()=>{
 const e=new SimulationEngine();e.organisms=e.organisms.slice(0,5);
 HABITATS.forEach((h,i)=>Object.assign(e.organisms[i],{x:h.x,y:h.y,carnivory:i===0?.9:0}));
 e.grid.nutrients.fill(.5);e.grid.waste.fill(.25);e.grid.substrate.fill(.4);
 const rng=getRandomState(),next=Organism.getNextId(),history=e.geography.toJSON();e.geography.measure(e);
 const rows=e.geography.broadcast().regions;
 assert.equal(rows.reduce((n,r)=>n+r.cells,0),5);assert.ok(rows.every(r=>r.cells===1));
 assert.equal(rows.reduce((n,r)=>n+r.plants,0),e.algae.isles.length);assert.equal(rows.reduce((n,r)=>n+r.hunters,0),1);
 assert.ok(rows.every(r=>r.nutrients===.5&&r.waste===.25&&r.reef===.4));
 assert.equal(getRandomState(),rng);assert.equal(Organism.getNextId(),next);assert.deepEqual(e.geography.toJSON(),history);
});

test('legacy checkpoint gains geography without changing its bodies, fields, identifiers or random state',()=>{
 const e=new SimulationEngine();assert.ok(e.persistence.saveSnapshot(e));
 const saved=e.persistence.read(e.persistence.filePath);delete saved.geographyState;delete saved.checksum;
 saved.checksum=createHash('sha256').update(JSON.stringify(saved)).digest('hex');fs.writeFileSync(e.persistence.filePath,JSON.stringify(saved));
 const restored=new SimulationEngine();assert.ok(restored.persistence.saveSnapshot(restored));const current=restored.persistence.read(restored.persistence.filePath);
 for(const key of ['organisms','fields','vents','ephemeralFumaroles','algaeData','familyHistory','nurseryState','rngState','nextOrganismId','genesisTime','ticks'])assert.deepEqual(current[key],saved[key]);
 assert.equal(current.geographyState.startedAtTick,saved.ticks);assert.equal(current.geographyState.samples.length,1);
});

test('minute observations stay bounded and survive a restart without rewriting past samples',()=>{
 const e=new SimulationEngine();
 for(let i=0;i<GEOGRAPHY_HISTORY_LIMIT+20;i++){e.ticks+=600;e.geography.step(e);}
 const history=e.geography.toJSON();assert.equal(history.samples.length,GEOGRAPHY_HISTORY_LIMIT);
 assert.ok(e.persistence.saveSnapshot(e));const restored=new SimulationEngine();assert.deepEqual(restored.geography.toJSON(),history);
 const bad=new Geography(e.grid);for(const value of [{...history,radius:620},{...history,version:99},{...history,samples:[{tick:1,counts:[-1],plants:[]}]}])assert.throws(()=>bad.fromJSON(value));
 bad.fromJSON({...history,startedAtTick:e.ticks+1,samples:[]});assert.throws(()=>bad.init(e));
});

test('new release places use normal founders and persist their actual habitat',()=>{
 const e=new SimulationEngine();e.organisms=e.organisms.slice(0,140);
 const now=Date.UTC(2026,9,2);for(const [i,habitat]of ['shadow','frontier'].entries()){
  const identity=e.nursery.identity(String(i+1).repeat(64),'network'+i);
  assert.equal(e.nursery.submit(e,identity,{requestId:`00000000-0000-4000-8000-00000000000${i}`,name:'Geography fixture',habitat,design:NURSERY_PRESETS.grazer},now+i*900000).ok,true);
  e.nursery.process(e,now+i*900000);const founder=e.organisms.at(-1);
  assert.equal(sampleHabitat(founder.x,founder.y).id,habitat);assert.equal(founder.energy,60);assert.equal(founder.generation,1);
 }
 assert.equal(e.nursery.introduced,2);const restored=new SimulationEngine();assert.deepEqual(restored.nursery.toJSON(),e.nursery.toJSON());
});

test('frontier and inlet browser trials remain finite and isolated',()=>{
 for(const habitat of ['shadow','frontier']){
  const rng=getRandomState(),next=Organism.getNextId(),trial=createTrial(NURSERY_PRESETS.weaver,habitat);
  for(let i=0;i<1800;i++)trial.step();const result=trial.snapshot();
  assert.ok(result.total<=64);assert.ok(result.cells.every(o=>[o.x,o.y,o.energy].every(Number.isFinite)&&Math.hypot(o.x-1050,o.y-1050)<=1020+.001));
  assert.equal(getRandomState(),rng);assert.equal(Organism.getNextId(),next);
 }
});
