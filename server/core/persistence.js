import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CONFIG } from '../config.js';
import { Organism } from './organism.js';
import { getRandomState, setRandomState } from './random.js';
const checksum = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const fieldNames = ['nutrients', 'waste', 'signal', 'substrate'];
const encode = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');

export class PersistenceManager {
  constructor(filePath = CONFIG.SNAPSHOT_FILE) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  read(file) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.formatVersion !== undefined && data.formatVersion !== 2) throw new Error('Unsupported snapshot version');
    if (data.formatVersion === 2 && typeof data.checksum !== 'string') throw new Error('Missing snapshot checksum');
    if (data.checksum) {
      const { checksum: expected, ...payload } = data;
      if (checksum(payload) !== expected) throw new Error('Snapshot checksum mismatch');
    }
    if (!Array.isArray(data.organisms) || !Array.isArray(data.speciesList) || !Number.isSafeInteger(data.ticks) || data.ticks < 0 || !Number.isFinite(data.genesisTime)) throw new Error('Invalid snapshot');
    if (data.formatVersion === 2 && (!Number.isSafeInteger(data.rngState) || data.rngState < 0 || data.rngState > 0xffffffff)) throw new Error('Invalid random state');
    const ids = new Set();
    for (const o of data.organisms) {
      if (![o.x, o.y, o.energy, o.age, o.genome?.size, o.genome?.carnivory].every(Number.isFinite)) throw new Error('Invalid organism');
      if (data.formatVersion >= 2) {
        if (!Number.isSafeInteger(o.id) || o.id < 1 || ids.has(o.id)) throw new Error('Invalid organism ID');
        ids.add(o.id);
      }
    }
    return data;
  }
  saveSnapshot(engine) {
    try {
      const data = {
        formatVersion: 2, savedAt: Date.now(), genesisTime: engine.genesisTime, ticks: engine.ticks,
        rngState: getRandomState(), nextOrganismId: Organism.getNextId(),
        organisms: engine.organisms.map(o => {
          const { playerSteer, isPiloted, ...state } = o;
          return state;
        }),
        speciesList: engine.lineage.getAllSpecies(), nextSpeciesId: engine.lineage.nextSpeciesId,
        dynasties: engine.getSerializableDynasties?.() ?? [],
        currentEpoch: engine.naturalist.currentEpoch, epochNameEn: engine.naturalist.epochNameEn, epochNameRu: engine.naturalist.epochNameRu,
        journalEntries: engine.naturalist.journalEntries,
        observationState: { lastObservationTime: engine.naturalist.lastObservationTime, lastJevScreenTime: engine.naturalist.lastJevScreenTime },
        fields: Object.fromEntries(fieldNames.map(n => [n, encode(engine.grid[n])])),
        vents: engine.grid.vents, ephemeralFumaroles: engine.grid.ephemeralFumaroles,
        nutrientBlooms: engine.nutrientBlooms ?? [], nextBloomId: engine.nextBloomId, lastVisitorFeed: engine.lastVisitorFeed,
        colonyData: engine.colonies?.getSerializableData() ?? [], climate: engine.climate?.toJSON(),
        atlasEntries: engine.atlas?.toJSON() ?? [], cataclysmData: engine.cataclysms?.toJSON(), algaeData: engine.algae?.toJSON(),
        recentWindow: engine.recentWindow, migrationState: engine.migrationState, legacyColonyArchive: engine.legacyColonyArchive
      };
      data.checksum = checksum(data);
      const temp = `${this.filePath}.tmp`;
      const fd = fs.openSync(temp, 'w', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      if (fs.existsSync(this.filePath)) {
        try { this.read(this.filePath); fs.copyFileSync(this.filePath, `${this.filePath}.previous`); } catch { /* Retain the last known good backup. */ }
      }
      fs.renameSync(temp, this.filePath);
      const dir = fs.openSync(path.dirname(this.filePath), 'r');
      try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
      return true;
    } catch (err) { console.error('[Persistence] Save failed:', err.message); return false; }
  }
  loadSnapshot(engine) {
    const candidates = [this.filePath, `${this.filePath}.previous`].filter(f => fs.existsSync(f));
    if (!candidates.length) return false;
    let data;
    for (const file of candidates) {
      try { data = this.read(file); this.validateFields(data, engine.grid); break; }
      catch (err) { data = null; console.error('[Persistence] Rejected snapshot:', file, err.message); }
    }
    if (!data) throw new Error('No valid world snapshot; refusing to replace the existing world with Genesis');
    const identityRecovery = !data.formatVersion ? this.recoverLegacyIds(data) : null;
    engine.migrationState = data.migrationState ?? identityRecovery;
    engine.legacyColonyArchive = data.legacyColonyArchive ?? (identityRecovery?.identitiesReassigned ? data.colonyData : undefined);
    engine.genesisTime = data.genesisTime;
    engine.ticks = data.ticks;
    engine.naturalist.currentEpoch = data.currentEpoch ?? 1;
    engine.naturalist.epochNameEn = data.epochNameEn ?? 'The Primordial Dawn';
    engine.naturalist.epochNameRu = data.epochNameRu ?? 'Первичный Рассвет';
    engine.naturalist.journalEntries = data.journalEntries ?? [];
    if (!data.formatVersion) for (const entry of engine.naturalist.journalEntries) entry.legacyUnverified = true;
    Object.assign(engine.naturalist, data.observationState ?? {});
    engine.lineage.speciesMap.clear();
    for (const sp of data.speciesList) {
      if (!data.formatVersion) { sp.legacyCensusCount = sp.totalCount; sp.totalCount = 0; sp.countingSince = Date.now(); }
      engine.lineage.speciesMap.set(sp.id, sp);
    }
    engine.lineage.rebuildIndex(!data.formatVersion);
    engine.lineage.nextSpeciesId = data.speciesList.reduce((max, s) => Math.max(max, s.id + 1), data.nextSpeciesId ?? 1);
    engine.organisms = data.organisms.map(saved => {
      const canonical = engine.lineage.getSpecies(saved.speciesId)?.canonicalId;
      if (!data.formatVersion && canonical && canonical !== saved.speciesId) {
        saved.legacySpeciesId = saved.speciesId; saved.speciesId = canonical;
      }
      const org = new Organism(saved.x, saved.y, saved.genome, saved.generation, saved.parentId, saved.speciesId);
      Object.assign(org, saved, { playerSteer: { x: 0, y: 0, ticks: 0 }, isPiloted: false });
      org.birthTime = saved.birthTime ?? data.savedAt - saved.age * CONFIG.TICK_INTERVAL_MS;
      return org;
    });
    Organism.setNextId(Math.max(data.nextOrganismId ?? 1, ...engine.organisms.map(o => o.id + 1), ...engine.organisms.map(o => (o.parentId ?? 0) + 1)));
    if (data.fields) for (const n of fieldNames) {
      const b = Buffer.from(data.fields[n], 'base64');
      const bytes = new Uint8Array(engine.grid[n].buffer, engine.grid[n].byteOffset, engine.grid[n].byteLength);
      bytes.set(b);
    }
    else if (data.substrateBase64) {
      const b = Buffer.from(data.substrateBase64, 'base64');
      if (b.length === engine.grid.substrate.byteLength) new Uint8Array(engine.grid.substrate.buffer).set(b);
      console.warn('[Persistence] Legacy snapshot has no chemical fields; chemistry continuity begins with this migration');
    }
    if (data.vents) engine.grid.vents = data.vents;
    if (data.ephemeralFumaroles) engine.grid.ephemeralFumaroles = data.ephemeralFumaroles;
    engine.nutrientBlooms = data.nutrientBlooms ?? [];
    engine.nextBloomId = data.nextBloomId ?? 1;
    engine.lastVisitorFeed = data.lastVisitorFeed;
    if (data.recentWindow) engine.recentWindow = data.recentWindow;
    engine.restoreDynasties?.(data.dynasties ?? []);
    engine.colonies?.restoreFromData(identityRecovery?.identitiesReassigned ? [] : (data.colonyData ?? []), new Map(engine.organisms.map(o => [o.id, o])));
    if (data.climate) engine.climate?.fromJSON(data.climate);
    if (data.atlasEntries) engine.atlas?.fromJSON(data.atlasEntries);
    if (data.cataclysmData) engine.cataclysms?.fromJSON(data.cataclysmData);
    if (data.algaeData) engine.algae?.fromJSON(data.algaeData);
    engine.lineage.updatePopulations(engine.organisms);
    if (data.rngState !== undefined) setRandomState(data.rngState);
    console.log(`[Persistence] Restored tick ${data.ticks}, ${engine.organisms.length} stable organism IDs`);
    return true;
  }
  validateFields(data, grid) {
    if (data.formatVersion >= 2) for (const n of fieldNames) {
      if (typeof data.fields?.[n] !== 'string' || Buffer.from(data.fields[n], 'base64').length !== grid[n].byteLength) throw new Error(`Invalid ${n} field`);
    }
  }
  recoverLegacyIds(data) {
    const file = `${this.filePath}.ids`;
    if (!fs.existsSync(file)) throw new Error('Legacy world needs a matching live ID capture before migration');
    const packet = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (packet.t !== data.ticks || packet.n !== data.organisms.length) throw new Error('Legacy ID capture tick does not match snapshot');
    if (packet.identitiesReassigned && packet.snapshotSha256 !== createHash('sha256').update(fs.readFileSync(this.filePath)).digest('hex')) throw new Error('Recovery receipt does not match legacy snapshot');
    if (packet.identitiesReassigned) {
      if (!Array.isArray(packet.assignedIds) || packet.assignedIds.length !== data.organisms.length || new Set(packet.assignedIds).size !== data.organisms.length || !packet.assignedIds.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Invalid recovery identities');
      for (let i = 0; i < data.organisms.length; i++) data.organisms[i].id = packet.assignedIds[i];
      if (data.cataclysmData) {
        data.cataclysmData.lazarusIds = data.organisms.filter(o => o.isLazarus).map(o => o.id);
        data.cataclysmData.lazarusOrganisms = undefined;
      }
      console.warn('[Persistence] Restored the last legacy checkpoint with new IDs; previous live identities and unsaved time could not be recovered');
      return { identitiesReassigned: true, checkpointTick: data.ticks, lastObservedTick: packet.lastObservedTick, migratedAt: Date.now(), reason: 'legacy_shutdown_timeout' };
    }
    const rows = new Map();
    const key = (x, y, species) => `${Math.fround(x)}:${Math.fround(y)}:${species}`;
    for (let i = 0; i < packet.orgs.length; i += 10) {
      const k = key(packet.orgs[i + 1], packet.orgs[i + 2], packet.orgs[i + 8]);
      if (rows.has(k)) throw new Error('Ambiguous legacy position');
      rows.set(k, packet.orgs[i]);
    }
    for (const o of data.organisms) {
      o.id = rows.get(key(o.x, o.y, o.speciesId));
      if (!Number.isSafeInteger(o.id)) throw new Error('Legacy organism could not be matched');
    }
    console.log('[Persistence] Recovered all legacy organism IDs from the final live tick');
    return null;
  }
}
