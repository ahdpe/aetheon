import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aetheon-test-'));
process.env.SNAPSHOT_FILE = path.join(dir, 'world.json');
process.env.VENICE_API_KEY = '';
const { SimulationEngine } = await import('../server/core/engine.js');
const { Organism } = await import('../server/core/organism.js');
const { ColonyManager } = await import('../server/core/colonies.js');
const { LineageManager } = await import('../server/core/lineage.js');
const { PersistenceManager } = await import('../server/core/persistence.js');
const { NetworkManager } = await import('../server/network/socket.js');
const { VeniceBudget } = await import('../server/ai/budget.js');
const { setRandomState, getRandomState } = await import('../server/core/random.js');
const { escapeHtml } = await import('../public/js/ui/safeHtml.js');
const { AINaturalist } = await import('../server/ai/naturalist.js');

test('checkpoint preserves identities, chemistry, bonds and future deterministic evolution', () => {
  const clock = Date.now; Date.now = () => 2000000000000;
  try {
    setRandomState(42);
    const e = new SimulationEngine();
    for (let i = 0; i < 45; i++) e.step();
    const ids = e.organisms.map(o => o.id), rng = getRandomState();
    assert.equal(e.persistence.saveSnapshot(e), true);
    const serialized = JSON.parse(fs.readFileSync(process.env.SNAPSHOT_FILE));
    const describe = world => ({ organisms: world.organisms.map(({ playerSteer, isPiloted, ...o }) => o),
      fields: ['nutrients','waste','signal','substrate'].map(n => Array.from(world.grid[n])),
      climate: world.climate.toJSON(), colonies: world.colonies.getBondPairs(), rng: getRandomState() });
    for (let i = 0; i < 65; i++) e.step();
    const expected = describe(e);
    const restored = new SimulationEngine();
    assert.deepEqual(restored.organisms.map(o => o.id), ids);
    assert.equal(getRandomState(), rng);
    assert.deepEqual(restored.colonies.getSerializableData(), serialized.colonyData);
    for (let i = 0; i < 65; i++) restored.step();
    assert.deepEqual(describe(restored), expected);
    assert.equal(new Set(restored.organisms.map(o => o.id)).size, restored.organisms.length);
  } finally { Date.now = clock; }
});

test('damaged checkpoint recovers previous; two damaged checkpoints fail instead of new Genesis', () => {
  const e = new SimulationEngine(), p = new PersistenceManager(path.join(dir, 'recovery.json'));
  p.saveSnapshot(e); p.saveSnapshot(e);
  fs.writeFileSync(p.filePath, '{corrupt');
  assert.equal(p.loadSnapshot(e), true);
  fs.writeFileSync(`${p.filePath}.previous`, '{also corrupt');
  assert.throws(() => p.loadSnapshot(e), /No valid world/);
});

test('legacy migration requires the same final tick and restores actual IDs', () => {
  const e = new SimulationEngine(), p = new PersistenceManager(path.join(dir, 'legacy.json'));
  p.saveSnapshot(e);
  const data = JSON.parse(fs.readFileSync(p.filePath)); delete data.checksum; delete data.formatVersion;
  for (const o of data.organisms) delete o.id;
  const packet = e.getBroadcastPacket();
  // Legacy wire format used Float32; construct its exact original representation.
  packet.orgs = e.organisms.flatMap(o => [o.id,Math.fround(o.x),Math.fround(o.y),Math.fround(o.vx),Math.fround(o.vy),Math.fround(o.energy),Math.fround(o.size),Math.fround(o.hue),o.speciesId,Math.fround(o.carnivory)]);
  fs.writeFileSync(p.filePath, JSON.stringify(data)); fs.writeFileSync(`${p.filePath}.ids`, JSON.stringify(packet));
  assert.equal(p.loadSnapshot(e), true);
  assert.deepEqual(e.organisms.map(o => o.id), packet.orgs.filter((_, i) => i % 10 === 0));
  packet.t--; fs.writeFileSync(`${p.filePath}.ids`, JSON.stringify(packet));
  assert.throws(() => p.loadSnapshot(e), /tick does not match/);
});

