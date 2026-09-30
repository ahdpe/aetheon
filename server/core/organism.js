import { CONFIG } from '../config.js';

let nextOrganismId = 1;

export class Organism {
  constructor(x, y, genome = null, generation = 1, parentId = 0, speciesId = 1) {
    this.id = nextOrganismId++;
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    
    this.energy = CONFIG.INITIAL_ORGANISM_ENERGY;
    this.age = 0;
    this.generation = generation;
    this.parentId = parentId;
    this.speciesId = speciesId;
    this.birthTime = Date.now();
    this.kills = 0;
    this.childrenCount = 0;
    
    // Internal Kuramoto phase and membrane morphology
    this.phase = Math.random() * Math.PI * 2;
    this.heading = Math.random() * Math.PI * 2;
    
    // Genome vector
    if (genome) {
      this.genome = { ...genome };
    } else {
      this.genome = Organism.createRandomGenome();
    }

    // Cached phenotype parameters derived from genome
    this.size = Math.max(3.5, Math.min(16.0, this.genome.size));
    this.hue = (this.genome.hue % 1.0 + 1.0) % 1.0;
    this.carnivory = Math.max(0.0, Math.min(1.0, this.genome.carnivory));
    this.maxSpeed = Math.max(0.8, Math.min(4.5, this.genome.speedMax));
  }

  static createRandomGenome(seedHue = null) {
    const isPredator = Math.random() < 0.15;
    const baseHue = seedHue !== null ? seedHue : (isPredator ? 0.95 + Math.random() * 0.1 : 0.45 + Math.random() * 0.25);
    
    return {
      size: isPredator ? 9.0 + Math.random() * 4.0 : 5.0 + Math.random() * 5.0,
      hue: baseHue % 1.0,
      speedMax: isPredator ? 2.5 + Math.random() * 1.5 : 1.2 + Math.random() * 1.5,
      carnivory: isPredator ? 0.65 + Math.random() * 0.35 : Math.random() * 0.15,
      chemotaxisNutrient: isPredator ? 0.2 : 0.8 + Math.random() * 0.8,
      chemotaxisWaste: -0.6 + (Math.random() - 0.5) * 0.4, // usually avoid waste
      ciliaryFrequency: 0.15 + Math.random() * 0.35,
      phaseCoupling: Math.random() * 0.8,
      splitThreshold: isPredator ? 140.0 + Math.random() * 50 : 100.0 + Math.random() * 40,
      metabolismEfficiency: 0.9 + Math.random() * 0.25,
      mutationRate: 0.05 + Math.random() * 0.05,
      adhesion: Math.random() * 0.5
    };
  }

  // Mutate genome with Cauchy-like heavy-tailed distribution for evolutionary leaps
  createMutatedGenome() {
    const rate = this.genome.mutationRate;
    const g = { ...this.genome };

    const mutateVal = (val, min, max, scale = 1.0) => {
      // Small Gaussian mutation + occasional Cauchy jump
      const r = (Math.random() - 0.5) * 2;
      const jump = Math.random() < 0.05 ? r * 4.0 : r;
      const delta = jump * rate * scale;
      return Math.max(min, Math.min(max, val + delta));
    };

    g.size = mutateVal(g.size, 3.5, 18.0, 3.0);
    g.hue = (mutateVal(g.hue, 0.0, 1.0, 0.2) + 1.0) % 1.0;
    g.speedMax = mutateVal(g.speedMax, 0.8, 5.0, 1.0);
    g.carnivory = mutateVal(g.carnivory, 0.0, 1.0, 0.3);
    g.chemotaxisNutrient = mutateVal(g.chemotaxisNutrient, -1.0, 2.5, 0.5);
    g.chemotaxisWaste = mutateVal(g.chemotaxisWaste, -2.0, 1.5, 0.5);
    g.ciliaryFrequency = mutateVal(g.ciliaryFrequency, 0.05, 0.8, 0.1);
    g.phaseCoupling = mutateVal(g.phaseCoupling, 0.0, 1.5, 0.3);
    g.splitThreshold = mutateVal(g.splitThreshold, 80.0, 220.0, 20.0);
    g.metabolismEfficiency = mutateVal(g.metabolismEfficiency, 0.6, 1.6, 0.2);
    g.mutationRate = mutateVal(g.mutationRate, 0.01, 0.3, 0.04);
    g.adhesion = mutateVal(g.adhesion, 0.0, 1.0, 0.2);

    return g;
  }

