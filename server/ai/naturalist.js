import { VeniceBudget } from './budget.js';
import { CONFIG } from '../config.js';

export class AINaturalist {
  constructor(lineageManager) {
    this.lineageManager = lineageManager;
    this.journalEntries = [];
    this.currentEpoch = 1;
    this.epochNameEn = 'The Primordial Dawn';
    this.epochNameRu = 'Первичный Рассвет';
    this.lastObservationTime = Date.now();
    this.lastJevScreenTime = 0;
    this.totalApiCalls = 0;
    this.budget = new VeniceBudget();
    this.observationBusy = false;
    this.totalJevCalls = 0;
    
    // Seed initial poetic observation
    this.addEntry({
      type: 'epoch',
      icon: '🌅',
      badgeEn: 'Epoch Milestone',
      badgeRu: 'Эпоха I',
      titleEn: 'Epoch I: The Primordial Dawn',
      titleRu: 'Эпоха I: Первичный Рассвет',
      contentEn: 'Life has sparked in the depths of our microscopic droplet. Around five warm mineral vents, the first delicate creatures drift peacefully, pulsing with gentle emerald light and taking their first rhythmic strokes.',
      contentRu: 'В глубинах нашей микрокапли зародилась жизнь. Вокруг пяти теплых минеральных источников собрались первые хрупкие создания: они мерцают мягким изумрудным светом и делают свои первые робкие гребки.',
      insightEn: 'The cradle of life is stable. Organisms feed, hunt and divide around resource gradients. Their descendants inherit mutating traits.',
      insightRu: 'Колыбель жизни стабильна. Организмы питаются, охотятся и делятся у источников ресурсов. Потомки наследуют изменяющиеся признаки.',
      timestamp: Date.now()
    });
  }

  advanceEpoch(nameRu, nameEn) {
    this.currentEpoch++;
    this.epochNameRu = nameRu;
    this.epochNameEn = nameEn;
    console.log(`[AINaturalist] Advanced to Epoch ${this.currentEpoch}: ${nameRu} / ${nameEn}`);
  }