test('colony transfers conserve energy and a detached cell receives no remote donation', () => {
  const c = new ColonyManager(), a = new Organism(600,600), b = new Organism(610,600);
  a.energy = 100; b.energy = 200; c.formBond(a,b);
  c.applyBondPhysics(new Map([[a.id,a],[b.id,b]]));
  assert.ok(Math.abs(a.energy+b.energy-300) < 1e-10);
  const d = new Organism(620,600); c.formBond(b,d); a.x = 0; a.energy = 20;
  c.applyBondPhysics(new Map([a,b,d].map(o => [o.id,o])));
  assert.equal(a.energy, 20); assert.equal(c.orgToColony.has(a.id), false);
});

test('repeated genomes reuse a morph, census is not births, revived species clears extinction', () => {
  const l = new LineageManager(), g = { size:9,hue:.02,carnivory:.8,speedMax:4,chemotaxisNutrient:1 };
  const id = l.evaluateSpeciation(g,1);
  assert.equal(l.evaluateSpeciation(g,1), id);
  l.recordBirth(id); l.updatePopulations([{ speciesId:id }]); l.updatePopulations([{ speciesId:id }]);
  assert.equal(l.getSpecies(id).totalCount, 1);
  l.updatePopulations([]); assert.ok(l.getSpecies(id).extinctTime);
  l.updatePopulations([{ speciesId:id }]); assert.equal(l.getSpecies(id).extinctTime, null);
});

test('outsider cannot steer, nonfinite food rejected, global food quota survives new clients', () => {
  const e = new SimulationEngine(), o = e.organisms[0];
  assert.equal(e.claimPilot(o.id,'owner'),true);
  assert.equal(e.applySteer(o.id,1,0,1,'outsider'),false);
  assert.equal(e.applySteer(o.id,1,0,1,'owner'),true);
  assert.equal(e.injectInteraction('nutrient_drop',undefined,undefined).success,false);
  assert.equal(e.injectInteraction('nutrient_drop',700,700).success,true);
  assert.equal(e.injectInteraction('nutrient_drop',700,700).success,false);
  o.energy = 0; assert.equal(o.isDead(),true);
});

test('human piloting gives no extra immunity from a successful fatal attack', () => {
  const e = new SimulationEngine(), hunter=e.organisms[0], prey=e.organisms[1];
  hunter.carnivory=.8; hunter.x=700; hunter.y=700;
  prey.x=705; prey.y=700; prey.isPiloted=true;
  e.organisms=[hunter,prey];
  e.recentWindow.kills=0;
  hunter.step=prey.step=()=>{}; hunter.canReproduce=prey.canReproduce=()=>false;
  hunter.attemptPredation=other=>other===prey?{killed:true}:null;
  e.cataclysms.step=()=>{}; e.cataclysms.isBiogenesisBlocked=()=>true;
  e.algae.update=()=>{}; setRandomState(1);
  e.step();
  assert.equal(e.recentWindow.kills,1); assert.ok(!e.organisms.includes(prey));
});

test('a birth classified into an existing morphology does not announce a new discovery', () => {
  const e=new SimulationEngine(), parent=e.organisms[0];
  const genome={...parent.genome,size:9.4,hue:.99,carnivory:.01,speedMax:4.5};
  const existing=e.lineage.createSpecies(genome,parent.speciesId);
  e.organisms=[parent]; e.maxOrganisms=2; e.recentWindow.births=0; e.recentWindow.speciations=0;
  e.cataclysms.step=()=>{}; e.cataclysms.isBiogenesisBlocked=()=>true; e.algae.update=()=>{};
  parent.step=()=>{}; parent.attemptPredation=()=>null; parent.canReproduce=()=>true;
  parent.reproduce=()=>new Organism(parent.x+1,parent.y,genome,parent.generation+1,parent.id);
  e.step();
  assert.equal(e.recentWindow.births,1); assert.equal(e.recentWindow.speciations,0);
  assert.equal(e.organisms.at(-1).speciesId,existing.id);
});

test('dynasty requires a 30-second server pilot; markup and duplicate names rejected', () => {
  const e = new SimulationEngine(), n = Object.create(NetworkManager.prototype); n.engine = e;
  const o = e.organisms[0], ws = { clientId:'owner',send(){},lastActions:new Map() };
  e.claimPilot(o.id,ws.clientId);
  n.handleClientMessage(ws,{type:'found_dynasty',orgId:o.id,founderName:'Test'});
  assert.equal(o.dynastyName,null);
  ws.lastActions.clear(); ws.pilotStartedAt = Date.now()-31000;
  n.handleClientMessage(ws,{type:'found_dynasty',orgId:o.id,founderName:'<b>Test</b>'});
  assert.equal(o.dynastyName,null);
  ws.lastActions.clear(); n.handleClientMessage(ws,{type:'found_dynasty',orgId:o.id,founderName:'Test'});
  assert.equal(o.dynastyName,'Test');
  assert.equal(e.foundDynasty(e.organisms[1].id,'Test'),null);
  assert.equal(escapeHtml('<b>"a"&</b>'), '&lt;b&gt;&quot;a&quot;&amp;&lt;/b&gt;');
});

