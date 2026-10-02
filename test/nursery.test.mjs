import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
process.env.SNAPSHOT_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'aetheon-nursery-')),'world.json');
process.env.VENICE_API_KEY='';
const {CONFIG}=await import('../server/config.js');
const {SimulationEngine}=await import('../server/core/engine.js');
const {Organism}=await import('../server/core/organism.js');
const {Nursery,NURSERY_LIMITS,visitorCookie}=await import('../server/core/nursery.js');
const {NURSERY_PRESETS,DESIGN_KEYS,validateDesign,designCost,DESIGN_BUDGET,designGenome}=await import('../public/js/shared/nurseryDesign.js');
const {createTrial}=await import('../public/js/shared/nurseryTrial.js');
const {getRandomState,setRandomState}=await import('../server/core/random.js');
const {NetworkManager}=await import('../server/network/socket.js');
beforeEach(()=>{for(const f of [CONFIG.SNAPSHOT_FILE,CONFIG.SNAPSHOT_FILE+'.previous'])fs.rmSync(f,{force:true});setRandomState(1234);Organism.setNextId(1);});
const request=(i=1,design=NURSERY_PRESETS.grazer)=>({requestId:`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`,name:'Lumen',habitat:'meadow',design:{...design}});
const identity=(e,i=1,address='test')=>e.nursery.identity(i.toString(16).padStart(64,'0'),address);

test('designs trade finite credits and cannot submit arbitrary genome privileges',()=>{
 for(const p of Object.values(NURSERY_PRESETS)){assert.ok(validateDesign(p));assert.ok(designCost(p)<=DESIGN_BUDGET);assert.ok(designGenome(p).splitThreshold<CONFIG.MAX_ORGANISM_ENERGY);}
 for(const d of [{...NURSERY_PRESETS.grazer,metabolismEfficiency:999},{...NURSERY_PRESETS.grazer,shell:Infinity},Object.fromEntries(DESIGN_KEYS.map(k=>[k,1]))])assert.equal(validateDesign(d),false);
 const e=new SimulationEngine(),ids=e.organisms.map(o=>o.id),rng=getRandomState();
 for(const msg of [{...request(),name:'<script>'},{...request(),habitat:'__proto__'},{...request(),design:{...request().design,size:-1}}])assert.equal(e.nursery.submit(e,identity(e),msg).ok,false);
 assert.deepEqual(e.organisms.map(o=>o.id),ids);assert.equal(getRandomState(),rng);assert.equal(e.nursery.records.length,0);
});

test('queued admission is durable and idempotent across reconnection and restart',()=>{
 const e=new SimulationEngine(),rng=getRandomState();assert.equal(e.nursery.submit(e,identity(e),request()).ok,true);
 assert.equal(getRandomState(),rng);assert.equal(e.nursery.records.length,1);
 const restored=new SimulationEngine();assert.equal(restored.nursery.records[0].status,'queued');
 assert.equal(restored.nursery.submit(restored,identity(restored),request()).ok,true);assert.equal(restored.nursery.records.length,1);
 restored.nursery.process(restored);assert.equal(restored.nursery.introduced,1);
 const durable=o=>{const {playerSteer,isPiloted,...state}=o;return state;};
 const savedOrg=durable(restored.organisms.at(-1)),nextRng=getRandomState(),next=Organism.getNextId();
 const again=new SimulationEngine();assert.deepEqual(durable(again.organisms.at(-1)),savedOrg);assert.equal(getRandomState(),nextRng);assert.equal(Organism.getNextId(),next);
 again.nursery.process(again);assert.equal(again.nursery.introduced,1);assert.equal(again.nursery.submit(again,identity(again),request()).record.status,'released');
});

test('full ocean and climate crisis delay introductions without removing organisms',()=>{
 const e=new SimulationEngine();e.maxOrganisms=e.organisms.length;
 e.nursery.submit(e,identity(e),request());const ids=e.organisms.map(o=>o.id),rng=getRandomState();
 e.nursery.process(e);assert.deepEqual(e.organisms.map(o=>o.id),ids);assert.equal(getRandomState(),rng);
 e.maxOrganisms++;e.cataclysms.phase='crisis';e.nursery.process(e);assert.deepEqual(e.organisms.map(o=>o.id),ids);
 e.cataclysms.phase='dormant';e.nursery.process(e);assert.equal(e.organisms.length,ids.length+1);assert.deepEqual(e.organisms.slice(0,-1).map(o=>o.id),ids);
 const o=e.organisms.at(-1);assert.equal(o.energy,60);assert.equal(o.age,0);assert.equal(o.generation,1);assert.equal(o.parentId,0);
 assert.deepEqual(o.genome,designGenome(request().design));assert.equal(e.history.families.get(o.familyId).origin,'nursery');
 o.age=50;o.energy=180;const child=o.reproduce(o.speciesId);e.history.recordBirth(o,child,e.ticks);e.organisms.push(child);
 assert.equal(child.familyId,o.familyId);assert.equal(e.history.describe(o.familyId,e.organisms,e.ticks).births,1);assert.equal(e.getOrganismProfile(child.id).familyName,'Lumen');
});