  async chronicleCataclysm(type, phase, stats, details = null) {
    const isSulfide = type === 'sulfide_anoxia';
    const isCryo = type === 'cryo_freeze';
    const isUV = type === 'uv_radiation';

    let icon = '💥';
    let badgeRu = '⚠️ ВЕЛИКОЕ ВЫМИРАНИЕ';
    let badgeEn = '⚠️ GREAT EXTINCTION';
    let titleRu = '';
    let titleEn = '';
    let contentRu = '';
    let contentEn = '';
    let insightRu = '';
    let insightEn = '';

    if (phase === 'premonition') {
      icon = isSulfide ? '🌋' : (isCryo ? '❄️' : '⚡');
      badgeRu = '⚠️ ПРЕДВЕСТИЕ КАТАКЛИЗМА';
      badgeEn = '⚠️ CATACLYSM WARNING';

      if (isSulfide) {
        titleRu = 'Сейсмические толчки гидротермального дна';
        titleEn = 'Hydrothermal Benthic Tremors';
        contentRu = 'Датчики фиксируют критическое нарастание давления в магматических каналах. Из глубоководных жерл начинают подниматься темные шлейфы тяжелых сульфидов. Океан замер в тревожном ожидании...';
        contentEn = 'Telemetry detects a critical pressure surge within the magmatic conduits. Dark plumes of heavy sulfides begin billowing from deep vents. The ocean holds its breath in tense stillness...';
        insightRu = 'Организмы в открытой толще воды оказываются под угрозой. Самые безопасные зоны — глубокие рифовые расщелины.';
        insightEn = 'Organisms in open water are most vulnerable. Deep reef crevices offer the only stable sanctuary.';
      } else if (isCryo) {
        titleRu = 'Дендритный иней на границе капли';
        titleEn = 'Dendritic Frost at the Droplet Rim';
        contentRu = 'Температура внешней среды стремительно падает. Поверхностное натяжение капли покрывается кристаллической коркой льда. Водяной объем сжимается, оттесняя жизнь к теплым жерлам.';
        contentEn = 'Ambient laboratory temperature drops sharply. The droplet surface tension begins encrusting with crystalline ice. Life is driven back towards the warmth of thermal vents.';
        insightRu = 'Только существа, находящиеся вблизи термальных источников, смогут сохранить тепло и избежать оледенения.';
        insightEn = 'Only organisms clustered around the warm hydrothermal chimneys will survive the freeze.';
      } else {
        titleRu = 'Ионизационная вспышка фотонного шторма';
        titleEn = 'Ionization Flare: Photon Tempest';
        contentRu = 'Свет лабораторного микроскопа вспыхнул ослепительным высокоэнергетическим спектром. Ионизирующее излучение пронзает верхние слои капли, дестабилизируя липидные мембраны.';
        contentEn = 'The laboratory illuminator flashes with a blinding high-energy spectrum. Ionizing radiation penetrates the surface waters, destabilizing fragile lipid membranes.';
        insightRu = 'Высокая радиация смертельна для большинства, но вызывает взрывные мутации у наиболее стойких особей.';
        insightEn = 'Intense radiation proves lethal to the majority, but sparks explosive mutations in the hardiest survivors.';
      }
    } else if (phase === 'crisis') {
      icon = '💀';
      badgeRu = '⚠️ ПИК ВЫМИРАНИЯ';
      badgeEn = '⚠️ EXTINCTION PEAK';

      titleRu = `Начало кризиса: ${stats?.organismCount ?? 0} живых особей`;
      titleEn = `Crisis begins: ${stats?.organismCount ?? 0} living organisms`;
      contentRu = 'Началась острая фаза внешнего воздействия. Итоговые потери ещё не измерены; наблюдайте за выживанием в разных участках океана.';
      contentEn = 'The acute phase of the external disturbance has begun. Final losses have not yet been measured; observe survival across habitats.';
      insightRu = 'Массовая гибель очищает экологическое пространство, подготавливая почву для взрывного скачка новой жизни.';
      insightEn = 'Mass mortality clears out stagnant monopolies, preparing the stage for an explosive radiation of novel life.';
    } else if (phase === 'lazarus_dawn') {
      icon = '👑';
      badgeRu = '🌅 ЛАЗАРЬ-ТАКСОНЫ • НОВАЯ ЭРА';
      badgeEn = '🌅 LAZARUS TAXA • NEW ERA';

      const survivorCount = Array.isArray(details) ? details.length : 5;
      titleRu = `Эпоха ${this.currentEpoch}: Заря первопредков (${survivorCount} Лазаря)`;
      titleEn = `Epoch ${this.currentEpoch}: Dawn of the Pioneers (${survivorCount} Lazarus Taxa)`;
      contentRu = `Океан пережил катастрофу. В опустевших водах капли выжили лишь ${survivorCount} уникальных первопредков-Лазарей. Они унаследовали весь мир, богатый распавшимся био-детритом. Начинается Эпоха ${this.currentEpoch}: «${this.epochNameRu}».`;
      contentEn = `The ocean has endured. In the emptied waters, only ${survivorCount} heroic Lazarus pioneers remain. They inherit an entire droplet enriched by the fallen world. Welcome to Epoch ${this.currentEpoch}: "${this.epochNameEn}".`;
      insightRu = 'Эти выжившие дадут начало следующим поколениям. Дополнительный спонтанный спавн создаёт отдельные исходные линии.';
      insightEn = 'These survivors seed the next generation. Any additional spontaneous arrivals are separate founder lines.';
    } else if (phase === 'radiation') {
      icon = '✨';
      badgeRu = '🧬 КЕМБРИЙСКИЙ ВЗРЫВ';
      badgeEn = '🧬 CAMBRIAN EXPLOSION';

      titleRu = 'Адаптивная радиация: Вспышка видообразования';
      titleEn = 'Adaptive Radiation: Speciation Burst';
      contentRu = 'Началась экспериментальная фаза восстановления: модель усиливает мутации и подачу питания. Выжившие могут дать начало новым сочетаниям признаков; устойчивость этих линий ещё предстоит проверить.';
      contentEn = 'An experimental recovery phase begins: the model increases mutation and nutrient supply. Survivors may produce new combinations of traits; their long-term stability remains to be measured.';
      insightRu = 'Разнообразие и устойчивость потомков будут измеряться в следующих поколениях.';
      insightEn = 'The survivors are reproducing. Whether diverse stable lineages recover will be measured over subsequent generations.';
    }

    this.addEntry({
      type: 'cataclysm',
      icon,
      badgeRu,
      badgeEn,
      titleRu,
      titleEn,
      contentRu,
      contentEn,
      insightRu,
      insightEn,
      timestamp: Date.now()
    });
    this.lastObservationTime = Date.now();
  }

  recordFounderDynasty(speciesNameRu, speciesNameEn, founderName, hue = 0.5) {
    this.addEntry({
      type: 'dynasty',
      icon: '👑',
      badgeEn: 'Avatar Dynasty',
      badgeRu: 'Династия Аватара',
      titleEn: `Observer "${founderName}" Founds Lineage Branch`,
      titleRu: `Наблюдатель «${founderName}» основывает династическую ветвь`,
      contentEn: `Direct psychic resonance established. Through sustained ciliary piloting, Observer "${founderName}" has steered the evolutionary fate of a specimen of ${speciesNameEn}. The direct lineage (Gen F1) now bears the founder's seal.`,
      contentRu: `Установлен прямой контакт с аватаром. Управляя особью более 30 секунд, Наблюдатель «${founderName}» направил эволюционную траекторию особи «${speciesNameRu}». Прямая ветвь потомков (пок. F1) наследует имя династии.`,
      insightEn: `The named branch follows the same metabolic rules as wild organisms; each division advances its generation.`,
      insightRu: `Прямые потомки особи наследуют повышенный метаболический КПД и наращивают поколения (F1, F2...) при митозе.`,
      timestamp: Date.now()
    });
    this.lastObservationTime = Date.now();
  }

