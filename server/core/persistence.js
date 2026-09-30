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
          genome: org.genome
        })),
        speciesList: engine.lineage.getAllSpecies(),
        journalEntries: engine.naturalist.journalEntries,
        substrateBase64: (engine.grid && engine.grid.substrate) ? Buffer.from(engine.grid.substrate.buffer).toString('base64') : null,
        colonyData: engine.colonies ? engine.colonies.getSerializableData() : [],
        climate: engine.climate ? engine.climate.toJSON() : null,
        atlasEntries: engine.atlas ? engine.atlas.toJSON() : []
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
          return org;
        });
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

      return true;
    } catch (err) {
      console.error('[Persistence] Error loading snapshot, starting fresh:', err.message);
      return false;
    }
  }
}
