import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {TerrainField,TERRAIN_SEED,validateTerrainState,transportChemicals} from '../public/js/shared/terrain.js';
import {makeResourceRecharge,RESOURCE_OASES} from '../public/js/shared/habitats.js';
process.env.VENICE_API_KEY='';
process.env.SNAPSHOT_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'aetheon-terrain-test-')),'world.json');
const {ChemicalGrid}=await import('../server/core/chemicalGrid.js');
const {Organism}=await import('../server/core/organism.js');
const {SimulationEngine}=await import('../server/core/engine.js');
const {getRandomState,setRandomState}=await import('../server/core/random.js');
const {OceanRenderer}=await import('../public/js/gl/renderer.js');

test('shared relief is reproducible, bounded, and consumes no biological randomness',()=>{
 const rng=getRandomState(),a=new TerrainField(),b=new TerrainField();
 assert.equal(getRandomState(),rng);
 for(const key of ['elevation','currentX','currentY','light','mobility','permeability'])assert.deepEqual(a[key],b[key]);
 const forms=new Set();let min=1,max=0;
 for(let y=200;y<1900;y+=35)for(let x=200;x<1900;x+=35){
  const s=a.sample(x,y);forms.add(s.landform);min=Math.min(min,s.elevation);max=Math.max(max,s.elevation);
  assert.ok(s.mobility>=.72&&s.mobility<=1&&s.light>=.059&&s.light<=1);
  assert.ok(Math.hypot(s.currentX,s.currentY)<.28);assert.ok(s.floorHeight>=-28&&s.floorHeight<=-4);
 }
 assert.equal(forms.size,4);assert.ok(max-min>.4);
 const x=87,y=113,s=a.sample(x*a.spacing,y*a.spacing);
 assert.equal(s.elevation,a.elevation[y*a.size+x]);
});

test('every transport face conserves mass through heterogeneous reefs and terrain',()=>{
 const g=new ChemicalGrid();g.nutrients.fill(0);g.waste.fill(0);g.signal.fill(0);
 for(let i=0;i<g.cellCount;i++)if(g.terrain.wet[i]){
  g.nutrients[i]=(i%23)/100;g.waste[i]=(i%17)/100;g.signal[i]=(i%7)/100;g.substrate[i]=(i%31)/31;
 }
 const keys=['nutrients','waste','signal'],initial=keys.map(k=>g[k].reduce((a,b)=>a+b,0));
 for(let tick=0;tick<500;tick++){
  transportChemicals(g,[.08,.04,.12]);
  for(const k of keys)g[k].set(g['next'+k[0].toUpperCase()+k.slice(1)]);
 }
 keys.forEach((k,i)=>{
  const total=g[k].reduce((a,b)=>a+b,0);assert.ok(Math.abs(total-initial[i])<initial[i]*2e-6,`${k}: ${total-initial[i]}`);
  assert.ok(g[k].every(v=>Number.isFinite(v)&&v>=0));
  assert.ok(g[k].every((v,j)=>g.terrain.wet[j]||v===0),'zero flux across ocean edge');
 });
});

test('diffusive exchange is symmetric and depressions release a pulse more slowly',()=>{
 const g=new ChemicalGrid();g.terrain.eastFlow.fill(0);g.terrain.southFlow.fill(0);g.substrate.fill(0);
 const candidates=Array.from(g.terrain.wet.keys()).filter(i=>g.terrain.wet[i]&&i%g.size>4&&i%g.size<g.size-5&&i>g.size*5&&i<g.cellCount-g.size*5);
 const low=candidates.reduce((a,b)=>g.terrain.permeability[a]<g.terrain.permeability[b]?a:b),high=candidates.reduce((a,b)=>g.terrain.permeability[a]>g.terrain.permeability[b]?a:b);
 const pulse=i=>{g.nutrients.fill(0);g.nutrients[i]=1;transportChemicals(g,[.08,0,0]);return g.nextNutrients[i];};
 assert.ok(pulse(low)>pulse(high));
 g.terrain.eastConductance.fill(0);g.terrain.southConductance.fill(0);g.terrain.eastConductance[low]=.6;
 g.nutrients.fill(0);g.nutrients[low]=1;transportChemicals(g,[.08,0,0]);const out=1-g.nextNutrients[low];
 g.nutrients.fill(0);g.nutrients[low+1]=1;transportChemicals(g,[.08,0,0]);assert.ok(Math.abs(g.nextNutrients[low]-out)<1e-7);
});

test('geology changes cell propulsion and drift, while the food recharge budget stays fixed',()=>{
 const g=new ChemicalGrid();g.nutrients.fill(0);const o=new Organism(1190,1260);o.energy=70;
 const clone=new Organism(o.x,o.y,o.genome);Object.assign(clone,structuredClone(o));const rng=getRandomState();
 o.step(g,[],[],1020);setRandomState(rng);
 const terrain=g.terrain;g.terrain=undefined;clone.step(g,[],[],1020);g.terrain=terrain;
 assert.ok(Math.hypot(o.vx-clone.vx,o.vy-clone.vy)>1e-6);
 assert.ok(Math.abs(makeResourceRecharge().reduce((a,b)=>a+b,0)-48.564)<1e-4);
});

test('terrain receipts reject future, unknown or altered geology',()=>{
 assert.deepEqual(validateTerrainState({version:1,seed:TERRAIN_SEED,startedAtTick:20},20),{version:1,seed:TERRAIN_SEED,startedAtTick:20});
 for(const state of [{version:2,seed:TERRAIN_SEED,startedAtTick:0},{version:1,seed:1,startedAtTick:0},{version:1,seed:TERRAIN_SEED,startedAtTick:21}])assert.throws(()=>validateTerrainState(state,20));
});