test('codex queries search all history but deliver a bounded page', () => {
  const e = new SimulationEngine(), n = Object.create(NetworkManager.prototype); n.engine = e;
  for(let i=0;i<150;i++) e.lineage.createSpecies({nameEn:`Historical ${i}`,size:4,hue:.5,carnivory:.1,speedMax:1});
  const first = n.codexPage({}); assert.equal(first.species.length,48); assert.ok(first.meta.total>150);
  const result = n.codexPage({query:'Historical 149'}); assert.equal(result.species.length,1);
});

test('socket errors during policy rejection do not escape and crash the world', () => {
  const e=new SimulationEngine();
  for(const capacity of [false,true]) {
    const n=Object.create(NetworkManager.prototype); n.engine=e; n.wss=new EventEmitter(); n.clients=new Set(capacity?Array.from({length:64},()=>({})):[]);
    n.setupListeners();
    const ws=new EventEmitter(); let closed;
    ws.close=code=>{closed=code;};
    n.wss.emit('connection',ws,{headers:{origin:'https://outside.invalid',host:'ocean.invalid'}});
    assert.equal(closed,capacity?1013:1008);
    assert.doesNotThrow(()=>ws.emit('error',new Error('Rejected oversized frame')));
    assert.equal(n.clients.size,capacity?64:0);
  }
});

test('events occurring during a delayed observation remain in the next measurement window', () => {
  const e=new SimulationEngine();
  e.recentWindow={kills:5,births:10,speciations:1,windowStartTime:Date.now()-1000};
  const captured=e.getStats();
  e.recentWindow.kills+=2; e.recentWindow.births+=7; e.recentWindow.speciations++;
  e.resetRecentWindow(captured);
  assert.deepEqual(e.recentWindow,{kills:2,births:7,speciations:1,windowStartTime:captured.observedAt});
});

function fakeVenice({fail=false}={}) {
  let paid=0;
  return { get paid(){return paid;}, fetcher:async(url,options)=>{
    if(url.includes('/models')) return {ok:true,json:async()=>({data:[{id:'writer',model_spec:{availableContextTokens:8192,pricing:{input:{usd:.1875},output:{usd:.75}}}}]})};
    paid++; if(fail) throw new Error('ambiguous timeout');
    return {ok:true,json:async()=>({usage:{prompt_tokens:100,completion_tokens:75},choices:[]})};
  }};
}
const body={model:'writer',messages:[{role:'user',content:'Facts'}],max_tokens:750};
test('budget persists reservations on ambiguous failures and skips simultaneous work', async()=>{
  const fake=fakeVenice({fail:true}), file=path.join(dir,'budget.json');
  const b=new VeniceBudget({file,key:'test',bootstrap:false,fetcher:fake.fetcher});
  await Promise.all([b.request('text','https://venice.invalid/chat',body),b.request('text','https://venice.invalid/chat',body)]);
  assert.equal(fake.paid,1); const charged=b.load().spent; assert.ok(charged>0);
  const restarted=new VeniceBudget({file,key:'test',bootstrap:false,fetcher:fake.fetcher}); assert.equal(restarted.load().spent,charged);
  const state=restarted.load(); state.spent=restarted.limit-1; restarted.save(state);
  assert.equal(await restarted.request('text','https://venice.invalid/chat',body),null); assert.equal(fake.paid,1);
});
test('budget uses actual usage, first legacy day is protected, corruption fails closed',async()=>{
  const fake=fakeVenice(), file=path.join(dir,'budget2.json');
  const legacy=new VeniceBudget({file,key:'test',fetcher:fake.fetcher});
  assert.equal(await legacy.request('text','https://venice.invalid/chat',body),null); assert.equal(fake.paid,0);
  const b=new VeniceBudget({file:path.join(dir,'budget3.json'),key:'test',bootstrap:false,fetcher:fake.fetcher});
  await b.request('text','https://venice.invalid/chat',body); assert.equal(b.load().spent,75);
  fs.writeFileSync(b.file,'{broken'); assert.equal(await b.request('text','https://venice.invalid/chat',body),null); assert.equal(fake.paid,1);
});