  recordDynastyExtinction(dynastyName, speciesNameRu, speciesNameEn, maxGen, peakMembers, lifetimeMins, hue = 0.5) {
    this.addEntry({
      type: 'dynasty_extinct',
      icon: '🏛️',
      badgeEn: 'Hall of Fame',
      badgeRu: 'Зал Славы Династий',
      titleEn: `Dynasty "${dynastyName}" Enters Hall of Fame`,
      titleRu: `Династия «${dynastyName}» уходит в Зал Славы`,
      contentEn: `The genealogical branch of "${dynastyName}" (${speciesNameEn}) has concluded its cycle after ${maxGen} generations, achieving a peak population of ${peakMembers} living cells over ${lifetimeMins} minutes. Its deeds are permanently enshrined in the Dynasty Hall of Fame.`,
      contentRu: `Генеалогическая ветвь «${dynastyName}» вида «${speciesNameRu}» завершила свой жизненный путь, прожив ${maxGen} поколений с пиком в ${peakMembers} особей за ${lifetimeMins} мин. Династия навечно занесена в Зал Славы.`,
      insightEn: `Wild specimens of the species continue to thrive in the ocean, ready for future observers to guide them.`,
      insightRu: `Дикие представители вида продолжают жить в чаше, готовые принять руководство будущих наблюдателей.`,
      timestamp: Date.now()
    });
    this.lastObservationTime = Date.now();
  }

  addEntry(entry) {
    if (!entry) return;

    // Strict title and semantic deduplication
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
    const newTitleEn = norm(entry.titleEn);
    const newTitleRu = norm(entry.titleRu);

    const isDuplicate = this.journalEntries.some(existing => {
      const exTitleEn = norm(existing.titleEn);
      const exTitleRu = norm(existing.titleRu);
      if (newTitleEn && exTitleEn && (newTitleEn === exTitleEn || exTitleEn.includes(newTitleEn) || newTitleEn.includes(exTitleEn))) {
        return true;
      }
      if (newTitleRu && exTitleRu && (newTitleRu === exTitleRu || exTitleRu.includes(newTitleRu) || newTitleRu.includes(exTitleRu))) {
        return true;
      }
      return false;
    });

    if (isDuplicate) {
      console.log(`[AINaturalist] Suppressed duplicate journal dispatch: "${entry.titleEn || entry.titleRu}"`);
      return;
    }

    entry.id = Date.now();
    this.journalEntries.unshift(entry); // newest first
    if (this.journalEntries.length > 60) {
      this.journalEntries.pop();
    }
    if (typeof this.onNewEntry === 'function') {
      try {
        this.onNewEntry(entry);
      } catch (err) {
        console.error('[AINaturalist] Error in onNewEntry callback:', err);
      }
    }
  }

  getRecentEntries(limit = 15) {
    return this.journalEntries.slice(0, limit);
  }

  // Periodic observation check with JEV decision gatekeeper
  async checkObservation(engineStats) {
    if (this.observationBusy) return false;
    this.observationBusy = true;
    try { return await this.checkObservationOnce(engineStats); }
    finally { this.observationBusy = false; }
  }

  async checkObservationOnce(engineStats) {
    const now = Date.now();
    const minutesSinceLastDispatch = (now - this.lastObservationTime) / 60000;

    // 1. Identify newly stabilized species needing taxonomic christening (requires min 5 min cooldown)
    if (minutesSinceLastDispatch >= 120) {
      const allSpecies = this.lineageManager.getCatalogSpecies();
      const unchronicled = allSpecies.find(s => !s.aiChronicle && s.totalCount > 12 && s.population > 2);

      if (unchronicled) {
        await this.chronicleSpecies(unchronicled, engineStats);
        this.lastObservationTime = now;
        return true;
      }
    }

    // 2. Rate limit JEV screening interval
    const screeningInterval = CONFIG.JEV_SCREENING_INTERVAL_MS || 60000;
    if (now - this.lastJevScreenTime < screeningInterval) {
      return false;
    }
    this.lastJevScreenTime = now;

    // 3. Minimum cooldown between published journal entries (20 minutes)
    if (minutesSinceLastDispatch < 20) {
      return false;
    }

    // 4. Local pre-screen: strictly filter out routine background noise (like routine cell births)
    const kills = engineStats.recentKills || 0;
    const speciations = engineStats.recentSpeciations || 0;
    const colonyCount = engineStats.colonyCount || 0;

    // Only genuine milestones qualify:
    // - New speciation branch
    // - Apex hunting rampage (10+ kills)
    // - Multicellular supercolony expansion (4+ colonies)
    // - Or rare deep ecological contemplation after 35+ minutes of silence
    const hasSignificantEvent = speciations > 0 || kills >= 10 || colonyCount >= 4;
    const longSilence = minutesSinceLastDispatch >= 35;

    if (!hasSignificantEvent && !longSilence) {
      return false; // Skip ordinary baseline noise
    }

    // 5. Screen ecosystem dynamics with JEV micro-decisions
    const jevVerdict = await this.screenWithJev(engineStats, minutesSinceLastDispatch);

    if (jevVerdict && jevVerdict.shouldPublish) {
      // Extra confidence gate: low-confidence JEV publish requires longer silence
      if (jevVerdict.confidence < 0.6 && minutesSinceLastDispatch < 15) {
        return false; // Low confidence + recent publish → skip
      }
      await this.chronicleEcosystem(engineStats, jevVerdict);
      this.lastObservationTime = now;
      return true;
    }

    // 6. Safety fallback if JEV is offline/unreachable and maximum quiet interval has elapsed
    if (!jevVerdict && (now - this.lastObservationTime >= CONFIG.AI_OBSERVER_INTERVAL_MS)) {
      await this.chronicleEcosystem(engineStats, null);
      this.lastObservationTime = now;
      return true;
    }

    return false;
  }

