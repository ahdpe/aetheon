import {HABITATS,OCEAN_GEOMETRY} from '../shared/habitats.js';
import {TerrainField} from '../shared/terrain.js';

const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

// Seabed colour follows continuous local conditions, without the atlas's
// categorical radial borders. Generated once, shared by 2D, 3D and nursery.
function seabedColour(s){
 let rgb=blend([26,57,65],[46,79,69],smooth(.15,.9,s.light)*.5);
 rgb=blend(rgb,[93,83,57],smooth(.43,.73,s.elevation)*.72);
 rgb=blend(rgb,[18,43,60],s.channel*.55);
 return blend(rgb,[22,38,59],s.basin*.45);
}

export function makeTerrainCanvas(size=320,terrain=new TerrainField(),{atlas=false}={}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size),scale=OCEAN_GEOMETRY.worldSize/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const wx=x*scale,wy=y*scale;if(Math.hypot(wx-1050,wy-1050)>OCEAN_GEOMETRY.radius)continue;
  const s=terrain.sample(wx,wy),i=(y*size+x)*4;
  const shade=Math.max(.32,Math.min(1.2,.66+(s.gradientX-s.gradientY)*85));
  let rgb=seabedColour(s),contour=1;
  if(atlas){
   // Enhanced bathymetric topographic map: natural organic relief with depth contours
   const ridge=Math.max(0,(s.elevation-.48)*2),channel=s.channel;
   rgb=[Math.min(255,rgb[0]*1.15+ridge*30-channel*8), Math.min(255,rgb[1]*1.2+ridge*25+channel*5), Math.min(255,rgb[2]*1.25+ridge*12+channel*14)];
   contour=Math.abs(s.elevation*18-Math.round(s.elevation*18))<Math.max(.012,Math.min(.09,Math.hypot(s.gradientX,s.gradientY)*scale*9))?.82:1;
  }
  for(let c=0;c<3;c++)pixels.data[i+c]=rgb[c]*shade*contour;
  pixels.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);return canvas;
}

export function drawCurrentArrows(ctx,terrain,scale){
 ctx.save();ctx.strokeStyle='#b8eee455';ctx.lineWidth=1.5;
 for(let y=250;y<1950;y+=230)for(let x=250;x<1950;x+=230){
  if(Math.hypot(x-1050,y-1050)>OCEAN_GEOMETRY.radius-70)continue;
  const s=terrain.sample(x,y),speed=Math.hypot(s.currentX,s.currentY);if(speed<.025)continue;
  const a=Math.atan2(s.currentY,s.currentX),length=8+Math.min(17,speed*100),px=x*scale,py=y*scale;
  ctx.beginPath();ctx.moveTo(px-Math.cos(a)*length*.5,py-Math.sin(a)*length*.5);ctx.lineTo(px+Math.cos(a)*length*.5,py+Math.sin(a)*length*.5);
  ctx.lineTo(px+Math.cos(a)*length*.5-Math.cos(a-.6)*6,py+Math.sin(a)*length*.5-Math.sin(a-.6)*6);
  ctx.moveTo(px+Math.cos(a)*length*.5,py+Math.sin(a)*length*.5);ctx.lineTo(px+Math.cos(a)*length*.5-Math.cos(a+.6)*6,py+Math.sin(a)*length*.5-Math.sin(a+.6)*6);ctx.stroke();
 }
 ctx.restore();
}
