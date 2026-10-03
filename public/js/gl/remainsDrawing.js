import {getSpeciesMorphology,drawCellMembranePath} from './morphology.js';

// The original inherited membrane, frozen in its last pose: no living pulse/glow.
export function drawRemains(ctx,p,x,y,r,detailed=true,selected=false) {
  const age=Math.min(1,p.age/p.maxAge), morph=getSpeciesMorphology(p.speciesId,p.hue,p.carnivory,p.size,0,p.anatomy);
  const body=Math.max(1.4,r)*(1-age*.24)*(.6+.4*p.fraction);
  const rx=body*morph.aspectX,ry=body*morph.aspectY;
  ctx.save();ctx.translate(x,y);ctx.rotate(p.heading);
  ctx.globalAlpha*=detailed ? .85-age*.5 : .24;
  ctx.fillStyle=`hsla(${Math.round(p.hue*360)},22%,31%,.7)`;
  ctx.strokeStyle='#d4bc8f';ctx.lineWidth=Math.max(.75,1+p.anatomy.shell);
  drawCellMembranePath(ctx,morph.shape,rx,ry,0,p.sourceId);ctx.fill();ctx.stroke();
  if(detailed&&r>=5) {
    ctx.strokeStyle='#807769';ctx.lineWidth=.9;
    ctx.beginPath();ctx.moveTo(-rx*.45,-ry*.55);ctx.lineTo(-rx*.12,ry*.25);ctx.lineTo(rx*.28,-ry*.2);ctx.lineTo(rx*.5,ry*.5);ctx.stroke();
    if(morph.hasFlagellum) {
      ctx.beginPath();ctx.moveTo(-rx,0);ctx.bezierCurveTo(-rx-body*.5,body*.6,-rx-body,body*.6,-rx-body*.9,body*.1);ctx.stroke();
    }
    // A finite, silent scatter of material, revealed as the membrane breaks down.
    ctx.fillStyle='#c7b58a';
    for(let i=0;i<4;i++) {
      const a=p.sourceId+i*2.4,d=body*(.4+age*.9);
      ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d*.8,Math.max(.7,body*.07),0,Math.PI*2);ctx.fill();
    }
  }
  if(selected) {
    ctx.globalAlpha=1;ctx.strokeStyle='#e8d0a5';ctx.lineWidth=1;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.ellipse(0,0,rx+7,ry+7,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}