  // Ultra-fast micro-decision screening using Venice Decisions API (TypeSafe Jev)
  async screenWithJev(stats, minutesSinceLastDispatch) {
    if (!CONFIG.VENICE_API_KEY || !CONFIG.VENICE_DECISIONS_URL) {
      return null;
    }

    const t0 = Date.now();
    this.totalJevCalls = (this.totalJevCalls || 0) + 1;

    const state = {
      recentKills: stats.recentKills || 0,
      recentBirths: stats.recentBirths || 0,
      recentSpeciations: stats.recentSpeciations || 0,
      organismCount: stats.organismCount || 0,
      speciesCount: stats.speciesCount || 0,
      dominantSpecies: stats.dominantSpeciesNameRu || stats.dominantSpeciesNameEn || 'Unknown',
      dominantCount: stats.dominantCount || 0,
      topApexPredator: stats.topPredatorNameRu || stats.topPredatorNameEn || 'None',
      minutesSinceLastDispatch: Math.round(minutesSinceLastDispatch * 10) / 10
    };

    const questions = {
      should_publish: {
        type: 'choice',
        instructions: 'Should this ecological interval be published as a journal dispatch for visitors, or skipped as routine baseline?',
        criteria: {
          publish: 'Speciation branch event, severe apex predator wave (10+ kills), multicellular supercolony, or 35+ min tranquil equilibrium milestone',
          skip: 'Routine cell divisions/mitosis, minor predatory grazing, and background population fluctuations'
        }
      },
      editorial_focus: {
        type: 'choice',
        instructions: 'What is the primary driving drama or theme of this ecosystem moment?',
        criteria: {
          speciation_branch: 'A new lineage or species has adapted and split off',
          predation_hunt: 'Apex predators striking in high numbers in open water',
          reef_architecture: 'Colonies and bio-calcite mineral reefs growing around vents',
          tranquil_equilibrium: 'Deep peaceful harmony and rhythmic metabolic drifting'
        }
      },
      urgency_level: {
        type: 'score',
        instructions: 'Rate the urgency and drama of this moment from 0 (calm) to 2 (intense crisis or milestone).',
        criteria: ['calm / baseline', 'moderate activity', 'high drama']
      }
    };

    try {
      const data = await this.budget.request('decision', CONFIG.VENICE_DECISIONS_URL, {
        model: CONFIG.JEV_MODEL || 'jev-latest', state, questions
      });
      if (!data) return null;
      const answers = data.answers || {};
      const shouldPublishChoice = answers.should_publish?.choice;
      const editorialFocus = answers.editorial_focus?.choice || 'tranquil_equilibrium';
      const confidence = answers.should_publish?.confidence ?? 0.5;
      const latency = Date.now() - t0;

      // Publish if JEV selected publish OR if maximum silence exceeded
      const shouldPublish = shouldPublishChoice === 'publish';

      console.log(`[JEV Screener] Verdict: ${shouldPublishChoice} (${shouldPublish ? 'PUBLISH' : 'SKIP'}, conf: ${confidence}), Focus: ${editorialFocus} (${latency}ms)`);

      return {
        shouldPublish,
        choice: shouldPublishChoice,
        editorialFocus,
        confidence,
        probabilities: answers.should_publish?.probabilities || {},
        latency
      };
    } catch (err) {
      console.warn(`[JEV Screener] Decision request failed (${err.message}), using procedural fallback`);
      return null;
    }
  }

