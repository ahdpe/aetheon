// Observation metadata only: these records never participate in selection or motion.
export const FAMILY_TRAITS = ['size', 'speedMax', 'carnivory', 'adhesion', 'metabolismEfficiency', 'chemotaxisNutrient', 'elongation', 'shell', 'flagella', 'sensing'];
export const HISTORY_LIMITS = { families: 2048, nodes: 2048, events: 8 };
export const traitsOf = organism => Object.fromEntries(FAMILY_TRAITS.map(key => [key, Number.isFinite(organism.genome?.[key]) ? organism.genome[key] : 0]));

export class FamilyHistory {
  constructor() {
    this.families = new Map();
    this.nodes = new Map();
    this.startedAt = Date.now();
    this.startedAtTick = null;
  }

  addRoot(org, tick, origin = 'baseline') {
    org.familyId = org.id;
    this.families.set(org.id, {
      id: org.id, founderId: org.id, founderGeneration: org.generation,
      speciesId: org.speciesId, hue: org.hue, startedAt: Date.now(), startedAtTick: tick,
      origin, founderTraits: traitsOf(org), births: 0, deaths: 0,
      living: 1, peak: 1, maxGeneration: org.generation, events: [], extinctAtTick: null
    });
    this.addNode(org, tick, origin === 'baseline');
    return this.families.get(org.id);
  }

  addNode(org, tick, baseline = false) {
    if (this.nodes.has(org.id)) return;
    this.nodes.set(org.id, {
      id: org.id, parentId: org.parentId, familyId: org.familyId, generation: org.generation,
      speciesId: org.speciesId, traits: traitsOf(org), bornTick: baseline ? null : tick,
      firstObservedTick: tick, diedTick: null, baseline
    });
  }

  event(family, event) {
    family.events.push(event);
    family.events = family.events.slice(-HISTORY_LIMITS.events);
  }

  recordBirth(parent, child, tick) {
    const family = this.families.get(parent.familyId) ?? this.addRoot(parent, tick);
    child.familyId = family.id;
    this.addNode(child, tick);
    family.births++;
    family.maxGeneration = Math.max(family.maxGeneration, child.generation);
    this.event(family, { type: child.speciesId !== parent.speciesId ? 'morph' : 'birth', tick, id: child.id, parentId: parent.id, generation: child.generation });
  }

  recordDeath(org, tick, cause = 'removed') {
    const node = this.nodes.get(org.id), family = this.families.get(org.familyId);
    if (!node || !family || node.diedTick !== null) return;
    node.diedTick = tick;
    node.cause = cause;
    family.deaths++;
  }

  synchronize(organisms, tick, { initial = false } = {}) {
    if (this.startedAtTick === null) this.startedAtTick = tick;
    const byId = new Map(organisms.map(o => [o.id, o]));
    const resolving = new Set();
    const resolve = org => {
      if (this.families.has(org.familyId)) return org.familyId;
      const parent = initial && byId.get(org.parentId);
      if (parent && parent !== org && !resolving.has(parent.id)) {
        resolving.add(org.id);
        org.familyId = resolve(parent);
        resolving.delete(org.id);
        return org.familyId;
      }
      return this.addRoot(org, tick, initial ? 'baseline' : 'biogenesis').id;
    };
    const livingIds = new Set(), counts = new Map();
    for (const org of organisms) {
      resolve(org);
      this.addNode(org, tick, initial);
      const family = this.families.get(org.familyId);
      family.maxGeneration = Math.max(family.maxGeneration, org.generation);
      livingIds.add(org.id);
      counts.set(org.familyId, (counts.get(org.familyId) ?? 0) + 1);
    }
    // Also cover removals made by ecological mechanisms outside the death callback.
    for (const node of this.nodes.values()) if (node.diedTick === null && !livingIds.has(node.id)) {
      this.recordDeath({ id: node.id, familyId: node.familyId }, tick);
    }
    for (const family of this.families.values()) {
      family.living = counts.get(family.id) ?? 0;
      family.peak = Math.max(family.peak, family.living);
      if (family.living === 0 && family.extinctAtTick === null) {
        family.extinctAtTick = tick;
        this.event(family, { type: 'extinction', tick });
      } else if (family.living > 0) family.extinctAtTick = null;
    }
    // Keep every living specimen and a bounded recent ancestry window.
    for (const [id] of this.nodes) {
      if (this.nodes.size <= HISTORY_LIMITS.nodes) break;
      if (!livingIds.has(id)) this.nodes.delete(id);
    }
    for (const [id, family] of this.families) {
      if (this.families.size <= HISTORY_LIMITS.families) break;
      if (family.living === 0) this.families.delete(id);
    }
  }

  describe(familyId, organisms, tick) {
    const family = this.families.get(familyId);
    if (!family) return null;
    const living = organisms.filter(o => o.familyId === familyId);
    const meanTraits = living.length ? Object.fromEntries(FAMILY_TRAITS.map(key => [key, living.reduce((sum, o) => sum + traitsOf(o)[key], 0) / living.length])) : null;
    const nodes = [...this.nodes.values()].filter(n => n.familyId === familyId).slice(-24).map(n => ({ ...n, parentKnown: this.nodes.get(n.parentId)?.familyId === familyId }));
    const focus = [...living].sort((a, b) => b.generation - a.generation || b.energy - a.energy)[0];
    return {
      ...family, living: living.length, meanTraits, focusId: focus?.id ?? null, focusPosition: focus ? { x: focus.x, y: focus.y } : null,
      currentTick: tick, historyStartedAt: this.startedAt, historyStartedAtTick: this.startedAtTick,
      nodes, ancestryWindowLimited: true
    };
  }

  toJSON() {
    return { version: 1, startedAt: this.startedAt, startedAtTick: this.startedAtTick, families: [...this.families.values()], nodes: [...this.nodes.values()] };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.version !== 1 || !Array.isArray(data.families) || !Array.isArray(data.nodes)) throw new Error('Invalid family history');
    this.startedAt = data.startedAt;
    this.startedAtTick = data.startedAtTick;
    this.families = new Map(data.families.map(f => [f.id, f]));
    this.nodes = new Map(data.nodes.map(n => [n.id, n]));
  }
}
