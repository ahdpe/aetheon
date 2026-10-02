// Three continuous environmental gradients inside the existing chamber.
export function sampleHabitat(x, y) {
  const dx=x-700, dy=y-700, radius=Math.hypot(dx,dy), r=radius/620;
  const meadow=Math.exp(-(((r-0.56)/0.25)**2));
  const current=0.03+0.15*Math.max(0,1-r);
  return { id:r<0.34?'basin':r<0.76?'meadow':'shoal', light:0.3+0.7*meadow,
    currentX:radius?(-dy/radius)*current:0, currentY:radius?(dx/radius)*current:0 };
}
