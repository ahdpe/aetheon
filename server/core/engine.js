import { CONFIG } from '../config.js';
import { ChemicalGrid } from './chemicalGrid.js';
import { SpatialHash } from './spatialHash.js';
import { Organism } from './organism.js';
import { LineageManager } from './lineage.js';
import { AINaturalist } from '../ai/naturalist.js';
import { PersistenceManager } from './persistence.js';

export class SimulationEngine {
  constructor() {
    this.genesisTime = Date.now();
    this.ticks = 0;
    this.organisms = [];
    this.maxOrganisms = CONFIG.MAX_ORGANISMS;
    
    this.grid = new ChemicalGrid(CONFIG.GRID_SIZE);
    this.spatialHash = new SpatialHash(CONFIG.WORLD_SIZE, 35.0);
    this.lineage = new LineageManager();
    this.naturalist = new AINaturalist(this.lineage);
    this.persistence = new PersistenceManager();
    
    // Scratch buffer for spatial queries
    this.neighborScratch = [];
    this.eventsBuffer = []; // Broadcast events (births, deaths, predation strikes)
    
    this.init();
  }

  init() {
    // Attempt to restore saved world
    const restored = this.persistence.loadSnapshot(this);
    if (!restored) {
      this.seedPrimordialFauna();
    }
  }

