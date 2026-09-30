import { CONFIG } from '../config.js';

export class AINaturalist {
  constructor(lineageManager) {
    this.lineageManager = lineageManager;
    this.journalEntries = [];
    this.currentEpoch = 1;
    this.epochNameEn = 'Primordial Genesis';
    this.epochNameRu = 'Первичный Генезис';
    this.lastObservationTime = 0;
    this.totalApiCalls = 0;
    
    // Seed initial observation
    this.addEntry({
      type: 'epoch',
      titleEn: 'Epoch I: Primordial Genesis',
      titleRu: 'Эпоха I: Первичный Генезис',
      contentEn: 'The interfacial reactor has stabilized. Three ancestral archetypes have emerged around the geothermal mineral vents: the autotrophic grazers, the colonial weavers, and the chiral predators.',
      contentRu: 'Межфазный реактор стабилизировался. Вокруг геотермальных жерл возникли три первичных архетипа: автотрофные пастбищники, колониальные ткачи и киральные охотники.',
      timestamp: Date.now()
    });
  }

  addEntry(entry) {
    entry.id = this.journalEntries.length + 1;
    this.journalEntries.unshift(entry); // newest first
    if (this.journalEntries.length > 60) {
      this.journalEntries.pop();
    }
  }

  getRecentEntries(limit = 15) {
    return this.journalEntries.slice(0, limit);
  }

  // Periodic observation check
  async checkObservation(engineStats) {
    const now = Date.now();
    if (now - this.lastObservationTime < CONFIG.AI_OBSERVER_INTERVAL_MS) {
      return;
    }
    this.lastObservationTime = now;

    // Identify candidate species needing AI taxonomy
    const allSpecies = this.lineageManager.getAllSpecies();
    const unchronicled = allSpecies.find(s => !s.aiChronicle && s.totalCount > 15 && s.population > 3);

    if (unchronicled) {
      await this.chronicleSpecies(unchronicled, engineStats);
    } else {
      await this.chronicleEcosystem(engineStats);
    }
  }

  // Describe a newly stabilized species
  async chronicleSpecies(species, engineStats) {
    const isVeniceAvailable = Boolean(CONFIG.VENICE_API_KEY && CONFIG.VENICE_API_KEY.trim().length > 0);

    if (isVeniceAvailable) {
      try {
        const response = await this.queryVeniceAI({
          prompt: `You are the Autonomous Xenobiologist observing a 24/7 living digital ocean called AETHEON.
A newly evolved species has stabilized:
- ID: ${species.id}
- Ancestor ID: ${species.parentSpeciesId}
- Hue: ${Math.round(species.hue * 360)}°
- Predation ratio: ${Math.round(species.carnivory * 100)}% (${species.carnivory > 0.5 ? 'carnivore/hunter' : 'grazer/autotroph'})
- Speed: ${Math.round(species.speedMax * 10) / 10}
- Size: ${Math.round(species.size * 10) / 10}
- Current Population: ${species.population}

Provide a short taxonomy entry:
1. Scientific Latin name (2 words, e.g. "Siphonocirrus vorax")
2. English common name (2-3 words)
3. Russian common name (2-3 words)
4. A poetic, scientifically rigorous 1-2 sentence description in English.
5. A poetic, scientifically rigorous 1-2 sentence description in Russian.

Return ONLY a JSON object:
{"nameLa": "...", "nameEn": "...", "nameRu": "...", "descEn": "...", "descRu": "..."}`
        });

        if (response && response.nameLa) {
          species.nameLa = response.nameLa;
          species.nameEn = response.nameEn;
          species.nameRu = response.nameRu;
          species.descriptionEn = response.descEn;
          species.descriptionRu = response.descRu;
          species.aiChronicle = true;

          this.addEntry({
            type: 'species',
            speciesId: species.id,
            titleEn: `New Species Cataloged: ${species.nameLa}`,
            titleRu: `Зарегистрирован новый вид: ${species.nameLa}`,
            contentEn: `${species.nameEn} (${species.nameLa}): ${species.descriptionEn}`,
            contentRu: `${species.nameRu} (${species.nameLa}): ${species.descriptionRu}`,
            timestamp: Date.now()
          });
          return;
        }
      } catch (err) {
        console.warn('[AI Naturalist] Venice API call failed, falling back to procedural engine:', err.message);
      }
    }

    // High-quality procedural fallback engine (zero cost, immediate, poetic)
    this.generateProceduralSpeciesChronicle(species);
  }

