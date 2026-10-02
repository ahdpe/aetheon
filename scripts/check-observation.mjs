// Run ONLY on a disposable source/data copy. AI is disabled; this rewrites its checkpoint.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const [root, stepsText, output] = process.argv.slice(2), steps=Number(stepsText);
if(!root||!output||!Number.isSafeInteger(steps)||steps<1||steps>36000)throw Error('Usage: node check-observation.mjs DISPOSABLE_ROOT STEPS OUTPUT');
process.env.VENICE_API_KEY='';process.env.MAX_ORGANISMS='280';process.env.SNAPSHOT_FILE=path.join(root,'data/aetheon_world.json');
const base=pathToFileURL(root+'/'),{SimulationEngine}=await import(new URL('server/core/engine.js',base));
const e=new SimulationEngine(),startTick=e.ticks,world=e.genesisTime;
e.naturalist.checkObservation=async()=>false;
const summary=()=>({animals:e.organisms.length,plants:e.algae.isles.length,hunters:e.organisms.filter(o=>o.carnivory>.35).length,flora:{...e.algae.totals},morphs:e.lineage.getCatalogSpecies().length});
const before=summary(),times=[],cpu0=process.cpuUsage(),wall0=performance.now();
let births=0,kills=0,meanSpeedSum=0,minimumPopulation=Infinity,minimumHunters=Infinity,maxRss=process.memoryUsage().rss;
for(let i=0;i<steps;i++) {
 const t=performance.now();e.step();times.push(performance.now()-t);
 births+=e.eventsBuffer.filter(v=>v.type==='birth').length;kills+=e.eventsBuffer.filter(v=>v.type==='predation').length;
 minimumPopulation=Math.min(minimumPopulation,e.organisms.length);minimumHunters=Math.min(minimumHunters,e.organisms.filter(o=>o.carnivory>.35).length);
 meanSpeedSum+=e.organisms.reduce((s,o)=>s+Math.hypot(o.vx,o.vy),0)/Math.max(1,e.organisms.length);
 if(i%100===0) {
  maxRss=Math.max(maxRss,process.memoryUsage().rss);
  assert.ok(e.organisms.length<=280&&e.algae.isles.length<=32);
  assert.ok(e.organisms.every(o=>[o.x,o.y,o.vx,o.vy,o.energy,o.age].every(Number.isFinite)));
  assert.ok(['nutrients','waste','signal','substrate'].every(k=>e.grid[k].every(Number.isFinite)));
 }
}
const elapsed=performance.now()-wall0,cpu=process.cpuUsage(cpu0);times.sort((a,b)=>a-b);
assert.equal(e.ticks,startTick+steps);assert.equal(e.genesisTime,world);assert.ok(e.persistence.saveSnapshot(e));
const saved=e.persistence.read(e.persistence.filePath),restored=new SimulationEngine();assert.ok(restored.persistence.saveSnapshot(restored));
const again=restored.persistence.read(restored.persistence.filePath);
for(const key of Object.keys(saved).filter(k=>!['checksum','savedAt','speciesList'].includes(k)))assert.deepEqual(again[key],saved[key],key);
const report={startTick,endTick:e.ticks,worldCreatedAt:world,steps,before,after:summary(),births,kills,minimumPopulation,minimumHunters,meanSpeed:meanSpeedSum/steps,
 wallMs:Math.round(elapsed),cpuMs:Math.round((cpu.user+cpu.system)/1000),stepP95Ms:times[Math.floor(times.length*.95)],maxRssMiB:maxRss/1048576,
 avgPacketBytes:Buffer.byteLength(JSON.stringify(e.getBroadcastPacket())),snapshotBytes:e.persistence.lastSnapshotBytes,exactRestart:true};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