test('legacy duplicate labels remain archived while organisms use a canonical morphology', () => {
  const e = new SimulationEngine(), p = new PersistenceManager(path.join(dir, 'legacy-aliases.json'));
  const original = e.lineage.getSpecies(e.organisms[0].speciesId);
  const alias = e.lineage.createSpecies({ ...original, nameEn: 'Archived duplicate' });
  e.organisms[0].speciesId = alias.id;
  p.saveSnapshot(e);
  const data = JSON.parse(fs.readFileSync(p.filePath)); delete data.checksum; delete data.formatVersion;
  for (const o of data.organisms) delete o.id;
  fs.writeFileSync(p.filePath, JSON.stringify(data));
  const rows = e.organisms.flatMap(o => [o.id,Math.fround(o.x),Math.fround(o.y),0,0,0,0,0,o.speciesId,0]);
  fs.writeFileSync(`${p.filePath}.ids`, JSON.stringify({t:e.ticks,n:e.organisms.length,orgs:rows}));
  p.loadSnapshot(e);
  assert.equal(e.lineage.getAllSpecies().length, data.speciesList.length);
  assert.equal(e.lineage.getSpecies(alias.id).nameEn, 'Archived duplicate');
  assert.equal(e.organisms[0].speciesId, original.id);
  assert.equal(e.organisms[0].legacySpeciesId, alias.id);
  assert.ok(!e.lineage.getCatalogSpecies().some(s => s.id === alias.id));
});

test('explicit legacy recovery receipt preserves the checkpoint and records identity discontinuity', () => {
  const e = new SimulationEngine(), p = new PersistenceManager(path.join(dir,'receipt.json'));
  p.saveSnapshot(e);
  const d = JSON.parse(fs.readFileSync(p.filePath)); delete d.checksum; delete d.formatVersion;
  for (const o of d.organisms) delete o.id;
  d.colonyData = [{id:123,memberIds:[1,2],bonds:[{a:1,b:2,restLength:10}]}];
  const raw = JSON.stringify(d); fs.writeFileSync(p.filePath,raw);
  const receipt = {t:d.ticks,n:d.organisms.length,identitiesReassigned:true,lastObservedTick:d.ticks+50,snapshotSha256:createHash('sha256').update(raw).digest('hex'),assignedIds:d.organisms.map((_,i)=>100000+i)};
  fs.writeFileSync(p.filePath+'.ids',JSON.stringify(receipt));
  p.loadSnapshot(e);
  assert.equal(e.ticks,d.ticks); assert.equal(e.genesisTime,d.genesisTime);
  assert.equal(e.migrationState.identitiesReassigned,true);
  assert.equal(e.legacyColonyArchive.length,1); assert.equal(e.colonies.colonies.size,0);
  assert.deepEqual(e.organisms.map(o=>o.id),receipt.assignedIds);
  assert.deepEqual(e.organisms.map(o=>o.genome),d.organisms.map(o=>o.genome));
  receipt.snapshotSha256='wrong'; fs.writeFileSync(p.filePath+'.ids',JSON.stringify(receipt));
  assert.throws(()=>p.loadSnapshot(e),/receipt does not match/);
});

test('restarting during every catastrophe phase preserves its subsequent evolution', () => {
  const clock = Date.now; Date.now = () => 2000000000000;
  try {
    for (const phase of ['premonition','crisis','lazarus_dawn','radiation']) {
      const e = new SimulationEngine(), p = new PersistenceManager(path.join(dir, `${phase}.json`));
      e.cataclysms.currentType = 'cryo_freeze'; e.cataclysms.phase = phase;
      e.cataclysms.phaseTicks = 398; e.cataclysms.phaseMaxTicks = 400;
      if (phase === 'lazarus_dawn') e.cataclysms.crownLazarusPioneers();
      p.saveSnapshot(e);
      const describe = () => ({orgs:e.organisms,cat:e.cataclysms.toJSON(),rng:getRandomState(),fields:Array.from(e.grid.nutrients),epoch:e.naturalist.currentEpoch});
      for(let i=0;i<8;i++) e.step();
      const expected = JSON.stringify(describe());
      p.loadSnapshot(e);
      for(let i=0;i<8;i++) e.step();
      assert.equal(JSON.stringify(describe()), expected, phase);
    }
  } finally { Date.now = clock; }
});

