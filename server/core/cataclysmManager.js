import { random } from './random.js';
import { CONFIG } from '../config.js';

export const CATACLYSM_TYPES = {
  SULFIDE_ANOXIA: 'sulfide_anoxia',
  CRYO_FREEZE: 'cryo_freeze',
  UV_RADIATION: 'uv_radiation'
};

export const CATACLYSM_PHASES = {
  DORMANT: 'dormant',
  PREMONITION: 'premonition',       // ~60-80s early warning & seismic tremors
  CRISIS: 'crisis',                 // ~80-100s peak extinction mortality
  LAZARUS_DAWN: 'lazarus_dawn',     // ~40s pioneer coronation & epoch advance
  ADAPTIVE_RADIATION: 'radiation'   // ~120s Cambrian hyper-mutation bloom
};

export class CataclysmManager {
  constructor(engine) {
    this.engine = engine;
    
    // Core state
    this.phase = CATACLYSM_PHASES.DORMANT;
    this.currentType = null;
    this.phaseTicks = 0;
    this.phaseMaxTicks = 0;
    
    // Stagnation Detection Metrics
    this.stagnationScore = 0.0; // 0.0 to 1.0 (triggers cataclysm at 1.0)
    this.ticksSinceLastSpeciation = 0;
    this.lastObservedDiversity = 1.5;
    this.stagnationCooldownTicks = 0; // Prevent consecutive cataclysms too quickly
    
    // Historical tally
    this.extinctionsCount = 0;
    this.lazarusIds = new Set();
    this.lazarusOrganisms = [];
    this.epochTitles = [
      { ru: 'Первичный Рассвет', en: 'The Primordial Dawn' },
      { ru: 'Пост-Сульфидный Ренессанс', en: 'The Post-Sulfidic Renaissance' },
      { ru: 'Пост-Ледниковое Пробуждение', en: 'The Post-Glacial Awakening' },
      { ru: 'Ионический Кембрий', en: 'The Ionic Cambrian' },
      { ru: 'Эра Коралловых Титанов', en: 'Era of the Coral Titans' },
      { ru: 'Нео-Аэтеонский Расцвет', en: 'Neo-Aetheon Bloom' }
    ];

    // Phase Durations in 10 Hz ticks
    this.durations = {
      [CATACLYSM_PHASES.PREMONITION]: 600,        // 60 seconds
      [CATACLYSM_PHASES.CRISIS]: 900,              // 90 seconds
      [CATACLYSM_PHASES.LAZARUS_DAWN]: 400,        // 40 seconds
      [CATACLYSM_PHASES.ADAPTIVE_RADIATION]: 1200  // 120 seconds
    };
  }

  // Calculate Shannon Genetic Diversity Index: H = -sum(p_i * ln(p_i))
  calcShannonDiversity() {
    const orgs = this.engine.organisms;
    if (!orgs || orgs.length === 0) return { H: 0, maxDominance: 0, speciesCount: 0 };

    const countsBySpecies = new Map();
    for (let i = 0; i < orgs.length; i++) {
      const spId = orgs[i].speciesId;
      countsBySpecies.set(spId, (countsBySpecies.get(spId) || 0) + 1);
    }

    let H = 0.0;
    const total = orgs.length;
    let maxDominance = 0;

    for (const count of countsBySpecies.values()) {
      const p = count / total;
      if (p > maxDominance) maxDominance = p;
      if (p > 0) {
        H -= p * Math.log(p);
      }
    }

    return { H, maxDominance, speciesCount: countsBySpecies.size };
  }

  // 10 Hz canonical step
  step() {
    if (this.stagnationCooldownTicks > 0) {
      this.stagnationCooldownTicks--;
    }

    if (this.phase === CATACLYSM_PHASES.DORMANT) {
      this.stepStagnationDetector();
    } else {
      this.stepActiveCataclysm();
    }
  }

