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
    this.playerSteer = { x: 0, y: 0, ticks: 0 };
    this.isLazarus = false;
    this.fatalDamage = false;
    
    // Genome vector
    if (genome) {
      this.genome = { ...genome };
      // Normalization: scale down legacy oversized genomes from earlier unconstrained epochs
      if (this.genome.size > 9.5) {
        this.genome.size = Math.max(2.5, this.genome.size * 0.52);
      }
    } else {
      this.genome = Organism.createRandomGenome();
    }

    // Cached phenotype parameters derived from genome
    this.adultSize = Math.max(2.0, Math.min(9.5, this.genome.size));
    // Ontogenesis: 0.0 = newborn juvenile (38% size), 1.0 = fully grown adult (100% size)
    this.maturity = (parentId === 0) ? 1.0 : 0.0;
    this.size = this.adultSize * (0.38 + 0.62 * this.maturity);
    this.hue = (this.genome.hue % 1.0 + 1.0) % 1.0;
    this.carnivory = Math.max(0.0, Math.min(1.0, this.genome.carnivory));
    this.maxSpeed = Math.max(0.8, Math.min(4.5, this.genome.speedMax));
    this.isAvatarLineage = false;
    this.pilotedTicks = 0;
    this.panicTicks = 0;
  }

  static createRandomGenome(seedHue = null, forcePredator = null) {
    const isPredator = forcePredator !== null ? forcePredator : (Math.random() < 0.12);
    const baseHue = seedHue !== null ? seedHue : (isPredator ? 0.95 + Math.random() * 0.1 : 0.45 + Math.random() * 0.25);
    
    return {
      size: isPredator ? 5.5 + Math.random() * 2.5 : 2.8 + Math.random() * 2.6,
      hue: baseHue % 1.0,
      speedMax: isPredator ? 2.6 + Math.random() * 1.4 : 1.2 + Math.random() * 1.4,
      carnivory: isPredator ? 0.70 + Math.random() * 0.25 : Math.random() * 0.15,
      chemotaxisNutrient: isPredator ? 0.15 : 0.9 + Math.random() * 0.8,
      chemotaxisWaste: -0.6 + (Math.random() - 0.5) * 0.4, // usually avoid waste
      ciliaryFrequency: 0.15 + Math.random() * 0.35,
      phaseCoupling: Math.random() * 0.8,
      splitThreshold: isPredator ? 220.0 + Math.random() * 40 : 80.0 + Math.random() * 30,
      metabolismEfficiency: 0.9 + Math.random() * 0.25,
      mutationRate: 0.05 + Math.random() * 0.05,
      adhesion: isPredator ? Math.random() * 0.35 : 0.3 + Math.random() * 0.6
    };
  }

  // Mutate genome with Cauchy-like heavy-tailed distribution for evolutionary leaps
  createMutatedGenome(rateMultiplier = 1.0) {
    const rate = this.genome.mutationRate * rateMultiplier;
    const g = { ...this.genome };

    const mutateVal = (val, min, max, scale = 1.0) => {
      // Small Gaussian mutation + occasional Cauchy jump
      const r = (Math.random() - 0.5) * 2;
      const jump = Math.random() < 0.05 ? r * 4.0 : r;
      const delta = jump * rate * scale;
      return Math.max(min, Math.min(max, val + delta));
    };

    g.size = mutateVal(g.size, 2.0, 9.5, 1.4);
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
  step(grid, nearbyNeighbors, nutrientBlooms = [], effectiveRadius = null, tempFactor = 1.0) {
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

    // 2. Chemical gradient sensing (Chemotaxis) or Active Player Steering Override
    const isPiloted = Boolean(this.playerSteer && this.playerSteer.ticks > 0);
    let steerX = 0;
    let steerY = 0;

    if (isPiloted) {
      this.pilotedTicks++;
      this.playerSteer.ticks--;
      // High-authority visitor steering impulse
      steerX = this.playerSteer.x * 6.5;
      steerY = this.playerSteer.y * 6.5;
    } else {
      const chem = grid.sample(this.x, this.y);
      steerX = chem.gradNutrientX * this.genome.chemotaxisNutrient + chem.gradWasteX * this.genome.chemotaxisWaste;
      steerY = chem.gradNutrientY * this.genome.chemotaxisNutrient + chem.gradWasteY * this.genome.chemotaxisWaste;

      // 2.5. Active Visitor Food Scent Luring vs Detritus Scavenging
      var isLuredToFood = false;
      var foodLureDist = Infinity;
      var isDetritusTarget = false;

      if (nutrientBlooms && nutrientBlooms.length > 0 && this.carnivory < 0.78) {
        let closestBloom = null;
        let closestDist = Infinity;

        for (let b = 0; b < nutrientBlooms.length; b++) {
          const bloom = nutrientBlooms[b];
          if (bloom.energy <= 0) continue;
          const d = Math.hypot(bloom.x - this.x, bloom.y - this.y);

          // Detritus has a strictly LOCAL sensory radius (75 μm)
          // Visitor food drops have a moderate sensory radius (260 μm)
          const maxSenseDist = bloom.isDetritus ? 75.0 : 260.0;
          if (d < maxSenseDist && d < closestDist) {
            closestDist = d;
            closestBloom = bloom;
            isDetritusTarget = !!bloom.isDetritus;
          }
        }

        if (closestBloom) {
          isLuredToFood = true;
          foodLureDist = closestDist;

          if (isDetritusTarget) {
            // Gentle local scavenger attraction — does not overwhelm chemotaxis or crowding
            const distNorm = closestDist / 75.0;
            const lureStrength = (1.0 - distNorm) * 1.6;
            const dx = closestBloom.x - this.x;
            const dy = closestBloom.y - this.y;
            steerX += (dx / closestDist) * lureStrength;
            steerY += (dy / closestDist) * lureStrength;

            // Graze detritus
            if (closestDist < closestBloom.radius + this.size * 1.2) {
              const bite = Math.min(closestBloom.energy, 2.0);
              closestBloom.energy -= bite;
              this.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, this.energy + bite * 1.5);
              if (this.maturity < 1.0) {
                this.maturity = Math.min(1.0, this.maturity + 0.04);
                this.size = Math.min(this.adultSize, this.adultSize * (0.38 + 0.62 * this.maturity));
              }
            }
          } else {
            // Visitor food bloom: responsive attraction but capped to prevent runaway singularity
            const distNorm = closestDist / 260.0;
            const lureStrength = (1.0 - distNorm) * 3.8;
            const dx = closestBloom.x - this.x;
            const dy = closestBloom.y - this.y;
            steerX += (dx / closestDist) * lureStrength;
            steerY += (dy / closestDist) * lureStrength;

            // Graze visitor food
            if (closestDist < closestBloom.radius + this.size * 1.5) {
              const bite = Math.min(closestBloom.energy, 3.5);
              closestBloom.energy -= bite;
              this.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, this.energy + bite * 2.0);
              if (this.maturity < 1.0) {
                this.maturity = Math.min(1.0, this.maturity + 0.05);
                this.size = Math.min(this.adultSize, this.adultSize * (0.38 + 0.62 * this.maturity));
              }
            }
          }
        }
      }
    }

    // Direct interactions with nearby neighbors
    let nearestPredator = null;
    let nearestPredatorDist = 9999;
    let nearestPrey = null;
    let nearestPreyDist = 9999;
    let separationX = 0;
    let separationY = 0;
    let isFleeing = false;

    if (nearbyNeighbors.length > 0) {
      let crowdCount = 0;
      let crowdCenterX = 0;
      let crowdCenterY = 0;

      for (let i = 0; i < nearbyNeighbors.length; i++) {
        const other = nearbyNeighbors[i];
        if (other === this) continue;

        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) || 0.01;

        // A. Elastic volume exclusion (prevent awkward overlapping clumps & clumping)
        const minDist = (this.size + other.size) * 1.45;
        if (d < minDist) {
          const push = (minDist - d) / minDist;
          separationX -= (dx / d) * push * 4.5;
          separationY -= (dy / d) * push * 4.5;
        }

        // Measure crowd density within 4x size
        if (d < (this.size + other.size) * 2.5) {
          crowdCount++;
          crowdCenterX += dx;
          crowdCenterY += dy;
        }

        // B. Identify single nearest threat / prey to avoid force cancellation
        if (other.carnivory > 0.35 && other.size > this.size * 1.1 && d < nearestPredatorDist) {
          nearestPredatorDist = d;
          nearestPredator = { dx, dy, d };
        } else if (this.carnivory > 0.35 && other.size < this.size * 0.9 && d < nearestPreyDist) {
          nearestPreyDist = d;
          nearestPrey = { dx, dy, d };
        }
      }

      // C. Active Anti-Clumping Dispersal: if crowded by more than 5 neighbors, strongly push away from crowd center
      if (crowdCount >= 5) {
        const avgDx = crowdCenterX / crowdCount;
        const avgDy = crowdCenterY / crowdCount;
        const avgDist = Math.hypot(avgDx, avgDy) || 0.01;
        const crowdRepulsion = Math.min(5.5, (crowdCount - 4) * 1.2);
        separationX -= (avgDx / avgDist) * crowdRepulsion;
        separationY -= (avgDy / avgDist) * crowdRepulsion;
      }
    }

    // Apply fleeing force if predator is near (amplified sensory awareness & panic steering)
    const fleeThreshold = Math.max(52.0, this.size * 6.5);
    if (nearestPredator && nearestPredator.d < fleeThreshold) {
      isFleeing = true;
      const urgency = 1.0 - (nearestPredator.d / fleeThreshold);
      const fleeForce = 3.5 + urgency * 3.5; // up to 7.0 force for close threats
      steerX -= (nearestPredator.dx / nearestPredator.d) * fleeForce;
      steerY -= (nearestPredator.dy / nearestPredator.d) * fleeForce;
    }

    // Apply pursuit force if prey is near
    if (nearestPrey && nearestPrey.d < this.size * 4.5) {
      steerX += (nearestPrey.dx / nearestPrey.d) * 2.8;
      steerY += (nearestPrey.dy / nearestPrey.d) * 2.8;
    }

    // Add separation force
    steerX += separationX;
    steerY += separationY;

    // 2.7. Substrate Deflection (Reefs & Bio-Architecture)
    if (grid.getSubstrate) {
      const subDensity = grid.getSubstrate(this.x, this.y);
      if (subDensity > 0.25) {
        const gradSub = grid.getSubstrateGradient(this.x, this.y);
        const push = (subDensity - 0.25) * 4.2;
        // Repel away from dense reef along gradient
        steerX -= gradSub.dx * push;
        steerY -= gradSub.dy * push;
        // Mineral friction / drag inside shoals
        this.vx *= (1.0 - Math.min(0.20, subDensity * 0.25));
        this.vy *= (1.0 - Math.min(0.20, subDensity * 0.25));
      }
    }

    // Option 1: Soft Surface Tension & Inward Chamber Steering
    const CX = CONFIG.CHAMBER_CENTER_X;
    const CY = CONFIG.CHAMBER_CENTER_Y;
    const R = effectiveRadius || CONFIG.CHAMBER_RADIUS;
    const margin = Math.min(CONFIG.SURFACE_TENSION_MARGIN, R * 0.22);

    const toCenterX = this.x - CX;
    const toCenterY = this.y - CY;
    const distCenter = Math.hypot(toCenterX, toCenterY) || 0.001;

    if (distCenter > R - margin) {
      const t = (distCenter - (R - margin)) / margin; // 0 (edge of margin) to 1 (at the rim)
      const nx = -toCenterX / distCenter; // Inward unit normal vector
      const ny = -toCenterY / distCenter;

      // Smooth progressive inward steering force
      const steerPush = 4.5 * (t * t);
      steerX += nx * steerPush;
      steerY += ny * steerPush;

      // Deflect outward radial velocity so organisms naturally cruise along the rim
      const outwardVel = (this.vx * toCenterX + this.vy * toCenterY) / distCenter;
      if (outwardVel > 0) {
        steerX += nx * outwardVel * 2.2;
        steerY += ny * outwardVel * 2.2;
      }
    }

    // Smooth angular turning with inertia (snappy & reactive when lured to food or piloted)
    const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steerMag > 0.05) {
      const targetHeading = Math.atan2(steerY, steerX);
      let angleDiff = targetHeading - this.heading;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      const maxTurn = isPiloted ? 0.65 : (isLuredToFood ? 0.55 : ((distCenter > R - margin) ? 0.45 : 0.28));
      const turnRate = isPiloted ? 0.55 : (isLuredToFood ? 0.48 : 0.25);
      this.heading += Math.max(-maxTurn, Math.min(maxTurn, angleDiff * turnRate));
    } else {
      // Gentle forward wander
      this.heading += (Math.random() - 0.5) * 0.08;
    }

    // Continuous rhythmic ciliary propulsion with chemotactic feeding sprint
    const ciliaryPulse = 0.5 + 0.5 * Math.sin(this.phase);
    let speedMultiplier;
    if (isPiloted) {
      const thrust = (this.playerSteer && typeof this.playerSteer.thrust === 'number') ? this.playerSteer.thrust : 1.0;
      if (thrust > 0.1) {
        speedMultiplier = 2.1; // Full throttle forward thrust!
        this.phase += 0.08;   // High-frequency ciliary flutter
      } else if (thrust < -0.1) {
        speedMultiplier = -0.35; // Active reverse brake
      } else {
        speedMultiplier = 0.45;  // Idle gentle cruise
      }
    } else {
      speedMultiplier = 0.7 + 0.5 * ciliaryPulse;
    }

    // Panic evasive sprint when fleeing or recently bitten
    if (this.panicTicks > 0) {
      this.panicTicks--;
      speedMultiplier += 1.35;
      this.phase += 0.08;
    } else if (isFleeing) {
      speedMultiplier += 0.65;
      this.phase += 0.04;
    }

    if (isLuredToFood && !isDetritusTarget && foodLureDist < 260 && !isPiloted) {
      // Vigorous rush towards user-dropped food!
      const sprintFactor = Math.pow(1.0 - foodLureDist / 260, 0.75) * 1.15;
      speedMultiplier += sprintFactor;
      this.phase += 0.06; // Faster cilia beat
    }

    const targetVx = Math.cos(this.heading) * this.maxSpeed * speedMultiplier * tempFactor;
    const targetVy = Math.sin(this.heading) * this.maxSpeed * speedMultiplier * tempFactor;

    const accelRate = isPiloted ? 0.45 : 0.2;
    this.vx += (targetVx - this.vx) * accelRate;
    this.vy += (targetVy - this.vy) * accelRate;

    // Gentle fluid damping
    this.vx *= 0.98;
    this.vy *= 0.98;

    this.x += this.vx;
    this.y += this.vy;

    // Hard physical boundary: elastic meniscus / petri dish rim
    const newDist = Math.hypot(this.x - CX, this.y - CY) || 0.001;
    const maxAllowedDist = R - this.size;
    if (newDist > maxAllowedDist) {
      const uX = (this.x - CX) / newDist;
      const uY = (this.y - CY) / newDist;
      this.x = CX + uX * maxAllowedDist;
      this.y = CY + uY * maxAllowedDist;

      // Elastic cushioned bounce off the surface tension
      const radV = this.vx * uX + this.vy * uY;
      if (radV > 0) {
        this.vx -= 1.6 * radV * uX;
        this.vy -= 1.6 * radV * uY;
        this.heading = Math.atan2(this.vy, this.vx);
      }
    }

    // 3. Metabolism & Feeding
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const predatorPenalty = this.carnivory > 0.35 ? (1.5 + this.carnivory * 0.8) : 1.0;
    const metabolicCost = ((CONFIG.BASE_METABOLIC_RATE * (this.size * 0.12) + (currentSpeed * currentSpeed) * 0.02) * predatorPenalty) / this.genome.metabolismEfficiency;
    this.energy -= metabolicCost;

    // Graze nutrients from the chemical substrate
    if (this.carnivory < 0.6) {
      const intakeLimit = (1.0 - this.carnivory) * (this.size * 0.22);
      const consumed = grid.consumeAndExcrete(
        this.x, 
        this.y, 
        intakeLimit, 
        0.3, // waste ratio
        0.06 * ciliaryPulse // luminescence signal
      );
      this.energy += consumed * 5.4 * this.genome.metabolismEfficiency;

      // Filter-feeders and grazers continuously precipitate mineral grains
      if (grid.depositSubstrate && this.carnivory < 0.35 && consumed > 0.04) {
        grid.depositSubstrate(this.x, this.y, 0.0008 * (this.size / 10), this.size * 0.7);
      }
    }

    // Maintain vital energy baseline while actively piloted by visitor
    if (isPiloted) {
      this.energy = Math.max(40.0, this.energy);
    }

    // 3.0. Ontogenesis & Somatic Maturation: juvenile growth into adult
    if (this.maturity < 1.0) {
      const growthRate = (this.energy > 55.0) ? 0.0035 : 0.0016;
      this.maturity = Math.min(1.0, this.maturity + growthRate);
      this.size = this.adultSize * (0.38 + 0.62 * this.maturity);
    }

    // Cap maximum energy
    if (this.energy > CONFIG.MAX_ORGANISM_ENERGY) {
      this.energy = CONFIG.MAX_ORGANISM_ENERGY;
    }
  }

  // Predation interaction: check if this organism can hunt or bite 'prey'
  attemptPredation(prey, grid) {
    if (this.carnivory < 0.35 || prey === this) return false;
    // Don't attack other apex hunters unless noticeably larger
    if (prey.carnivory > 0.35 && prey.size >= this.size * 0.85) return false;
    // Cannot hunt colossi more than 20% larger than hunter
    if (prey.size > this.size * 1.2) return false;

    const dx = prey.x - this.x;
    const dy = prey.y - this.y;
    const contactDist = (this.size + prey.size) * 0.75;

    if (dx * dx + dy * dy <= contactDist * contactDist) {
      // 1. Reef shelter evasion: small organisms hide in mineral crevices / coral caverns
      if (grid && grid.getSubstrate) {
        const preySub = grid.getSubstrate(prey.x, prey.y);
        if (preySub > 0.20 && this.size > prey.size * 1.2) {
          // 65% chance the prey slips into a reef crevice
          if (Math.random() < 0.65) {
            this.vx *= 0.6;
            this.vy *= 0.6;
            return false;
          }
        }
      }

      if (prey.playerSteer && prey.playerSteer.ticks > 0) {
        // Piloted organism cannot be insta-devoured: predatory strike & evasive recoil!
        const bite = Math.min(prey.energy * 0.25, 20.0);
        prey.energy -= bite;
        this.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, this.energy + bite * 0.7);
        const d = Math.hypot(dx, dy) || 1.0;
        prey.vx += (dx / d) * 4.5;
        prey.vy += (dy / d) * 4.5;
        prey.panicTicks = 30;
        return { killed: false, preyId: prey.id };
      }

      // Check if prey can be swallowed whole: only if predator is colossal (>2.2x prey) OR prey is depleted (< 22 energy)
      const canSwallowWhole = (this.size > prey.size * 2.2) || (prey.energy < 22.0);

      if (canSwallowWhole) {
        // Full ingestion / kill!
        const gainedEnergy = Math.max(30.0, prey.energy * 0.45);
        this.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, this.energy + gainedEnergy);
        this.kills++;
        grid.consumeAndExcrete(this.x, this.y, 0, 0.8, 0.4);
        if (grid.depositSubstrate) {
          grid.depositSubstrate(prey.x, prey.y, 0.05 * (prey.size / 8), prey.size * 0.9);
        }
        return { killed: true, preyId: prey.id };
      } else {
        // Predatory strike & bite: tears away vital energy without insta-killing healthy organisms
        const bite = Math.min(prey.energy * 0.38, 38.0);
        prey.energy -= bite;
        this.energy = Math.min(CONFIG.MAX_ORGANISM_ENERGY, this.energy + bite * 0.7);

        // If bite depleted remaining energy, prey perishes
        if (prey.energy <= 0.0) {
          this.kills++;
          grid.consumeAndExcrete(this.x, this.y, 0, 0.8, 0.4);
          if (grid.depositSubstrate) {
            grid.depositSubstrate(prey.x, prey.y, 0.04 * (prey.size / 8), prey.size * 0.8);
          }
          return { killed: true, preyId: prey.id };
        }

        // Prey survives bite: triggers evasive sprint & alarm discharge!
        const d = Math.hypot(dx, dy) || 1.0;
        prey.vx += (dx / d) * 5.2;
        prey.vy += (dy / d) * 5.2;
        prey.panicTicks = 25;

        // Hunter experiences jaw recoil / handling delay
        this.vx *= 0.4;
        this.vy *= 0.4;

        // Discharge defensive chemical alarm cloud in water
        if (grid.injectSignal) {
          grid.injectSignal(prey.x, prey.y, 1.2, 28);
        }

        return { killed: false, preyId: prey.id };
      }
    }
    return false;
  }

  // Check if organism is eligible for Mitosis (Cell Division)
  canReproduce() {
    return this.energy >= this.genome.splitThreshold && this.age > 40 && this.maturity >= 0.85;
  }

  // Perform Mitosis: returns new child Organism
  reproduce(speciesId, mutationMultiplier = 1.0) {
    this.energy *= 0.48; // Split energy between parent and child
    this.childrenCount++;

    const mutatedGenome = this.createMutatedGenome(mutationMultiplier);
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = this.size * 1.5;
    
    let childX = this.x + Math.cos(spawnAngle) * spawnDist;
    let childY = this.y + Math.sin(spawnAngle) * spawnDist;

    const CX = CONFIG.CHAMBER_CENTER_X;
    const CY = CONFIG.CHAMBER_CENTER_Y;
    const maxR = CONFIG.CHAMBER_RADIUS - 12.0;
    const cDist = Math.hypot(childX - CX, childY - CY);
    if (cDist > maxR) {
      const angle = Math.atan2(childY - CY, childX - CX);
      childX = CX + Math.cos(angle) * (maxR - 5);
      childY = CY + Math.sin(angle) * (maxR - 5);
    }

    const child = new Organism(
      childX,
      childY,
      mutatedGenome,
      this.generation + 1,
      this.id,
      speciesId
    );

    // Epigenetic inheritance: if parent was actively steered/piloted by a visitor
    if (this.isAvatarLineage || this.pilotedTicks > 120) {
      child.isAvatarLineage = true;
      child.genome.metabolismEfficiency = Math.min(1.8, child.genome.metabolismEfficiency * 1.12);
    }
    child.energy = this.energy * 0.95;
    return child;
  }

  // Check if organism has perished
  isDead() {
    if (this.playerSteer && this.playerSteer.ticks > 0) return false; // Protected while visitor is piloting!
    return this.fatalDamage || this.energy <= 0.0 || this.age > 12000; // max lifespan ~20 mins of continuous life
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
  getDetailedProfile(species = null) {
    const speciesNameLa = species ? (species.nameLa || `Species #${this.speciesId}`) : 'Aetheobiont';
    const speciesNameRu = species ? (species.nameRu || species.nameLa) : 'Эфиробионт';
    const speciesNameEn = species ? (species.nameEn || species.nameLa) : 'Aetheobiont';

    let dietType = 'grazer';
    if (this.carnivory > 0.35) {
      dietType = 'hunter';
    } else if (this.carnivory < 0.1 && this.size > 4.2) {
      dietType = 'filter';
    } else {
      dietType = 'grazer';
    }

    let behaviorType = 'grazing';
    if (this.carnivory > 0.35) {
      behaviorType = 'hunting';
    } else if (this.energy > this.genome.splitThreshold * 0.85) {
      behaviorType = 'mitosis';
    } else if (this.energy < 30) {
      behaviorType = 'starving';
    } else if (dietType === 'filter') {
      behaviorType = 'filtering';
    } else {
      behaviorType = 'grazing';
    }

    return {
      id: this.id,
      speciesId: this.speciesId,
      speciesName: speciesNameLa,
      speciesNameRu,
      speciesNameEn,
      dietType,
      behaviorType,
      diet: dietType === 'hunter' ? 'Apex Hunter' : (dietType === 'filter' ? 'Filter Feeder' : 'Grazer'),
      behavior: behaviorType,
      generation: this.generation,
      parentId: this.parentId,
      ageTicks: this.age,
      ageSeconds: Math.floor(this.age / CONFIG.TICK_RATE_HZ),
      energy: Math.round(this.energy),
      maxEnergy: CONFIG.MAX_ORGANISM_ENERGY,
      splitThreshold: Math.round(this.genome.splitThreshold),
      kills: this.kills,
      childrenCount: this.childrenCount,
      size: Math.round(this.size * 10) / 10,
      adultSize: Math.round((this.adultSize || this.size) * 10) / 10,
      maturity: Math.round((this.maturity !== undefined ? this.maturity : 1.0) * 100),
      isAvatarLineage: Boolean(this.isAvatarLineage),
      founderName: species ? (species.founderName || null) : null,
      speed: Math.round(Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 10) / 10,
      hue: this.hue,
      carnivory: Math.round(this.carnivory * 100),
      mutationRate: Math.round(this.genome.mutationRate * 100),
      ciliaryFrequency: Math.round(this.genome.ciliaryFrequency * 100) / 100
    };
  }
}