  generateProceduralSpeciesChronicle(species) {
    const isHunter = species.carnivory > 0.5;
    const isGrazer = species.carnivory < 0.2;
    const isOmni = !isHunter && !isGrazer;

    let latinGenus = isHunter ? 'Vibrionox' : (isGrazer ? 'Aethenella' : 'Chronohelix');
    let latinSpecies = isHunter ? 'chiralis' : (species.size > 9 ? 'magnifica' : 'microstoma');
    
    if (species.speedMax > 2.5) latinSpecies = 'velox';
    else if (species.hue > 0.8) latinSpecies = 'purpurea';
    else if (species.hue < 0.2) latinSpecies = 'aurata';

    let enName = isHunter ? `Luminous Stalker #${species.id}` : (isGrazer ? `Bioluminescent Grazer #${species.id}` : `Chimera Polyp #${species.id}`);
    let ruName = isHunter ? `Светящийся ловец #${species.id}` : (isGrazer ? `Биолюминесцентный пастбищник #${species.id}` : `Химерный полип #${species.id}`);

    let descEn = isHunter
      ? `A swift predatory soliton exhibiting aggressive ciliary steering and hunting smaller grazers near fluid currents.`
      : `An autotrophic organism that thrives near hydrothermal mineral plumes, dissipating gentle bioluminescence.`;

    let descRu = isHunter
      ? `Быстрый хищный солитон с агрессивным маневрированием жгутиками, охотящийся на пастбищников вблизи течений.`
      : `Автотрофный организм, процветающий у гидротермальных минеральных источников и излучающий мягкий фосфорный свет.`;

    species.nameLa = `${latinGenus} ${latinSpecies}`;
    species.nameEn = enName;
    species.nameRu = ruName;
    species.descriptionEn = descEn;
    species.descriptionRu = descRu;
    species.aiChronicle = true;

    this.addEntry({
      type: 'species',
      speciesId: species.id,
      titleEn: `Field Codex: ${species.nameLa}`,
      titleRu: `Полевой журнал: ${species.nameLa}`,
      contentEn: `${species.nameEn} (${species.nameLa}): ${descEn}`,
      contentRu: `${species.nameRu} (${species.nameLa}): ${descRu}`,
      timestamp: Date.now()
    });
  }

  // Periodic ecosystem status chronicle
  async chronicleEcosystem(stats) {
    const entryEn = `Substrate equilibrium check: ${stats.organismCount} active resonators across ${stats.speciesCount} distinct lineages. Mean fluid energy density is stable at ${(stats.meanEnergy || 50).toFixed(1)} eu.`;
    const entryRu = `Анализ субстратного равновесия: ${stats.organismCount} активных резонаторов в ${stats.speciesCount} эволюционных линиях. Средняя плотность энергии стабильна на уровне ${(stats.meanEnergy || 50).toFixed(1)} э.е.`;

    this.addEntry({
      type: 'observation',
      titleEn: `Ecosystem Dispatch (Generation #${stats.generation || 1})`,
      titleRu: `Сводка экосистемы (Поколение #${stats.generation || 1})`,
      contentEn: entryEn,
      contentRu: entryRu,
      timestamp: Date.now()
    });
  }

  // Venice AI HTTPS call
  async queryVeniceAI({ prompt }) {
    if (!CONFIG.VENICE_API_KEY) return null;
    this.totalApiCalls++;

    const res = await fetch(CONFIG.VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.VENICE_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.VENICE_MODEL,
        messages: [
          { role: 'system', content: 'You are an autonomous xenobiology system monitoring a digital artificial life biome. You speak with scientific poetic elegance. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      throw new Error(`Venice API responded with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }
}
