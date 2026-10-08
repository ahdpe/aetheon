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
    this.lastObservationTheme = null;
    this.themeCycleCounter = 0;
    
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
    const topGen = engineStats.topDynastyGen || 0;

    // Only genuine milestones qualify:
    // - New speciation branch
    // - Apex hunting rampage (8+ kills)
    // - Multicellular supercolony expansion (3+ colonies)
    // - High dynasty generation milestone (F3+)
    // - Or rare deep ecological contemplation after 35+ minutes of silence
    const hasSignificantEvent = speciations > 0 || kills >= 8 || colonyCount >= 3 || topGen >= 3;
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
      colonyCount: stats.colonyCount || 0,
      bondedOrganisms: stats.bondedOrganisms || 0,
      largestColony: stats.largestColonySize || 0,
      activeDynasties: stats.activeDynastiesCount || 0,
      topDynasty: stats.topDynastyName ? `${stats.topDynastyName} (F${stats.topDynastyGen})` : 'None',
      habitats: stats.habitatSummary || 'Open Water',
      cataclysmPhase: stats.cataclysmPhase || 'stable',
      minutesSinceLastDispatch: Math.round(minutesSinceLastDispatch * 10) / 10
    };

    const questions = {
      should_publish: {
        type: 'choice',
        instructions: 'Should this ecological interval be published as a journal dispatch for visitors, or skipped as routine baseline?',
        criteria: {
          publish: 'Speciation branch event, severe apex predator wave (8+ kills), multicellular supercolony, ancient dynasty milestone (F3+), or 35+ min tranquil equilibrium milestone',
          skip: 'Routine cell divisions/mitosis, minor grazing, and background population fluctuations'
        }
      },
      editorial_focus: {
        type: 'choice',
        instructions: 'What is the primary driving drama or theme of this ecosystem moment?',
        criteria: {
          speciation_branch: 'A new lineage or species has adapted and split off',
          predation_hunt: 'Apex predators striking with tactical intercepts in open water',
          colonial_superorganism: 'Multicellular colonies or membrane bonds forming collective superorganisms',
          dynasty_legacy: 'An ancient observer-guided dynasty or lineage enduring across multiple generations',
          reef_architecture: 'Colonies and bio-calcite mineral reefs growing around vents and shallows',
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
        const prompt = `A newly evolved species has stabilized in the microscopic ocean AETHEON:
- Species ID: ${species.id}
- Ancestor ID: ${species.parentSpeciesId}
- Color hue: ${Math.round(species.hue * 360)}°
- Trophic role: ${isHunter ? 'Active predator: pursues other cells with predictive lunges, deals strike damage and digests biomass' : 'Grazer / Chemotroph: filters dissolved organic nutrients from the mineral plumes'}
- Speed: ${Math.round(species.speedMax * 10) / 10} μm/step
- Body Size: ${Math.round(species.size * 10) / 10} μm
- Current Population: ${species.population}

Provide an engaging natural history entry in JSON:
1. "nameLa": Latin binomial name reflecting morphology and behavior (e.g. "Vibrionox velox", "Aethenella spiralis")
2. "nameEn": English common name (e.g. "Crimson Dart", "Abyssal Spinner")
3. "nameRu": Russian common name (e.g. "Алый стрелочник", "Глубоководный веретенник")
4. "icon": emoji (e.g. ⚔️, 🌿, ⚡, 🌀, 🐋)
5. "titleEn": Short engaging title with emoji
6. "titleRu": Краткий увлекательный заголовок с эмодзи
7. "storyEn": 2 captivating, documentary-style sentences in English describing their swimming mechanics, hunting/feeding strategy, and visual elegance.
8. "storyRu": 2 захватывающих, художественных предложения на русском о биомеханике движения, способе питания и повадках вида.
9. "insightEn": 1 clear astrobiological/ecological takeaway about this adaptation.
10. "insightRu": 1 емкий научный вывод об адаптивном преимуществе этих признаков.

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
        (stats.colonyCount || 0) >= 2 ? 'colonial_superorganism' : (
          (stats.topDynastyGen || 0) >= 2 ? 'dynasty_legacy' : (
            (stats.recentBirths || 0) > 8 ? 'population_boom' : (
              (stats.recentSpeciations || 0) > 0 ? 'speciation_branch' : 'tranquil_equilibrium'
            )
          )
        )
      )
    );

    let themeGuidance = '';
    if (focusTheme === 'predation_hunt') {
      themeGuidance = `Tactical apex predator hunts (${stats.topPredatorNameRu || 'ловчие'}), predictive lead intercept strikes claiming ${stats.recentKills || 0} prey, and grazers executing boundary evasions along the droplet rim.`;
    } else if (focusTheme === 'population_boom') {
      themeGuidance = `Mitotic population surge (${stats.recentBirths || 0} divisions), crowding around mineral vents and shallows, total population climbing to ${stats.organismCount}.`;
    } else if (focusTheme === 'speciation_branch') {
      themeGuidance = `Evolutionary divergence (${stats.recentSpeciations || 0} new species split), morphological variation in ciliary drives and size, colonizing new archipelago zones.`;
    } else if (focusTheme === 'colonial_superorganism' || focusTheme === 'reef_architecture') {
      themeGuidance = `Multicellular superorganisms and membrane bonds (${stats.colonyCount || 0} clusters, ${stats.bondedOrganisms || 0} interconnected cells), cytoplasmic energy sharing, and bio-calcite accretion.`;
    } else if (focusTheme === 'dynasty_legacy') {
      themeGuidance = `Endurance of the ancient dynasty "${stats.topDynastyName || 'Первородные'}" (Gen F${stats.topDynastyGen || 1}), surviving environmental shifts and passing honed survival traits across generations.`;
    } else if (focusTheme === 'extinction_threat') {
      themeGuidance = `Vulnerable species dwindling under predatory pressure and competing for thermal plumes in phase ${stats.cataclysmPhase || 'stable'}.`;
    } else {
      themeGuidance = `Deep metabolic harmony, peaceful laminar drifting along hydrothermal currents, and steady nutrient filtration across habitats.`;
    }

    if (isVeniceAvailable) {
      try {
        const recentTitles = this.journalEntries.slice(0, 5).map(e => `"${e.titleEn}" / "${e.titleRu}"`).join(', ');
        const prompt = `Live field observation of the microscopic aquarium AETHEON:
- Editorial Theme: ${themeGuidance}
- Recent hunts / predation strikes: ${stats.recentKills || 0} (predators use predictive lead intercept; prey uses rim evasion)
- Recent cell divisions (mitosis): ${stats.recentBirths || 0}
- Recent speciation branches: ${stats.recentSpeciations || 0}
- Multicellular Colonies: ${stats.colonyCount || 0} colonies (${stats.bondedOrganisms || 0} bonded cells, max cluster size: ${stats.largestColonySize || 0})
- Dynasties: ${stats.activeDynastiesCount || 0} active (Leading: "${stats.topDynastyName || 'None'}" at F${stats.topDynastyGen || 0})
- Regional Habitats: ${stats.habitatSummary || 'Open Water'}
- Dominant lineage: "${stats.dominantSpeciesNameRu || stats.dominantSpeciesNameEn || 'Пастбищник'}" (${stats.dominantCount || 0} organisms)
- Top Apex Hunter: "${stats.topPredatorNameRu || stats.topPredatorNameEn || 'Охотник'}"
- Active population: ${stats.organismCount} organisms across ${stats.speciesCount} species
- Cataclysm state: ${stats.cataclysmPhase || 'stable'}
- Generation milestone: #${stats.generation}
- RECENT TITLES TO NEVER REPEAT: ${recentTitles || 'None'}

CRITICAL RULES & STYLE GUIDELINES:
1. NEVER start with clichés like 'В недрах AETHEON', 'В сердце AETHEON', 'In the depths of AETHEON', 'A vibrant tapestry', 'A kaleidoscope of life', or 'В глубинах'.
2. NEVER use the robotic phrase 'Это значит, что' or 'This means that'.
3. DO NOT repeat words from recent titles. You MUST invent a completely fresh, unique headline and original metaphor.
4. Deep ecological and astrobiological causal reasoning: connect the physical environment (currents, mineral oases, surface tension rim, thermal chimneys) with cellular behaviors (tactical chases, membrane bonds, shared cytoplasm).
5. Cinematic, thrilling, natural-documentary voice (David Attenborough / Jacques Cousteau).
6. "insightRu" / "insightEn": 1 profound scientific insight explaining the evolutionary or ecological mechanism, OR empty string "" if not strictly needed.

JSON format ONLY:
{
  "icon": "emoji fitting the story (e.g. ⚔️, 🌪️, 🌾, 🧬, 🌋, ⚡, 🪸, 👑)",
  "badgeEn": "Short 2-word badge in English (e.g. 'Predator Surge', 'Thermal Bloom', 'Colonial Nexus', 'Dynastic Drift')",
  "badgeRu": "Короткий бейдж 2 слова на русском (напр. 'Охота хищника', 'Тепловой всплеск', 'Колониальный узел', 'Эхо династии')",
  "titleEn": "Unique engaging headline",
  "titleRu": "Уникальный интригующий заголовок",
  "storyEn": "2 vivid documentary sentences with deep narrative depth.",
  "storyRu": "2 ярких, кинематографичных предложения на русском языке с глубоким повествованием.",
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

    // Dynamic candidates pool based on real events in this window
    const candidates = [];
    if ((stats.recentKills ?? 0) > 0) candidates.push('predation');
    if ((stats.recentBirths ?? 0) >= 3) candidates.push('mitosis');
    if ((stats.recentSpeciations ?? 0) > 0) candidates.push('speciation');
    if (stats.dominantSpeciesNameRu && (stats.dominantCount ?? 0) > 15) candidates.push('dominance');
    if ((stats.colonyCount ?? 0) >= 2) candidates.push('colonies');
    if (stats.topDynastyName && (stats.topDynastyGen ?? 0) >= 2) candidates.push('dynasty');
    if ((stats.organismCount ?? 0) > 30) candidates.push('vents');
    candidates.push('equilibrium');

    // Never repeat the same theme consecutively
    let available = candidates.filter(t => t !== this.lastObservationTheme);
    if (!available.length) available = candidates;

    this.themeCycleCounter = (this.themeCycleCounter + 1) % 1000;
    const selectedTheme = available[this.themeCycleCounter % available.length];
    this.lastObservationTheme = selectedTheme;

    const variant = (stats.generation || this.themeCycleCounter) % 2;
    let chosen;

    switch (selectedTheme) {
      case 'predation':
        chosen = variant === 0 ? {
          icon: '⚔️',
          badgeEn: 'Predator Hunt',
          badgeRu: 'Охота хищников',
          titleEn: '⚔️ The Crimson Stalkers',
          titleRu: `⚔️ Охотничий рейд: ${stats.topPredatorNameRu || 'Ловчие'}`,
          storyEn: `${stats.recentKills} organisms fell victim to predatory attacks during this window. Ambush lunges and swift maneuvers reshape survival near the seabed.`,
          storyRu: `За окно наблюдения ${stats.recentKills} организмов пали жертвами хищников. Скоростные маневры и внезапные выпады меняют баланс в придонных слоях.`,
          insightEn: 'Predatory pressure selects for higher sensory acuity and agile acceleration.',
          insightRu: 'Давление хищников отбирает самых чутких и быстрых особей, ускоряя развитие сенсорных систем.'
        } : {
          icon: '🦈',
          badgeEn: 'Selection Pressure',
          badgeRu: 'Давление отбора',
          titleEn: '🦈 Apex Hunter Sweep',
          titleRu: `🦈 Теневые охотники: ${stats.topPredatorNameRu || 'Апекс-хищники'}`,
          storyEn: `Apex hunters patrol the shelf boundaries, driving peaceful grazers toward protective reef shelters and thermal upwellings.`,
          storyRu: `Ловчие особи патрулируют границы шельфа, вынуждая мирных планктоноядных искать спасения в лабиринтах рифов.`,
          insightEn: 'Schooling behavior and reef shelters significantly reduce the odds of being singled out.',
          insightRu: 'Стайное поведение и укрытия в зарослях снижают вероятность стать легкой добычей.'
        };
        break;

      case 'colonies':
        chosen = variant === 0 ? {
          icon: '🪸',
          badgeEn: 'Reef Genesis',
          badgeRu: 'Рост рифов',
          titleEn: '🪸 Bio-Calcite Architecture',
          titleRu: '🪸 Морфогенез рифов: оазисы жизни',
          storyEn: `${stats.colonyCount} multicellular colonies thrive across the ocean (up to ${stats.largestColonySize ?? 0} cells in the largest). Elastic membrane bonds coordinate flagellar propulsion.`,
          storyRu: `В океане процветают ${stats.colonyCount} связанных колоний (до ${stats.largestColonySize ?? 0} клеток в крупнейшей). Эластичные мембраны объединяют усилия гребли жгутиков.`,
          insightEn: 'Multicellular clusters overcome counter-currents and resist predator attacks more effectively.',
          insightRu: 'Многоклеточные агрегаты эффективнее преодолевают противотоки и противостоят атакам хищников.'
        } : {
          icon: '🔗',
          badgeEn: 'Membrane Bonds',
          badgeRu: 'Симбиоз мембран',
          titleEn: '🔗 Cytoplasmic Energy Bridges',
          titleRu: '🔗 Цитоплазматический мост: взаимная поддержка',
          storyEn: `Colony members transfer energy across intercellular channels, sustaining hungry neighbors from collective reserves.`,
          storyRu: `Клетки в колониях непрерывно перекачивают энергию по цитоплазматическим каналам, питая голодающих соседей из общих запасов.`,
          insightEn: 'Trophic sharing increases resilience against local nutrient fluctuations.',
          insightRu: 'Трофический обмен повышает устойчивость группы к локальным перепадам питательных веществ.'
        };
        break;

      case 'mitosis':
        chosen = variant === 0 ? {
          icon: '🌾',
          badgeEn: 'Mitosis Surge',
          badgeRu: 'Прилив делений',
          titleEn: '🌾 Mitotic Population Surge',
          titleRu: '🌾 Демографический бум: деление поколений',
          storyEn: `${stats.recentBirths} cell divisions were recorded. An abundance of dissolved nutrients triggered a reproductive boom, bringing the population to ${stats.organismCount} cells.`,
          storyRu: `Зафиксировано ${stats.recentBirths} клеточных делений. Обилие растворенной органики вызвало всплеск рождаемости, доведя популяцию до ${stats.organismCount} особей.`,
          insightEn: 'Higher population density intensifies competition for light and mineral salts on the shallows.',
          insightRu: 'Рост плотности населения усиливает конкуренцию за свет и минеральные соли на отмелях.'
        } : {
          icon: '✨',
          badgeEn: 'Energy Pulse',
          badgeRu: 'Энергетический пик',
          titleEn: '✨ Microfauna Proliferation',
          titleRu: '✨ Пролиферация микрофауны',
          storyEn: `Favorable feeding conditions around the reefs accelerated energy storage, triggering cascading mitosis waves among primary producers.`,
          storyRu: `Благоприятные условия вокруг рифов ускорили накопление АТФ, запуская каскадные волны митоза среди первичных продуцентов.`,
          insightEn: 'Rapid reproduction allows a species to swiftly colonize newly available food niches.',
          insightRu: 'Быстрое размножение позволяет виду стремительно занять свободные пищевые ниши.'
        };
        break;

      case 'speciation':
        chosen = variant === 0 ? {
          icon: '🧬',
          badgeEn: 'Speciation',
          badgeRu: 'Ветвление жизни',
          titleEn: '🧬 Evolutionary Divergence',
          titleRu: '🧬 Новое ответвление древа жизни',
          storyEn: `${stats.recentSpeciations} newly registered trait combinations emerged. Mutations in flagellar morphology and membrane adhesion branch into new lineages.`,
          storyRu: `За окно наблюдения зарегистрировано ${stats.recentSpeciations} новых сочетаний признаков. Изменения в строении жгутиков и мембран формируют новые адаптивные ветви.`,
          insightEn: 'Time will reveal which genetic innovations offer lasting survival advantages in an evolving habitat.',
          insightRu: 'Только время покажет, какие мутации дадут долгосрочное преимущество в изменчивой среде.'
        } : {
          icon: '🌱',
          badgeEn: 'Genetic Drift',
          badgeRu: 'Генетический дрейф',
          titleEn: '🌱 Novel Morphological Strands',
          titleRu: '🌱 Рождение нового морфотипа',
          storyEn: `Spontaneous genetic drift introduced subtle variations in sensory radius and ciliary frequency among emerging lineages.`,
          storyRu: `Спонтанные мутации привели к тонким изменениям в сенсорном радиусе и частоте биения ресничек среди молодых ветвей.`,
          insightEn: 'Slight physiological differences can lead to profound divergence in ecological strategy.',
          insightRu: 'Небольшие физиологические различия могут положить начало совершенно разным стратегиям выживания.'
        };
        break;

      case 'dominance':
        chosen = variant === 0 ? {
          icon: '👑',
          badgeEn: 'Dominant Lineage',
          badgeRu: 'Доминирующий вид',
          titleEn: `👑 Rise of ${stats.dominantSpeciesNameEn || 'the Dominant Lineage'}`,
          titleRu: `👑 Экспансия вида: «${stats.dominantSpeciesNameRu}»`,
          storyEn: `${stats.dominantSpeciesNameEn || 'The dominant lineage'} took the leading position with ${stats.dominantCount} cells, outcompeting rivals across mineral-rich zones.`,
          storyRu: `Вид «${stats.dominantSpeciesNameRu}» занял лидирующую позицию в капле (${stats.dominantCount} особей), вытесняя конкурентов с богатых участков.`,
          insightEn: 'A winning genome dominates by balancing swimming speed, body size, and metabolic efficiency.',
          insightRu: 'Успешный геном доминирует за счет идеального баланса скорости, размера и энергопотребления.'
        } : {
          icon: '🏆',
          badgeEn: 'Species Flourishing',
          badgeRu: 'Триумф популяции',
          titleEn: `🏆 Ecological Monopolist: ${stats.dominantSpeciesNameEn || 'Dominant Form'}`,
          titleRu: `🏆 Экологический монополист: «${stats.dominantSpeciesNameRu}»`,
          storyEn: `Dense concentrations of ${stats.dominantSpeciesNameEn || 'the dominant species'} now form the living foundation of the benthic reefs.`,
          storyRu: `Плотные скопления особей «${stats.dominantSpeciesNameRu}» теперь формируют живой каркас подводных отмелей.`,
          insightEn: 'High density increases vulnerability to specialized parasites and predatory focus.',
          insightRu: 'Высокая плотность вида привлекает к нему внимание ловчих хищников, балансируя экосистему.'
        };
        break;

      case 'dynasty':
        chosen = variant === 0 ? {
          icon: '👑',
          badgeEn: 'Dynastic Lineage',
          badgeRu: 'Династическая ветвь',
          titleEn: `👑 Legacy of ${stats.topDynastyName || 'the Ancients'}`,
          titleRu: `👑 Наследие династии: «${stats.topDynastyName || 'Первородные'}»`,
          storyEn: `The lineage of "${stats.topDynastyName}" has endured to generation F${stats.topDynastyGen || 1}. Generations of continuous division refine their metabolic stamina across changing currents.`,
          storyRu: `Генеалогическая ветвь «${stats.topDynastyName}» успешно достигла поколения F${stats.topDynastyGen || 1}. Непрерывная череда митозов закалила их метаболизм в изменчивых придонных течениях.`,
          insightEn: 'Long-surviving lineages develop high metabolic efficiency, buffering them against localized nutrient droughts.',
          insightRu: 'Долгоживущие династии накапливают высокий энергетический КПД, защищающий популяцию при колебаниях ресурсов.'
        } : {
          icon: '🏛️',
          badgeEn: 'Ancestral Memory',
          badgeRu: 'Память поколений',
          titleEn: `🏛️ Enduring Lineage: ${stats.topDynastyName || 'Ancestral Strain'}`,
          titleRu: `🏛️ Неугасимый род: «${stats.topDynastyName || 'Древние'}»`,
          storyEn: `Generation F${stats.topDynastyGen || 1} of the "${stats.topDynastyName}" dynasty navigates the archipelago reefs with steady ciliary pulses, carrying the founder's imprint forward.`,
          storyRu: `Поколение F${stats.topDynastyGen || 1} династии «${stats.topDynastyName}» уверенно бороздит рифовые отмели, сохраняя первоначальный отпечаток основателя сквозь эпохи.`,
          insightEn: 'Inherited ciliary drive parameters stabilize navigation patterns across successive generations.',
          insightRu: 'Наследуемые параметры жгутикового аппарата стабилизируют навигацию сквозь поколения.'
        };
        break;

      case 'vents':
        chosen = variant === 0 ? {
          icon: '🌋',
          badgeEn: 'Tectonic Rifts',
          badgeRu: 'Дыхание разломов',
          titleEn: '🌋 Abyssal Hydrothermal Plumes',
          titleRu: '🌋 Абиссальные минеральные плюмы',
          storyEn: `Geothermal vents along the tectonic rift fissure release warm sulfide plumes, sustaining dense swarms of chemosynthetic cells.`,
          storyRu: `Геотермальные источники вдоль тектонического разлома выбрасывают струи сульфидов и солей, собирая вокруг себя мерцающие рои хемосинтетиков.`,
          insightEn: 'Thermal and chemical gradients around the rift power the primary metabolism of the entire ocean.',
          insightRu: 'Температурные и химические градиенты разломов служат главным двигателем метаболизма всей капли.'
        } : {
          icon: '♨️',
          badgeEn: 'Geothermal Pulse',
          badgeRu: 'Геотермальный ток',
          titleEn: '♨️ Deep-Water Chemosynthesis',
          titleRu: '♨️ Глубоководный хемосинтез',
          storyEn: `Mineral-laden waters swirl around the volcanic chimneys, nurturing cells that never see the surface light.`,
          storyRu: `Насыщенная минералами вода циркулирует вокруг вулканических башен, питая клетки, никогда не видевшие поверхностного света.`,
          insightEn: 'Abyssal ecosystems thrive entirely independent of sunlight through mineral catalysis.',
          insightRu: 'Абиссальные экосистемы живут полностью независимо от солнечного света благодаря минеральному катализу.'
        };
        break;

      default: // equilibrium
        chosen = variant === 0 ? {
          icon: '⚖️',
          badgeEn: 'Equilibrium',
          badgeRu: 'Баланс капли',
          titleEn: '⚖️ Ocean Homeostasis',
          titleRu: '⚖️ Гармония течений и метаболизма',
          storyEn: `The ocean holds ${stats.organismCount ?? 0} organisms across ${stats.speciesCount ?? 0} living forms. During this observation window, ${stats.recentBirths ?? 0} divisions and ${stats.recentKills ?? 0} fatal hunts were recorded.`,
          storyRu: `В океане живут ${stats.organismCount ?? 0} организмов, относящихся к ${stats.speciesCount ?? 0} зарегистрированным формам. За окно наблюдения отмечено ${stats.recentBirths ?? 0} делений и ${stats.recentKills ?? 0} смертельных атак.`,
          insightEn: 'Resource gradients, local interactions and inherited traits determine each organism\'s next step.',
          insightRu: 'Следующий шаг организма зависит от ресурсов, соседей и наследуемых признаков.'
        } : {
          icon: '🌊',
          badgeEn: 'Fluid Serenity',
          badgeRu: 'Спокойствие глубин',
          titleEn: '🌊 Planktonic Currents',
          titleRu: '🌊 Ламинарные придонные течения',
          storyEn: `Gentle currents sweep across the seabed, carrying organic detritus and microscopic spores to quiet backwaters. During this quiet interval, ${stats.recentBirths ?? 0} divisions and ${stats.recentKills ?? 0} fatal hunts were recorded.`,
          storyRu: `Мягкие придонные течения омывают океанское дно, разнося питательную взвесь в тихие заводи. За окно наблюдения отмечено ${stats.recentBirths ?? 0} делений и ${stats.recentKills ?? 0} смертельных атак.`,
          insightEn: 'Circulation prevents resource stagnation, linking distant habitats into a single living biosphere.',
          insightRu: 'Циркуляция предотвращает застой ресурсов, связывая отдаленные биотопы в единую биосферу.'
        };
        break;
    }

    this.addEntry({
      type: 'observation',
      icon: chosen.icon,
      badgeEn: chosen.badgeEn,
      badgeRu: chosen.badgeRu,
      titleEn: `${chosen.titleEn} (Gen #${stats.generation || 1})`,
      titleRu: `${chosen.titleRu} (Поколение #${stats.generation || 1})`,
      contentEn: chosen.storyEn,
      contentRu: chosen.storyRu,
      insightEn: chosen.insightEn,
      insightRu: chosen.insightRu,
      editorialFocus: selectedTheme,
      screener: jevDecision ? 'jev-latest' : 'baseline',
      timestamp: Date.now()
    });
  }

  // Interactive AI Bio-Scanner: personal natural-history biography of an individual organism
  async scanOrganismBiography(org, species, stats) {
    const isHunter = org.carnivory > 0.35;
    const fallback = {
      name: isHunter ? 'Теневой Охотник' : 'Изумрудный Пилигрим',
      statusTitleRu: org.generation > 5 ? `Ветеран рода F${org.generation}` : (isHunter ? 'Ловчая особь' : 'Мирный фильтратор'),
      statusTitleEn: org.generation > 5 ? `Dynasty Veteran F${org.generation}` : (isHunter ? 'Apex Stalker' : 'Planktonic Grazer'),
      bioRu: `Особь #${org.id} принадлежит к виду «${species?.nameRu || 'Морф'}». Прошла ${org.childrenCount || 0} циклов деления и уверенно лавирует среди океанических течений.`,
      bioEn: `Specimen #${org.id} of "${species?.nameEn || 'Morph'}". It has completed ${org.childrenCount || 0} divisions and navigates the currents with agile ciliary pulses.`,
      traits: [
        isHunter ? 'Хищный радар' : 'Трофическая стойкость',
        `Поколение F${org.generation}`,
        org.dynastyName ? `Династия: ${org.dynastyName}` : 'Дикий штамм'
      ]
    };

    if (!CONFIG.VENICE_API_KEY) return fallback;

    try {
      const prompt = `Field micro-scan of individual organism #${org.id} in living ocean AETHEON:
- Species: "${species?.nameRu || 'Морф'}" (${species?.nameLa || 'Organismus'})
- Generation: F${org.generation}
- Role: ${isHunter ? 'Predator / Hunter (attacks neighbors with predictive lead)' : 'Grazer / Filterer (absorbs dissolved nutrients)'}
- Size: ${Math.round(org.size * 10) / 10} μm, Speed limit: ${Math.round(org.speedMax * 10) / 10}
- Children: ${org.childrenCount || 0}
- Dynasty: "${org.dynastyName || 'Wild'}"
- Ocean Epoch: "${this.epochNameRu || 'Эпоха'}"

Write an engaging, 2-sentence personalized natural-history biography of THIS specific cell in David Attenborough documentary style. Describe its personal survival story, maneuvers, and character.
JSON format ONLY:
{
  "name": "Poetic personal moniker for this specimen in Russian (e.g. 'Око Бездны', 'Быстрый Пилигрим', 'Алый Веретенник')",
  "statusTitleRu": "Short status in Russian (e.g. 'Ветеран глубин', 'Опытный хищник', 'Хранитель рифа')",
  "statusTitleEn": "Short status in English",
  "bioRu": "2 vivid documentary sentences in Russian about this cell's journey.",
  "bioEn": "2 vivid documentary sentences in English.",
  "traits": ["Trait 1 in Russian", "Trait 2 in Russian", "Trait 3 in Russian"]
}`;
      const res = await this.queryVeniceAI({ prompt });
      if (res && res.bioRu) {
        return {
          name: res.name || fallback.name,
          statusTitleRu: res.statusTitleRu || fallback.statusTitleRu,
          statusTitleEn: res.statusTitleEn || fallback.statusTitleEn,
          bioRu: res.bioRu,
          bioEn: res.bioEn || fallback.bioEn,
          traits: Array.isArray(res.traits) && res.traits.length ? res.traits : fallback.traits
        };
      }
    } catch (err) {
      console.warn('[AI Naturalist] Bio-scan failed, using fallback:', err.message);
    }
    return fallback;
  }

  // AI-Engineered Novel Counter-Species: introduced when ecosystem biodiversity stagnates
  async engineerNovelSpecies(stats) {
    if (!CONFIG.VENICE_API_KEY) return null;
    try {
      const prompt = `The living ocean AETHEON needs an evolutionary breakthrough to counter biodiversity decline.
Current state:
- Total population: ${stats.organismCount} organisms across ${stats.speciesCount} species
- Dominant form: "${stats.dominantSpeciesNameRu || 'Пастбищник'}" (${stats.dominantCount || 0} cells)
- Top hunter: "${stats.topPredatorNameRu || 'None'}"
- Habitats: ${stats.habitatSummary || 'Open Water'}

Design a brand-new, exotic adaptive counter-species to diversify the ecosystem:
JSON format ONLY:
{
  "nameLa": "Latin binomial name (e.g. 'Chronohelix sapphirina', 'Vibrionox flammeus')",
  "nameEn": "English common name (e.g. 'Sapphire Leviathan', 'Ruby Dart')",
  "nameRu": "Russian common name (e.g. 'Сапфировый левиафан', 'Рубиновый стрелочник')",
  "trophicRole": "hunter" OR "grazer" OR "colony_builder",
  "hue": number between 0.0 and 1.0 (choose a vivid color contrasting with green, e.g. 0.95=crimson, 0.6=sapphire, 0.75=violet, 0.12=amber),
  "carnivory": number between 0.0 and 0.85 (0.75 for hunter, 0.05 for grazer),
  "size": number between 3.5 and 8.5,
  "speedMax": number between 1.2 and 4.2,
  "storyRu": "2 sentences describing its evolutionary adaptations in Russian.",
  "storyEn": "2 sentences in English."
}`;
      const res = await this.queryVeniceAI({ prompt });
      if (res && res.nameLa && Number.isFinite(res.hue)) return res;
    } catch (err) {
      console.warn('[AI Naturalist] Novel species engineering failed:', err.message);
    }
    return null;
  }

  // Venice AI HTTPS call with robust JSON extraction
  async queryVeniceAI({ prompt }) {
    if (!CONFIG.VENICE_API_KEY) return null;
    this.totalApiCalls++;

    const systemPrompt = `You are a world-renowned Nature Documentary Narrator (like David Attenborough or Jacques Cousteau) and Astrobiologist observing a living microscopic ocean called AETHEON.
You combine deep evolutionary insight with thrilling, poetic storytelling. You explain ecological adaptations—how organisms navigate currents, hunt with predictive lunges, evade predators along the meniscus rim, cooperate via multicellular membrane channels, and endure across generations.
ABSOLUTELY FORBIDDEN: Do NOT use dry, robotic jargon like 'interfacial reactor', 'solitons', 'active resonators', 'substrate equilibrium', 'scalar field'.
NEVER invent false facts (no photosynthesis, no eyes, no brains—only cilia, chemotaxis, cell membranes, organelles).
Write captivating, emotionally resonant, documentary-grade prose with warmth, precision, and wonder. OUTPUT VALID JSON ONLY.`;

    const data = await this.budget.request('text', CONFIG.VENICE_API_URL, {
      model: CONFIG.VENICE_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      temperature: 0.75, max_tokens: 1100,
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
