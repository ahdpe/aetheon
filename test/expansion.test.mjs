import test from 'node:test';
import assert from 'node:assert/strict';
import {expandSnapshot,savedGeometry} from '../server/core/expansion.js';
import {getRandomState} from '../server/core/random.js';
import {makeResourceRecharge,RESOURCE_OASES,sampleHabitat} from '../public/js/shared/habitats.js';
import {createChemicalGridClass} from '../public/js/shared/chemicalCore.js';
import {TRIAL_PHYSICS} from '../public/js/shared/nurseryDesign.js';
import {SpatialHash} from '../public/js/shared/spatialHash.js';

function legacy() {
 const fields={};
 for(const [k,j]of ['nutrients','waste','signal','substrate'].entries()){
  const v=Float32Array.from({length:128*128},(_,i)=>(i%127)/127*(k+1)*.1);
  fields[j]=Buffer.from(v.buffer).toString('base64');
 }
 return {formatVersion:3,ticks:1234,genesisTime:100,rngState:123,nextOrganismId:999,fields,
  organisms:[{id:42,parentId:41,x:620.25,y:700.125,energy:88,genome:{shell:.7}}],
  algaeData:{isles:[{id:3,x:500.25,y:510.5,biomass:30,parentId:2}],totals:{births:2}},
  vents:[{id:'old',x:64,y:32,baseX:64,baseY:32,radius:7,power:.7}],ephemeralFumaroles:[{x:20,y:30,life:90}],
  nutrientBlooms:[{x:610,y:611,energy:20}],nurseryState:{salt:'protected',records:[{position:{x:900,y:910},familyId:42}]},
  familyHistory:{nodes:[{id:42,parentId:41}]},climate:{ticks:1234},journalEntries:[{text:'historical'}],
  geographyState:{version:1,radius:680,startedAtTick:100,samples:[{tick:1200,counts:[1,0,0,0,0],plants:[0,0,0,0,1]}]}};
}
test('expansion copies every old chemical byte and translates bodies, roots, vents and receipts without RNG or identity changes',()=>{
 const before=legacy(),copy=structuredClone(before),rng=getRandomState(),after=expandSnapshot(before);
 assert.deepEqual(before,copy);assert.equal(getRandomState(),rng);
 for(const key of ['rngState','nextOrganismId','genesisTime','ticks','familyHistory','climate','journalEntries'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(after.organisms,[{...before.organisms[0],x:970.25,y:1050.125}]);
 assert.equal(after.algaeData.isles[0].biomass,30);assert.equal(after.algaeData.isles[0].x,850.25);
 assert.deepEqual(after.vents,[{...before.vents[0],x:96,y:64,baseX:96,baseY:64}]);
 assert.deepEqual(after.nurseryState.records[0].position,{x:1250,y:1260});assert.equal(after.nurseryState.salt,before.nurseryState.salt);
 for(const key of Object.keys(before.fields)){
  const old=Buffer.from(before.fields[key],'base64'),now=Buffer.from(after.fields[key],'base64');
  for(let y=0;y<128;y++)assert.deepEqual(now.subarray(((y+32)*192+32)*4,((y+32)*192+160)*4),old.subarray(y*128*4,(y+1)*128*4));
 }
 assert.deepEqual(after.geographyState.samples[0],{...before.geographyState.samples[0],radius:680});
 assert.equal(after.geographyState.expandedAtTick,1234);assert.equal(after.geographyState.radius,1020);
 assert.deepEqual(after.worldGeometry,savedGeometry());assert.strictEqual(expandSnapshot(after),after);
});
test('unknown geometry and damaged legacy field sizes are refused instead of resampling or restarting Genesis',()=>{
 for(const change of [{worldGeometry:{...savedGeometry(),gridSize:128}},{formatVersion:4},{geographyState:{radius:999}},{fields:{nutrients:'AAAA'}}])assert.throws(()=>expandSnapshot({...legacy(),...change}));
});
test('larger water keeps the old total accessible recharge budget and creates real rich/poor contrasts',()=>{
 const r=makeResourceRecharge();let oldWet=0;
 for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(Math.hypot(x*1400/128-700,y*1400/128-700)<=680)oldWet++;
 assert.ok(Math.abs(r.reduce((a,b)=>a+b,0)-oldWet*.004)<1e-5);
 const at=(x,y)=>r[Math.round(y*192/2100)*192+Math.round(x*192/2100)];
 const gap=at(1050,1850);for(const p of RESOURCE_OASES){assert.ok(at(p.x,p.y)>gap*12);assert.ok(sampleHabitat(p.x,p.y).light>.8);}
 assert.equal(at(0,0),0);assert.ok(r.every(Number.isFinite));
});
test('cached recharge affects dissolved food numerically, even with no plants, vents or random fumaroles',()=>{
 const Grid=createChemicalGridClass(TRIAL_PHYSICS,()=>.5),g=new Grid();g.nutrients.fill(0);g.vents=[];
 for(let i=0;i<500;i++)g.step(null,i);
 const rich=g.sampleVal(1050,250),poor=g.sampleVal(1050,1850);
 assert.ok(rich>poor*10);assert.ok(poor>0);assert.ok(g.nutrients.every(v=>v>=0&&v<=2));
});
test('bilinear sampling and chemical gradients keep their physical scale after exact lattice embedding',()=>{
 const data=legacy(),expanded=expandSnapshot(data),Old=createChemicalGridClass({...TRIAL_PHYSICS,WORLD_SIZE:1400,GRID_SIZE:128},()=>.5),New=createChemicalGridClass(TRIAL_PHYSICS,()=>.5),old=new Old(),now=new New();
 for(const k of Object.keys(data.fields)){
  new Uint8Array(old[k].buffer).set(Buffer.from(data.fields[k],'base64'));new Uint8Array(now[k].buffer).set(Buffer.from(expanded.fields[k],'base64'));
 }
 for(const p of [[700.2,700.7],[510.25,490.5],[1220.25,400.125]]){
  const a=old.sample(...p),b=now.sample(p[0]+350,p[1]+350);
  for(const k of Object.keys(a))assert.ok(Math.abs(a[k]-b[k])<1e-12,k);
 }
});
test('rigid translation preserves physical neighbour sets and colony separation despite larger hash bounds',()=>{
 const points=Array.from({length:200},(_,i)=>({id:i,x:120+(i*53)%1170,y:130+(i*79)%1160}));
 const old=new SpatialHash(1400,35),now=new SpatialHash(2100,35);
 for(const p of points){old.insert(p);now.insert({...p,x:p.x+350,y:p.y+350});}
 for(const p of points){
  const a=old.query(p.x,p.y,85).map(o=>o.id).sort((a,b)=>a-b);
  const b=now.query(p.x+350,p.y+350,85).map(o=>o.id).sort((a,b)=>a-b);
  assert.deepEqual(a,b);
 }
});
