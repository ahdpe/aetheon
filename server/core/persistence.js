import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { Organism } from './organism.js';

export class PersistenceManager {
  constructor(filePath = CONFIG.SNAPSHOT_FILE) {
    this.filePath = filePath;
    this.ensureDirectory();
  }

  ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  saveSnapshot(engine) {
    try {
      const data = {
        savedAt: Date.now(),
        genesisTime: engine.genesisTime,
        ticks: engine.ticks,
        currentEpoch: engine.naturalist.currentEpoch,
        epochNameEn: engine.naturalist.epochNameEn,
        epochNameRu: engine.naturalist.epochNameRu,
        organisms: engine.organisms.map(org => ({
          x: org.x,
          y: org.y,
          vx: org.vx,
          vy: org.vy,
          energy: org.energy,
          age: org.age,
          generation: org.generation,
          parentId: org.parentId,
          speciesId: org.speciesId,
          kills: org.kills,
          childrenCount: org.childrenCount,
          phase: org.phase,
          heading: org.heading,
          isLazarus: org.isLazarus || false,
          isAvatarLineage: org.isAvatarLineage || false,
          dynastyName: org.dynastyName || null,
          dynastyGen: org.dynastyGen || 0,
          founderId: org.founderId || null,
          maturity: org.maturity !== undefined ? org.maturity : 1.0,
          genome: org.genome
        })),
        speciesList: engine.lineage.getAllSpecies(),
        dynasties: engine.getSerializableDynasties ? engine.getSerializableDynasties() : [],
        journalEntries: engine.naturalist.journalEntries,
        substrateBase64: (engine.grid && engine.grid.substrate) ? Buffer.from(engine.grid.substrate.buffer).toString('base64') : null,
        colonyData: engine.colonies ? engine.colonies.getSerializableData() : [],
        climate: engine.climate ? engine.climate.toJSON() : null,
        atlasEntries: engine.atlas ? engine.atlas.toJSON() : [],
        cataclysmData: engine.cataclysms ? engine.cataclysms.toJSON() : null,
        algaeData: engine.algae ? engine.algae.toJSON() : null
      };

      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data));
      fs.renameSync(tempPath, this.filePath);
      console.log(`[Persistence] World snapshot successfully saved (${engine.organisms.length} organisms).`);
    } catch (err) {
      console.error('[Persistence] Failed to save snapshot:', err.message);
    }
  }

  loadSnapshot(engine) {
    try {
      if (!fs.existsSync(this.filePath)) {
        console.log('[Persistence] No previous world snapshot found. Starting fresh Genesis.');
        return false;
      }

      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);

      engine.genesisTime = data.genesisTime || Date.now();
      engine.ticks = data.ticks || 0;
      if (data.currentEpoch) engine.naturalist.currentEpoch = data.currentEpoch;
      if (data.epochNameEn) engine.naturalist.epochNameEn = data.epochNameEn;
      if (data.epochNameRu) engine.naturalist.epochNameRu = data.epochNameRu;
      if (data.climate && engine.climate) engine.climate.fromJSON(data.climate);
      if (data.atlasEntries && engine.atlas) engine.atlas.fromJSON(data.atlasEntries);
      if (data.cataclysmData && engine.cataclysms) engine.cataclysms.fromJSON(data.cataclysmData);
      if (data.algaeData && engine.algae) engine.algae.fromJSON(data.algaeData);

      if (data.speciesList && Array.isArray(data.speciesList)) {
        engine.lineage.speciesMap.clear();
        for (const sp of data.speciesList) {
          engine.lineage.speciesMap.set(sp.id, sp);
          if (sp.id >= engine.lineage.nextSpeciesId) {
            engine.lineage.nextSpeciesId = sp.id + 1;
          }
        }
      }

      if (data.journalEntries && Array.isArray(data.journalEntries)) {
        engine.naturalist.journalEntries = data.journalEntries;
      }

      if (data.substrateBase64 && engine.grid && engine.grid.substrate) {
        try {
          const buf = Buffer.from(data.substrateBase64, 'base64');
          if (buf.byteLength === engine.grid.substrate.byteLength) {
            engine.grid.substrate.set(new Float32Array(buf.buffer, buf.byteOffset, engine.grid.substrate.length));
            console.log('[Persistence] Successfully restored bio-calcite substrate reef matrix.');
          }
        } catch (e) {
          console.warn('[Persistence] Substrate restoration failed:', e.message);
        }
      }

      if (data.organisms && Array.isArray(data.organisms)) {
        engine.organisms = data.organisms.map(saved => {
          const org = new Organism(
            saved.x,
            saved.y,
            saved.genome,
            saved.generation,
            saved.parentId,
            saved.speciesId
          );
          org.vx = saved.vx;
          org.vy = saved.vy;
          org.energy = saved.energy;
          org.age = saved.age;
          org.kills = saved.kills || 0;
          org.childrenCount = saved.childrenCount || 0;
          org.phase = saved.phase;
          org.heading = saved.heading;
          org.isLazarus = saved.isLazarus || false;
          org.isAvatarLineage = saved.isAvatarLineage || false;
          org.dynastyName = saved.dynastyName || null;
          org.dynastyGen = saved.dynastyGen || 0;
          org.founderId = saved.founderId || null;
          org.maturity = (saved.maturity !== undefined) ? saved.maturity : 1.0;
          org.size = org.adultSize * (0.38 + 0.62 * org.maturity);
          return org;
        });
      }

      // Restore active and archived dynasties
      if (data.dynasties && engine.restoreDynasties) {
        engine.restoreDynasties(data.dynasties);
      }

      console.log(`[Persistence] Resumed world from snapshot! Age: ${Math.floor((Date.now() - engine.genesisTime) / (1000 * 60))} mins, Pop: ${engine.organisms.length}`);

      // Restore multicellular colonies (must happen after organisms are loaded)
      if (data.colonyData && engine.colonies) {
        const orgsById = new Map();
        for (const org of engine.organisms) {
          orgsById.set(org.id, org);
        }
        engine.colonies.restoreFromData(data.colonyData, orgsById);
        const cs = engine.colonies.getStats();
        if (cs.colonyCount > 0) {
          console.log(`[Persistence] Restored ${cs.colonyCount} multicellular colonies (${cs.totalBondedOrganisms} bonded organisms).`);
        }
      }

      // De-clumping check on resume: if organisms are stacked in a dense pile (> 10 organisms within 35 μm), disperse them nicely across the droplet and vents
      if (engine.organisms && engine.organisms.length > 0) {
        const CX = CONFIG.CHAMBER_CENTER_X;
        const CY = CONFIG.CHAMBER_CENTER_Y;
        const R = CONFIG.CHAMBER_RADIUS * 0.72;
        const vents = (engine.grid && engine.grid.vents) ? engine.grid.vents : [];

        let dispersedCount = 0;
        for (let i = 0; i < engine.organisms.length; i++) {
          const org = engine.organisms[i];
          let closeCount = 0;
          for (let j = 0; j < engine.organisms.length; j++) {
            if (i === j) continue;
            const dx = org.x - engine.organisms[j].x;
            const dy = org.y - engine.organisms[j].y;
            if (dx * dx + dy * dy < 35 * 35) closeCount++;
          }
          if (closeCount > 10) {
            dispersedCount++;
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 260;
            if (vents.length > 0 && Math.random() < 0.65) {
              const vent = vents[Math.floor(Math.random() * vents.length)];
              const vx = (vent.x / CONFIG.GRID_SIZE) * CONFIG.WORLD_SIZE;
              const vy = (vent.y / CONFIG.GRID_SIZE) * CONFIG.WORLD_SIZE;
              org.x = Math.max(CX - R, Math.min(CX + R, vx + (Math.random() - 0.5) * 140));
              org.y = Math.max(CY - R, Math.min(CY + R, vy + (Math.random() - 0.5) * 140));
            } else {
              org.x = Math.max(CX - R, Math.min(CX + R, CX + Math.cos(angle) * dist));
              org.y = Math.max(CY - R, Math.min(CY + R, CY + Math.sin(angle) * dist));
            }
            // Give fresh randomized heading and mild velocity
            org.heading = Math.random() * Math.PI * 2;
            org.vx = Math.cos(org.heading) * 0.8;
            org.vy = Math.sin(org.heading) * 0.8;
          }
        }
        if (dispersedCount > 0) {
          console.log(`[Persistence] De-clumped and naturally dispersed ${dispersedCount} organisms across the droplet manifold.`);
        }
      }

      return true;
    } catch (err) {
      console.error('[Persistence] Error loading snapshot, starting fresh:', err.message);
      return false;
    }
  }
}
