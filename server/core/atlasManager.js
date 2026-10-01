import { CONFIG } from '../config.js';

export class AtlasManager {
  constructor(engine) {
    this.engine = engine;
    this.atlasEntries = [];
    this.lastRecordedDay = 0;
  }

  init() {
    // If no previous entries exist, seed Day 1 entry
    if (this.atlasEntries.length === 0) {
      this.recordDay(1, true);
    }
  }

  // Generate SVG Topographic Map of the Droplet Biosphere
  generateTopographicMapSvg(dayIndex) {
    const size = 440;
    const center = size * 0.5;
    const radius = 190;
    const vents = this.engine.grid.vents || [];
    const organisms = this.engine.organisms || [];
    const colonies = this.engine.colonies ? this.engine.colonies.getBondPairs() : [];
    const substrate = this.engine.grid.substrate;
    const frost = this.engine.climate ? this.engine.climate.frost : 0;
    const gridSize = CONFIG.GRID_SIZE || 128;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" class="atlas-topo-map">
  <defs>
    <radialGradient id="oceanBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#051226"/>
      <stop offset="70%" stop-color="#030a16"/>
      <stop offset="100%" stop-color="#01040a"/>
    </radialGradient>
    <radialGradient id="reefGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#064e3b" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Droplet Background -->
  <circle cx="${center}" cy="${center}" r="${radius}" fill="url(#oceanBg)" stroke="#00f0ff" stroke-width="2" opacity="0.95"/>
  <circle cx="${center}" cy="${center}" r="${radius - 3}" fill="none" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="3,4" opacity="0.6"/>
  <circle cx="${center}" cy="${center}" r="${radius - 12}" fill="none" stroke="#0284c7" stroke-width="0.5" opacity="0.3"/>`;

    // 1. Bio-calcite Mineral Reefs (Sampled from 128x128 grid)
    if (substrate) {
      svg += `\n  <!-- Bio-Calcite Mineral Reefs & Shoals -->\n  <g class="topo-reefs" opacity="0.85">`;
      const step = 4; // 32x32 sample points
      for (let gy = 0; gy < gridSize; gy += step) {
        for (let gx = 0; gx < gridSize; gx += step) {
          const idx = gy * gridSize + gx;
          const val = substrate[idx];
          if (val > 0.15) {
            // Map grid coords [0, 128) to SVG circle coords
            const nx = (gx / gridSize) - 0.5;
            const ny = (gy / gridSize) - 0.5;
            const sx = center + nx * (radius * 1.8);
            const sy = center + ny * (radius * 1.8);
            const dist = Math.hypot(sx - center, sy - center);
            if (dist < radius - 8) {
              const rSize = Math.max(3.5, Math.min(18, val * 19));
              const op = Math.min(0.75, val * 0.85).toFixed(2);
              svg += `\n    <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${rSize.toFixed(1)}" fill="#059669" opacity="${op}"/>`;
              if (val > 0.36) {
                svg += `\n    <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(rSize * 0.5).toFixed(1)}" fill="#a7f3d0" opacity="0.80"/>`;
              }
            }
          }
        }
      }
      svg += `\n  </g>`;
    }

    // 2. Hydrothermal Vents (including dynamic & ephemeral vents)
    svg += `\n  <!-- Hydrothermal Vents -->\n  <g class="topo-vents">`;
    const ventColors = ['#f59e0b', '#06b6d4', '#f43f5e', '#10b981', '#8b5cf6'];
    for (let v = 0; v < vents.length; v++) {
      const vent = vents[v];
      const vx = center + ((vent.x / gridSize) - 0.5) * (radius * 1.8);
      const vy = center + ((vent.y / gridSize) - 0.5) * (radius * 1.8);
      const color = vent.hue !== undefined ? `hsl(${Math.round(vent.hue * 360)}, 90%, 60%)` : ventColors[v % ventColors.length];
      const isEph = !!vent.isEphemeral;
      
      svg += `\n    <!-- Vent #${v + 1} ${isEph ? '(Ephemeral Fumarole)' : ''} -->
    <circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="${isEph ? 16 : 24}" fill="${color}" opacity="0.14"/>
    <circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="${isEph ? 10 : 15}" fill="${color}" opacity="0.30"/>
    <circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="${isEph ? 5 : 7.5}" fill="${color}" opacity="0.85" filter="url(#glow)"/>
    <circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="2.5" fill="#ffffff"/>
    <text x="${(vx + 9).toFixed(1)}" y="${(vy - 8).toFixed(1)}" fill="${color}" font-family="monospace" font-size="7.5" font-weight="bold">${isEph ? 'FUMAROLE' : `VENT ${v + 1}`}</text>`;
    }
    svg += `\n  </g>`;

    // 3. Colony Intercellular Connections
    if (colonies.length > 0) {
      svg += `\n  <!-- Multicellular Colony Bonds -->\n  <g class="topo-bonds" stroke="#38bdf8" stroke-width="1.3" opacity="0.7">`;
      const orgMap = new Map();
      for (const org of organisms) orgMap.set(org.id, org);

      for (let i = 0; i < Math.min(80, colonies.length); i++) {
        const b = colonies[i];
        const oA = orgMap.get(b.a);
        const oB = orgMap.get(b.b);
        if (oA && oB) {
          const ax = center + ((oA.x / CONFIG.WORLD_SIZE) - 0.5) * (radius * 1.85);
          const ay = center + ((oA.y / CONFIG.WORLD_SIZE) - 0.5) * (radius * 1.85);
          const bx = center + ((oB.x / CONFIG.WORLD_SIZE) - 0.5) * (radius * 1.85);
          const by = center + ((oB.y / CONFIG.WORLD_SIZE) - 0.5) * (radius * 1.85);
          svg += `\n    <line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" />`;
        }
      }
      svg += `\n  </g>`;
    }

    // 4. Authentic Organism Population Morphology (Living Fauna Capsules)
    svg += `\n  <!-- Organism Constellation -->\n  <g class="topo-fauna">`;
    for (let i = 0; i < organisms.length; i += 2) {
      const o = organisms[i];
      const ox = center + ((o.x / CONFIG.WORLD_SIZE) - 0.5) * (radius * 1.85);
      const oy = center + ((o.y / CONFIG.WORLD_SIZE) - 0.5) * (radius * 1.85);
      const angDeg = Math.round(Math.atan2(o.vy || 0, o.vx || 1) * (180 / Math.PI));
      const hue = Math.round((o.hue !== undefined ? o.hue : 0.45) * 360);
      const isHunter = o.carnivory > 0.35;
      const bodyColor = `hsl(${hue}, 85%, 62%)`;
      const coreColor = `hsl(${hue}, 95%, 88%)`;
      const length = Math.max(5.0, Math.min(13.0, (o.size || 6) * 1.3));
      const width = Math.max(3.0, Math.min(7.5, (o.size || 6) * 0.75));

      svg += `\n    <!-- Org #${o.id} -->
    <g transform="translate(${ox.toFixed(1)}, ${oy.toFixed(1)}) rotate(${angDeg})">
      <line x1="${-(length * 0.5).toFixed(1)}" y1="0" x2="${-(length * 1.1).toFixed(1)}" y2="${(Math.sin(i) * 1.5).toFixed(1)}" stroke="${bodyColor}" stroke-width="0.7" opacity="0.6"/>
      <rect x="${-(length * 0.5).toFixed(1)}" y="${-(width * 0.5).toFixed(1)}" width="${length.toFixed(1)}" height="${width.toFixed(1)}" rx="${(width * 0.5).toFixed(1)}" fill="${bodyColor}" opacity="0.88" stroke="${isHunter ? '#f43f5e' : '#38bdf8'}" stroke-width="0.7"/>
      <circle cx="${(length * 0.12).toFixed(1)}" cy="0" r="${(width * 0.28).toFixed(1)}" fill="${coreColor}"/>
    </g>`;
    }
    svg += `\n  </g>`;

    // 5. Frost Dendrites along Rim (if active)
    if (frost > 1) {
      svg += `\n  <!-- Glacial Meniscus Ice Needles -->\n  <g class="topo-frost" stroke="#bae6fd" stroke-width="1" opacity="0.75">`;
      for (let k = 0; k < 36; k++) {
        const ang = (k / 36) * Math.PI * 2;
        const len = (frost / 115) * 22;
        const x1 = center + Math.cos(ang) * radius;
        const y1 = center + Math.sin(ang) * radius;
        const x2 = center + Math.cos(ang) * (radius - len);
        const y2 = center + Math.sin(ang) * (radius - len);
        svg += `\n    <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
      }
      svg += `\n  </g>`;
    }

    // 6. Cartographic Overlays (Reticle, Scale, Cardinal Compass)
    svg += `\n  <!-- Cartographic Metadata -->
  <g class="topo-hud" font-family="'JetBrains Mono', monospace" font-size="8" fill="#00f0ff" opacity="0.85">
    <!-- Center reticle -->
    <line x1="${center - 8}" y1="${center}" x2="${center + 8}" y2="${center}" stroke="#00f0ff" stroke-width="0.8"/>
    <line x1="${center}" y1="${center - 8}" x2="${center}" y2="${center + 8}" stroke="#00f0ff" stroke-width="0.8"/>
    <circle cx="${center}" cy="${center}" r="3" fill="none" stroke="#00f0ff" stroke-width="0.8"/>
    
    <!-- Outer Caliper Degree Marks -->
    <text x="${center - 4}" y="18" text-anchor="middle">0° N</text>
    <text x="${size - 18}" y="${center + 3}">90° E</text>
    <text x="${center - 4}" y="${size - 8}" text-anchor="middle">180° S</text>
    <text x="8" y="${center + 3}">270° W</text>

    <!-- Scale Bar & Survey Badge -->
    <rect x="22" y="${size - 32}" width="120" height="20" fill="rgba(6,12,26,0.85)" rx="4" stroke="rgba(0,240,255,0.4)" stroke-width="0.8"/>
    <text x="30" y="${size - 23}" font-size="7.5" fill="#38bdf8">SCALE: 300 μm</text>
    <line x1="30" y1="${size - 17}" x2="130" y2="${size - 17}" stroke="#38bdf8" stroke-width="1.2"/>
    <line x1="30" y1="${size - 20}" x2="30" y2="${size - 14}" stroke="#38bdf8" stroke-width="1.2"/>
    <line x1="130" y1="${size - 20}" x2="130" y2="${size - 14}" stroke="#38bdf8" stroke-width="1.2"/>

    <!-- Day Badge -->
    <rect x="${size - 142}" y="${size - 32}" width="120" height="20" fill="rgba(6,12,26,0.85)" rx="4" stroke="rgba(0,240,255,0.4)" stroke-width="0.8"/>
    <text x="${size - 134}" y="${size - 19}" font-size="7.5" fill="#00f0ff">DAY ${dayIndex} SURVEY</text>
  </g>
</svg>`;

    return svg;
  }

  // Record a daily atlas entry
  async recordDay(dayIndex, isInitial = false) {
    const stats = this.engine.getStats ? this.engine.getStats() : {};
    const svgMap = this.generateTopographicMapSvg(dayIndex);
    const dateFormatted = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    let titleEn = `Day ${dayIndex}: The Great Biosphere Expansion`;
    let titleRu = `День ${dayIndex}: Экспансия Биосферы и Рост Рифов`;
    let summaryEn = `A pivotal 24-hour cycle in the droplet. The population sustained ${stats.organismCount || 280} living entities across ${stats.speciesCount || 40} stabilized species. Mineral calcite precipitation covered ${stats.reefCoverage || 16}% of the manifold, channeling hydrothermal currents into sheltered nurseries.`;
    let summaryRu = `Знаменательный 24-часовой цикл в микрокапле. Популяция удерживает ${stats.organismCount || 280} живых особей в ${stats.speciesCount || 40} стабилизировавшихся видах. Био-кальцитовые рифы покрыли ${stats.reefCoverage || 16}% дна, направляя теплые минеральные шлейфы в защищенные лагуны.`;

    if (dayIndex === 1) {
      titleEn = `Day I: Genesis & The Primordial Dawn`;
      titleRu = `День I: Генезис и Первичный Рассвет`;
      summaryEn = `The microscopic droplet sparked into life around five hydrothermal mineral hearths. The first autotrophic grazers colonized the thermal plumes, initiating bio-calcite mineral excretion and giving rise to the very first multicellular superorganisms and solitary apex hunters.`;
      summaryRu = `Микроскопическая капля ожила вокруг пяти гидротермальных очагов. Первые миролюбивые пастбищники заселили теплые минеральные струи, положив начало биокальцитовым рифам, первым многоклеточным колониям и ловким охотникам глубин.`;
    }

    const entry = {
      day: dayIndex,
      date: dateFormatted,
      timestamp: Date.now(),
      epoch: stats.epoch || 1,
      epochNameEn: stats.epochNameEn || 'The Primordial Dawn',
      epochNameRu: stats.epochNameRu || 'Первичный Рассвет',
      titleEn,
      titleRu,
      summaryEn,
      summaryRu,
      svgMap,
      metrics: {
        population: stats.organismCount || 280,
        speciesCount: stats.speciesCount || 50,
        generation: stats.generation || 1,
        coloniesCount: stats.colonyCount || 0,
        largestColonySize: stats.largestColonySize || 0,
        reefCoverage: stats.reefCoverage || 16,
        dominantSpeciesEn: stats.dominantSpeciesNameEn || 'Grazer',
        dominantSpeciesRu: stats.dominantSpeciesNameRu || 'Пастбищник',
        apexHunterEn: stats.topPredatorNameEn || 'Hunter',
        apexHunterRu: stats.topPredatorNameRu || 'Ловчий',
        temperatureC: stats.temperatureCelsius || 28.5
      }
    };

    // If day already exists, update it; otherwise add to front
    const existingIdx = this.atlasEntries.findIndex(e => e.day === dayIndex);
    if (existingIdx >= 0) {
      this.atlasEntries[existingIdx] = entry;
    } else {
      this.atlasEntries.unshift(entry);
    }
    this.lastRecordedDay = dayIndex;

    console.log(`[AtlasManager] Recorded Daily Atlas Entry for Day ${dayIndex}. Total entries: ${this.atlasEntries.length}`);
    return entry;
  }

  // Periodic check called from engine step (e.g. every 500 ticks)
  checkDailyCycle() {
    const ageSeconds = Math.floor((Date.now() - this.engine.genesisTime) / 1000);
    const currentDay = Math.floor(ageSeconds / 86400) + 1;

    if (currentDay > this.lastRecordedDay) {
      this.recordDay(currentDay);
    }
  }

  getAllEntries() {
    return this.atlasEntries;
  }

  toJSON() {
    return this.atlasEntries.map(e => ({
      ...e,
      // Keep SVG map in persistence
      svgMap: e.svgMap
    }));
  }

  fromJSON(entries) {
    if (Array.isArray(entries) && entries.length > 0) {
      this.atlasEntries = entries;
      this.lastRecordedDay = Math.max(...entries.map(e => e.day || 1));
      console.log(`[AtlasManager] Restored ${entries.length} Daily Atlas entries from snapshot (Latest: Day ${this.lastRecordedDay}).`);
    } else {
      this.init();
    }
  }
}