  seedPrimordialFauna() {
    console.log('[SimulationEngine] Seeding initial primordial fauna...');
    // Seed autotrophs, weavers, and hunters around the vents
    const vents = this.grid.vents;
    const speciesList = this.lineage.getAllSpecies();
    
    for (let i = 0; i < 280; i++) {
      const vent = vents[i % vents.length];
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 80 + 10;
      
      const wx = (vent.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + Math.cos(angle) * dist + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;
      const wy = (vent.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + Math.sin(angle) * dist + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;

      const species = speciesList[i % speciesList.length];
      const org = new Organism(wx, wy, Organism.createRandomGenome(species.hue), 1, 0, species.id);
      this.organisms.push(org);
    }
  }

  // 10 Hz canonical simulation step
  step() {
    this.ticks++;

    // 1. Advance chemical diffusion & vents
    this.grid.step();

    // 2. Clear & repopulate spatial hash
    this.spatialHash.clear();
    for (let i = 0; i < this.organisms.length; i++) {
      this.spatialHash.insert(this.organisms[i]);
    }

    const newChildren = [];
    const deadSet = new Set();
    this.eventsBuffer.length = 0;

    // 3. Update organisms
    for (let i = 0; i < this.organisms.length; i++) {
      const org = this.organisms[i];
      if (deadSet.has(org.id)) continue;

      // Query nearby neighbors for phase coupling & predation
      this.spatialHash.query(org.x, org.y, org.size * 3.5, this.neighborScratch);
      
      // Step organism physics and metabolism
      org.step(this.grid, this.neighborScratch);

      // Predation checks (carnivores attack smaller neighbors)
      if (org.carnivory > 0.4) {
        for (let n = 0; n < this.neighborScratch.length; n++) {
          const prey = this.neighborScratch[n];
          if (!deadSet.has(prey.id) && org.attemptPredation(prey, this.grid)) {
            deadSet.add(prey.id);
            this.eventsBuffer.push({
              type: 'predation',
              x: prey.x,
              y: prey.y,
              predatorId: org.id,
              preyId: prey.id
            });
            break; // max 1 kill per tick
          }
        }
      }

      // Check for cell division (Mitosis)
      if (org.canReproduce() && (this.organisms.length + newChildren.length) < this.maxOrganisms) {
        const childSpeciesId = this.lineage.evaluateSpeciation(org.genome, org.speciesId);
        const child = org.reproduce(childSpeciesId);
        newChildren.push(child);
        this.eventsBuffer.push({
          type: 'birth',
          x: child.x,
          y: child.y,
          speciesId: child.speciesId
        });
      }

      // Natural death check
      if (org.isDead()) {
        deadSet.add(org.id);
        // Dissolve organism mass back into nutrients
        this.grid.injectDrop(org.x, org.y, org.size * 0.25, org.size * 1.5);
      }
    }

    // 4. Remove deceased organisms
    if (deadSet.size > 0) {
      this.organisms = this.organisms.filter(o => !deadSet.has(o.id));
    }

    // 5. Append new offspring
    if (newChildren.length > 0) {
      this.organisms.push(...newChildren);
    }

    // 6. Spontaneous Biogenesis (if population dips too low, vents nucleate fresh life)
    if (this.organisms.length < CONFIG.MIN_ORGANISMS) {
      const needed = CONFIG.MIN_ORGANISMS - this.organisms.length;
      const vents = this.grid.vents;
      for (let k = 0; k < needed; k++) {
        const vent = vents[Math.floor(Math.random() * vents.length)];
        const wx = (vent.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (Math.random() - 0.5) * 60 + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;
        const wy = (vent.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (Math.random() - 0.5) * 60 + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;
        const speciesList = this.lineage.getAllSpecies();
        const sp = speciesList[Math.floor(Math.random() * speciesList.length)];
        this.organisms.push(new Organism(wx, wy, Organism.createRandomGenome(sp.hue), 1, 0, sp.id));
      }
    }

    // 7. Update lineage statistics every 5 seconds (50 ticks)
    if (this.ticks % 50 === 0) {
      this.lineage.updatePopulations(this.organisms);
    }

    // 8. Trigger AI observations check
    if (this.ticks % 100 === 0) {
      this.naturalist.checkObservation(this.getStats());
    }

    // 9. Periodic persistence autosave (every 10 mins)
    if (this.ticks % (CONFIG.TICK_RATE_HZ * 60 * 10) === 0) {
      this.persistence.saveSnapshot(this);
    }
  }

  // Handle external visitor perturbation (dropping nutrients, stirring water)
  injectInteraction(type, x, y, options = {}) {
    if (type === 'nutrient_drop') {
      this.grid.injectDrop(x, y, 1.2, 35);
      return { success: true, type: 'nutrient_drop', x, y };
    } else if (type === 'thermal_burst') {
      this.grid.injectDrop(x, y, 2.5, 60);
      return { success: true, type: 'thermal_burst', x, y };
    }
    return { success: false };
  }

  getStats() {
    const ageSeconds = Math.floor((Date.now() - this.genesisTime) / 1000);
    const days = Math.floor(ageSeconds / 86400);
    const hours = Math.floor((ageSeconds % 86400) / 3600);
    const mins = Math.floor((ageSeconds % 3600) / 60);

    let totalEnergy = 0;
    let maxGen = 1;
    for (let i = 0; i < this.organisms.length; i++) {
      totalEnergy += this.organisms[i].energy;
      if (this.organisms[i].generation > maxGen) {
        maxGen = this.organisms[i].generation;
      }
    }

    return {
      organismCount: this.organisms.length,
      speciesCount: this.lineage.getAllSpecies().filter(s => s.population > 0).length,
      generation: maxGen,
      ageFormatted: `${days}d ${hours}h ${mins}m`,
      ageDays: days,
      meanEnergy: this.organisms.length ? totalEnergy / this.organisms.length : 0,
      epoch: this.naturalist.currentEpoch,
      epochNameEn: this.naturalist.epochNameEn,
      epochNameRu: this.naturalist.epochNameRu,
      ticks: this.ticks
    };
  }

  // Find an organism by ID for detailed profile inspection
  getOrganismProfile(id) {
    const org = this.organisms.find(o => o.id === id);
    if (!org) return null;
    const species = this.lineage.getSpecies(org.speciesId);
    return org.getDetailedProfile(species ? species.nameLa : 'Aetheobiont');
  }

  // Pack low-latency 10 Hz broadcast packet for clients
  getBroadcastPacket() {
    const orgData = new Float32Array(this.organisms.length * 10);
    let ptr = 0;
    for (let i = 0; i < this.organisms.length; i++) {
      const o = this.organisms[i];
      orgData[ptr++] = o.id;
      orgData[ptr++] = o.x;
      orgData[ptr++] = o.y;
      orgData[ptr++] = o.vx;
      orgData[ptr++] = o.vy;
      orgData[ptr++] = o.energy;
      orgData[ptr++] = o.size;
      orgData[ptr++] = o.hue;
      orgData[ptr++] = o.speciesId;
      orgData[ptr++] = o.carnivory;
    }

    return {
      t: this.ticks,
      n: this.organisms.length,
      orgs: Array.from(orgData), // JSON-serializable array
      events: this.eventsBuffer.slice(0, 20)
    };
  }
}
