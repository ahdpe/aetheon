import { random } from './random.js';
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
import { CataclysmManager } from './cataclysmManager.js';
import { AlgaeManager } from './algaeManager.js';
import { FamilyHistory } from './familyHistory.js';
import { Nursery } from './nursery.js';

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
    this.history = new FamilyHistory();
    this.nursery = new Nursery();
    this.colonies = new ColonyManager();
    this.atlas = new AtlasManager(this);
    this.cataclysms = new CataclysmManager(this);
    this.algae = new AlgaeManager();
    
    // Active visitor-created nutrient blooms
    this.nutrientBlooms = [];
    this.nextBloomId = 1;

    // Active human pilots in 3D Dive mode (Multiplayer exclusivity)
    this.pilotedMap = new Map(); // orgId -> clientId
    this.clientPilotMap = new Map(); // clientId -> orgId

    // Scratch buffer for spatial queries
    this.neighborScratch = [];
    this.eventsBuffer = []; // Broadcast events (births, deaths, predation strikes)

    // True genealogical lineages (Variant 1: branch dynasties)
    this.activeDynasties = new Map(); // name -> dynasty metadata

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
    }
    this.ecologyEpoch ??= { version:1, startedAtTick:this.ticks, startedAt:Date.now(), initializedAnatomy:false };
    this.history.synchronize(this.organisms, this.ticks, { initial: true });
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
      const angle = random() * Math.PI * 2;
      const dist = random() * 60 + 5;
      
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

    // 0. Advance active visitor nutrient blooms and detritus clouds
    for (let b = this.nutrientBlooms.length - 1; b >= 0; b--) {
      const bloom = this.nutrientBlooms[b];
      bloom.age++;
      if (bloom.age % 4 === 0) {
        this.grid.injectDrop(bloom.x, bloom.y, bloom.isDetritus ? 0.2 : 0.4, bloom.radius);
      }
      if (bloom.age >= bloom.maxAge || bloom.energy <= 0) {
        this.nutrientBlooms.splice(b, 1);
      }
    }

    // 0.5. Advance planetary climate (thermal breathing, dendritic frost, vent modulation)
    this.climate.step(this.grid.vents);
    const effRadius = this.climate.getEffectiveRadius(CONFIG.CHAMBER_RADIUS);
    const tempFactor = 0.85 + 0.25 * this.climate.temperature;

    // 1. Advance chemical diffusion & vents (modulated by climate vent factors and tectonic ticks)
    this.grid.step(this.climate.ventFactors, this.ticks);

    // 1.5. Advance Cataclysms & Stagnation Detector
    if (this.cataclysms) {
      this.cataclysms.step();
    }

    // 2. Clear & repopulate spatial hash
    this.spatialHash.clear();
    for (let i = 0; i < this.organisms.length; i++) {
      this.spatialHash.insert(this.organisms[i]);
    }

    // 2.5. Update Benthic Algae Isles & Sanctuaries
    if (this.algae) {
      this.algae.update(this);
    }

    const newChildren = [];
    const eligibleParents = [];
    const deadSet = new Set();
    this.eventsBuffer.length = 0;

    // 3. Update organisms
    for (let i = 0; i < this.organisms.length; i++) {
      const org = this.organisms[i];
      if (deadSet.has(org.id)) continue;

      // Query nearby neighbors for phase coupling & predation (predators have wider sensory horizon)
      const queryRadius = org.carnivory > 0.35 
        ? Math.max(55.0, org.size * 8.0) 
        : Math.max(38.0, org.size * 5.0);
      const senseRadius = queryRadius * org.body.senseRadius;
      this.spatialHash.query(org.x, org.y, senseRadius, this.neighborScratch);
      
      // Step organism physics, metabolism, and food sensing (with climate constraints)
      org.step(this.grid, this.neighborScratch, this.nutrientBlooms, effRadius, tempFactor);

      if (org.isDead()) { deadSet.add(org.id); this.handleOrganismDeath(org,false); continue; }

      // Predation checks (carnivores attack smaller neighbors)
      if (org.carnivory > 0.35) {
        for (let n = 0; n < this.neighborScratch.length; n++) {
          const prey = this.neighborScratch[n];
          if (!deadSet.has(prey.id)) {
            const strike = org.attemptPredation(prey, this.grid, this.algae);
            if (strike) {
              if (strike.killed) this.recentWindow.kills++;
              if (strike.killed) {
                deadSet.add(prey.id);
                this.handleOrganismDeath(prey, true);
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

      if (org.canReproduce()) eligibleParents.push(org);

      // Natural death check
      if (org.isDead()) {
        deadSet.add(org.id);
        this.handleOrganismDeath(org, false);
      }
    }

    // Allocate only real vacant slots, fairly among surviving parents. No forced turnover cull.
    const parents = eligibleParents.filter(o => !deadSet.has(o.id) && !o.isDead() && o.canReproduce());
    for(let i=parents.length-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));[parents[i],parents[j]]=[parents[j],parents[i]];
    }
    const slots = Math.max(0,this.maxOrganisms-(this.organisms.length-deadSet.size));
    const nurserySlot=slots>0&&this.nursery.ready(this)?1:0;
    for(const org of parents.slice(0,slots-nurserySlot)) {
          const specThresholdMult = this.cataclysms ? this.cataclysms.getSpeciationThresholdMultiplier() : 1.0;
          const mutMult = this.cataclysms ? this.cataclysms.getMutationMultiplier() : 1.0;
          const child = org.reproduce(org.speciesId, mutMult);
          const nextSpeciesBefore = this.lineage.nextSpeciesId;
          const childSpeciesId = this.lineage.evaluateSpeciation(child.genome, org.speciesId, specThresholdMult);
          child.speciesId = childSpeciesId;
          this.history.recordBirth(org, child, this.ticks);
          this.lineage.recordBirth(childSpeciesId);
          if (this.lineage.nextSpeciesId > nextSpeciesBefore) {
            this.recentWindow.speciations++;
            if (this.cataclysms) this.cataclysms.onSpeciation();
          }
          this.recentWindow.births++;

          newChildren.push(child);
          this.eventsBuffer.push({
            type: 'birth',
            id: child.id,
            parentId: org.id,
            x: child.x,
            y: child.y,
            speciesId: child.speciesId
          });
          // Multicellular bonding: if parent has high adhesion or collective phase-coupling, child stays attached
          const adhesion = org.genome.adhesion ?? 0.35;
          const coupling = org.genome.phaseCoupling ?? 0.4;
          const bondingAffinity = adhesion + coupling * 0.3;
          if (bondingAffinity > 0.65 && org.carnivory < 0.40) {
            this.colonies.formBond(org, child);
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
        if (this.pilotedMap.has(deadId)) {
          const clientId = this.pilotedMap.get(deadId);
          this.pilotedMap.delete(deadId);
          this.clientPilotMap.delete(clientId);
        }
      }
      this.organisms = this.organisms.filter(o => !deadSet.has(o.id));
    }

    // 5. Append new offspring
    if (newChildren.length > 0) {
      this.organisms.push(...newChildren);
    }

    // 6. Spontaneous Biogenesis (if population dips too low, vents nucleate fresh life)
    const blockBiogenesis = this.cataclysms && this.cataclysms.isBiogenesisBlocked();
    if (!blockBiogenesis && this.organisms.length < CONFIG.MIN_ORGANISMS) {
      const needed = Math.min(CONFIG.MIN_ORGANISMS-this.organisms.length,Math.max(0,this.maxOrganisms-this.organisms.length-nurserySlot));
      const vents = this.grid.vents;
      const speciesList = this.lineage.getAllSpecies();
      for (let k = 0; k < needed; k++) {
        const vent = vents[Math.floor(random() * vents.length)];
        const wx = vent.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (random() - 0.5) * 40;
        const wy = vent.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (random() - 0.5) * 40;
        const isHunter = random() < 0.15;
        const sp = isHunter ? (speciesList[2] || speciesList[0]) : speciesList[Math.floor(random() * 2)];
        const newborn = new Organism(wx, wy, Organism.createRandomGenome(sp.hue, isHunter), 1, 0, sp.id);
        this.history.addRoot(newborn, this.ticks, 'biogenesis');
        this.organisms.push(newborn);
      }
    }

    // 6.5. Natural Ecological Balance: prevent total hunter extinction without vent-camping
    let activeHunters = 0;
    for (let i = 0; i < this.organisms.length; i++) {
      if (this.organisms[i].carnivory > 0.35) activeHunters++;
    }

    if (!blockBiogenesis && activeHunters < 4) {
      const neededHunters = Math.min(2, 4 - activeHunters, Math.max(0, this.maxOrganisms - this.organisms.length-nurserySlot));
      let hunterSpecies = this.lineage.getSpecies(3); // Vibrionox vorax
      if (!hunterSpecies) {
        hunterSpecies = this.lineage.getAllSpecies().find(s => s.carnivory > 0.45) || this.lineage.getAllSpecies()[2];
      }

      const CX = CONFIG.CHAMBER_CENTER_X;
      const CY = CONFIG.CHAMBER_CENTER_Y;
      for (let h = 0; h < neededHunters; h++) {
        // Disperse in pelagic open water AWAY from hydrothermal vents to allow grazers to thrive
        const angle = random() * Math.PI * 2;
        const dist = 180 + random() * 220;
        const wx = CX + Math.cos(angle) * dist;
        const wy = CY + Math.sin(angle) * dist;
        const org = new Organism(wx, wy, Organism.createRandomGenome(hunterSpecies.hue, true), 1, 0, hunterSpecies.id);
        org.maturity = 0.55;
        org.size = org.adultSize * (0.38 + 0.62 * org.maturity);
        org.energy = 75.0; // Moderate energy; must hunt actively to grow & reproduce
        this.history.addRoot(org, this.ticks, 'biogenesis');
        this.organisms.push(org);
      }
    }

    // 7. Update lineage and dynasty statistics
    if (this.ticks % 20 === 0) {
      this.updateDynasties();
      this.history.synchronize(this.organisms, this.ticks);
    }
    if (this.ticks % 50 === 0) {
      this.lineage.updatePopulations(this.organisms);
    }

    // 8. Trigger AI observations check
    if (this.ticks % 100 === 0) {
      const capturedStats = this.getStats();
      this.naturalist.checkObservation(capturedStats).then(observed => {
        if (observed) {
          this.resetRecentWindow(capturedStats);
        }
      }).catch(err => {
        console.error('[Engine] Observation check error:', err);
      });
    }

    // 8.5. Check 24-hour daily atlas cycle (every 200 ticks)
    if (this.ticks % 200 === 0 && this.atlas) {
      this.atlas.checkDailyCycle();
    }

    // Introductions use a real vacant slot after ordinary life and reproduction.
    this.nursery.process(this);

    // 9. Periodic persistence autosave (every 10 mins)
    if (this.ticks % (CONFIG.TICK_RATE_HZ * 60 * 10) === 0) {
      this.persistence.saveSnapshot(this);
    }
  }

  // Handle external visitor perturbation (dropping nutrients, stirring water)
  injectInteraction(type, x, y, options = {}) {
    if (![x, y].every(Number.isFinite)) return { success: false, reason: 'invalid_coordinates' };
    if (type === 'nutrient_drop') {
      const now = Date.now();
      if (now - (this.lastVisitorFeed ?? 0) < 5000) return { success: false, reason: 'world_cooldown' };
      if (this.nutrientBlooms.filter(b => !b.isDetritus).length >= 8) return { success: false, reason: 'world_quota' };
      const CX = CONFIG.CHAMBER_CENTER_X;
      const CY = CONFIG.CHAMBER_CENTER_Y;
      const R = CONFIG.CHAMBER_RADIUS;
      const dx = x - CX;
      const dy = y - CY;
      const dist = Math.hypot(dx, dy);

      // Never drop food outside the droplet!
      if (dist > R - 10) {
        return { success: false, reason: 'outside_droplet' };
      }

      // Clamp near-edge drops safely inside the open swimming zone so organisms can reach it
      let dropX = x;
      let dropY = y;
      const maxDropR = R - 45;
      if (dist > maxDropR && dist > 0) {
        dropX = CX + (dx / dist) * maxDropR;
        dropY = CY + (dy / dist) * maxDropR;
      }

      const bloom = {
        id: this.nextBloomId++,
        x: dropX,
        y: dropY,
        energy: 380.0, // Substantial nutritional bounty
        radius: 95.0,  // Visually rich dispersion radius
        maxAge: 350,   // ~35 seconds active lifespan
        age: 0
      };
      this.lastVisitorFeed = now;
      this.nutrientBlooms.push(bloom);
      this.grid.injectDrop(dropX, dropY, 4.5, 95);
      return { success: true, type: 'nutrient_drop', x: dropX, y: dropY, bloom };
    }
    return { success: false };
  }

  // Handle visitor first-person ciliary steering impulse with active throttle (thrust)
  applySteer(orgId, steerX, steerY, thrust = 1.0, clientId = null) {
    if (!clientId || this.pilotedMap.get(orgId) !== clientId || ![steerX, steerY, thrust].every(Number.isFinite)) return false;
    for (let i = 0; i < this.organisms.length; i++) {
      const o = this.organisms[i];
      if (o.id === orgId) {
        // Keep active steering authority for 12 ticks (~1.2 seconds)
        o.playerSteer = { x: steerX, y: steerY, thrust, ticks: 12 };
        const mag = Math.hypot(steerX, steerY);
        if (mag > 0.05) {
          const targetHeading = Math.atan2(steerY, steerX);
          o.heading = targetHeading;
          const spdMult = thrust > 0.1 ? 2.1 : (thrust < -0.1 ? -0.35 : 0.45);
          o.vx = Math.cos(targetHeading) * o.maxSpeed * spdMult;
          o.vy = Math.sin(targetHeading) * o.maxSpeed * spdMult;
        }
        return true;
      }
    }
    return false;
  }

  // Claim exclusive pilot authority over an organism for a visitor
  claimPilot(orgId, clientId) {
    if (!clientId) return false;
    const numId = Number(orgId);
    const o = this.organisms.find(org => org.id === numId);
    if (!o) return false;

    // Check if currently occupied by another visitor
    if (this.pilotedMap.has(numId)) {
      const currentHolder = this.pilotedMap.get(numId);
      if (currentHolder !== clientId) {
        return false; // Occupied!
      }
    }

    // Release any previous organism this client was piloting
    if (this.clientPilotMap.has(clientId)) {
      this.releasePilot(clientId);
    }

    this.pilotedMap.set(numId, clientId);
    this.clientPilotMap.set(clientId, numId);
    o.isPiloted = true;

    o.playerSteer = { x: 0, y: 0, ticks: 100 };
    return true;
  }

  // Release pilot authority when visitor exits 3D mode or disconnects
  releasePilot(clientId) {
    if (!this.clientPilotMap.has(clientId)) return;
    const orgId = this.clientPilotMap.get(clientId);
    this.clientPilotMap.delete(clientId);
    this.pilotedMap.delete(orgId);
    const o = this.organisms.find(org => org.id === orgId);
    if (o) {
      o.isPiloted = false;
      if (o.playerSteer) o.playerSteer.ticks = 0;
    }
  }

  getPilotedIds() {
    return Array.from(this.pilotedMap.keys());
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
      observedAt: Date.now(),
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

  resetRecentWindow(observed = null) {
    // Events occurring while the asynchronous narrator is working belong to the next window.
    this.recentWindow.kills = observed ? Math.max(0, this.recentWindow.kills - observed.recentKills) : 0;
    this.recentWindow.births = observed ? Math.max(0, this.recentWindow.births - observed.recentBirths) : 0;
    this.recentWindow.speciations = observed ? Math.max(0, this.recentWindow.speciations - observed.recentSpeciations) : 0;
    this.recentWindow.windowStartTime = observed?.observedAt ?? Date.now();
  }

  // Find an organism by ID for detailed profile inspection
  getOrganismProfile(id) {
    const org = this.organisms.find(o => o.id === id);
    if (!org) return null;
    const species = this.lineage.getSpecies(org.speciesId);
    const profile = org.getDetailedProfile(species);
    profile.familyId = org.familyId;
    profile.familyName = this.history.families.get(org.familyId)?.displayName??null;
    if (org.dynastyName && this.activeDynasties.has(org.dynastyName)) {
      const dyn = this.activeDynasties.get(org.dynastyName);
      profile.dynastyLivingCount = dyn.currentCount;
      profile.dynastyPeakCount = dyn.peakCount;
      profile.dynastyMaxGen = dyn.maxGen;
    }
    return profile;
  }

  // Pack low-latency 10 Hz broadcast packet for clients
  getBroadcastPacket() {
    const orgData = new Array(this.organisms.length * 15);
    let ptr = 0;
    for (let i = 0; i < this.organisms.length; i++) {
      const o = this.organisms[i];
      orgData[ptr++] = o.id;
      orgData[ptr++] = Math.round(o.x * 10) / 10;
      orgData[ptr++] = Math.round(o.y * 10) / 10;
      orgData[ptr++] = Math.round(o.vx * 100) / 100;
      orgData[ptr++] = Math.round(o.vy * 100) / 100;
      orgData[ptr++] = Math.round(o.energy * 1) / 1;
      orgData[ptr++] = Math.round(o.size * 10) / 10;
      orgData[ptr++] = Math.round(o.hue * 100) / 100;
      orgData[ptr++] = o.speciesId;
      orgData[ptr++] = Math.round(o.carnivory * 100) / 100;
      for (const key of ['elongation','shell','flagella','sensing']) orgData[ptr++] = Math.round(o.body[key]*100)/100;
      orgData[ptr++] = Math.round(o.phase*100)/100;
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
        e: Math.round(b.energy),
        d: b.isDetritus ? 1 : 0,
        h: b.hue !== undefined ? Math.round(b.hue * 100) / 100 : undefined
      })),
      colonies: this.colonies.getBondPairs(),
      climate: this.climate.getBroadcastState(),
      pilots: this.getPilotedIds(),
      vents: (this.ticks % 20 === 0 && this.grid.getVentsState) ? this.grid.getVentsState() : undefined,
      ecology: this.ticks%20===0 ? {epoch:this.ecologyEpoch,plants:this.algae.isles.length,floraBirths:this.algae.totals.births,floraDeaths:this.algae.totals.deaths,biomass:Math.round(this.algae.isles.reduce((sum,p)=>sum+p.biomass,0))}:undefined,
      algae: (this.ticks % 20 === 0 && this.algae) ? this.algae.getBroadcastState() : undefined,
      cataclysm: this.cataclysms ? this.cataclysms.getBroadcastState() : undefined,
      lazarus: this.cataclysms ? this.cataclysms.getLazarusIds() : undefined
    };
  }

  // Handle organism demise: release chemical nutrients, deposit bio-calcite reef substrate, and form organic detritus
  handleOrganismDeath(org, isPredation = false, forceDetritus = false) {
    this.history.recordDeath(org, this.ticks, isPredation ? 'predation' : 'energy_or_age');
    // 1. Dissolve organism mass into nutrients
    this.grid.injectDrop(org.x, org.y, org.size * 0.25, org.size * 1.5);

    // 2. Necro-calcification: deposit structural bio-calcite into substrate (bone reefs)
    if (this.grid.depositSubstrate) {
      this.grid.depositSubstrate(org.x, org.y, 0.12 * (org.size / 8), org.size * 1.5);
    }

    // 3. Detritus cloud: dead cells leave scavengeable necromass for grazers
    // Throttled: only adult organisms (maturity >= 0.7, size >= 4.0) with bounded probability or predation or forced test
    const shouldSpawn = forceDetritus || (org.maturity >= 0.7 && org.size >= 4.0 && (isPredation ? random() < 0.45 : random() < 0.25));
    if (shouldSpawn) {
      this.spawnDetritusBloom(org.x, org.y, org.size, org.hue, org.energy);
    }
  }

  spawnDetritusBloom(x, y, size, hue, energyRemaining) {
    const detritusBlooms = this.nutrientBlooms.filter(b => b.isDetritus);
    if (detritusBlooms.length >= 8) {
      const oldestDetritusIdx = this.nutrientBlooms.findIndex(b => b.isDetritus);
      if (oldestDetritusIdx >= 0) {
        this.nutrientBlooms.splice(oldestDetritusIdx, 1);
      }
    }
    const detritusEnergy = Math.max(15.0, Math.min(60.0, (energyRemaining || 20) * 0.4 + size * 4));
    const bloom = {
      id: this.nextBloomId++,
      x,
      y,
      energy: detritusEnergy,
      radius: Math.max(10, Math.min(22, size * 1.6)),
      maxAge: 90, // ~9 seconds
      age: 0,
      isDetritus: true,
      hue: hue !== undefined ? hue : 0.12
    };
    this.nutrientBlooms.push(bloom);
  }

  foundDynasty(orgId, founderName) {
    const cleanName = String(founderName || '').trim().slice(0, 32);
    if (!cleanName || /[<>\x00-\x1f]/.test(cleanName) || this.activeDynasties.has(cleanName)) return null;
    const org = this.organisms.find(o => o.id === orgId);
    if (!org) return null;
    if (org.dynastyName) {
      // Specimen already belongs to a dynasty
      return null;
    }

    org.dynastyName = cleanName;
    org.dynastyGen = 1;
    org.founderId = org.id;
    org.isAvatarLineage = true;

    const species = this.lineage.getSpecies(org.speciesId);
    const dynasty = {
      name: cleanName,
      founderOrgId: org.id,
      speciesId: org.speciesId,
      speciesNameLa: species ? species.nameLa : 'Aetheobiont',
      speciesNameRu: species ? species.nameRu : 'Эфиробионт',
      speciesNameEn: species ? species.nameEn : 'Aetheobiont',
      hue: org.hue,
      foundedAt: Date.now(),
      peakCount: 1,
      currentCount: 1,
      maxGen: 1,
      isExtinct: false,
      extinctAt: null
    };
    this.activeDynasties.set(cleanName, dynasty);

    if (this.naturalist) {
      this.naturalist.recordFounderDynasty(dynasty.speciesNameRu, dynasty.speciesNameEn, cleanName, org.hue);
    }
    console.log(`[Dynasty] Observer established lineage branch "${cleanName}" on specimen #${org.id} (${dynasty.speciesNameLa})`);
    return dynasty;
  }

  updateDynasties() {
    if (this.activeDynasties.size === 0) return;
    const counts = new Map();
    const maxGens = new Map();

    for (let i = 0; i < this.organisms.length; i++) {
      const dName = this.organisms[i].dynastyName;
      if (dName) {
        counts.set(dName, (counts.get(dName) || 0) + 1);
        const curGen = this.organisms[i].dynastyGen || 1;
        if (curGen > (maxGens.get(dName) || 1)) {
          maxGens.set(dName, curGen);
        }
      }
    }

    for (const [name, dynasty] of this.activeDynasties.entries()) {
      if (dynasty.isExtinct) continue;
      const count = counts.get(name) || 0;
      dynasty.currentCount = count;
      const mg = maxGens.get(name) || dynasty.maxGen;
      if (mg > dynasty.maxGen) dynasty.maxGen = mg;
      if (count > dynasty.peakCount) dynasty.peakCount = count;

      if (count === 0) {
        dynasty.isExtinct = true;
        dynasty.extinctAt = Date.now();
        const lifetimeMins = Math.max(1, Math.round((dynasty.extinctAt - dynasty.foundedAt) / 60000));
        if (this.naturalist && this.naturalist.recordDynastyExtinction) {
          this.naturalist.recordDynastyExtinction(
            dynasty.name,
            dynasty.speciesNameRu,
            dynasty.speciesNameEn,
            dynasty.maxGen,
            dynasty.peakCount,
            lifetimeMins,
            dynasty.hue
          );
        }
        console.log(`[Dynasty] Lineage branch "${name}" became extinct after ${dynasty.maxGen} generations (peak: ${dynasty.peakCount} members, ${lifetimeMins} mins). Enshrined in Hall of Fame.`);
      }
    }
  }

  getAllDynasties() {
    return Array.from(this.activeDynasties.values());
  }

  getSerializableDynasties() {
    return Array.from(this.activeDynasties.values());
  }

  restoreDynasties(dynastyList) {
    if (!Array.isArray(dynastyList)) return;
    this.activeDynasties.clear();
    for (const d of dynastyList) {
      if (d && d.name) {
        this.activeDynasties.set(d.name, d);
      }
    }
    console.log(`[Dynasty] Restored ${this.activeDynasties.size} dynasty lineages.`);
  }

  nameSpeciesFounder(speciesId, founderName) {
    const sp = this.lineage.setFounderName(speciesId, founderName);
    if (sp && this.naturalist) {
      this.naturalist.recordFounderDynasty(sp.nameRu || sp.nameLa, sp.nameEn || sp.nameLa, founderName, sp.hue);
    }
    return sp;
  }

  // Trigger an extinction cataclysm
  triggerCataclysm(type) {
    if (this.cataclysms) {
      return this.cataclysms.triggerCataclysm(type, 'manual_trigger');
    }
    return false;
  }
}
