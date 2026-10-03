import {HABITATS,OCEAN_GEOMETRY} from '../shared/habitats.js';
import {TerrainField} from '../shared/terrain.js';

export function makeTerrainCanvas(size=320,terrain=new TerrainField()){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size),scale=OCEAN_GEOMETRY.worldSize/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const wx=x*scale,wy=y*scale;if(Math.hypot(wx-1050,wy-1050)>OCEAN_GEOMETRY.radius)continue;
  const s=terrain.sample(wx,wy),h=HABITATS.find(h=>h.id===s.id),hex=h.color.slice(1),i=(y*size+x)*4;
  const shade=Math.max(.32,Math.min(1.2,.66+(s.gradientX-s.gradientY)*85));
  const contour=Math.abs(s.elevation*18-Math.round(s.elevation*18))<Math.max(.012,Math.min(.09,Math.hypot(s.gradientX,s.gradientY)*scale*9))?.88:1;
  const ridge=Math.max(0,(s.elevation-.48)*2),channel=s.channel;
  pixels.data[i]=(parseInt(hex.slice(0,2),16)*.40+ridge*55-channel*12)*shade*contour;
  pixels.data[i+1]=(parseInt(hex.slice(2,4),16)*.47+ridge*30+channel*4)*shade*contour;
  pixels.data[i+2]=(parseInt(hex.slice(4,6),16)*.51+ridge*8+channel*14)*shade*contour;
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
