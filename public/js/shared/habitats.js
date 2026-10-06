// Expansion adds cells, keeping the chemical cell 10.9375 world units wide.
export const LEGACY_GEOMETRY = Object.freeze({version:1,worldSize:1400,gridSize:128,cx:700,cy:700,radius:680});
export const OCEAN_GEOMETRY = Object.freeze({version:2,worldSize:2100,gridSize:192,cx:1050,cy:1050,radius:1020,previousRadius:680});
export const RESOURCE_OASES = Object.freeze([
 {x:1050,y:240,radius:155},
 {x:1520,y:360,radius:135},
 {x:1860,y:850,radius:145},
 {x:1720,y:1420,radius:135},
 {x:540,y:1660,radius:130},
 {x:260,y:1200,radius:140},
 {x:380,y:560,radius:130}
]);
export const HABITATS = Object.freeze([
 {id:'basin',en:'Inner basin',ru:'Внутренняя котловина',color:'#647ba8',x:1050,y:1050},
 {id:'meadow',en:'Reef meadows',ru:'Подводные луга',color:'#58ba96',x:1390,y:1050},
 {id:'shadow',en:'Twilight backwater',ru:'Сумеречная заводь',color:'#a48bd3',x:780,y:1250},
 {id:'shoal',en:'Inner shallows',ru:'Внутренняя отмель',color:'#c4aa73',x:1600,y:1050},
 {id:'frontier',en:'Outer archipelago',ru:'Внешний архипелаг',color:'#74cdd5',x:1050,y:250}
]);

export function frontierFertility(x,y) {
 let strength=0;
 for(const p of RESOURCE_OASES)strength=Math.max(strength,Math.exp(-(((x-p.x)/p.radius)**2)-(((y-p.y)/p.radius)**2)));
 return strength;
}
// Inner gradients retain their original physical scale and translated coordinates.
export function sampleHabitat(x, y) {
  const dx=x-OCEAN_GEOMETRY.cx, dy=y-OCEAN_GEOMETRY.cy, radius=Math.hypot(dx,dy), r=radius/620;
  const angle = Math.atan2(dy, dx);
  const shelfR = 0.56 + 0.08 * Math.sin(angle * 2.0 + 0.9) + 0.05 * Math.cos(angle * 3.0 - 0.5);
  const meadow = Math.exp(-(((r-shelfR)/0.24)**2));
  const shadow = Math.exp(-(((x-780)/130)**2)-(((y-1250)/100)**2));
  const outer = radius>620?frontierFertility(x,y):0;
  const current = (0.03+0.15*Math.max(0,1-r))*(1-0.72*shadow);
  return { id:shadow>0.5?'shadow':radius>620?'frontier':r<0.34?'basin':r<0.76?'meadow':'shoal', light:(0.3+0.7*Math.max(meadow,.85*outer))*(1-0.68*shadow),
    currentX:radius?(-dy/radius)*current:0, currentY:radius?(dx/radius)*current:0 };
}

// External chemosynthetic recharge has a fixed total budget, even in larger water.
export function resourceWeight(x,y) {
 const dx = x - OCEAN_GEOMETRY.cx, dy = y - OCEAN_GEOMETRY.cy;
 const radius = Math.hypot(dx, dy);
 if(radius>OCEAN_GEOMETRY.radius)return 0;
 const angle = Math.atan2(dy, dx);
 const shelfR = 0.56 + 0.08 * Math.sin(angle * 2.0 + 0.9) + 0.05 * Math.cos(angle * 3.0 - 0.5);
 const meadow = Math.exp(-(((radius/620-shelfR)/.24)**2));
 return .015+.5*meadow+1.2*frontierFertility(x,y);
}
export function makeResourceRecharge(size=OCEAN_GEOMETRY.gridSize,worldSize=OCEAN_GEOMETRY.worldSize) {
 const values=new Float32Array(size*size),scale=worldSize/size;
 let sum=0,oldWetCells=0;
 for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(Math.hypot(x*1400/128-700,y*1400/128-700)<=680)oldWetCells++;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x;values[i]=resourceWeight(x*scale,y*scale);sum+=values[i];}
 const budget=.004*oldWetCells;
 for(let i=0;i<values.length;i++)values[i]*=budget/sum;
 return values;
}

export function habitatReleasePoint(habitat,angle) {
  if(habitat==='shadow')return {x:780+Math.cos(angle)*35,y:1250+Math.sin(angle)*25};
  if(habitat==='frontier'){
   const index=Math.floor(((angle%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*RESOURCE_OASES.length);
   const p=RESOURCE_OASES[index];return {x:p.x+Math.cos(angle)*30,y:p.y+Math.sin(angle)*30};
  }
  const radius={basin:140,meadow:350,shoal:500}[habitat];
  if(radius===undefined)throw new Error('Unknown habitat');
  const point={x:1050+Math.cos(angle)*radius,y:1050+Math.sin(angle)*radius};
  if(habitat==='meadow'&&sampleHabitat(point.x,point.y).id==='shadow')point.x=2100-point.x;
  return point;
}
