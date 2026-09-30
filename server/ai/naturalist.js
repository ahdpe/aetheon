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
    const unchronicled = allSpecies.find(s => !s.aiChronicle && s.totalCount > 12 && s.population > 2);

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
        const prompt = `Current status of the microscopic living aquarium AETHEON:
- Organisms alive: ${stats.organismCount}
- Number of active species: ${stats.speciesCount}
- Max Generation: ${stats.generation}
- Simulation Day: ${stats.ageDays + 1}
- Mean Energy: ${Math.round(stats.meanEnergy || 50)}

Write a thrilling, poetic 2-sentence dispatch as a nature documentary narrator for everyday visitors.
JSON format ONLY:
{
  "icon": "emoji (e.g. 🌅, 🌾, 🐺, 🌋, ⚖️)",
  "titleEn": "Short title with emoji in English",
  "titleRu": "Краткий заголовок с эмодзи на русском",
  "storyEn": "2 vivid sentences describing the drama in the water in English.",
  "storyRu": "2 ярких предложения о жизни в капле на русском.",
  "insightEn": "1 simple sentence explaining what this means.",
  "insightRu": "1 простое предложение: что это значит простыми словами."
}`;

        const response = await this.queryVeniceAI({ prompt });

        if (response && response.storyRu) {
          this.addEntry({
            type: 'observation',
            icon: response.icon || '🌾',
            badgeEn: 'Ecosystem Dispatch',
            badgeRu: 'Хроника капли',
            titleEn: response.titleEn || `Ecosystem Dispatch (Gen #${stats.generation || 1})`,
            titleRu: response.titleRu || `Сводка экосистемы (Поколение #${stats.generation || 1})`,
            contentEn: response.storyEn,
            contentRu: response.storyRu,
            insightEn: response.insightEn || 'The ecosystem remains in vibrant continuous motion.',
            insightRu: response.insightRu || 'Жизнь в капле продолжает свое непрерывное движение.',
            timestamp: Date.now()
          });
          return;
        }
      } catch (err) {
        console.warn('[AI Naturalist] Venice API ecosystem call failed, using procedural dispatch:', err.message);
      }
    }

    // Procedural narrative dispatches (engaging and accessible)
    const dispatches = [
      {
        icon: '🌾',
        badgeEn: 'Population Boom',
        badgeRu: 'Демографический бум',
        titleEn: '🌾 The Great Golden Harvest',
        titleRu: '🌾 Великое изобилие в капле',
        storyEn: `A celebration of life has gripped the micro-ocean! Over ${stats.organismCount} living creatures thrive across ${stats.speciesCount} distinct lineages. Shimmering clouds of green and amber illuminate every sector.`,
        storyRu: `В микромире настоящий праздник жизни! Более ${stats.organismCount} созданий процветают, разделившись на ${stats.speciesCount} видов. Вокруг пяти источников кипят сияющие колонии, а течения разносят тепло по всей капле.`,
        insightEn: `Resources are plentiful, sparking active cell divisions and intense evolutionary competition.`,
        insightRu: `Ресурсов хватает всем, клетки активно делятся, а конкуренция за лучшие теплые места усиливается.`
      },
      {
        icon: '🐺',
        badgeEn: 'Hunting Season',
        badgeRu: 'Охотничий сезон',
        titleEn: '🐺 The Crimson Patrols',
        titleRu: '🐺 Охотничий сезон в глубинах',
        storyEn: `Tension stirs in the fluid: fast predatory solitons are patrolling the open channels. Gentle grazers cluster tightly near the warmth of the vents, evading the sharp strikes of crimson hunters.`,
        storyRu: `В открытых течениях развернулась напряженная драма: стаи алых охотников патрулируют центр чаши. Мирные пастбищники сбиваются в защитные кольца у теплых жерл, спасаясь от резких выпадов преследователей.`,
        insightEn: `Survival of the fittest in action: only the most alert and swift organisms will pass their genes forward.`,
        insightRu: `Естественный отбор в действии: выживают самые чуткие и маневренные, передавая свои гены новому поколению.`
      },
      {
        icon: '⚖️',
        badgeEn: 'Dynamic Equilibrium',
        badgeRu: 'Баланс природы',
        titleEn: '⚖️ The Breathing Harmony',
        titleRu: '⚖️ Дыхание природного равновесия',
        storyEn: `Following bursts of expansion and hunting, a serene equilibrium settles across the water. Herbivores graze peacefully, predators rest in the currents, and the ocean breathes as a single unified organism.`,
        storyRu: `После бурной волны деления и охоты в чаше наступила гармоничная тишина. Хищники сыты, пастбищники неспешно пасутся на теплом мелководье, и вся экосистема дышит как единый слаженный организм.`,
        insightEn: `Nature has balanced its scales: birth rates and energy consumption have matched the steady output of the vents.`,
        insightRu: `Природа восстановила баланс: рождаемость и аппетит колонии идеально совпали с мощностью гидротермальных жерл.`
      }
    ];

    const pick = dispatches[Math.floor(Math.random() * dispatches.length)];

    this.addEntry({
      type: 'observation',
      icon: pick.icon,
      badgeEn: pick.badgeEn,
      badgeRu: pick.badgeRu,
      titleEn: `${pick.titleEn} (Gen #${stats.generation || 1})`,
      titleRu: `${pick.titleRu} (Поколение #${stats.generation || 1})`,
      contentEn: pick.storyEn,
      contentRu: pick.storyRu,
      insightEn: pick.insightEn,
      insightRu: pick.insightRu,
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
