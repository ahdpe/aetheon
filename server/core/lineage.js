export class LineageManager {
  constructor() {
    this.speciesMap = new Map();
    this.nextSpeciesId = 1;
    this.divergenceThreshold = 0.55; // Normalized genetic distance threshold for speciation
    
    // Seed initial primordial ancestor species
    this.registerPrimordialSpecies();
  }

  registerPrimordialSpecies() {
    // 1. Primordial Autotroph (Cyan grazer)
    this.createSpecies({
      nameLa: 'Aethenella luminosa',
      nameEn: 'Luminous Grazer',
      nameRu: 'Светящийся пастбищник',
      descriptionEn: 'Gentle primary producer with high chemotactic affinity for hydrothermal nutrient plumes.',
      descriptionRu: 'Мирный первичный продуцент с высоким хемотаксисом к термальным минеральным шлейфам.',
      hue: 0.52,
      carnivory: 0.05,
      size: 6.0,
      speedMax: 1.5,
      chemotaxisNutrient: 1.2
    }, 0);

    // 2. Primordial Filter-feeder (Amber weaver)
    this.createSpecies({
      nameLa: 'Chronohelix aurea',
      nameEn: 'Amber Weaver',
      nameRu: 'Янтарный ткач',
      descriptionEn: 'Slow-moving colonial organism with high membrane adhesion, forming dense feeding clusters.',
      descriptionRu: 'Медлительный колониальный организм с высокой адгезией мембраны, образующий плотные кластеры.',
      hue: 0.12,
      carnivory: 0.0,
      size: 7.5,
      speedMax: 1.0,
      chemotaxisNutrient: 0.9
    }, 0);

    // 3. Primordial Hunter (Phosphor stalker)
    this.createSpecies({
      nameLa: 'Vibrionox vorax',
      nameEn: 'Emerald Stalker',
      nameRu: 'Изумрудный ловчий',
      descriptionEn: 'Agile solitary hunter possessing chiral ciliary propulsion and predatory phase shearing.',
      descriptionRu: 'Быстрый одиночный охотник с киральным биением ресничек и хищным фазовым расщеплением.',
      hue: 0.35,
      carnivory: 0.75,
      size: 10.0,
      speedMax: 3.2,
      chemotaxisNutrient: 0.1
    }, 0);
  }

  createSpecies(data, parentSpeciesId = 0) {
    const id = this.nextSpeciesId++;
    const species = {
      id,
      parentSpeciesId,
      nameLa: data.nameLa || `Specimen-${id}`,
      nameEn: data.nameEn || `Aetheobiont #${id}`,
      nameRu: data.nameRu || `Этеобионт #${id}`,
      descriptionEn: data.descriptionEn || 'Newly emerged evolutionary branch.',
      descriptionRu: data.descriptionRu || 'Вновь возникшая эволюционная ветвь.',
      hue: data.hue,
      carnivory: data.carnivory,
      size: data.size,
      speedMax: data.speedMax,
      chemotaxisNutrient: data.chemotaxisNutrient,
      birthTime: Date.now(),
      extinctTime: null,
      population: 0,
      peakPopulation: 0,
      totalCount: 0,
      aiChronicle: null
    };

    this.speciesMap.set(id, species);
    return species;
  }

  // Calculate Euclidean genetic distance between an organism's genome and a species prototype
  calcGeneticDistance(genome, species) {
    const dHue = Math.abs(genome.hue - species.hue);
    const cyclicDHue = Math.min(dHue, 1.0 - dHue);
    const dCarnivory = Math.abs(genome.carnivory - species.carnivory);
    const dSize = Math.abs(genome.size - species.size) / 10.0;
    const dSpeed = Math.abs(genome.speedMax - species.speedMax) / 3.0;

    return Math.sqrt(
      cyclicDHue * cyclicDHue * 2.0 +
      dCarnivory * dCarnivory * 1.5 +
      dSize * dSize +
      dSpeed * dSpeed
    );
  }

  // Check if daughter organism has diverged enough to form a new species
  evaluateSpeciation(childGenome, parentSpeciesId) {
    const parentSpecies = this.speciesMap.get(parentSpeciesId);
    if (!parentSpecies) return parentSpeciesId;

    const dist = this.calcGeneticDistance(childGenome, parentSpecies);
    
    if (dist > this.divergenceThreshold) {
      // Divergence detected! Form a new species branch
      const isCarnivore = childGenome.carnivory > 0.4;
      const hueDegree = Math.round(childGenome.hue * 360);
      
      const newSpecies = this.createSpecies({
        nameLa: `Forma-${this.nextSpeciesId} ${isCarnivore ? 'carnivora' : 'phyta'}`,
        nameEn: `${isCarnivore ? 'Predatory' : 'Vegetal'} Morph #${this.nextSpeciesId}`,
        nameRu: `${isCarnivore ? 'Хищный' : 'Растительный'} морф #${this.nextSpeciesId}`,
        hue: childGenome.hue,
        carnivory: childGenome.carnivory,
        size: childGenome.size,
        speedMax: childGenome.speedMax,
        chemotaxisNutrient: childGenome.chemotaxisNutrient
      }, parentSpeciesId);

      return newSpecies.id;
    }

    return parentSpeciesId;
  }

  updatePopulations(organisms) {
    // Reset live population counts
    for (const species of this.speciesMap.values()) {
      species.population = 0;
    }

    // Count live organisms per species
    for (let i = 0; i < organisms.length; i++) {
      const sp = this.speciesMap.get(organisms[i].speciesId);
      if (sp) {
        sp.population++;
        sp.totalCount++;
        if (sp.population > sp.peakPopulation) {
          sp.peakPopulation = sp.population;
        }
      }
    }

    // Mark extinctions
    const now = Date.now();
    for (const species of this.speciesMap.values()) {
      if (species.population === 0 && !species.extinctTime && species.totalCount > 10) {
        species.extinctTime = now;
      }
    }
  }

  getSpecies(id) {
    return this.speciesMap.get(id);
  }

  getAllSpecies() {
    return Array.from(this.speciesMap.values());
  }

  getRecentSpecies(limit = 10) {
    return Array.from(this.speciesMap.values())
      .sort((a, b) => b.birthTime - a.birthTime)
      .slice(0, limit);
  }
}
