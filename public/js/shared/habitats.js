export const OCEAN_GEOMETRY = Object.freeze({worldSize:1400,cx:700,cy:700,radius:680,previousRadius:620});
export const HABITATS = Object.freeze([
 {id:'basin',en:'Inner basin',ru:'Внутренняя котловина',color:'#647ba8',x:700,y:700},
 {id:'meadow',en:'Meadow ring',ru:'Кольцо лугов',color:'#58ba96',x:1040,y:700},
 {id:'shadow',en:'Twilight backwater',ru:'Сумеречная заводь',color:'#a48bd3',x:430,y:900},
 {id:'shoal',en:'Shallow rim',ru:'Мелководный край',color:'#c4aa73',x:1250,y:700},
 {id:'frontier',en:'Outer frontier',ru:'Внешняя отмель',color:'#74cdd5',x:700,y:50}
]);

// Existing radial gradients keep their scale; the added inlet blends smoothly.
export function sampleHabitat(x, y) {
  const dx=x-700, dy=y-700, radius=Math.hypot(dx,dy), r=radius/620;
  const meadow=Math.exp(-(((r-0.56)/0.25)**2));
  const shadow=Math.exp(-(((x-430)/130)**2)-(((y-900)/100)**2));
  const current=(0.03+0.15*Math.max(0,1-r))*(1-0.72*shadow);
  return { id:shadow>0.5?'shadow':radius>620?'frontier':r<0.34?'basin':r<0.76?'meadow':'shoal', light:(0.3+0.7*meadow)*(1-0.68*shadow),
    currentX:radius?(-dy/radius)*current:0, currentY:radius?(dx/radius)*current:0 };
}

export function habitatReleasePoint(habitat,angle) {
  if(habitat==='shadow')return {x:430+Math.cos(angle)*35,y:900+Math.sin(angle)*25};
  const radius={basin:140,meadow:350,shoal:500,frontier:650}[habitat];
  if(radius===undefined)throw new Error('Unknown habitat');
  const point={x:700+Math.cos(angle)*radius,y:700+Math.sin(angle)*radius};
  if(habitat==='meadow'&&sampleHabitat(point.x,point.y).id==='shadow')point.x=1400-point.x;
  return point;
}