  // Describe a newly stabilized species
  async chronicleSpecies(species, engineStats) {
    const isVeniceAvailable = Boolean(CONFIG.VENICE_API_KEY && CONFIG.VENICE_API_KEY.trim().length > 0);

    if (isVeniceAvailable) {
      try {
        const isHunter = species.carnivory > 0.35;
        const prompt = `A newly evolved species has stabilized in the living microscopic ocean:
- Species ID: ${species.id}
- Ancestor ID: ${species.parentSpeciesId}
- Color hue: ${Math.round(species.hue * 360)}°
- Feeding rule: ${isHunter ? 'Can attack neighbors and absorb dissolved nutrients; carnivory is a numerical trait' : 'Absorbs dissolved nutrients; no photosynthesis is simulated'}
- Speed: ${Math.round(species.speedMax * 10) / 10} μm/step
- Body Size: ${Math.round(species.size * 10) / 10} μm
- Current Population: ${species.population}

Provide an engaging natural history entry in JSON:
1. "nameLa": Latin binomial name (e.g. "Vibrionox velox")
2. "nameEn": English common name (e.g. "Crimson Dart")
3. "nameRu": Russian common name (e.g. "Алый стрелочник")
4. "icon": emoji (e.g. ⚔️ for predator, 🌿 for grazer)
5. "titleEn": Short engaging title with emoji
6. "titleRu": Краткий увлекательный заголовок с эмодзи
7. "storyEn": 2 captivating, documentary-style sentences in English describing their behavior and beauty.
8. "storyRu": 2 захватывающих, художественных предложения на русском о повадках и жизни вида.
9. "insightEn": 1 simple sentence explaining what this species brings to the ecosystem.
10. "insightRu": 1 простое предложение: что появление этого вида значит для экосистемы.

JSON ONLY, NO MARKDOWN.`;

        const response = await this.queryVeniceAI({ prompt });

        if (response && response.nameLa) {
          species.nameLa = response.nameLa;
          species.nameEn = response.nameEn || species.nameLa;
          species.nameRu = response.nameRu || species.nameLa;
          species.descriptionEn = response.storyEn || response.descEn || '';
          species.descriptionRu = response.storyRu || response.descRu || '';
          species.aiChronicle = true;

          this.addEntry({
            type: 'species',
            icon: response.icon || (isHunter ? '⚔️' : '🌿'),
            badgeEn: isHunter ? 'New Predator' : 'New Grazer',
            badgeRu: isHunter ? 'Новый хищник' : 'Новый пастбищник',
            speciesId: species.id,
            species: {
              id: species.id,
              hue: species.hue,
              size: species.size,
              carnivory: species.carnivory,
              speedMax: species.speedMax,
              nameLa: species.nameLa,
              nameRu: species.nameRu,
              nameEn: species.nameEn
            },
            titleEn: response.titleEn || `New Species: ${species.nameLa}`,
            titleRu: response.titleRu || `Зарегистрирован новый вид: ${species.nameRu}`,
            contentEn: response.storyEn || response.descEn || `${species.nameEn} (${species.nameLa}) has emerged.`,
            contentRu: response.storyRu || response.descRu || `${species.nameRu} (${species.nameLa}) появился в чаше.`,
            insightEn: response.insightEn || 'A new branch on the tree of life has adapted to the micro-ocean.',
            insightRu: response.insightRu || 'Новая ветвь эволюционного древа успешно закрепилась в капле.',
            timestamp: Date.now()
          });
          return;
        }
      } catch (err) {
        console.warn('[AI Naturalist] Venice API call failed, using procedural storyteller:', err.message);
      }
    }

    // High-quality procedural fallback engine (poetic, engaging, accessible)
    this.generateProceduralSpeciesChronicle(species);
  }