test('3D relief receives actual calcite, not the display opacity of nutrient glow',()=>{
 const raw=new Uint8Array(48*48*4);raw[0]=200;raw[1]=100;raw[3]=0;raw[7]=220;
 const stub={thumbImgData:{data:new Uint8ClampedArray(48*48*4)},substrateImgData:{data:new Uint8ClampedArray(48*48*4)},
  thumbCtx:{putImageData(){}},substrateCtx:{putImageData(){}}};
 OceanRenderer.prototype.updateThumbnail.call(stub,raw);
 assert.ok(stub.thumbImgData.data[3]>0,'nutrient glow is visible');
 assert.equal(stub.substrateImgData.data[3],0,'glow does not build a mineral mound');
 assert.equal(stub.substrateImgData.data[7],220,'real mineral stock reaches the mesh');
});

test('an existing world receives geology without moving bodies or changing chemistry, RNG or history',()=>{
 const e=new SimulationEngine();e.persistence.saveSnapshot(e);
 const old=JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE));delete old.terrainState;delete old.checksum;
 old.checksum=createHash('sha256').update(JSON.stringify(old)).digest('hex');fs.writeFileSync(process.env.SNAPSHOT_FILE,JSON.stringify(old));
 const rng=getRandomState(),restored=new SimulationEngine();assert.equal(getRandomState(),rng);
 assert.deepEqual(restored.terrainState,{version:1,seed:TERRAIN_SEED,startedAtTick:old.ticks});
 restored.persistence.saveSnapshot(restored);const now=JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE));
 for(const k of ['organisms','fields','remainsState','geographyState','familyHistory','nurseryState','algaeData','journalEntries'])assert.deepEqual(now[k],old[k],k);
});

test('a real restart preserves geology and its future biological and chemical trajectory',()=>{
 const clock=Date.now;Date.now=()=>2000000000000;
 try{
  const e=new SimulationEngine();for(let i=0;i<30;i++)e.step();e.persistence.saveSnapshot(e);
  const describe=w=>({terrain:w.terrainState,organisms:w.organisms.map(({playerSteer,isPiloted,...o})=>o),
   plants:w.algae.toJSON(),bodies:w.remains.toJSON(),fields:['nutrients','waste','signal','substrate'].map(k=>Array.from(w.grid[k])),rng:getRandomState()});
  for(let i=0;i<100;i++)e.step();const expected=describe(e);
  const restored=new SimulationEngine();for(let i=0;i<100;i++)restored.step();assert.deepEqual(describe(restored),expected);
 }finally{Date.now=clock;}
});

test('asymmetric rift vents break the 72-degree regular pentagon and circular meadow',()=>{
 const g=new ChemicalGrid();assert.equal(g.vents.length,5);
 const angles=[],distances=[];
 for(const v of g.vents){
  const dx=v.baseX-g.size*.5,dy=v.baseY-g.size*.5;
  distances.push(Math.hypot(dx,dy));
  angles.push((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2));
 }
 angles.sort((a,b)=>a-b);
 const steps=angles.map((a,i)=>(i<angles.length-1?angles[i+1]-a:a+Math.PI*2-angles[i])*180/Math.PI);
 // Every step between vents must differ from the 72-degree pentagon
 assert.ok(steps.every(s=>Math.abs(s-72)>4));
 // Distances from center must vary naturally along the rift
 assert.ok(Math.max(...distances)-Math.min(...distances)>6);
});

test('outer archipelago resource oases break 5-point pentagram symmetry with organic archipelago distribution',()=>{
 assert.ok(RESOURCE_OASES.length !== 5);
 const angles=[],distances=[];
 for(const p of RESOURCE_OASES){
  const dx=p.x-1050,dy=p.y-1050;
  distances.push(Math.hypot(dx,dy));
  angles.push((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2));
 }
 angles.sort((a,b)=>a-b);
 const steps=angles.map((a,i)=>(i<angles.length-1?angles[i+1]-a:angles[0]+Math.PI*2-angles[i])*180/Math.PI);
 assert.ok(steps.every(s=>Math.abs(s-72)>8));
 assert.ok(Math.max(...distances)-Math.min(...distances)>40);
});

test('biogenic substrate and algae feedback dynamically reshapes terrain relief, permeability, shading and currents',()=>{
 const g=new ChemicalGrid();const baseElev=g.terrain.elevation[g.size*96+96],baseLight=g.terrain.light[g.size*96+96];
 g.depositSubstrate(1050,1050,0.85,35);
 assert.ok(g.substrate[g.size*96+96]>0.3);
 g.updateTerrainFromLife({isles:[{x:1050,y:1050,radius:40}]});
 // Reef accretion builds up elevation
 assert.ok(g.terrain.elevation[g.size*96+96]>baseElev+0.05);
 // Algae canopy shades seafloor and reef reduces permeability
 assert.ok(g.terrain.light[g.size*96+96]<baseLight);
 assert.ok(g.terrain.permeability[g.size*96+96]<g.terrain.basePermeability[g.size*96+96]);
 // Resetting restores exact base geology
 g.terrain.resetToBase();
 assert.equal(g.terrain.elevation[g.size*96+96],baseElev);
 assert.equal(g.terrain.light[g.size*96+96],baseLight);
});

