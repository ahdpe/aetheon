// One finite organic reserve, shared by the canonical world and nursery physics.
// Units are energy equivalents, not a claim of global thermodynamic conservation.
export const REMAINS_LIMIT = 96;
export const ORGANIC_TO_NUTRIENT = 1 / 5.4;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const totals = () => ({ deaths:0, introduced:0, dissolved:0, scavenged:0, assimilated:0, dissipated:0, expired:0, overflow:0 });

export class RemainsManager {
  constructor(startedAtTick = 0) {
    this.startedAtTick = startedAtTick;
    this.nextId = 1;
    this.items = [];
    this.totals = totals();
  }

  add(org, tick, grid, cause = 'energy_or_age') {
    if (org.necromassRecorded) return null;
    org.necromassRecorded = true;
    // Structural tissue is a small proxy for developed body mass. Ingestion leaves
    // only a quarter of that tissue; prey.energy already excludes the hunter's meal.
    const fraction = clamp(org.carcassFraction ?? 1, 0, 1);
    const energy = Math.max(0, org.energy) + Math.max(0, org.size) * 2 * fraction;
    const shell = clamp(org.body?.shell ?? 0, 0, 1);
    const item = {
      id:this.nextId++, sourceId:org.id, speciesId:org.speciesId, familyId:org.familyId ?? null,
      generation:org.generation, x:org.x, y:org.y, heading:org.heading ?? 0,
      size:org.size, hue:org.hue, carnivory:org.carnivory, fraction,
      anatomy:Object.fromEntries(['elongation','shell','flagella','sensing'].map(k=>[k,org.body?.[k] ?? 0])),
      diedTick:tick, cause, age:0, maxAge:600 + Math.round(shell * 2400),
      energy, initialEnergy:energy, eaten:0
    };
    this.totals.deaths++;
    this.totals.introduced += energy;
    if (this.items.length >= REMAINS_LIMIT) {
      const oldest = this.items.shift();
      this.dissolve(oldest, oldest.energy, grid);
      this.totals.overflow++;
    }
    this.items.push(item);
    return item;
  }

  dissolve(item, amount, grid) {
    const taken = Math.min(item.energy, Math.max(0, amount));
    if (!taken) return;
    item.energy -= taken;
    const accepted = grid.depositNutrients(item.x, item.y, taken * ORGANIC_TO_NUTRIENT, Math.max(12, item.size * 2));
    const recycled = Math.min(taken, Math.max(0, accepted / ORGANIC_TO_NUTRIENT));
    this.totals.dissolved += recycled;
    this.totals.dissipated += taken - recycled;
  }

  step(grid) {
    for (let i=this.items.length-1; i>=0; i--) {
      const item = this.items[i];
      // Linear decay of the remaining reserve; eaten material cannot decay again.
      this.dissolve(item, item.energy / Math.max(1, item.maxAge - item.age), grid);
      item.age++;
      if (item.age >= item.maxAge) {
        this.dissolve(item, item.energy, grid);
        this.items.splice(i, 1);
        this.totals.expired++;
      }
    }
  }

  graze(item, org, maxEnergy) {
    if (item.energy <= 0 || org.energy >= maxEnergy || org.isDead()) return 0;
    const efficiency = .35 + .45 * clamp(org.carnivory,0,1);
    const bite = Math.min(item.energy, .6 * (org.body?.feeding ?? 1), (maxEnergy-org.energy)/efficiency);
    if (bite <= 0) return 0;
    item.energy -= bite; item.eaten += bite;
    org.energy += bite * efficiency;
    this.totals.scavenged += bite;
    this.totals.assimilated += bite * efficiency;
    this.totals.dissipated += bite * (1-efficiency);
    return bite;
  }

  getStats() {
    const stock = this.items.reduce((s,p)=>s+p.energy,0);
    return { count:this.items.length, stock, ...this.totals, startedAtTick:this.startedAtTick,
      balanceError:this.totals.introduced-stock-this.totals.dissolved-this.totals.assimilated-this.totals.dissipated };
  }

  broadcast() {
    return this.items.map(p=>({id:p.id,sourceId:p.sourceId,speciesId:p.speciesId,generation:p.generation,
      x:p.x,y:p.y,size:p.size,hue:p.hue,carnivory:p.carnivory,heading:p.heading,anatomy:p.anatomy,
      age:p.age,maxAge:p.maxAge,fraction:p.fraction,cause:p.cause,
      remaining:p.initialEnergy ? p.energy/p.initialEnergy : 0,
      eaten:p.initialEnergy ? p.eaten/p.initialEnergy : 0}));
  }

  toJSON() { return {version:1,startedAtTick:this.startedAtTick,nextId:this.nextId,items:this.items,totals:this.totals}; }

  fromJSON(data, tick=0) {
    if (!data) { this.startedAtTick=tick; return; }
    const bad = () => { throw new Error('Invalid remains checkpoint'); };
    if(data.version!==1 || !Number.isSafeInteger(data.startedAtTick) || !Number.isSafeInteger(data.nextId) || data.nextId<1 || !Array.isArray(data.items) || data.items.length>REMAINS_LIMIT) bad();
    const ids = new Set(), sources = new Set();
    for(const p of data.items) {
      if(!Number.isSafeInteger(p.id)||p.id<1||p.id>=data.nextId||ids.has(p.id)||sources.has(p.sourceId)) bad();
      ids.add(p.id);sources.add(p.sourceId);
      if(!Number.isSafeInteger(p.sourceId)||p.sourceId<1||!Number.isSafeInteger(p.speciesId)||!Number.isSafeInteger(p.generation)) bad();
      for(const key of ['x','y','size','hue','carnivory','heading','age','maxAge','energy','initialEnergy','eaten','fraction','diedTick']) if(!Number.isFinite(p[key])) bad();
      if(p.age<0||p.age>=p.maxAge||p.maxAge<600||p.maxAge>3000||p.energy<0||p.energy>p.initialEnergy||p.eaten<0||p.eaten+p.energy>p.initialEnergy+1e-7||p.size<=0||p.fraction<0||p.fraction>1) bad();
      for(const key of ['elongation','shell','flagella','sensing']) if(!Number.isFinite(p.anatomy?.[key])||p.anatomy[key]<0||p.anatomy[key]>1) bad();
      if(!['predation','energy_or_age'].includes(p.cause)) bad();
    }
    for(const key of Object.keys(totals())) if(!Number.isFinite(data.totals?.[key])||data.totals[key]<0) bad();
    const stock=data.items.reduce((s,p)=>s+p.energy,0), t=data.totals;
    if(Math.abs(t.introduced-stock-t.dissolved-t.assimilated-t.dissipated)>1e-6*Math.max(1,t.introduced)) bad();
    this.startedAtTick=data.startedAtTick;this.nextId=data.nextId;this.items=structuredClone(data.items);this.totals={...data.totals};
  }
}