  generateProceduralSpeciesChronicle(species) {
    const isHunter = species.carnivory > 0.35;
    const isGrazer = species.carnivory < 0.25;
    const isLarge = species.size > 9.0;
    const isFast = species.speedMax > 2.2;

    let icon = isHunter ? '⚔️' : (isLarge ? '🐋' : (isFast ? '⚡' : '🌿'));
    let badgeEn = isHunter ? 'Predatory Morph' : 'New Lineage';
    let badgeRu = isHunter ? 'Хищный морф' : 'Новая линия';

    let latinGenus, latinSpecies, enName, ruName, storyEn, storyRu, insightEn, insightRu;

    if (isHunter) {
      latinGenus = isFast ? 'Vibrionox' : 'Acanthostoma';
      latinSpecies = isFast ? 'velox' : (isLarge ? 'tyrannus' : 'atrox');
      enName = isFast ? 'Swift Pursuer' : 'Drifting Hunter';
      ruName = isFast ? 'Быстрый преследователь' : 'Дрейфующий ловец';

      storyEn = `A predatory form has been registered: it can pursue neighbors while also absorbing dissolved nutrients. Its recorded speed limit is ${species.speedMax.toFixed(1)} world units per step; ${species.population} organisms currently belong to this form.`;
      storyRu = `Зарегистрирован хищный морф: он способен преследовать соседей и поглощать растворённые питательные вещества. Предельная скорость образца — ${species.speedMax.toFixed(1)} единицы мира за шаг; сейчас к этой форме относятся ${species.population} особей.`;

      insightEn = `Hunting creates a possible advantage for escape speed, but the outcome depends on energy costs and the local environment.`;
      insightRu = `Охота может давать преимущество скорости бегства; результат зависит от расхода энергии и местной среды.`;
    } else if (isLarge) {
      latinGenus = 'Chronohelix';
      latinSpecies = 'magnifica';
      enName = 'Emerald Leviathan';
      ruName = 'Изумрудный исполин';

      storyEn = `A broad-bodied form joins the ocean: the registered prototype has size ${species.size.toFixed(1)} and speed limit ${species.speedMax.toFixed(1)} world units per step. Follow its descendants to see whether this combination persists.`;
      storyRu = `В океане зарегистрирована крупная форма: размер образца — ${species.size.toFixed(1)}, предел скорости — ${species.speedMax.toFixed(1)} единицы мира за шаг. Наблюдайте за потомками, чтобы узнать, сохранится ли это сочетание.`;

      insightEn = `Size influences encounters and metabolic cost; it does not guarantee longevity.`;
      insightRu = `Размер влияет на столкновения и расход энергии, но не гарантирует долгой жизни.`;
    } else {
      latinGenus = 'Aethenella';
      latinSpecies = isFast ? 'fugax' : (species.hue < 0.2 ? 'aurata' : 'microstoma');
      enName = isFast ? 'Golden Water-Dancer' : 'Sunlit Grazer';
      ruName = isFast ? 'Золотой плясун' : 'Солнечный пастбищник';

      storyEn = `A nutrient-feeding form has been registered, with size ${species.size.toFixed(1)} and speed limit ${species.speedMax.toFixed(1)} world units per step. Its path follows local resource gradients, currents and neighboring organisms.`;
      storyRu = `Зарегистрирована форма, питающаяся растворёнными веществами: размер образца — ${species.size.toFixed(1)}, предел скорости — ${species.speedMax.toFixed(1)} единицы мира за шаг. Её путь зависит от местного питания, течений и соседей.`;

      insightEn = `The model supplies nutrients at vents; it does not simulate conversion of heat into biomass.`;
      insightRu = `Модель подаёт питание у источников; превращение тепла в биомассу здесь не моделируется.`;
    }

    species.nameLa = `${latinGenus} ${latinSpecies}`;
    species.nameEn = enName;
    species.nameRu = ruName;
    species.descriptionEn = storyEn;
    species.descriptionRu = storyRu;
    species.aiChronicle = true;

    this.addEntry({
      type: 'species',
      icon,
      badgeEn,
      badgeRu,
      speciesId: species.id,
      species: {
        id: species.id,
        hue: species.hue,
        size: species.size,
        carnivory: species.carnivory,
        speedMax: species.speedMax,
        nameLa: species.nameLa,
        nameRu: species.nameRu,
        nameEn: species.nameEn
      },
      titleEn: `${icon} Discovered: ${species.nameLa} (${enName})`,
      titleRu: `${icon} Открыт вид: ${species.nameLa} («${ruName}»)`,
      contentEn: storyEn,
      contentRu: storyRu,
      insightEn,
      insightRu,
      timestamp: Date.now()
    });
  }

