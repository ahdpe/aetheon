import { CONFIG } from '../config.js';
import { ChemicalGrid } from './chemicalGrid.js';
import { SpatialHash } from './spatialHash.js';
import { Organism } from './organism.js';
import { LineageManager } from './lineage.js';
import { ColonyManager } from './colonies.js';
import { ClimateEngine } from './climate.js';
import { AtlasManager } from './atlasManager.js';
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
    this.climate = new ClimateEngine();
    this.naturalist = new AINaturalist(this.lineage);
    this.persistence = new PersistenceManager();
    this.colonies = new ColonyManager();
    this.atlas = new AtlasManager(this);
    
    // Active visitor-created nutrient blooms
    this.nutrientBlooms = [];
    this.nextBloomId = 1;

    // Scratch buffer for spatial queries
    this.neighborScratch = [];
    this.eventsBuffer = []; // Broadcast events (births, deaths, predation strikes)

    // Dynamic metrics window for AI Naturalist observations
    this.recentWindow = {
      kills: 0,
      births: 0,
      speciations: 0,
      windowStartTime: Date.now()
    };
    
    this.init();
  }

  init() {
    // Attempt to restore saved world
    const restored = this.persistence.loadSnapshot(this);
    if (!restored) {
      this.seedPrimordialFauna();
    } else {
      // Ensure all restored organisms are strictly inside the circular chamber
      const CX = CONFIG.CHAMBER_CENTER_X;
      const CY = CONFIG.CHAMBER_CENTER_Y;
      const maxR = CONFIG.CHAMBER_RADIUS - 15.0;
      for (let i = 0; i < this.organisms.length; i++) {
        const o = this.organisms[i];
        const dist = Math.hypot(o.x - CX, o.y - CY);
        if (dist > maxR) {
          const ang = Math.atan2(o.y - CY, o.x - CX);
          o.x = CX + Math.cos(ang) * (maxR - 20);
          o.y = CY + Math.sin(ang) * (maxR - 20);
        }
      }
    }
    if (this.atlas) {
      this.atlas.init();
    }
  }

  seedPrimordialFauna() {
    console.log('[SimulationEngine] Seeding initial primordial fauna in circular chamber...');
    // Seed autotrophs, weavers, and hunters around the vents
    const vents = this.grid.vents;
    const speciesList = this.lineage.getAllSpecies();
    
    for (let i = 0; i < 280; i++) {
      const vent = vents[i % vents.length];
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 60 + 5;
      
      const wx = vent.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + Math.cos(angle) * dist;
      const wy = vent.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + Math.sin(angle) * dist;

      const isHunter = (i % 7 === 0); // ~14% apex predators, 86% primary producers
      const species = isHunter ? speciesList[2] : speciesList[i % 2];
      const org = new Organism(wx, wy, Organism.createRandomGenome(species.hue, isHunter), 1, 0, species.id);
      this.organisms.push(org);
    }
  }

  // 10 Hz canonical simulation step
  step() {
    this.ticks++;

    // 0. Advance active visitor nutrient blooms
    for (let b = this.nutrientBlooms.length - 1; b >= 0; b--) {
      const bloom = this.nutrientBlooms[b];
      bloom.age++;
      if (bloom.age % 4 === 0) {
        this.grid.injectDrop(bloom.x, bloom.y, 0.4, bloom.radius);
      }
      if (bloom.age >= bloom.maxAge || bloom.energy <= 0) {
        this.nutrientBlooms.splice(b, 1);
      }
    }

    // 0.5. Advance planetary climate (thermal breathing, dendritic frost, vent modulation)
    this.climate.step(this.grid.vents);
    const effRadius = this.climate.getEffectiveRadius(CONFIG.CHAMBER_RADIUS);
    const tempFactor = 0.85 + 0.25 * this.climate.temperature;

    // 1. Advance chemical diffusion & vents (modulated by climate vent factors)
    this.grid.step(this.climate.ventFactors);

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
      
      // Step organism physics, metabolism, and food sensing (with climate constraints)
      org.step(this.grid, this.neighborScratch, this.nutrientBlooms, effRadius, tempFactor);

      // Predation checks (carnivores attack smaller neighbors)
      // Predation checks (carnivores attack neighbors)
      if (org.carnivory > 0.35) {
        for (let n = 0; n < this.neighborScratch.length; n++) {
          const prey = this.neighborScratch[n];
          if (!deadSet.has(prey.id)) {
            const strike = org.attemptPredation(prey, this.grid);
            if (strike) {
              this.recentWindow.kills++;
              if (strike.killed) {
                deadSet.add(prey.id);
                this.eventsBuffer.push({
                  type: 'predation',
                  x: prey.x,
                  y: prey.y,
                  predatorId: org.id,
                  preyId: prey.id
                });
              }
              break; // max 1 strike per tick
            }
          }
        }
      }

      // Check for cell division (Mitosis)
      if (org.canReproduce()) {
        let allowMitosis = false;
        if ((this.organisms.length + newChildren.length) < this.maxOrganisms) {
          allowMitosis = true;
        } else if (this.organisms.length >= this.maxOrganisms && Math.random() < 0.25) {
          // Turnover: cull an old or depleted organism to maintain generational turnover
          for (let k = 0; k < this.organisms.length; k++) {
            const cand = this.organisms[k];
            const isCandPiloted = cand.playerSteer && cand.playerSteer.ticks > 0;
            if (!deadSet.has(cand.id) && cand !== org && !isCandPiloted && (cand.age > 4000 || cand.energy < 30)) {
              deadSet.add(cand.id);
              allowMitosis = true;
              break;
            }
          }
        }

        if (allowMitosis) {
          const childSpeciesId = this.lineage.evaluateSpeciation(org.genome, org.speciesId);
          if (childSpeciesId !== org.speciesId) {
            this.recentWindow.speciations++;
          }
          this.recentWindow.births++;
          const child = org.reproduce(childSpeciesId);
          newChildren.push(child);
          this.eventsBuffer.push({
            type: 'birth',
            x: child.x,
            y: child.y,
            speciesId: child.speciesId
          });
          // Multicellular bonding: if parent has high adhesion or collective phase-coupling, child stays attached
          const adhesion = org.genome.adhesion ?? 0.35;
          const coupling = org.genome.phaseCoupling ?? 0.4;
          const bondingAffinity = adhesion + coupling * 0.3;
          if (bondingAffinity > 0.48 && org.carnivory < 0.45) {
            this.colonies.formBond(org, child);
          }
        }
      }

      // Natural death check
      if (org.isDead()) {
        deadSet.add(org.id);
        // Dissolve organism mass back into nutrients
        this.grid.injectDrop(org.x, org.y, org.size * 0.25, org.size * 1.5);
        // Necro-calcification: deposit structural bio-calcite into substrate
        if (this.grid.depositSubstrate) {
          this.grid.depositSubstrate(org.x, org.y, 0.08 * (org.size / 10), org.size * 1.1);
        }
      }
    }

    // 3.5. Colony Bond Physics: spring forces, alignment, shared metabolism
    const orgsById = new Map();
    for (let i = 0; i < this.organisms.length; i++) {
      orgsById.set(this.organisms[i].id, this.organisms[i]);
    }
    this.colonies.applyBondPhysics(orgsById);

    // 4. Remove deceased organisms
    if (deadSet.size > 0) {
      for (const deadId of deadSet) {
        this.colonies.removeOrganism(deadId);
      }
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
      const speciesList = this.lineage.getAllSpecies();
      for (let k = 0; k < needed; k++) {
        const vent = vents[Math.floor(Math.random() * vents.length)];
        const wx = vent.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (Math.random() - 0.5) * 40;
        const wy = vent.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (Math.random() - 0.5) * 40;
        const isHunter = Math.random() < 0.15;
        const sp = isHunter ? (speciesList[2] || speciesList[0]) : speciesList[Math.floor(Math.random() * 2)];
        this.organisms.push(new Organism(wx, wy, Organism.createRandomGenome(sp.hue, isHunter), 1, 0, sp.id));
      }
    }

    // 6.5. Preserve Apex Predator Pack: ensure at least 14-20 hunters are actively swimming
    let activeHunters = 0;
    for (let i = 0; i < this.organisms.length; i++) {
      if (this.organisms[i].carnivory > 0.35) activeHunters++;
    }

    if (activeHunters < 16) {
      const neededHunters = 16 - activeHunters;
      const vents = this.grid.vents;
      let hunterSpecies = this.lineage.getSpecies(3); // Vibrionox vorax
      if (!hunterSpecies) {
        hunterSpecies = this.lineage.getAllSpecies().find(s => s.carnivory > 0.45) || this.lineage.getAllSpecies()[2];
      }

      for (let h = 0; h < neededHunters; h++) {
        const vent = vents[Math.floor(Math.random() * vents.length)];
        const wx = vent.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (Math.random() - 0.5) * 80;
        const wy = vent.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (Math.random() - 0.5) * 80;
        const org = new Organism(wx, wy, Organism.createRandomGenome(hunterSpecies.hue, true), 1, 0, hunterSpecies.id);
        org.energy = 160.0;
        this.organisms.push(org);
      }
    }

    // 7. Update lineage statistics every 5 seconds (50 ticks)
    if (this.ticks % 50 === 0) {
      this.lineage.updatePopulations(this.organisms);
    }

    // 8. Trigger AI observations check
    if (this.ticks % 100 === 0) {
      this.naturalist.checkObservation(this.getStats()).then(observed => {
        if (observed) {
          this.resetRecentWindow();
        }
      }).catch(err => {
        console.error('[Engine] Observation check error:', err);
      });
    }

    // 8.5. Check 24-hour daily atlas cycle (every 200 ticks)
    if (this.ticks % 200 === 0 && this.atlas) {
      this.atlas.checkDailyCycle();
    }

    // 9. Periodic persistence autosave (every 10 mins)
    if (this.ticks % (CONFIG.TICK_RATE_HZ * 60 * 10) === 0) {
      this.persistence.saveSnapshot(this);
    }
  }

  // Handle external visitor perturbation (dropping nutrients, stirring water)
  injectInteraction(type, x, y, options = {}) {
    if (type === 'nutrient_drop') {
      const bloom = {
        id: this.nextBloomId++,
        x,
        y,
        energy: 280.0, // Substantial nutritional bounty
        radius: 85.0,  // Visually rich dispersion radius
        maxAge: 300,   // ~30 seconds active lifespan
        age: 0
      };
      this.nutrientBlooms.push(bloom);
      this.grid.injectDrop(x, y, 3.5, 85);
      return { success: true, type: 'nutrient_drop', x, y, bloom };
    } else if (type === 'thermal_burst') {
      this.grid.injectDrop(x, y, 4.0, 110);
      return { success: true, type: 'thermal_burst', x, y };
    }
    return { success: false };
  }

  // Handle visitor first-person ciliary steering impulse
  applySteer(orgId, steerX, steerY) {
    for (let i = 0; i < this.organisms.length; i++) {
      const o = this.organisms[i];
      if (o.id === orgId) {
        // Keep active steering authority for 15 ticks (1.5 seconds)
        o.playerSteer = { x: steerX, y: steerY, ticks: 15 };
        const mag = Math.hypot(steerX, steerY);
        if (mag > 0.05) {
          const targetHeading = Math.atan2(steerY, steerX);
          o.heading = targetHeading;
          o.vx = Math.cos(targetHeading) * o.maxSpeed * 1.35;
          o.vy = Math.sin(targetHeading) * o.maxSpeed * 1.35;
        }
        return true;
      }
    }
    return false;
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

    const liveSpecies = this.lineage.getAllSpecies().filter(s => s.population > 0);
    let dominantSpecies = null;
    let apexHunterSpecies = null;

    for (let i = 0; i < liveSpecies.length; i++) {
      const sp = liveSpecies[i];
      if (!dominantSpecies || sp.population > dominantSpecies.population) {
        dominantSpecies = sp;
      }
      if (sp.carnivory > 0.35) {
        if (!apexHunterSpecies || sp.carnivory > apexHunterSpecies.carnivory) {
          apexHunterSpecies = sp;
        }
      }
    }

    return {
      organismCount: this.organisms.length,
      speciesCount: liveSpecies.length,
      generation: maxGen,
      ageFormatted: `${days}d ${hours}h ${mins}m`,
      ageDays: days,
      meanEnergy: this.organisms.length ? totalEnergy / this.organisms.length : 0,
      epoch: this.naturalist.currentEpoch,
      epochNameEn: this.naturalist.epochNameEn,
      epochNameRu: this.naturalist.epochNameRu,
      ticks: this.ticks,
      recentKills: this.recentWindow.kills,
      recentBirths: this.recentWindow.births,
      recentSpeciations: this.recentWindow.speciations,
      dominantSpeciesNameRu: dominantSpecies ? (dominantSpecies.nameRu || dominantSpecies.nameLa) : null,
      dominantSpeciesNameEn: dominantSpecies ? (dominantSpecies.nameEn || dominantSpecies.nameLa) : null,
      dominantCount: dominantSpecies ? dominantSpecies.population : 0,
      topPredatorNameRu: apexHunterSpecies ? (apexHunterSpecies.nameRu || apexHunterSpecies.nameLa) : null,
      topPredatorNameEn: apexHunterSpecies ? (apexHunterSpecies.nameEn || apexHunterSpecies.nameLa) : null,
      reefCoverage: this.grid.getReefCoverage ? this.grid.getReefCoverage() : 0,
      ...this.colonies.getStats(),
      ...this.climate.getStats()
    };
  }

  resetRecentWindow() {
    this.recentWindow.kills = 0;
    this.recentWindow.births = 0;
    this.recentWindow.speciations = 0;
    this.recentWindow.windowStartTime = Date.now();
  }

  // Find an organism by ID for detailed profile inspection
  getOrganismProfile(id) {
    const org = this.organisms.find(o => o.id === id);
    if (!org) return null;
    const species = this.lineage.getSpecies(org.speciesId);
    return org.getDetailedProfile(species);
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
      events: this.eventsBuffer.slice(0, 20),
      blooms: this.nutrientBlooms.map(b => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        r: Math.round(b.radius),
        e: Math.round(b.energy)
      })),
      colonies: this.colonies.getBondPairs(),
      climate: this.climate.getBroadcastState()
    };
  }
}