test('limits survive restart, enforce world spacing and cannot be reset by a new browser token',()=>{
 const e=new SimulationEngine(),now=Date.UTC(2026,9,2,10);e.nursery.submit(e,identity(e),request(),now);e.nursery.process(e,now);
 assert.equal(e.nursery.submit(e,identity(e),request(2),now).ok,true);
 e.nursery.process(e,now+100);assert.equal(e.nursery.introduced,1);
 e.nursery.process(e,now+NURSERY_LIMITS.intervalMs);assert.equal(e.nursery.introduced,2);
 const restored=new SimulationEngine();assert.equal(restored.nursery.submit(restored,identity(restored),request(3),now).reason,'visitor');
 for(let i=3;i<=6;i++){
  assert.equal(restored.nursery.submit(restored,identity(restored,i),request(i),now).ok,true);
  restored.nursery.process(restored,now+i*NURSERY_LIMITS.intervalMs);
 }
 assert.equal(restored.nursery.submit(restored,identity(restored,99),request(99),now).reason,'address');
});

test('a waiting founder gets one genuinely vacant slot before ordinary births can occupy it',()=>{
 const e=new SimulationEngine(),parent=e.organisms[0],dying=e.organisms[1];
 e.organisms=[parent,dying];e.maxOrganisms=2;e.cataclysms.isBiogenesisBlocked=()=>true;
 parent.carnivory=0;parent.step=()=>{};parent.canReproduce=()=>true;
 dying.step=()=>{dying.energy=-1;};
 e.nursery.submit(e,identity(e),request());e.step();
 assert.equal(e.organisms.length,2);assert.equal(e.organisms[0].id,parent.id);assert.equal(e.nursery.introduced,1);
 assert.equal(e.organisms[1].nurseryName,'Lumen');assert.equal(parent.childrenCount,0);
});

test('global daily cap and bounded queue apply even to distinct network identities',()=>{
 const e=new SimulationEngine(),now=Date.UTC(2026,9,2,10);
 for(let i=1;i<=12;i++){
  assert.equal(e.nursery.submit(e,identity(e,i,'network-'+i),request(i),now).ok,true);
  e.nursery.process(e,now+i*NURSERY_LIMITS.intervalMs);
 }
 assert.equal(e.nursery.submit(e,identity(e,13,'new'),request(13),now).reason,'daily');
 const tomorrow=now+86400000;
 for(let i=14;i<18;i++)assert.equal(e.nursery.submit(e,identity(e,i,'new-'+i),request(i),tomorrow).ok,true);
 assert.equal(e.nursery.submit(e,identity(e,18,'new-18'),request(18),tomorrow).reason,'queue');
 e.nursery.process(e,tomorrow+NURSERY_LIMITS.expiryMs);assert.equal(e.nursery.records.filter(r=>r.status==='queued').length,0);
 assert.equal(e.nursery.introduced,12);
});

test('failed admission save does not consume the quota or change the canonical world',()=>{
 const e=new SimulationEngine(),state=e.nursery.toJSON(),rng=getRandomState(),count=e.organisms.length;
 e.persistence.saveSnapshot=()=>false;
 assert.equal(e.nursery.submit(e,identity(e),request()).reason,'save');assert.deepEqual(e.nursery.toJSON(),state);
 assert.equal(e.organisms.length,count);assert.equal(getRandomState(),rng);
});

test('queued requests across UTC midnight cannot exceed the actual daily introduction cap',()=>{
 const e=new SimulationEngine(),before=Date.UTC(2026,9,2,23,50),after=Date.UTC(2026,9,3,0,15);
 for(let i=1;i<=4;i++)assert.equal(e.nursery.submit(e,identity(e,i,'network-'+i),request(i),before).ok,true);
 for(let i=0;i<4;i++)e.nursery.process(e,after+i*NURSERY_LIMITS.intervalMs);
 for(let i=5;i<=12;i++){
  const now=after+i*NURSERY_LIMITS.intervalMs;
  assert.equal(e.nursery.submit(e,identity(e,i,'network-'+i),request(i),now).ok,true);e.nursery.process(e,now);
 }
 assert.equal(e.nursery.introduced,12);
 assert.equal(e.nursery.submit(e,identity(e,13,'network-13'),request(13),after+13*NURSERY_LIMITS.intervalMs).reason,'daily');
 const fresh=new SimulationEngine();assert.equal(fresh.nursery.status(fresh,identity(fresh),after+13*NURSERY_LIMITS.intervalMs).dailyRemaining,0);
});