test('observer rejects overlapping work and factual fallback does not invent kills', async () => {
  const n = new AINaturalist(new LineageManager());
  let release; n.checkObservationOnce = () => new Promise(resolve => { release = resolve; });
  const first = n.checkObservation({});
  assert.equal(await n.checkObservation({}), false);
  release(true); assert.equal(await first, true);
  n.chronicleEcosystem = AINaturalist.prototype.chronicleEcosystem;
  await n.chronicleEcosystem({organismCount:4,speciesCount:2,recentBirths:0,recentKills:0}, {editorialFocus:'predation_hunt'});
  assert.ok(n.journalEntries[0].contentRu.includes('0 смертельных атак'));
});

test('decision calls refund actual usage when aggregate usage is returned', async () => {
  const fake=fakeVenice(), b=new VeniceBudget({file:path.join(dir,'budget-decisions.json'),key:'test',bootstrap:false,fetcher:fake.fetcher});
  await b.request('decision','https://venice.invalid/decisions',{model:'writer',questions:{one:{},two:{}}});
  assert.equal(b.load().spent,75);
});

test('historical aliases are retained in an immutable archive instead of each live checkpoint', () => {
  const e=new SimulationEngine(),p=new PersistenceManager(path.join(dir,'compact.json'));
  const original=e.lineage.getSpecies(1);
  for(let i=0;i<5000;i++) {
    const sp=e.lineage.createSpecies({...original,nameEn:`Archived ${i}`});sp.canonicalId=original.id;
  }
  e.lineage.rebuildIndex();
  const allCount=e.lineage.getAllSpecies().length,fullSpecies=e.lineage.getAllSpecies();
  assert.equal(p.saveSnapshot(e),true);
  const saved=JSON.parse(fs.readFileSync(p.filePath)),archive=path.join(dir,saved.morphologyArchive.name);
  assert.equal(saved.formatVersion,4);assert.equal(saved.morphologyArchive.count,5000);
  const fullBytes=Buffer.byteLength(JSON.stringify({...saved,speciesList:fullSpecies}));
  assert.ok(fs.statSync(p.filePath).size<fullBytes*.65);
  const originalArchive=fs.readFileSync(archive),mtime=fs.statSync(archive).mtimeMs;
  assert.equal(p.saveSnapshot(e),true);assert.equal(fs.statSync(archive).mtimeMs,mtime);
  assert.deepEqual(fs.readFileSync(archive),originalArchive);
  const ids=e.organisms.map(o=>o.id),rng=getRandomState();
  assert.equal(p.loadSnapshot(e),true);
  assert.equal(e.lineage.getAllSpecies().length,allCount);assert.equal(e.lineage.getCatalogSpecies().length,saved.speciesList.length);
  assert.deepEqual(e.organisms.map(o=>o.id),ids);assert.equal(getRandomState(),rng);
  e.lineage.updatePopulations(e.organisms);assert.equal(p.saveSnapshot(e),true);
});

test('corruption of a referenced archive refuses replacement of the historical world', () => {
  const p=new PersistenceManager(path.join(dir,'compact.json')),e=new SimulationEngine();
  const saved=JSON.parse(fs.readFileSync(p.filePath)),archive=path.join(dir,saved.morphologyArchive.name);
  fs.writeFileSync(archive,'{corrupt');
  assert.throws(()=>p.loadSnapshot(e),/No valid world snapshot/);
});

test('bio-scanner produces rich specimen chronicle and caches on organism profile', async () => {
  const e = new SimulationEngine();
  const org = e.organisms[0];
  assert.ok(org, 'organism exists');
  const res = await e.handleBioScan(org.id);
  assert.equal(res.success, true);
  assert.ok(res.scan.name);
  assert.ok(res.scan.bioRu);
  assert.ok(Array.isArray(res.scan.traits));

  // Verify cached on organism and profile
  assert.equal(org.aiBioScan, res.scan);
  const prof = e.getOrganismProfile(org.id);
  assert.equal(prof.aiBioScan, res.scan);

  // Subsequent call returns cached without recomputation
  const cachedRes = await e.handleBioScan(org.id);
  assert.equal(cachedRes.success, true);
  assert.equal(cachedRes.scan, res.scan);
});