  // Periodic ecosystem status chronicle (guided by JEV screening verdict)
  async chronicleEcosystem(stats, jevDecision = null) {
    const isVeniceAvailable = Boolean(CONFIG.VENICE_API_KEY && CONFIG.VENICE_API_KEY.trim().length > 0);

    const focusTheme = jevDecision?.editorialFocus || (
      (stats.recentKills || 0) > 2 ? 'predation_hunt' : (
        (stats.recentBirths || 0) > 8 ? 'population_boom' : (
          (stats.recentSpeciations || 0) > 0 ? 'speciation_branch' : 'tranquil_equilibrium'
        )
      )
    );

    let themeGuidance = '';
    if (focusTheme === 'predation_hunt') {
      themeGuidance = `Apex predator hunts (${stats.topPredatorNameRu || 'ловчие'}), sudden strikes claiming ${stats.recentKills || 0} prey, and grazers fleeing toward the mineral vents.`;
    } else if (focusTheme === 'population_boom') {
      themeGuidance = `Mitotic population surge (${stats.recentBirths || 0} divisions), crowding around mineral vents, and total population climbing to ${stats.organismCount}.`;
    } else if (focusTheme === 'speciation_branch') {
      themeGuidance = `Evolutionary divergence (${stats.recentSpeciations || 0} new species split), ciliary variations, and colonizing a new fluid niche.`;
    } else if (focusTheme === 'extinction_threat') {
      themeGuidance = `Vulnerable species dwindled under predatory pressure and competing for thermal plumes.`;
    } else {
      themeGuidance = `Calm metabolic harmony, peaceful gliding along hydrothermal currents, and steady nutrient filtration.`;
    }

    if (isVeniceAvailable) {
      try {
        const recentTitles = this.journalEntries.slice(0, 5).map(e => `"${e.titleEn}" / "${e.titleRu}"`).join(', ');
        const prompt = `Live field observation of the microscopic aquarium AETHEON:
- Editorial Theme: ${themeGuidance}
- Recent hunts / predation strikes: ${stats.recentKills || 0}
- Recent cell divisions (mitosis): ${stats.recentBirths || 0}
- Recent speciation branches: ${stats.recentSpeciations || 0}
- Dominant lineage: "${stats.dominantSpeciesNameRu || stats.dominantSpeciesNameEn || 'Пастбищник'}" (${stats.dominantCount || 0} organisms)
- Top Apex Hunter: "${stats.topPredatorNameRu || stats.topPredatorNameEn || 'Охотник'}"
- Active population: ${stats.organismCount} organisms across ${stats.speciesCount} species
- Generation milestone: #${stats.generation}
- RECENT TITLES TO NEVER REPEAT: ${recentTitles || 'None'}

CRITICAL RULES:
1. NEVER start with 'В недрах AETHEON', 'В сердце AETHEON', 'In the depths of AETHEON', 'A vibrant tapestry', or 'A kaleidoscope of life'.
2. NEVER use the phrase 'Это значит, что' or 'This means that'.
3. DO NOT repeat words from recent titles. You MUST invent a completely fresh, unique headline and original metaphor.
4. Describe the EXACT current drama based on the field data and editorial theme above:
   - Make it cinematic, thrilling, and accessible for general audiences.
4. "insightRu" / "insightEn": 1 brief scientific takeaway (without saying "это значит"), OR empty string "" if not strictly needed.

JSON format ONLY:
{
  "icon": "emoji fitting the story (e.g. ⚔️, 🌪️, 🌾, 🧬, 🌋, ⚡)",
  "badgeEn": "Short 2-word badge in English (e.g. 'Predator Surge', 'Thermal Bloom', 'Mitosis Wave')",
  "badgeRu": "Короткий бейдж 2 слова на русском (напр. 'Охота хищника', 'Тепловой всплеск', 'Волна делений')",
  "titleEn": "Unique engaging headline",
  "titleRu": "Уникальный интригующий заголовок",
  "storyEn": "2 vivid documentary sentences.",
  "storyRu": "2 ярких, кинематографичных предложения на русском языке.",
  "insightEn": "1 punchy scientific takeaway (or empty string)",
  "insightRu": "1 емкий научный вывод (или пустая строка)"
}`;

        const response = await this.queryVeniceAI({ prompt });

        if (response && response.storyRu) {
          this.addEntry({
            type: 'observation',
            icon: response.icon || (focusTheme === 'predation_hunt' ? '⚔️' : (focusTheme === 'population_boom' ? '🌾' : '⚖️')),
            badgeEn: response.badgeEn || 'Ecosystem Dispatch',
            badgeRu: response.badgeRu || 'Хроника капли',
            titleEn: response.titleEn || `Ecosystem Dispatch (Gen #${stats.generation || 1})`,
            titleRu: response.titleRu || `Сводка экосистемы (Поколение #${stats.generation || 1})`,
            contentEn: response.storyEn,
            contentRu: response.storyRu,
            insightEn: response.insightEn || '',
            insightRu: response.insightRu || '',
            editorialFocus: focusTheme,
            screener: jevDecision ? 'jev-latest' : 'baseline',
            timestamp: Date.now()
          });
          return;
        }
      } catch (err) {
        console.warn('[AI Naturalist] Venice API ecosystem call failed, using procedural dispatch:', err.message);
      }
    }

    // Adaptive procedural narrative dispatches (based on real recent events & JEV focus)
    let icon = '⚖️';
    let badgeEn = 'Equilibrium';
    let badgeRu = 'Баланс капли';
    let titleEn = 'A Moment in the Ocean';
    let titleRu = 'Мгновение жизни океана';
    let storyEn = `The ocean holds ${stats.organismCount ?? 0} organisms in ${stats.speciesCount ?? 0} registered living forms. During this observation window, ${stats.recentBirths ?? 0} divisions and ${stats.recentKills ?? 0} fatal hunts were recorded.`;
    let storyRu = `В океане живут ${stats.organismCount ?? 0} организмов, относящихся к ${stats.speciesCount ?? 0} зарегистрированным формам. За окно наблюдения отмечено ${stats.recentBirths ?? 0} делений и ${stats.recentKills ?? 0} смертельных атак.`;
    let insightEn = `Resource gradients, local interactions and inherited traits determine each organism's next step.`;
    let insightRu = `Следующий шаг организма зависит от ресурсов, соседей и наследуемых признаков.`;

    if ((stats.recentKills ?? 0) > 2) {
      icon = '⚔️';
      badgeEn = 'Predator Hunt';
      badgeRu = 'Охота хищников';
      titleEn = '⚔️ The Crimson Stalkers';
      titleRu = `⚔️ Охотничий рейд: ${stats.topPredatorNameRu || 'Ловчие'}`;
      storyEn = `${stats.recentKills} organisms died from predatory attacks during this observation window. Local pursuit and escape change where organisms can feed and survive.`;
      storyRu = `За окно наблюдения ${stats.recentKills} организмов погибли от хищных атак. Преследование и бегство меняют доступ к питанию и шансы выживания в разных местах.`;
      insightEn = `Whether faster escape spreads through the population depends on the survival and reproduction of its carriers.`;
      insightRu = `Распространение скорости бегства зависит от выживания и размножения её носителей.`;
    } else if ((stats.colonyCount ?? 0) >= 3) {
      icon = '🪸';
      badgeEn = 'Reef Genesis';
      badgeRu = 'Рост рифов';
      titleEn = '🪸 Bio-Calcite Architecture';
      titleRu = `🪸 Морфогенез рифов: оазисы жизни`;
      storyEn = `${stats.colonyCount} connected colonies are alive, with up to ${stats.largestColonySize ?? 0} cells in the largest. Their bonds transmit forces and redistribute energy between connected members.`;
      storyRu = `Живут ${stats.colonyCount} связанных колоний; в крупнейшей — ${stats.largestColonySize ?? 0} клеток. Связи передают усилия и позволяют обмениваться энергией внутри связной группы.`;
      insightEn = `A broken connection can split a colony and end its shared energy supply.`;
      insightRu = `Разрыв связи может разделить колонию и прекратить общий обмен энергией.`;
    } else if ((stats.recentSpeciations ?? 0) > 0) {
      icon = '🧬';
      badgeEn = 'Speciation';
      badgeRu = 'Ветвление жизни';
      titleEn = '🧬 Evolutionary Divergence';
      titleRu = '🧬 Новое ответвление древа жизни';
      storyEn = `${stats.recentSpeciations} newly registered trait combinations appeared during this observation window. Registration marks genetic distance from a prototype; successful adaptation is still to be tested.`;
      storyRu = `За окно наблюдения зарегистрировано ${stats.recentSpeciations} новых сочетаний признаков. Регистрация отмечает отличие от образца; успешная адаптация ещё не доказана.`;
      insightEn = `Follow later generations to learn which forms persist and which disappear.`;
      insightRu = `Следующие поколения покажут, какие формы закрепятся, а какие исчезнут.`;
    }

    this.addEntry({
      type: 'observation',
      icon,
      badgeEn,
      badgeRu,
      titleEn: `${titleEn} (Gen #${stats.generation || 1})`,
      titleRu: `${titleRu} (Поколение #${stats.generation || 1})`,
      contentEn: storyEn,
      contentRu: storyRu,
      insightEn,
      insightRu,
      editorialFocus: focusTheme,
      screener: jevDecision ? 'jev-latest' : 'baseline',
      timestamp: Date.now()
    });
  }

