import { CONFIG } from '../config.js';

export class AINaturalist {
  constructor(lineageManager) {
    this.lineageManager = lineageManager;
    this.journalEntries = [];
    this.currentEpoch = 1;
    this.epochNameEn = 'The Primordial Dawn';
    this.epochNameRu = 'Первичный Рассвет';
    this.lastObservationTime = 0;
    this.totalApiCalls = 0;
    
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

  // Periodic observation check
  async checkObservation(engineStats) {
    const now = Date.now();
    if (now - this.lastObservationTime < CONFIG.AI_OBSERVER_INTERVAL_MS) {
      return false;
    }
    this.lastObservationTime = now;

    // Identify candidate species needing AI taxonomy
    const allSpecies = this.lineageManager.getAllSpecies();
    const unchronicled = allSpecies.find(s => !s.aiChronicle && s.totalCount > 10 && s.population > 1);

    if (unchronicled) {
      await this.chronicleSpecies(unchronicled, engineStats);
      return true;
    } else {
      await this.chronicleEcosystem(engineStats);
      return true;
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

  // Periodic ecosystem status chronicle
  async chronicleEcosystem(stats) {
    const isVeniceAvailable = Boolean(CONFIG.VENICE_API_KEY && CONFIG.VENICE_API_KEY.trim().length > 0);

    if (isVeniceAvailable) {
      try {
        const prompt = `Live field observation of the microscopic aquarium AETHEON:
- Recent hunts / predation strikes: ${stats.recentKills || 0}
- Recent cell divisions (mitosis): ${stats.recentBirths || 0}
- Recent speciation branches: ${stats.recentSpeciations || 0}
- Dominant lineage: "${stats.dominantSpeciesNameEn || 'Grazer'}" (${stats.dominantCount || 0} organisms)
- Top Apex Hunter: "${stats.topPredatorNameEn || 'Solitary stalkers'}"
- Active population: ${stats.organismCount} organisms across ${stats.speciesCount} species
- Generation milestone: #${stats.generation}

CRITICAL RULES:
1. NEVER start with 'In the depths of AETHEON', 'A vibrant tapestry', 'In the microscopic realm', or 'A kaleidoscope of life'.
2. NEVER use the phrase 'Это значит, что' or 'This means that'.
3. Describe the EXACT current drama based on the field data above:
   - If hunts happened (${stats.recentKills || 0} kills), narrate the predator strikes and grazers fleeing toward the vents.
   - If births surged (${stats.recentBirths || 0} divisions), narrate the sudden bloom, crowding, and fight for mineral plumes.
   - If speciation happened (${stats.recentSpeciations || 0}), narrate how a new lineage split away.
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
            icon: response.icon || '🌾',
            badgeEn: response.badgeEn || 'Ecosystem Dispatch',
            badgeRu: response.badgeRu || 'Хроника капли',
            titleEn: response.titleEn || `Ecosystem Dispatch (Gen #${stats.generation || 1})`,
            titleRu: response.titleRu || `Сводка экосистемы (Поколение #${stats.generation || 1})`,
            contentEn: response.storyEn,
            contentRu: response.storyRu,
            insightEn: response.insightEn || '',
            insightRu: response.insightRu || '',
            timestamp: Date.now()
          });
          return;
        }
      } catch (err) {
        console.warn('[AI Naturalist] Venice API ecosystem call failed, using procedural dispatch:', err.message);
      }
    }

    // Adaptive procedural narrative dispatches (based on real recent events)
    let icon = '⚖️';
    let badgeEn = 'Equilibrium';
    let badgeRu = 'Баланс капли';
    let titleEn = 'Dynamic Equilibrium';
    let titleRu = 'Баланс природы в капле';
    let storyEn = `Organisms drift peacefully along the hydrothermal currents, filtering vital minerals and sustaining steady metabolic balance.`;
    let storyRu = `Обитатели капли плавно скользят вдоль теплых течений, фильтруя минеральные соли и поддерживая размеренный метаболический баланс.`;
    let insightEn = `Steady nutrient supply maintains population stability across all active niches.`;
    let insightRu = `Равномерный приток минералов предотвращает резкие колебания численности.`;

    if ((stats.recentKills || 0) > 2) {
      icon = '⚔️';
      badgeEn = 'Predator Hunt';
      badgeRu = 'Охота хищников';
      titleEn = '⚔️ The Crimson Stalkers';
      titleRu = `⚔️ Охотничий рейд: ${stats.topPredatorNameRu || 'Ловчие'}`;
      storyEn = `Predators have struck with sudden speed in the open channels! Swift hunters darted through the currents, claiming ${stats.recentKills} prey and driving grazers back to the shelter of the mineral vents.`;
      storyRu = `В открытых водных коридорах развернулась стремительная охота! Быстрые хищники нанесли ${stats.recentKills} точных ударов, заставив травоядных искать спасения у теплых минеральных жерл.`;
      insightEn = `Active predation prevents overgrazing and exerts evolutionary pressure for greater speed and defensive reflexes.`;
      insightRu = `Охота сдерживает перенаселение и стимулирует выработку защитной скорости у травоядных.`;
    } else if ((stats.recentBirths || 0) > 8) {
      icon = '🌾';
      badgeEn = 'Colony Boom';
      badgeRu = 'Всплеск делений';
      titleEn = '🌾 Thermal Feeding Frenzy';
      titleRu = `🌾 Демографический бум: ${stats.dominantSpeciesNameRu || 'Пастбищники'}`;
      storyEn = `A sudden wave of ${stats.recentBirths} cell divisions has swept through the hydrothermal reefs! The colony has expanded to ${stats.organismCount} organisms, with shimmering clusters contesting the richest feeding plumes.`;
      storyRu = `Теплые гидротермальные оазисы всколыхнула волна из ${stats.recentBirths} клеточных делений! Популяция выросла до ${stats.organismCount} особей, и вокруг жерл разгорелась плотная борьба за питательные шлейфы.`;
      insightEn = `Abundant nutrient intake fuels exponential mitotic divisions, testing the carrying capacity of each thermal zone.`;
      insightRu = `Избыток тепла и солей запускает митоз, проверяя пределы вместимости подводных оазисов.`;
    } else if ((stats.recentSpeciations || 0) > 0) {
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

    // Robust JSON extraction (handles markdown ```json blocks gracefully)
    try {
      return JSON.parse(content);
    } catch (e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw e;
    }
  }
}
