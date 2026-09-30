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
      insightEn: 'The cradle of life is stable. Without predators yet, autotrophic grazers freely explore and multiply around the warm mineral hearths.',
      insightRu: 'Колыбель жизни стабильна. Хищников пока нет, и мирные создания свободно делятся и обживают теплые подводные оазисы.',
      timestamp: Date.now()
    });
  }

  addEntry(entry) {
    entry.id = this.journalEntries.length + 1;
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
    const now = Date.now();

    // 1. Identify newly stabilized species needing taxonomic christening
    const allSpecies = this.lineageManager.getAllSpecies();
    const unchronicled = allSpecies.find(s => !s.aiChronicle && s.totalCount > 10 && s.population > 1);

    if (unchronicled) {
      await this.chronicleSpecies(unchronicled, engineStats);
      this.lastObservationTime = now;
      return true;
    }

    // 2. Rate limit JEV screening interval
    const screeningInterval = CONFIG.JEV_SCREENING_INTERVAL_MS || 60000;
    if (now - this.lastJevScreenTime < screeningInterval) {
      return false;
    }
    this.lastJevScreenTime = now;

    // 3. Minimum cooldown between published journal entries (8 minutes)
    const minutesSinceLastDispatch = (now - this.lastObservationTime) / 60000;
    if (minutesSinceLastDispatch < 8) {
      return false;
    }

    // 4. Local pre-screen: skip JEV call entirely if nothing noteworthy
    const kills = engineStats.recentKills || 0;
    const births = engineStats.recentBirths || 0;
    const speciations = engineStats.recentSpeciations || 0;
    const colonyCount = engineStats.colonyCount || 0;

    const hasSignificantEvent = kills >= 4 || births >= 8 || speciations > 0 || colonyCount > 0;
    const longSilence = minutesSinceLastDispatch >= 15;

    if (!hasSignificantEvent && !longSilence) {
      return false; // Nothing worth screening — save the API call
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
          publish: 'High predation kills (4+), rapid population boom (10+ births), speciation event, or more than 15 minutes since last chronicle',
          skip: 'Minor baseline fluctuations, routine small birth counts (1-5), and no heavy predator kills'
        }
      },
      editorial_focus: {
        type: 'choice',
        instructions: 'What is the primary driving drama or theme of this ecosystem moment?',
        criteria: {
          predation_hunt: 'Active hunts, apex predators striking prey in open water',
          population_boom: 'Sudden surge of cell divisions (mitosis) and crowding at vents',
          speciation_branch: 'A new lineage or species has adapted and split off',
          extinction_threat: 'A species is dwindling or facing sharp decline',
          tranquil_equilibrium: 'Peaceful harmony, steady metabolic drifting around mineral hearths'
        }
      },
      urgency_level: {
        type: 'score',
        instructions: 'Rate the urgency and drama of this moment from 0 (calm) to 2 (intense crisis or boom).',
        criteria: ['calm / baseline', 'moderate activity', 'high drama']
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(CONFIG.VENICE_DECISIONS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.VENICE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: CONFIG.JEV_MODEL || 'jev-latest',
          state,
          questions
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[JEV Screener] HTTP ${res.status}: ${await res.text()}`);
        return null;
      }

      const data = await res.json();
      const answers = data.answers || {};
      const shouldPublishChoice = answers.should_publish?.choice;
      const editorialFocus = answers.editorial_focus?.choice || 'tranquil_equilibrium';
      const confidence = answers.should_publish?.confidence ?? 0.5;
      const latency = Date.now() - t0;

      // Publish if JEV selected publish OR if maximum silence exceeded
      const shouldPublish = (shouldPublishChoice === 'publish') || (minutesSinceLastDispatch >= 18);

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
      clearTimeout(timeout);
      console.warn(`[JEV Screener] Decision request failed (${err.message}), using procedural fallback`);
      return null;
    }
  }

  // Describe a newly stabilized species
  async chronicleSpecies(species, engineStats) {
    const isVeniceAvailable = Boolean(CONFIG.VENICE_API_KEY && CONFIG.VENICE_API_KEY.trim().length > 0);

    if (isVeniceAvailable) {
      try {
        const isHunter = species.carnivory > 0.45;
        const prompt = `A newly evolved species has stabilized in the living microscopic ocean:
- Species ID: ${species.id}
- Ancestor ID: ${species.parentSpeciesId}
- Color hue: ${Math.round(species.hue * 360)}°
- Diet & Lifestyle: ${isHunter ? 'Apex Predator / Carnivore (hunts smaller neighbors, fast swimmer)' : 'Peaceful Herbivore / Autotroph (grazes on warm mineral vents)'}
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
    const isHunter = species.carnivory > 0.45;
    const isGrazer = species.carnivory < 0.25;
    const isLarge = species.size > 9.0;
    const isFast = species.speedMax > 2.2;

    let icon = isHunter ? '⚔️' : (isLarge ? '🐋' : (isFast ? '⚡' : '🌿'));
    let badgeEn = isHunter ? 'Apex Predator' : 'New Lineage';
    let badgeRu = isHunter ? 'Грозный хищник' : 'Новая линия';

    let latinGenus, latinSpecies, enName, ruName, storyEn, storyRu, insightEn, insightRu;

    if (isHunter) {
      latinGenus = isFast ? 'Vibrionox' : 'Acanthostoma';
      latinSpecies = isFast ? 'velox' : (isLarge ? 'tyrannus' : 'atrox');
      enName = isFast ? 'Crimson Dart' : 'Thorny Hunter';
      ruName = isFast ? 'Алый стрелочник' : 'Шипастый ловец';

      storyEn = `A bold mutation has broken the peace: a swift hunter has emerged with crimson membrane and whipping cilia. It no longer grazes on gentle minerals — it stalks slower neighbors with astonishing speed.`;
      storyRu = `Мирный покой капли нарушен: у одного из потомков возникла смелая мутация. Его тело стало обтекаемым, жгутики бьют с удвоенной силой, а мембрана налилась тревожным алым светом. Он больше не ест минералы — он вышел на охоту за своими собратьями.`;

      insightEn = `Predators prevent herbivore overpopulation and force grazers to evolve agility and defensive instincts.`;
      insightRu = `Хищники не дают травоядным перенаселить чашу и поедают медлительных, стимулируя эволюцию скорости.`;
    } else if (isLarge) {
      latinGenus = 'Chronohelix';
      latinSpecies = 'magnifica';
      enName = 'Emerald Leviathan';
      ruName = 'Изумрудный исполин';

      storyEn = `Near the tranquil mineral vents, a slow-moving giant has evolved. Its massive, glowing cell wall stores immense reserves of vitality, gracefully cruising through the micro-currents.`;
      storyRu = `У теплых минеральных источников зародился медлительный исполин. Его крупная мембрана излучает ровное фосфорное сияние, а вместительные вакуоли позволяют запасать рекордное количество энергии.`;

      insightEn = `Large body size shields them from small predators, making this species a majestic living anchor of the reef.`;
      insightRu = `Крупный размер защищает от мелких хищников, превращая этот вид в величественного долгожителя глубин.`;
    } else {
      latinGenus = 'Aethenella';
      latinSpecies = isFast ? 'fugax' : (species.hue < 0.2 ? 'aurata' : 'microstoma');
      enName = isFast ? 'Golden Water-Dancer' : 'Sunlit Grazer';
      ruName = isFast ? 'Золотой плясун' : 'Солнечный пастбищник';

      storyEn = `A delightful peaceful species has gathered around the hydrothermal hearths. Beating their cilia in harmonic synchrony, they form luminous shimmering ribbons across the water.`;
      storyRu = `Очаровательное миролюбивое создание обосновалось у гидротермальных очагов. Синхронизируя биение ресничек в единую живую волну, они кружат хороводом, наполняя воду золотистым светом.`;

      insightEn = `These gentle autotrophs form the foundational bedrock of the food chain, converting mineral heat into living matter.`;
      insightRu = `Эти кроткие создания составляют основу пищевой цепочки, превращая тепло жерл в чистую биомассу.`;
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
        const prompt = `Live field observation of the microscopic aquarium AETHEON:
- Editorial Theme: ${themeGuidance}
- Recent hunts / predation strikes: ${stats.recentKills || 0}
- Recent cell divisions (mitosis): ${stats.recentBirths || 0}
- Recent speciation branches: ${stats.recentSpeciations || 0}
- Dominant lineage: "${stats.dominantSpeciesNameRu || stats.dominantSpeciesNameEn || 'Пастбищник'}" (${stats.dominantCount || 0} organisms)
- Top Apex Hunter: "${stats.topPredatorNameRu || stats.topPredatorNameEn || 'Охотник'}"
- Active population: ${stats.organismCount} organisms across ${stats.speciesCount} species
- Generation milestone: #${stats.generation}

CRITICAL RULES:
1. NEVER start with 'В недрах AETHEON', 'В сердце AETHEON', 'In the depths of AETHEON', 'A vibrant tapestry', or 'A kaleidoscope of life'.
2. NEVER use the phrase 'Это значит, что' or 'This means that'.
3. Describe the EXACT current drama based on the field data and editorial theme above:
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
    let titleEn = 'Dynamic Equilibrium';
    let titleRu = 'Баланс природы в капле';
    let storyEn = `Organisms drift peacefully along the hydrothermal currents, filtering vital minerals and sustaining steady metabolic balance.`;
    let storyRu = `Обитатели капли плавно скользят вдоль теплых течений, фильтруя минеральные соли и поддерживая размеренный метаболический баланс.`;
    let insightEn = `Steady nutrient supply maintains population stability across all active niches.`;
    let insightRu = `Равномерный приток минералов предотвращает резкие колебания численности.`;

    if (focusTheme === 'predation_hunt' || (stats.recentKills || 0) > 2) {
      icon = '⚔️';
      badgeEn = 'Predator Hunt';
      badgeRu = 'Охота хищников';
      titleEn = '⚔️ The Crimson Stalkers';
      titleRu = `⚔️ Охотничий рейд: ${stats.topPredatorNameRu || 'Ловчие'}`;
      storyEn = `Predators have struck with sudden speed in the open channels! Swift hunters darted through the currents, claiming ${stats.recentKills || 3} prey and driving grazers back to the shelter of the mineral vents.`;
      storyRu = `В открытых водных коридорах развернулась стремительная охота! Быстрые хищники нанесли ${stats.recentKills || 3} точных ударов, заставив травоядных искать спасения у теплых минеральных жерл.`;
      insightEn = `Active predation prevents overgrazing and exerts evolutionary pressure for greater speed and defensive reflexes.`;
      insightRu = `Охота сдерживает перенаселение и стимулирует выработку защитной скорости у травоядных.`;
    } else if (focusTheme === 'population_boom' || (stats.recentBirths || 0) > 8) {
      icon = '🌾';
      badgeEn = 'Colony Boom';
      badgeRu = 'Всплеск делений';
      titleEn = '🌾 Thermal Feeding Frenzy';
      titleRu = `🌾 Демографический бум: ${stats.dominantSpeciesNameRu || 'Пастбищники'}`;
      storyEn = `A sudden wave of ${stats.recentBirths || 10} cell divisions has swept through the hydrothermal reefs! The colony has expanded to ${stats.organismCount} organisms, with shimmering clusters contesting the richest feeding plumes.`;
      storyRu = `Теплые гидротермальные оазисы всколыхнула волна из ${stats.recentBirths || 10} клеточных делений! Популяция выросла до ${stats.organismCount} особей, и вокруг жерл разгорелась плотная борьба за питательные шлейфы.`;
      insightEn = `Abundant nutrient intake fuels exponential mitotic divisions, testing the carrying capacity of each thermal zone.`;
      insightRu = `Избыток тепла и солей запускает митоз, проверяя пределы вместимости подводных оазисов.`;
    } else if (focusTheme === 'speciation_branch' || (stats.recentSpeciations || 0) > 0) {
      icon = '🧬';
      badgeEn = 'Speciation';
      badgeRu = 'Ветвление жизни';
      titleEn = '🧬 Evolutionary Divergence';
      titleRu = '🧬 Новое ответвление древа жизни';
      storyEn = `Accumulated genetic mutations have triggered an evolutionary split! A divergent lineage with novel ciliary morphology has broken away to occupy an unexploited fluid zone.`;
      storyRu = `Накопленные в поколениях мутации привели к видообразованию! Новая генетическая ветвь с измененным строением ресничек отделилась и осваивает свободный гидродинамический ярус.`;
      insightEn = `Niche specialization reduces direct competition and expands the ecological complexity of the waters.`;
      insightRu = `Освоение новых ниш снижает прямую конкуренцию и делает экосистему более устойчивой.`;
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
OUTPUT VALID JSON ONLY.`;

    const res = await fetch(CONFIG.VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.VENICE_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.VENICE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 750,
        venice_parameters: {
          include_venice_system_prompt: false
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Venice API responded with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
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
