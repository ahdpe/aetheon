// Run on a disposable copy, with AI disabled. Never target the live data path.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [root,stepsText,output]=process.argv.slice(2),steps=Number(stepsText);
if(!root?.startsWith('/private/tmp/aetheon-expansion-')||!output||!Number.isSafeInteger(steps)||steps<0||steps>36000)throw Error('Use disposable /private/tmp/aetheon-expansion-* root, 0..36000 steps and output path');
process.env.VENICE_API_KEY='';process.env.MAX_ORGANISMS='280';process.env.SNAPSHOT_FILE=path.join(root,'data/aetheon_world.json');
const base=pathToFileURL(root+'/'),{SimulationEngine}=await import(new URL('server/core/engine.js',base));
const {expandSnapshot}=await import(new URL('server/core/expansion.js',base));
const original=JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE)),expected=expandSnapshot(original),e=new SimulationEngine();
e.naturalist.checkObservation=async()=>false;
assert.ok(e.persistence.saveSnapshot(e));const migrated=e.persistence.read(e.persistence.filePath);
for(const key of Object.keys(expected).filter(k=>!['checksum','savedAt','formatVersion','speciesList'].includes(k)))assert.deepEqual(migrated[key],expected[key],`migration ${key}`);
const summary=()=>{
 const c={animals:e.organisms.length,plants:e.algae.isles.length,hunters:e.organisms.filter(o=>o.carnivory>.35).length,
  cellsBeyondPreviousEdge:0,plantsBeyondPreviousEdge:0,meanRadius:0,crowdedCells:0,regionalCounts:e.geography.latest.regions.map(r=>r.cells)};
 for(const o of e.organisms){const r=Math.hypot(o.x-1050,o.y-1050);c.meanRadius+=r;if(r>680)c.cellsBeyondPreviousEdge++;
  if(e.organisms.filter(p=>p!==o&&Math.hypot(o.x-p.x,o.y-p.y)<40).length>5)c.crowdedCells++;
 }
 c.meanRadius/=Math.max(1,c.animals);c.plantsBeyondPreviousEdge=e.algae.isles.filter(p=>Math.hypot(p.x-1050,p.y-1050)>680).length;
 return c;
};
const before=summary(),times=[],cpu0=process.cpuUsage(),wall0=performance.now(),observations=[];
let births=0,kills=0,minimumPopulation=e.organisms.length,minimumHunters=before.hunters,maxRss=process.memoryUsage().rss;
for(let i=0;i<steps;i++){
 const t=performance.now();e.step();times.push(performance.now()-t);
 births+=e.eventsBuffer.filter(v=>v.type==='birth').length;kills+=e.eventsBuffer.filter(v=>v.type==='predation').length;
 minimumPopulation=Math.min(minimumPopulation,e.organisms.length);minimumHunters=Math.min(minimumHunters,e.organisms.filter(o=>o.carnivory>.35).length);
 if(i%100===0){
  maxRss=Math.max(maxRss,process.memoryUsage().rss);assert.ok(e.organisms.length<=280&&e.algae.isles.length<=32);
  assert.ok(e.organisms.every(o=>[o.x,o.y,o.vx,o.vy,o.energy,o.age].every(Number.isFinite)&&Math.hypot(o.x-1050,o.y-1050)<=1020+.001));
  assert.ok(['nutrients','waste','signal','substrate'].every(k=>e.grid[k].every(Number.isFinite)));
 }
 if((i+1)%6000===0)observations.push({tick:e.ticks,...summary()});
}
const elapsed=performance.now()-wall0,cpu=process.cpuUsage(cpu0);times.sort((a,b)=>a-b);
assert.equal(e.ticks,original.ticks+steps);assert.equal(e.genesisTime,original.genesisTime);assert.ok(e.persistence.saveSnapshot(e));
const saved=e.persistence.read(e.persistence.filePath),restored=new SimulationEngine();assert.ok(restored.persistence.saveSnapshot(restored));
const again=restored.persistence.read(restored.persistence.filePath);
for(const key of Object.keys(saved).filter(k=>!['checksum','savedAt','speciesList'].includes(k)))assert.deepEqual(again[key],saved[key],`restart ${key}`);
const report={startTick:original.ticks,endTick:e.ticks,worldCreatedAt:e.genesisTime,steps,waterAreaFactor:2.25,gridSize:e.grid.size,
 before,after:summary(),observations,births,kills,minimumPopulation,minimumHunters,wallMs:Math.round(elapsed),cpuMs:Math.round((cpu.user+cpu.system)/1000),
 stepP95Ms:times[Math.floor(times.length*.95)]??0,maxRssMiB:maxRss/1048576,avgPacketBytes:Buffer.byteLength(JSON.stringify(e.getBroadcastPacket())),
 snapshotBytes:e.persistence.lastSnapshotBytes,exactMigration:true,exactRestart:true,rechargePerTick:e.grid.recharge.reduce((a,b)=>a+b,0)};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