test('visitor launch cap follows actual release day when a request waited overnight',()=>{
 const e=new SimulationEngine(),before=Date.UTC(2026,9,2,23,50),after=Date.UTC(2026,9,3,0,15),own=identity(e);
 assert.equal(e.nursery.submit(e,own,request(),before).ok,true);e.nursery.process(e,after);
 assert.equal(e.nursery.submit(e,own,request(2),after).ok,true);e.nursery.process(e,after+NURSERY_LIMITS.intervalMs);
 assert.equal(e.nursery.submit(e,own,request(3),after+2*NURSERY_LIMITS.intervalMs).reason,'visitor');
});

test('a malformed saved nursery ledger is rejected rather than resetting quotas or privileging a genome',()=>{
 const e=new SimulationEngine();e.nursery.submit(e,identity(e),request());const state=e.nursery.toJSON();
 const bad=structuredClone(state);bad.records[0].genome.metabolismEfficiency=999;
 assert.throws(()=>new Nursery().fromJSON(bad),/Invalid nursery state/);
 const duplicate=structuredClone(state);duplicate.records.push(duplicate.records[0]);assert.throws(()=>new Nursery().fromJSON(duplicate));
 const loaded=new Nursery();loaded.fromJSON(state);assert.deepEqual(loaded.toJSON(),state);
});

test('failed introduction commit rolls back organisms, history, registry, identity and random state',()=>{
 const e=new SimulationEngine();e.nursery.submit(e,identity(e),request());
 const organisms=JSON.stringify(e.organisms),history=JSON.stringify(e.history.toJSON()),catalog=JSON.stringify(e.lineage.getCatalogSpecies()),rng=getRandomState(),id=Organism.getNextId(),state=e.nursery.toJSON();
 const save=e.persistence.saveSnapshot.bind(e.persistence);let calls=0;e.persistence.saveSnapshot=engine=>++calls===2?false:save(engine);
 e.nursery.process(e);assert.equal(JSON.stringify(e.organisms),organisms);assert.equal(JSON.stringify(e.history.toJSON()),history);
 assert.equal(JSON.stringify(e.lineage.getCatalogSpecies()),catalog);assert.equal(getRandomState(),rng);assert.equal(Organism.getNextId(),id);assert.deepEqual(e.nursery.toJSON(),state);
 const restored=new SimulationEngine();assert.equal(restored.nursery.records[0].status,'queued');
});

test('a committed checkpoint is recognised after a late save error and is never introduced twice',()=>{
 const e=new SimulationEngine();e.nursery.submit(e,identity(e),request());
 const save=e.persistence.saveSnapshot.bind(e.persistence);let calls=0;e.persistence.saveSnapshot=engine=>{const result=save(engine);return ++calls===2?false:result;};
 e.nursery.process(e);assert.equal(e.nursery.introduced,1);assert.equal(e.nursery.records[0].status,'released');
 const restored=new SimulationEngine();restored.nursery.process(restored);assert.equal(restored.nursery.introduced,1);assert.equal(restored.organisms.length,281);
});

test('public nursery responses expose no visitor tokens, address hashes, salts or private queued genomes',()=>{
 const e=new SimulationEngine(),own=identity(e),other=identity(e,2,'other');e.nursery.submit(e,own,request());
 const view=e.nursery.status(e,own),str=JSON.stringify(view);
 for(const secret of [e.nursery.salt,own.visitor,own.address])assert.equal(str.includes(secret),false);
 assert.equal(view.records[0].genome,undefined);assert.equal(e.nursery.status(e,other).records.length,0);
 assert.equal(visitorCookie('other=x; aetheon_visitor='+'a'.repeat(64)+'; end=x'),'a'.repeat(64));assert.equal(visitorCookie('aetheon_visitor=bad'),null);
 const n=Object.create(NetworkManager.prototype);n.engine=e;let result;
 n.handleClientMessage({lastActions:new Map(),nurseryIdentity:own,send:s=>result=JSON.parse(s)},{type:'get_nursery'});assert.equal(result.type,'nursery_status');
});

test('isolated trials repeat with the same seed, use actual cells and never spend canonical IDs or random draws',()=>{
 const rng=getRandomState(),id=Organism.getNextId();
 const a=createTrial(NURSERY_PRESETS.weaver),b=createTrial(NURSERY_PRESETS.weaver);
 for(let i=0;i<1800;i++){a.step();b.step();}
 assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(getRandomState(),rng);assert.equal(Organism.getNextId(),id);
 assert.ok(a.snapshot().total<=64);assert.equal(a.snapshot().seconds,180);
 for(const c of a.snapshot().cells)assert.ok([c.x,c.y,c.energy].every(Number.isFinite));
});
