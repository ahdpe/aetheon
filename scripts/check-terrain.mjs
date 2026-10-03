// A bounded experiment on copied data only. Never point at a canonical data path.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [root,stepsText,output]=process.argv.slice(2),steps=Number(stepsText);
if(!root?.startsWith('/private/tmp/aetheon-terrain-')||!output||!Number.isSafeInteger(steps)||steps<0||steps>36000)throw Error('Use disposable /private/tmp/aetheon-terrain-* root, 0..36000 steps and output path');
process.env.VENICE_API_KEY='';process.env.MAX_ORGANISMS='280';process.env.SNAPSHOT_FILE=path.join(root,'data/aetheon_world.json');
const {SimulationEngine}=await import(new URL('server/core/engine.js',pathToFileURL(root+'/')));
const original=JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE)),e=new SimulationEngine();
e.naturalist.checkObservation=async()=>false;
assert.ok(e.persistence.saveSnapshot(e));const migrated=e.persistence.read(e.persistence.filePath);
const compare=(before,after)=>{
 for(const key of Object.keys(before).filter(k=>!['checksum','savedAt','speciesList'].includes(k)))assert.deepEqual(after[key],before[key],`state ${key}`);
 assert.equal(before.speciesList.length,after.speciesList.length);
 const census=new Map();for(const o of after.organisms)census.set(o.speciesId,(census.get(o.speciesId)??0)+1);
 for(let i=0;i<before.speciesList.length;i++) {
  const {population:a,...old}=before.speciesList[i],{population:b,...now}=after.speciesList[i];
  assert.deepEqual(now,old,'catalog genes/history');assert.equal(b,census.get(now.id)??0,'derived census');
 }
};
compare(original,migrated);
if(e.remains&&!original.remainsState){assert.equal(e.remains.items.length,0);assert.equal(e.remains.startedAtTick,original.ticks);}
const describe=()=>({animals:e.organisms.length,plants:e.algae.isles.length,hunters:e.organisms.filter(o=>o.carnivory>.35).length,
 terrain:e.terrainState,bodies:e.remains?.getStats(),
 dissolved:e.grid.nutrients.reduce((a,b)=>a+b,0),habitatCounts:e.geography.latest?.regions.map(r=>({id:r.id,cells:r.cells,plants:r.plants})),meanEnergy:e.organisms.reduce((s,o)=>s+o.energy,0)/Math.max(1,e.organisms.length)});
const before=describe(),times=[],cpu0=process.cpuUsage(),wall0=performance.now(),observations=[];
let births=0,kills=0,minimumPopulation=e.organisms.length,maxBodies=0,maxRss=process.memoryUsage().rss;
for(let i=0;i<steps;i++) {
 const t=performance.now();e.step();times.push(performance.now()-t);
 births+=e.eventsBuffer.filter(v=>v.type==='birth').length;kills+=e.eventsBuffer.filter(v=>v.type==='predation').length;
 minimumPopulation=Math.min(minimumPopulation,e.organisms.length);maxBodies=Math.max(maxBodies,e.remains?.items.length??0);
 if(i%100===0) {
  maxRss=Math.max(maxRss,process.memoryUsage().rss);assert.ok(e.organisms.length<=280&&e.algae.isles.length<=32);
  assert.ok(e.organisms.every(o=>[o.x,o.y,o.vx,o.vy,o.energy,o.age].every(Number.isFinite)&&Math.hypot(o.x-1050,o.y-1050)<=1020+.001));
  assert.ok(['nutrients','waste','signal','substrate'].every(k=>e.grid[k].every(Number.isFinite)));
  if(e.remains){assert.ok(e.remains.items.length<=96);assert.ok(Math.abs(e.remains.getStats().balanceError)<1e-6*Math.max(1,e.remains.totals.introduced));}
 }
 if((i+1)%6000===0)observations.push({tick:e.ticks,...describe()});
}
const elapsed=performance.now()-wall0,cpu=process.cpuUsage(cpu0);times.sort((a,b)=>a-b);
assert.equal(e.ticks,original.ticks+steps);assert.equal(e.genesisTime,original.genesisTime);assert.ok(e.persistence.saveSnapshot(e));
const saved=e.persistence.read(e.persistence.filePath),restored=new SimulationEngine();assert.ok(restored.persistence.saveSnapshot(restored));
compare(saved,restored.persistence.read(restored.persistence.filePath));
const report={startTick:original.ticks,endTick:e.ticks,worldCreatedAt:e.genesisTime,steps,before,after:describe(),observations,births,kills,
 minimumPopulation,maxBodies,wallMs:Math.round(elapsed),cpuMs:Math.round((cpu.user+cpu.system)/1000),stepP95Ms:times[Math.floor(times.length*.95)]??0,
 maxRssMiB:maxRss/1048576,snapshotBytes:e.persistence.lastSnapshotBytes,maximumBodyPacketBytes:e.remains?Buffer.byteLength(JSON.stringify(e.remains.broadcast())):0,
 exactMigration:true,exactRestart:true};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