  // Periodic monitoring for evolutionary deadlock / monoculture trap
  stepStagnationDetector() {
    this.ticksSinceLastSpeciation++;

    // Evaluate diversity every 50 ticks (5 seconds)
    if (this.engine.ticks % 50 === 0) {
      const { H, maxDominance, speciesCount } = this.calcShannonDiversity();
      this.lastObservedDiversity = H;

      // Stagnation triggers when:
      // 1. Single species forms an ecological monopoly (> 80% of entire population)
      // 2. OR diversity index falls below 0.60 for extended time
      // 3. AND no new species has emerged for > 20000 ticks (~33 minutes)
      const isMonopoly = maxDominance > 0.82 && this.engine.organisms.length >= 160;
      const isLowDiversity = H < 0.65 && speciesCount <= 2;
      const isProlongedStasis = this.ticksSinceLastSpeciation > 20000;

      if ((isMonopoly || isLowDiversity) && isProlongedStasis && this.stagnationCooldownTicks <= 0) {
        this.stagnationScore = Math.min(1.0, this.stagnationScore + 0.015);
      } else {
        this.stagnationScore = Math.max(0.0, this.stagnationScore - 0.005);
      }

      // Natural auto-trigger when stagnation reaches critical threshold
      if (this.stagnationScore >= 1.0) {
        const types = [
          CATACLYSM_TYPES.SULFIDE_ANOXIA,
          CATACLYSM_TYPES.CRYO_FREEZE,
          CATACLYSM_TYPES.UV_RADIATION
        ];
        const chosen = types[this.extinctionsCount % types.length];
        this.triggerCataclysm(chosen, 'stagnation_detected');
      }
    }
  }

  // Active Cataclysm lifecycle runner
  stepActiveCataclysm() {
    this.phaseTicks++;
    const progress = Math.min(1.0, this.phaseTicks / Math.max(1, this.phaseMaxTicks));

    switch (this.phase) {
      case CATACLYSM_PHASES.PREMONITION:
        this.stepPremonition(progress);
        if (this.phaseTicks >= this.phaseMaxTicks) {
          this.transitionTo(CATACLYSM_PHASES.CRISIS);
        }
        break;

      case CATACLYSM_PHASES.CRISIS:
        this.stepCrisis(progress);
        // Crisis concludes when target survivor count (3-6) is reached or timer expires
        const alive = this.engine.organisms.length;
        if (this.phaseTicks >= this.phaseMaxTicks || alive <= 5) {
          this.transitionTo(CATACLYSM_PHASES.LAZARUS_DAWN);
        }
        break;

      case CATACLYSM_PHASES.LAZARUS_DAWN:
        this.stepLazarusDawn(progress);
        if (this.phaseTicks >= this.phaseMaxTicks) {
          this.transitionTo(CATACLYSM_PHASES.ADAPTIVE_RADIATION);
        }
        break;

      case CATACLYSM_PHASES.ADAPTIVE_RADIATION:
        this.stepAdaptiveRadiation(progress);
        // Conclude recovery when population has rebounded to healthy levels
        if (this.phaseTicks >= this.phaseMaxTicks && this.engine.organisms.length >= 100) {
          this.transitionTo(CATACLYSM_PHASES.DORMANT);
        }
        break;
    }
  }

