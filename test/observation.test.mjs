import test from 'node:test';
import assert from 'node:assert/strict';
import { ObservationBuffer, followGain, angleMix, focusGeometry, insideFocus } from '../public/js/gl/observation.js';
import { ParticleSystem } from '../public/js/gl/particles.js';
import { createOrganismClass } from '../public/js/shared/organismCore.js';
import { TRIAL_PHYSICS, designGenome, NURSERY_PRESETS } from '../public/js/shared/nurseryDesign.js';

const entity=(x,id=1,heading=0)=>({id,x,y:700,vx:Math.cos(heading),vy:Math.sin(heading),phase:heading,size:4});
const frame=(x,id=1,heading=0)=>new Map([[id,entity(x,id,heading)]]);

test('irregular packets interpolate monotonically and never extrapolate or drift while disconnected',()=>{
 const b=new ObservationBuffer(260);
 for(const [t,x] of [[0,0],[190,19],[420,42],[600,60]])b.push(frame(x),t,t);
 let previous=-Infinity;
 for(let now=260;now<2000;now+=16){const x=b.sample(now).get(1).x;assert.ok(x>=previous&&x>=0&&x<=60);previous=x;}
 assert.equal(b.sample(10000).get(1).x,60);
 const wrapping=new ObservationBuffer(0);wrapping.push(frame(0,1,3.1),0,0);wrapping.push(frame(10,1,-3.1),200,2);
 assert.ok(Math.abs(wrapping.sample(100).get(1).heading)>3);
 assert.ok(Math.abs(angleMix(3.1,-3.1,.5)-Math.PI)<.001);
});

test('buffer is bounded, clears after reconnect, and removes confirmed dead cells from hit targets',()=>{
 const b=new ObservationBuffer();
 for(let t=0;t<3000;t+=200)b.push(frame(t),t,t);
 assert.equal(b.frames.length,8);
 b.push(frame(0,2),6000,6000);assert.equal(b.frames.length,1);assert.equal(b.sample(6000).has(1),false);
 b.push(new Map(),6200,6200);assert.equal(b.sample(6200).size,0);
 b.push(frame(3),6300,1);assert.equal(b.frames.length,1);
 b.clear();assert.equal(b.sample(6400).size,0);
});

test('camera response and ambient particle evolution agree at 30, 60 and 120 frames per second',()=>{
 const describe=fps=>{
  let seed=456,position=0;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
  const p=new ParticleSystem(24,1400,{cx:700,cy:700,r:680},random);
  for(let i=0;i<fps*5;i++){position+=(100-position)*followGain(1000/fps);p.advance(1000/fps,[]);}
  return{position,x:Array.from(p.x),y:Array.from(p.y),vx:Array.from(p.vx),vy:Array.from(p.vy)};
 };
 const a=describe(30),b=describe(60),c=describe(120);
 for(const k of ['x','y','vx','vy']){assert.deepEqual(a[k],b[k]);assert.deepEqual(a[k],c[k]);}
 assert.ok(Math.abs(a.position-b.position)<1e-9&&Math.abs(a.position-c.position)<1e-9);
});

test('focus geometry follows both viewport sizes and rejects peripheral interactions',()=>{
 for(const [w,h] of [[320,740],[1280,900]]) {
  const f=focusGeometry(w,h);assert.equal(insideFocus(w/2,h/2,f),true);assert.equal(insideFocus(0,0,f),false);
  assert.equal(insideFocus(f.x+f.radius+1,f.y,f),false);assert.equal(insideFocus(f.x+f.radius+1,f.y,f,2),true);
 }
});

test('quiet autonomous swimming slows down while panic, predation and pilot control retain bursts',()=>{
 const O=createOrganismClass(TRIAL_PHYSICS,()=>.5),g=designGenome(NURSERY_PRESETS.grazer);
 const grid={sample:()=>({gradNutrientX:0,gradNutrientY:0,gradWasteX:0,gradWasteY:0}),sampleSubstrate:()=>0,consumeAndExcrete:()=>0};
 const run=mode=>{
  const o=new O(700,700,g);o.vx=o.vy=0;o.heading=0;o.phase=0;o.energy=180;
  if(mode==='panic')o.panicTicks=100;
  if(mode==='pilot')o.playerSteer={x:1,y:0,ticks:100,thrust:1};
  for(let i=0;i<40;i++)o.step(grid,[],[],680,1);
  assert.equal(o.age,40);assert.ok(Number.isFinite(o.energy)&&o.energy<180);return o;
 };
 const quiet=run('quiet'),panic=run('panic'),pilot=run('pilot');
 assert.ok(panic.x-700>(quiet.x-700)*2);assert.ok(pilot.x-700>(quiet.x-700)*2);
 assert.ok(panic.energy<quiet.energy);
 // Canonical and nursery use the same class factory and constants; biting still has its own cooldown.
 const hunter=new O(700,700,designGenome(NURSERY_PRESETS.hunter));const prey=new O(703,700,g);prey.energy=200;
 assert.ok(hunter.attemptPredation(prey,grid));assert.equal(hunter.attemptPredation(prey,grid),false);
 const chase=new O(700,700,hunter.genome),idle=new O(700,700,hunter.genome),target=new O(735,700,g);
 for(const o of [chase,idle]){o.heading=0;o.vx=o.vy=0;o.phase=0;o.energy=180;}
 chase.step(grid,[target],[],680,1);idle.step(grid,[],[],680,1);
 assert.ok(chase.vx>idle.vx*2,'prey detection causes a real hunting burst');
});