  // Venice AI HTTPS call with robust JSON extraction
  async queryVeniceAI({ prompt }) {
    if (!CONFIG.VENICE_API_KEY) return null;
    this.totalApiCalls++;

    const systemPrompt = `You are a world-renowned Nature Documentary Narrator (like David Attenborough or Jacques Cousteau) observing a living microscopic aquarium called AETHEON.
ABSOLUTELY FORBIDDEN: Do NOT use dry, robotic jargon like 'interfacial reactor', 'solitons', 'active resonators', 'substrate equilibrium', 'scalar field'.
INSTEAD: Write thrilling, easy-to-understand, poetic nature stories for curious everyday visitors with warmth and wonder.
Use only the supplied measured facts. Never invent population losses, diets, photosynthesis, achievements or causal certainty. Describe uncertainty as uncertainty. OUTPUT VALID JSON ONLY.`;

    const data = await this.budget.request('text', CONFIG.VENICE_API_URL, {
      model: CONFIG.VENICE_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 750,
      venice_parameters: { include_venice_system_prompt: false }
    });
    if (!data) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return cleanAndParseJson(content);
  }
}

function cleanAndParseJson(content) {
  if (!content || typeof content !== 'string') return null;
  // 1. Strip markdown code fences
  let cleaned = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // 2. Direct parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 3. Extract outermost { ... }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
    try {
      return JSON.parse(cleaned);
    } catch (_) {}

    // 4. Fix unquoted emojis or values like "icon": 🦈,
    let fixed = cleaned.replace(/("icon"\s*:\s*)([^\s",\{\}\[\]]+)(\s*[,}\n])/g, '$1"$2"$3');
    try {
      return JSON.parse(fixed);
    } catch (_) {}

    // 5. Remove trailing commas before } or ]
    fixed = fixed.replace(/,\s*([\}\]])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch (_) {}
  }

  // 6. Regex field extraction fallback
  const extractField = (key) => {
    const re = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i');
    const m = content.match(re);
    if (m) return m[1];
    const re2 = new RegExp(`"${key}"\\s*:\\s*([^,\\n\\}]+)`, 'i');
    const m2 = content.match(re2);
    if (m2) return m2[1].replace(/^["']|["']$/g, '').trim();
    return null;
  };

  const obj = {};
  const keys = ['nameLa', 'nameEn', 'nameRu', 'icon', 'titleEn', 'titleRu', 'storyEn', 'storyRu', 'insightEn', 'insightRu', 'badgeEn', 'badgeRu'];
  for (const k of keys) {
    const val = extractField(k);
    if (val !== null) obj[k] = val;
  }
  return Object.keys(obj).length >= 2 ? obj : null;
}
