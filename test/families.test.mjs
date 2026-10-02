import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.SNAPSHOT_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'aetheon-family-')),'world.json');
process.env.VENICE_API_KEY='';
const {SimulationEngine}=await import('../server/core/engine.js');
const {FamilyHistory,HISTORY_LIMITS}=await import('../server/core/familyHistory.js');
const {Organism}=await import('../server/core/organism.js');
const {NetworkManager}=await import('../server/network/socket.js');
const {getRandomState}=await import('../server/core/random.js');

test('families follow actual descent, keep unrelated roots separate and leave older ancestry unknown',()=> {
  const e=new SimulationEngine(),a=e.organisms[0],b=e.organisms[1];
  const root=a.familyId;
  const child=a.reproduce(a.speciesId),grandchild=child.reproduce(child.speciesId);
  e.history.recordBirth(a,child,1);e.history.recordBirth(child,grandchild,2);
  e.organisms=[a,b,child,grandchild];e.history.synchronize(e.organisms,2);
  let f=e.history.describe(root,e.organisms,2);
  assert.equal(f.living,3);assert.equal(f.births,2);assert.equal(f.maxGeneration,a.generation+2);
  assert.equal(grandchild.familyId,root);assert.notEqual(b.familyId,root);
  assert.equal(f.nodes.find(n=>n.id===grandchild.id).parentId,child.id);
  assert.equal(f.nodes.find(n=>n.id===a.id).bornTick,null);
  assert.equal(f.nodes.find(n=>n.id===a.id).parentKnown,false);
  e.history.recordDeath(child,3,'predation');e.history.recordDeath(child,3,'predation');
  e.organisms=e.organisms.filter(o=>o.id!==child.id);e.history.synchronize(e.organisms,3);
  f=e.history.describe(root,e.organisms,3);assert.equal(f.deaths,1);assert.equal(f.living,2);
  e.organisms=[b];e.history.synchronize(e.organisms,4);
  f=e.history.describe(root,e.organisms,4);assert.equal(f.living,0);assert.equal(f.deaths,3);assert.equal(f.focusId,null);
  assert.equal(f.events.at(-1).type,'extinction');
});

test('family notebook survives a checkpoint and remains an observer of the world',()=> {
  const now=Date.now;Date.now=()=>2000000000000;
  try {
    const e=new SimulationEngine(),parent=e.organisms[0],child=parent.reproduce(parent.speciesId);
    e.history.recordBirth(parent,child,5);e.organisms.push(child);e.ticks=5;
    const before=JSON.stringify(e.organisms),rng=getRandomState();
    const network=Object.create(NetworkManager.prototype);network.engine=e;
    const replies=[],ws={send:s=>replies.push(JSON.parse(s)),lastActions:new Map()};
    network.handleClientMessage(ws,{type:'get_family',id:parent.familyId});
    network.handleClientMessage(ws,{type:'get_tour'});
    assert.equal(replies[0].family.living,2);assert.ok(e.organisms.some(o=>o.id===replies[1].id));
    const target=e.organisms.find(o=>o.id===replies[1].id);
    assert.deepEqual(replies[1].position,{x:target.x,y:target.y});
    const focus=e.organisms.find(o=>o.id===replies[0].family.focusId);
    assert.deepEqual(replies[0].family.focusPosition,{x:focus.x,y:focus.y});
    assert.equal(JSON.stringify(e.organisms),before);assert.equal(getRandomState(),rng);
    assert.equal(e.persistence.saveSnapshot(e),true);
    const history=e.history.toJSON();
    const restored=new SimulationEngine();
    assert.deepEqual(restored.history.toJSON(),history);
    assert.equal(restored.history.describe(parent.familyId,restored.organisms,5).living,2);
    assert.equal(getRandomState(),rng);
  } finally {Date.now=now;}
});

test('bounded ancestry retains every living member and explicitly drops old extinct archives',()=> {
  const history=new FamilyHistory(),alive=[];
  for(let i=1;i<=HISTORY_LIMITS.families+400;i++) {
    const o=new Organism(700,700);o.id=i;
    history.addRoot(o,i,'biogenesis');
    if(i>HISTORY_LIMITS.families+100) alive.push(o);
  }
  history.synchronize(alive,4000);
  assert.ok(history.nodes.size<=HISTORY_LIMITS.nodes);assert.ok(history.families.size<=HISTORY_LIMITS.families);
  assert.equal(history.describe(1,alive,4000),null);
  for(const o of alive) {assert.ok(history.nodes.has(o.id));assert.equal(history.describe(o.familyId,alive,4000).living,1);}
});

test('tour does not invent a birth or living descendant in an empty world',()=> {
  const e=new SimulationEngine(),network=Object.create(NetworkManager.prototype);network.engine=e;e.organisms=[];
  let reply;network.handleClientMessage({send:s=>reply=JSON.parse(s),lastActions:new Map()},{type:'get_tour'});
  assert.equal(reply.id,undefined);
});

test('initial observation joins verified living parents and children without inventing past birth counts',()=> {
  const h=new FamilyHistory(),parent=new Organism(700,700),child=parent.reproduce(parent.speciesId);
  h.synchronize([child,parent],100,{initial:true});
  const f=h.describe(parent.id,[child,parent],100);
  assert.equal(child.familyId,parent.familyId);assert.equal(f.living,2);assert.equal(f.births,0);
  assert.equal(f.nodes.find(n=>n.id===child.id).parentKnown,true);
  assert.equal(f.nodes.find(n=>n.id===child.id).bornTick,null);
});


test('tour prefers established recent births and hunters with time left to observe',()=>{
 const e=new SimulationEngine(),parent=e.organisms[0],old=e.organisms[1],young=e.organisms[2];
 const stable=parent.reproduce(parent.speciesId),fresh=parent.reproduce(parent.speciesId);
 stable.energy=fresh.energy=80;stable.age=60;fresh.age=1;e.ticks=100;
 e.history.recordBirth(parent,stable,40);e.history.recordBirth(parent,fresh,99);
 old.carnivory=young.carnivory=.8;old.energy=young.energy=100;old.age=11990;young.age=200;young.maturity=1;
 e.organisms=[old,young,parent,stable,fresh];
 const n=Object.create(NetworkManager.prototype);n.engine=e;let reply;
 const ws={send:s=>reply=JSON.parse(s),lastActions:new Map()};n.handleClientMessage(ws,{type:'get_tour'});
 assert.equal(reply.id,stable.id);assert.equal(reply.reason,'birth');
 ws.lastActions.clear();n.handleClientMessage(ws,{type:'get_tour'});assert.equal(reply.id,young.id);
});
