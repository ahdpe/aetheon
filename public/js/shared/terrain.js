import {OCEAN_GEOMETRY, sampleHabitat} from './habitats.js';

export const TERRAIN_SEED=0x41e7;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const bell=(v)=>Math.exp(-v*v);
const geologicalPhase=(TERRAIN_SEED&255)/231;

// Fixed geological relief, independent of the biological PRNG and wall clock.
// Valleys are pre-existing geography; organisms do not excavate them yet.
export function terrainShape(x,y){
 const u=(x-1050)/620,v=(y-1050)/620;
 const a=v-.40*Math.sin(u*2.2+.4*geologicalPhase)-.25;
 const b=u-.34*Math.sin(v*2.6-geologicalPhase)-.38;
 const channel=Math.max(bell(a/.12),.85*bell(b/.14));
 const basin=Math.max(bell((u+.38)/.45)*bell((v-.22)/.38),.8*bell((u-.42)/.48)*bell((v+.55)/.4));
 const ridge=bell((a-.24)/.16)*(1-.55*basin);
 const elevation=clamp(.48+.10*Math.sin(u*2.3)*Math.cos(v*2.8)+.27*ridge-.27*channel-.18*basin,0,1);
 return {elevation,channel,basin};
}

export function validateTerrainState(state,tick){
 if(!state||state.version!==1||state.seed!==TERRAIN_SEED||!Number.isSafeInteger(state.startedAtTick)||state.startedAtTick<0||state.startedAtTick>tick)
  throw Error('Invalid terrain receipt');
 return {...state};
}

export class TerrainField {
 constructor(size=OCEAN_GEOMETRY.gridSize,worldSize=OCEAN_GEOMETRY.worldSize){
  this.size=size;this.worldSize=worldSize;this.spacing=worldSize/size;
  const count=size*size;
  for(const name of ['elevation','channel','basin','gradientX','gradientY','currentX','currentY','light','mobility','permeability','eastConductance','southConductance','eastFlow','southFlow'])this[name]=new Float32Array(count);
  this.wet=new Uint8Array(count);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,wx=x*this.spacing,wy=y*this.spacing,s=terrainShape(wx,wy),h=sampleHabitat(wx,wy);
   this.wet[i]=Math.hypot(wx-OCEAN_GEOMETRY.cx,wy-OCEAN_GEOMETRY.cy)<=OCEAN_GEOMETRY.radius?1:0;
   this.elevation[i]=s.elevation;this.channel[i]=s.channel;this.basin[i]=s.basin;
   const gx=(terrainShape(wx+8,wy).elevation-terrainShape(wx-8,wy).elevation)/16;
   const gy=(terrainShape(wx,wy+8).elevation-terrainShape(wx,wy-8).elevation)/16;
   this.gradientX[i]=gx;this.gradientY[i]=gy;
   const slope=Math.hypot(gx,gy),flowScale=.65+.7*s.channel-.4*s.basin;
   // Project part of the circulation along contours, avoiding artificial walls.
   const nx=slope?gx/slope:0,ny=slope?gy/slope:0,dot=h.currentX*nx+h.currentY*ny;
   this.currentX[i]=(h.currentX-dot*nx*.7)*flowScale;
   this.currentY[i]=(h.currentY-dot*ny*.7)*flowScale;
   this.light[i]=clamp(h.light*(.64+.62*s.elevation),.06,1);
   this.mobility[i]=clamp(1-slope*45,.72,1);
   this.permeability[i]=clamp(.85-.50*s.basin-.27*slope*70,.22,1);
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x;
   if(x<size-1)this.edge(i,i+1,'east');
   if(y<size-1)this.edge(i,i+size,'south');
  }
 }
 edge(i,j,direction){
  if(!this.wet[i]||!this.wet[j])return;
  this[direction+'Conductance'][i]=Math.min(this.permeability[i],this.permeability[j]);
  const velocity=direction==='east'?this.currentX:this.currentY;
  // World displacement per tick -> cell fractions; small conservative upwind flow.
  this[direction+'Flow'][i]=clamp((velocity[i]+velocity[j])*.5/this.spacing,-.018,.018);
 }
 sample(x,y){
  const gx=clamp(x/this.spacing,0,this.size-1),gy=clamp(y/this.spacing,0,this.size-1),ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
  const a=iy*this.size+ix,b=iy*this.size+Math.min(ix+1,this.size-1),c=Math.min(iy+1,this.size-1)*this.size+ix,d=c+Math.min(1,this.size-1-ix);
  const s=sampleHabitat(x,y);
  for(const k of ['elevation','channel','basin','gradientX','gradientY','currentX','currentY','light','mobility','permeability'])s[k]=(this[k][a]*(1-fx)+this[k][b]*fx)*(1-fy)+(this[k][c]*(1-fx)+this[k][d]*fx)*fy;
  s.floorHeight=-28+24*s.elevation;
  s.landform=s.channel>.55?'channel':s.basin>.5?'basin':s.elevation>.57?'ridge':'slope';
  return s;
 }
}

// Each face transfers the same amount out of one cell and into its neighbour.
// No terrain coefficient can manufacture food. Reactions/sources run separately.
export function transportChemicals(grid,rates){
 const t=grid.terrain,N=grid.size,src=[grid.nutrients,grid.waste,grid.signal],dst=[grid.nextNutrients,grid.nextWaste,grid.nextSignal],sub=grid.substrate;
 for(let k=0;k<3;k++)dst[k].set(src[k]);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const i=y*N+x;
  for(let axis=0;axis<2;axis++){
   if(axis===0?x===N-1:y===N-1)continue;
   const j=i+(axis===0?1:N),conductance=axis===0?t.eastConductance[i]:t.southConductance[i];
   if(!conductance)continue;
   const reef=Math.max(.12,1-Math.max(sub[i],sub[j])*.88),flow=(axis===0?t.eastFlow[i]:t.southFlow[i])*reef;
   for(let k=0;k<3;k++){
    const a=src[k][i],b=src[k][j],flux=rates[k]*.25*conductance*reef*(a-b)+flow*(flow>0?a:b);
    dst[k][i]-=flux;dst[k][j]+=flux;
   }
  }
 }
}