  // 1. Premonition: environmental tremors, vent bubbling, early warning
  stepPremonition(progress) {
    if (this.engine.ticks % 10 === 0) {
      if (this.currentType === CATACLYSM_TYPES.SULFIDE_ANOXIA) {
        // Hydrothermal vents begin pulsing erratically
        for (const v of this.engine.grid.vents) {
          this.engine.grid.injectDrop(
            v.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE),
            v.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE),
            0.6,
            45
          );
        }
      }
    }
  }

  // 2. Peak Crisis: severe environmental mortality
  stepCrisis(progress) {
    const orgs = this.engine.organisms;
    const targetSurvivors = 5;
    
    const candidates = orgs.slice();

    // If population is still above the target survivor threshold, apply selective pressure
    if (candidates.length > targetSurvivors) {
      // Sort candidates by survival fitness in catastrophe:
      // Survivors should be those sheltering in reefs or near warm vents with high metabolism
      const scored = candidates.map(org => {
        let shelterScore = 0;

        // Substrate reef shelter
        if (this.engine.grid.getSubstrate) {
          const sub = this.engine.grid.getSubstrate(org.x, org.y);
          shelterScore += sub * 3.5; // Reef caverns provide natural protection
        }

        // Distance to nearest hydrothermal vent
        const vents = this.engine.grid.vents;
        let minVentDist = Infinity;
        for (const v of vents) {
          const vx = v.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE);
          const vy = v.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE);
          const d = Math.hypot(org.x - vx, org.y - vy);
          if (d < minVentDist) minVentDist = d;
        }

        if (this.currentType === CATACLYSM_TYPES.CRYO_FREEZE) {
          // In Cryo-shock, distance to warm vents is the single most vital factor
          shelterScore += Math.max(0, (140 - minVentDist) / 25);
        } else if (this.currentType === CATACLYSM_TYPES.SULFIDE_ANOXIA) {
          // In Sulfide-anoxia, being directly on top of boiling toxic vent is dangerous,
          // but deep reef formations are the safest refugia
          shelterScore += Math.min(2.0, minVentDist / 60);
        }

        // Resilience traits from genome
        const defense = (org.genome.metabolismEfficiency || 1.0) + (org.genome.adhesion || 0.3) * 0.5;
        const totalFitness = shelterScore * 2.0 + defense + (org.energy / 50.0);

        return { org, score: totalFitness };
      });

      // Sort ascending (lowest shelter score dies first)
      scored.sort((a, b) => a.score - b.score);

      // Calculate cull rate to smoothly and steadily reach target survivors before crisis concludes
      const diff = candidates.length - targetSurvivors;
      const ticksLeft = Math.max(1, this.phaseMaxTicks - this.phaseTicks);
      const neededRate = Math.ceil(diff / ticksLeft);
      const cullRate = Math.max(1, Math.min(candidates.length - targetSurvivors, Math.max(neededRate, Math.floor(candidates.length * 0.03))));
      const toCull = scored.slice(0, cullRate);

      for (const item of toCull) {
        if (candidates.length <= targetSurvivors) break;
        // Fatal toxicity / frost / radiation damage
        item.org.fatalDamage = true;
        item.org.energy = 0.0;
      }
    }

    // In Sulfide anoxia: inject dark sulfur deposits on the seabed
    if (this.engine.ticks % 8 === 0 && this.currentType === CATACLYSM_TYPES.SULFIDE_ANOXIA) {
      const vents = this.engine.grid.vents;
      for (const v of vents) {
        const vx = v.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE);
        const vy = v.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE);
        this.engine.grid.injectDrop(vx, vy, 0.8, 80);
      }
    }
  }

  // 3. Lazarus Dawn: select & crown the surviving pioneers
  stepLazarusDawn(progress) {
    if (this.lazarusIds.size === 0) {
      this.crownLazarusPioneers();
    }

    // Keep pioneers supplied with vital energy so they thrive and do not starve
    for (const org of this.engine.organisms) {
      if (this.lazarusIds.has(org.id)) {
        org.energy = Math.max(org.energy, 185.0);
      }
    }
  }

  // 4. Adaptive Radiation: Cambrian burst with hyper-mutations and rich detritus
  stepAdaptiveRadiation(progress) {
    // Inject massive nutrient bounty from all the deceased predecessors (detritus)
    if (this.engine.ticks % 25 === 0) {
      const vents = this.engine.grid.vents;
      for (const v of vents) {
        const vx = v.x * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (random() - 0.5) * 120;
        const vy = v.y * (CONFIG.WORLD_SIZE / CONFIG.GRID_SIZE) + (random() - 0.5) * 120;
        this.engine.grid.injectDrop(vx, vy, 1.8, 110);
      }
    }
  }

  // Identify and consecrate the surviving organisms as Lazarus Pioneers
  crownLazarusPioneers() {
    this.lazarusIds.clear();
    this.lazarusOrganisms = [];

    const liveOrgs = this.engine.organisms;
    for (const org of liveOrgs) {
      org.isLazarus = true;
      org.energy = 220.0; // Abundant vitality
      this.lazarusIds.add(org.id);
      
      const sp = this.engine.lineage.getSpecies(org.speciesId);
      if (sp) {
        sp.isLazarusLineage = true;
      }

      this.lazarusOrganisms.push({
        id: org.id,
        speciesId: org.speciesId,
        speciesNameRu: sp ? (sp.nameRu || sp.nameLa) : 'Неизвестный вид',
        speciesNameEn: sp ? (sp.nameEn || sp.nameLa) : 'Unknown species',
        hue: org.hue,
        size: org.size,
        generation: org.generation
      });
    }

    console.log(`[CataclysmManager] Crowned ${this.lazarusIds.size} Lazarus Pioneers!`);

    // Advance World Epoch
    const nextEpochIdx = this.engine.naturalist.currentEpoch % this.epochTitles.length;
    const epochInfo = this.epochTitles[nextEpochIdx];
    this.engine.naturalist.advanceEpoch(epochInfo.ru, epochInfo.en);

    // Notify AI Naturalist to chronicle this historic milestone
    if (this.engine.naturalist && typeof this.engine.naturalist.chronicleCataclysm === 'function') {
      this.engine.naturalist.chronicleCataclysm(
        this.currentType,
        CATACLYSM_PHASES.LAZARUS_DAWN,
        this.engine.getStats(),
        this.lazarusOrganisms
      );
    }
  }

  // Phase transition handler
  transitionTo(newPhase) {
    const oldPhase = this.phase;
    this.phase = newPhase;
    this.phaseTicks = 0;
    this.phaseMaxTicks = this.durations[newPhase] || 0;

    console.log(`[CataclysmManager] Transitioned: ${oldPhase} -> ${newPhase} (${this.currentType})`);

    // Emit Naturalist journal dispatches at critical phase shifts
    if (this.engine.naturalist && typeof this.engine.naturalist.chronicleCataclysm === 'function') {
      if (newPhase === CATACLYSM_PHASES.PREMONITION) {
        this.engine.naturalist.chronicleCataclysm(this.currentType, CATACLYSM_PHASES.PREMONITION, this.engine.getStats());
      } else if (newPhase === CATACLYSM_PHASES.CRISIS) {
        this.engine.naturalist.chronicleCataclysm(this.currentType, CATACLYSM_PHASES.CRISIS, this.engine.getStats());
      } else if (newPhase === CATACLYSM_PHASES.ADAPTIVE_RADIATION) {
        this.engine.naturalist.chronicleCataclysm(this.currentType, CATACLYSM_PHASES.ADAPTIVE_RADIATION, this.engine.getStats());
      }
    }

    if (newPhase === CATACLYSM_PHASES.DORMANT) {
      this.currentType = null;
      this.stagnationScore = 0.0;
      this.stagnationCooldownTicks = 36000; // 1 hour cooldown before next cataclysm
      this.extinctionsCount++;
      // Clear Lazarus flags
      for (const org of this.engine.organisms) {
        org.isLazarus = false;
      }
      this.lazarusIds.clear();
    }
  }

  // Manual / Stagnation Trigger
  triggerCataclysm(type = CATACLYSM_TYPES.SULFIDE_ANOXIA, reason = 'manual') {
    if (this.phase !== CATACLYSM_PHASES.DORMANT) {
      console.warn(`[CataclysmManager] Cannot trigger cataclysm, already active in phase: ${this.phase}`);
      return false;
    }

    this.currentType = type;
    this.transitionTo(CATACLYSM_PHASES.PREMONITION);
    console.log(`[CataclysmManager] 💥 Great Extinction initiated! Type: ${type}, Reason: ${reason}`);
    return true;
  }

  // Check if spontaneous biogenesis is allowed (blocked during crisis to allow authentic die-off)
  isBiogenesisBlocked() {
    return this.phase === CATACLYSM_PHASES.CRISIS || this.phase === CATACLYSM_PHASES.LAZARUS_DAWN;
  }

  // Hyper-mutation multiplier during Cambrian Adaptive Radiation phase
  getMutationMultiplier() {
    if (this.phase === CATACLYSM_PHASES.ADAPTIVE_RADIATION) {
      return 2.8; // High genetic mutation bursts into new body shapes
    }
    return 1.0;
  }

  // Speciation divergence threshold multiplier (lowered during adaptive radiation for rapid speciation)
  getSpeciationThresholdMultiplier() {
    if (this.phase === CATACLYSM_PHASES.ADAPTIVE_RADIATION) {
      return 0.65; // Much easier to establish brand new species
    }
    return 1.0;
  }

  // Reset ticks since speciation when a new species emerges
  onSpeciation() {
    this.ticksSinceLastSpeciation = 0;
  }

  getLazarusIds() {
    return Array.from(this.lazarusIds);
  }

  // Compact broadcast packet for WebSocket transmission
  getBroadcastState() {
    if (this.phase === CATACLYSM_PHASES.DORMANT) {
      return {
        active: false,
        phase: 'dormant',
        stagnationScore: Math.round(this.stagnationScore * 100) / 100
      };
    }

    const typeNames = {
      [CATACLYSM_TYPES.SULFIDE_ANOXIA]: {
        ru: 'Великий Сульфидный Замор',
        en: 'The Great Sulfide Anoxia',
        icon: '🌋',
        descRu: 'Геотермальный выброс токсичных сульфидов. Вода насыщается ядовитыми солями.',
        descEn: 'Hydrothermal eruption of toxic sulfides. Anoxia spreads through open waters.'
      },
      [CATACLYSM_TYPES.CRYO_FREEZE]: {
        ru: 'Великое Оледенение Капли',
        en: 'The Great Microscopic Ice Age',
        icon: '❄️',
        descRu: 'Криогенный шок. Ледяные иглы наступают от краев капли к центру.',
        descEn: 'Cryogenic plunge. Dendritic rime creeps from the meniscus toward the vents.'
      },
      [CATACLYSM_TYPES.UV_RADIATION]: {
        ru: 'Ультрафиолетовый Шторм',
        en: 'The Ultraviolet Photon Storm',
        icon: '⚡',
        descRu: 'Внешняя фотонная вспышка. Радиация пронизывает верхние слои капли.',
        descEn: 'External photon tempest. High-energy radiation destabilizes cellular membranes.'
      }
    };

    const info = typeNames[this.currentType] || {
      ru: 'Великий Катаклизм',
      en: 'Great Cataclysm',
      icon: '💥',
      descRu: 'Глобальное вымирание биосферы.',
      descEn: 'Global biosphere collapse.'
    };

    const progress = Math.min(1.0, this.phaseTicks / Math.max(1, this.phaseMaxTicks));

    return {
      active: true,
      phase: this.phase,
      type: this.currentType,
      progress: Math.round(progress * 1000) / 1000,
      icon: info.icon,
      nameRu: info.ru,
      nameEn: info.en,
      descRu: info.descRu,
      descEn: info.descEn,
      survivors: this.lazarusOrganisms.length || this.engine.organisms.length,
      stagnationScore: Math.round(this.stagnationScore * 100) / 100
    };
  }

  toJSON() {
    return {
      phase: this.phase,
      currentType: this.currentType,
      phaseTicks: this.phaseTicks,
      phaseMaxTicks: this.phaseMaxTicks,
      stagnationScore: this.stagnationScore,
      extinctionsCount: this.extinctionsCount,
      ticksSinceLastSpeciation: this.ticksSinceLastSpeciation,
      lastObservedDiversity: this.lastObservedDiversity,
      stagnationCooldownTicks: this.stagnationCooldownTicks,
      lazarusIds: Array.from(this.lazarusIds),
      lazarusOrganisms: this.lazarusOrganisms
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.phase = data.phase || CATACLYSM_PHASES.DORMANT;
    this.currentType = data.currentType || null;
    this.phaseTicks = data.phaseTicks || 0;
    this.phaseMaxTicks = data.phaseMaxTicks || 0;
    this.stagnationScore = data.stagnationScore || 0.0;
    this.extinctionsCount = data.extinctionsCount ?? 0;
    this.ticksSinceLastSpeciation = data.ticksSinceLastSpeciation ?? 0;
    this.lastObservedDiversity = data.lastObservedDiversity ?? 1.5;
    this.stagnationCooldownTicks = data.stagnationCooldownTicks ?? 0;
    if (Array.isArray(data.lazarusIds)) {
      this.lazarusIds = new Set(data.lazarusIds);
    }
    this.lazarusOrganisms = data.lazarusOrganisms ?? this.engine.organisms
      .filter(o => this.lazarusIds.has(o.id))
      .map(o => ({ id: o.id, speciesId: o.speciesId, hue: o.hue, size: o.size, generation: o.generation }));
  }
}