  // Step 10 Hz physics, chemistry, Kuramoto oscillator, and metabolism
  step(grid, nearbyNeighbors) {
    this.age++;

    // 1. Advance Kuramoto phase oscillator
    let phaseTorque = 0;
    if (this.genome.phaseCoupling > 0.01 && nearbyNeighbors.length > 0) {
      for (let i = 0; i < nearbyNeighbors.length; i++) {
        const neighbor = nearbyNeighbors[i];
        if (neighbor !== this) {
          phaseTorque += Math.sin(neighbor.phase - this.phase);
        }
      }
      phaseTorque = (phaseTorque / nearbyNeighbors.length) * this.genome.phaseCoupling;
    }
    this.phase = (this.phase + this.genome.ciliaryFrequency + phaseTorque) % (Math.PI * 2);

    // 2. Chemical gradient sensing (Chemotaxis)
    const chem = grid.sample(this.x, this.y);
    
    // Desired steering vector from chemical field
    let steerX = chem.gradNutrientX * this.genome.chemotaxisNutrient + chem.gradWasteX * this.genome.chemotaxisWaste;
    let steerY = chem.gradNutrientY * this.genome.chemotaxisNutrient + chem.gradWasteY * this.genome.chemotaxisWaste;

    // Direct interactions with nearby neighbors
    let nearestPredator = null;
    let nearestPredatorDist = 9999;
    let nearestPrey = null;
    let nearestPreyDist = 9999;
    let separationX = 0;
    let separationY = 0;

    if (nearbyNeighbors.length > 0) {
      for (let i = 0; i < nearbyNeighbors.length; i++) {
        const other = nearbyNeighbors[i];
        if (other === this) continue;

        let dx = other.x - this.x;
        let dy = other.y - this.y;
        if (dx > CONFIG.WORLD_SIZE * 0.5) dx -= CONFIG.WORLD_SIZE;
        else if (dx < -CONFIG.WORLD_SIZE * 0.5) dx += CONFIG.WORLD_SIZE;
        if (dy > CONFIG.WORLD_SIZE * 0.5) dy -= CONFIG.WORLD_SIZE;
        else if (dy < -CONFIG.WORLD_SIZE * 0.5) dy += CONFIG.WORLD_SIZE;

        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) || 0.01;

        // A. Elastic volume exclusion (prevent awkward overlapping clumps)
        const minDist = (this.size + other.size) * 1.1;
        if (d < minDist) {
          const push = (minDist - d) / minDist;
          separationX -= (dx / d) * push * 2.0;
          separationY -= (dy / d) * push * 2.0;
        }

        // B. Identify single nearest threat / prey to avoid force cancellation
        if (this.carnivory < 0.35 && other.carnivory > 0.4 && other.size > this.size && d < nearestPredatorDist) {
          nearestPredatorDist = d;
          nearestPredator = { dx, dy, d };
        } else if (this.carnivory > 0.4 && other.size < this.size * 0.85 && d < nearestPreyDist) {
          nearestPreyDist = d;
          nearestPrey = { dx, dy, d };
        }
      }
    }

    // Apply fleeing force if predator is near
    if (nearestPredator && nearestPredator.d < this.size * 5.0) {
      steerX -= (nearestPredator.dx / nearestPredator.d) * 3.5;
      steerY -= (nearestPredator.dy / nearestPredator.d) * 3.5;
    }

    // Apply pursuit force if prey is near
    if (nearestPrey && nearestPrey.d < this.size * 4.0) {
      steerX += (nearestPrey.dx / nearestPrey.d) * 2.5;
      steerY += (nearestPrey.dy / nearestPrey.d) * 2.5;
    }

    // Add separation force
    steerX += separationX;
    steerY += separationY;

