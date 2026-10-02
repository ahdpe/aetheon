// The budget constrains visitor designs; ordinary offspring still mutate naturally.
export const DESIGN_BUDGET = 7.5;
export const DESIGN_WEIGHTS = {size:2,speed:2,elongation:0.5,shell:2,flagella:2,sensing:2,adhesion:1.5,diet:1};
export const DESIGN_KEYS = [...Object.keys(DESIGN_WEIGHTS),'hue'];
export const NURSERY_PRESETS = {
 grazer:{size:.3,speed:.3,elongation:.35,shell:.25,flagella:.35,sensing:.7,adhesion:.2,diet:.05,hue:.49},
 weaver:{size:.45,speed:.15,elongation:.55,shell:.4,flagella:.2,sensing:.4,adhesion:.95,diet:0,hue:.12},
 hunter:{size:.75,speed:.65,elongation:.9,shell:.35,flagella:.55,sensing:.4,adhesion:.05,diet:.9,hue:.86}
};
export const designCost = d => Object.entries(DESIGN_WEIGHTS).reduce((sum,[key,weight])=>sum+d[key]*weight,0);
export function validateDesign(d) {
 return !!d && typeof d==='object' && !Array.isArray(d) && Object.keys(d).length===DESIGN_KEYS.length &&
  DESIGN_KEYS.every(k=>Object.hasOwn(d,k)&&Number.isFinite(d[k])&&d[k]>=0&&d[k]<=1) && designCost(d)<=DESIGN_BUDGET+1e-9;
}
export function designGenome(d) {
 if(!validateDesign(d)) throw new Error('Invalid nursery design');
 const carnivory=d.diet*.9;
 return {size:2.8+5.2*d.size,hue:d.hue,speedMax:1+2.5*d.speed,carnivory,
  elongation:d.elongation,shell:d.shell,flagella:d.flagella,sensing:d.sensing,adhesion:d.adhesion,
  chemotaxisNutrient:1.4*(1-carnivory),chemotaxisWaste:-.6,ciliaryFrequency:.3,
  phaseCoupling:.5,splitThreshold:95+135*carnivory,metabolismEfficiency:1,mutationRate:.07};
}
// Defaults used by the isolated browser trial; server configuration remains authoritative.
export const TRIAL_PHYSICS = {GRID_SIZE:128,WORLD_SIZE:1400,CHAMBER_RADIUS:620,CHAMBER_CENTER_X:700,CHAMBER_CENTER_Y:700,
 SURFACE_TENSION_MARGIN:120,TICK_RATE_HZ:10,BASE_METABOLIC_RATE:.08,INITIAL_ORGANISM_ENERGY:60,MAX_ORGANISM_ENERGY:250,
 DIFFUSION_RATE_NUTRIENT:.08,DIFFUSION_RATE_WASTE:.04,DIFFUSION_RATE_SIGNAL:.12,
 DECAY_RATE_NUTRIENT:.0005,DECAY_RATE_WASTE:.003,DECAY_RATE_SIGNAL:.02};
export const HABITAT_RADII = {basin:140,meadow:350,shoal:500};