    // Smooth angular turning with inertia (prevent rapid 180° twitching)
    const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steerMag > 0.05) {
      const targetHeading = Math.atan2(steerY, steerX);
      let angleDiff = targetHeading - this.heading;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      this.heading += Math.max(-0.25, Math.min(0.25, angleDiff * 0.2));
    } else {
      // Gentle forward wander
      this.heading += (Math.random() - 0.5) * 0.08;
    }

    // Continuous rhythmic ciliary propulsion
    const ciliaryPulse = 0.5 + 0.5 * Math.sin(this.phase);
    const speedMultiplier = 0.7 + 0.5 * ciliaryPulse;

    const targetVx = Math.cos(this.heading) * this.maxSpeed * speedMultiplier;
    const targetVy = Math.sin(this.heading) * this.maxSpeed * speedMultiplier;

    this.vx += (targetVx - this.vx) * 0.2;
    this.vy += (targetVy - this.vy) * 0.2;

    // Gentle fluid damping
    this.vx *= 0.98;
    this.vy *= 0.98;

    this.x = (this.x + this.vx + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;
    this.y = (this.y + this.vy + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;

    // 3. Metabolism & Feeding
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const predatorPenalty = this.carnivory > 0.4 ? 1.8 : 1.0;
    const metabolicCost = ((CONFIG.BASE_METABOLIC_RATE * (this.size * 0.15) + (currentSpeed * currentSpeed) * 0.03) * predatorPenalty) / this.genome.metabolismEfficiency;
    this.energy -= metabolicCost;

    // Graze nutrients from the chemical substrate
    if (this.carnivory < 0.6) {
      const intakeLimit = (1.0 - this.carnivory) * (this.size * 0.25);
      const consumed = grid.consumeAndExcrete(
        this.x, 
        this.y, 
        intakeLimit, 
        0.3, // waste ratio
        0.06 * ciliaryPulse // luminescence signal
      );
      this.energy += consumed * 18.0 * this.genome.metabolismEfficiency;
    }

    // Cap maximum energy
    if (this.energy > CONFIG.MAX_ORGANISM_ENERGY) {
      this.energy = CONFIG.MAX_ORGANISM_ENERGY;
    }
  }

  // Predation interaction: check if this organism can consume 'prey'
  attemptPredation(prey, grid) {
    if (this.carnivory < 0.4 || prey === this) return false;
    if (prey.size >= this.size * 0.9) return false; // Must be noticeably larger to consume

    let dx = prey.x - this.x;
    let dy = prey.y - this.y;
    if (dx > CONFIG.WORLD_SIZE * 0.5) dx -= CONFIG.WORLD_SIZE;
    else if (dx < -CONFIG.WORLD_SIZE * 0.5) dx += CONFIG.WORLD_SIZE;
    if (dy > CONFIG.WORLD_SIZE * 0.5) dy -= CONFIG.WORLD_SIZE;
    else if (dy < -CONFIG.WORLD_SIZE * 0.5) dy += CONFIG.WORLD_SIZE;

    const contactDist = (this.size + prey.size) * 0.7;
    if (dx * dx + dy * dy <= contactDist * contactDist) {
      // Successful predatory strike!
      const gainedEnergy = prey.energy * 0.75;
      this.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, this.energy + gainedEnergy);
      this.kills++;
      
      // Excrete digestive plume into grid
      grid.consumeAndExcrete(this.x, this.y, 0, 0.8, 0.4);
      return true;
    }
    return false;
  }

  // Check if organism is eligible for Mitosis (Cell Division)
  canReproduce() {
    return this.energy >= this.genome.splitThreshold && this.age > 40;
  }

  // Perform Mitosis: returns new child Organism
  reproduce(speciesId) {
    this.energy *= 0.48; // Split energy between parent and child
    this.childrenCount++;

    const mutatedGenome = this.createMutatedGenome();
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = this.size * 1.5;
    
    const childX = (this.x + Math.cos(spawnAngle) * spawnDist + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;
    const childY = (this.y + Math.sin(spawnAngle) * spawnDist + CONFIG.WORLD_SIZE) % CONFIG.WORLD_SIZE;

    const child = new Organism(
      childX,
      childY,
      mutatedGenome,
      this.generation + 1,
      this.id,
      speciesId
    );
    child.energy = this.energy * 0.95;
    return child;
  }

  // Check if organism has perished
  isDead() {
    return this.energy <= 0.0 || this.age > 12000; // max lifespan ~20 mins of continuous life
  }

  // Pack compact binary representation for low-bandwidth 10 Hz broadcast
  toCompactJSON() {
    return [
      this.id,
      Math.round(this.x * 10) / 10,
      Math.round(this.y * 10) / 10,
      Math.round(this.vx * 100) / 100,
      Math.round(this.vy * 100) / 100,
      Math.round(this.energy),
      this.speciesId,
      Math.round(this.size * 10) / 10,
      Math.round(this.hue * 100) / 100,
      Math.round(this.phase * 100) / 100,
      Math.round(this.carnivory * 100) / 100,
      this.generation
    ];
  }

  // Full detailed report for the Inspector / Bio-Card
  getDetailedProfile(speciesName = 'Aetheobiont') {
    let diet = 'Herbivore / Autotroph';
    if (this.carnivory > 0.6) diet = 'Apex Carnivore';
    else if (this.carnivory > 0.3) diet = 'Omnivore';

    let behavior = 'Grazing peacefully';
    if (this.carnivory > 0.5) behavior = 'Stalking prey';
    else if (this.energy > this.genome.splitThreshold * 0.85) behavior = 'Preparing for mitosis';
    else if (this.energy < 25) behavior = 'Starving, seeking nutrients';

    return {
      id: this.id,
      speciesId: this.speciesId,
      speciesName,
      generation: this.generation,
      parentId: this.parentId,
      ageTicks: this.age,
      ageSeconds: Math.floor(this.age / CONFIG.TICK_RATE_HZ),
      energy: Math.round(this.energy),
      maxEnergy: CONFIG.MAX_ORGANISM_ENERGY,
      splitThreshold: Math.round(this.genome.splitThreshold),
      diet,
      behavior,
      kills: this.kills,
      childrenCount: this.childrenCount,
      size: Math.round(this.size * 10) / 10,
      speed: Math.round(Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 10) / 10,
      hue: this.hue,
      carnivory: Math.round(this.carnivory * 100),
      mutationRate: Math.round(this.genome.mutationRate * 100),
      ciliaryFrequency: Math.round(this.genome.ciliaryFrequency * 100) / 100
    };
  }
}
