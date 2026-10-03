import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG } from '../config.js';
import { visitorCookie } from '../core/nursery.js';

export class NetworkManager {
  constructor(server, engine) {
    this.engine = engine;
    this.wss = new WebSocketServer({ server, maxPayload: 4096, perMessageDeflate: false });
    this.clients = new Set();
    
    this.setupListeners();
    this.heartbeat = setInterval(() => {
      for (const ws of this.clients) {
        if (!ws.alive || ws.readyState !== WebSocket.OPEN) { ws.terminate(); continue; }
        ws.alive = false; ws.ping();
      }
    }, 30000);
    this.heartbeat.unref();
    this.wss.on('close', () => clearInterval(this.heartbeat));

    // Broadcast live naturalist observations as they are written by AI
    if (this.engine.naturalist) {
      this.engine.naturalist.onNewEntry = (entry) => {
        this.broadcast({
          type: 'journal_entry',
          entry
        });
      };
    }
  }

  setupListeners() {
    this.wss.on('connection', (ws, req) => {
      // Rejected connections can still emit errors while their close frame is pending.
      ws.on('error', (err) => {
        console.warn('[Network] Client socket error:', err.message);
        this.engine.releasePilot(ws.clientId);
        this.clients.delete(ws);
      });
      if (this.clients.size >= 64) { ws.close(1013, 'Ocean spectator capacity reached'); return; }
      if (req.headers.origin) {
        try { if (new URL(req.headers.origin).host !== req.headers.host) { ws.close(1008, 'Origin rejected'); return; } }
        catch { ws.close(1008, 'Origin rejected'); return; }
      }
      ws.clientId = randomUUID();
      const localProxy=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const address=localProxy&&typeof req.headers['x-real-ip']==='string'?req.headers['x-real-ip']:req.socket.remoteAddress;
      ws.nurseryIdentity=this.engine.nursery.identity(visitorCookie(req.headers.cookie),address);
      ws.alive = true; ws.on('pong', () => { ws.alive = true; });
      ws.tokens = 40; ws.refillTime = Date.now(); ws.lastActions = new Map();
      this.clients.add(ws);
      console.log(`[WS] Client connected from ${req.socket.remoteAddress} (ID: ${ws.clientId}). Active clients: ${this.clients.size}`);

      // Send initial hand-shake state
      const initialPayload = {
        type: 'init',
        worldCreatedAt: this.engine.genesisTime,
        worldSize: CONFIG.WORLD_SIZE,
        gridSize: CONFIG.GRID_SIZE,
        terrain:this.engine.terrainState,
        geography:this.engine.geography.broadcast(),
        chamber: {
          cx: CONFIG.CHAMBER_CENTER_X,
          cy: CONFIG.CHAMBER_CENTER_Y,
          r: CONFIG.CHAMBER_RADIUS
        },
        vents: this.engine.grid.vents,
        stats: this.engine.getStats(),
        journal: this.engine.naturalist.getRecentEntries(30),
        species: this.engine.lineage.getRecentSpecies(12),
        visitors: this.clients.size,
        thumbnail: Array.from(this.engine.grid.getThumbnail(48)), // 48x48 initial chemical field
        atlas: this.engine.atlas ? this.engine.atlas.getAllEntries() : [],
        algae: this.engine.algae ? this.engine.algae.getBroadcastState() : [],
        remains:this.engine.remains.broadcast(), ecology:this.engine.getEcologyState()
      };

      ws.send(JSON.stringify(initialPayload));
      this.broadcastVisitorCount();

      ws.on('message', (message) => {
        try {
          const now = Date.now();
          ws.tokens = Math.min(40, ws.tokens + (now - ws.refillTime) * 0.025); ws.refillTime = now;
          if (ws.tokens < 1) { ws.close(1008, 'Message rate exceeded'); return; }
          ws.tokens--;
          const data = JSON.parse(message);
          if (data && typeof data === 'object' && !Array.isArray(data)) this.handleClientMessage(ws, data);
        } catch (err) {
          console.error('[Network] Error parsing message:', err.message);
        }
      });

      ws.on('close', () => {
        this.engine.releasePilot(ws.clientId);
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected (${ws.clientId}). Active clients: ${this.clients.size}`);
        this.broadcastVisitorCount();
      });

    });
  }

  handleClientMessage(ws, msg) {
    const now = Date.now();
    const cooldowns = { interact: 10000, get_codex: 150, get_atlas: 2000, inspect: 500, get_family: 1000, get_tour: 2000, found_dynasty: 60000, name_lineage: 60000, dive_start: 500, get_nursery:1000, nursery_release:5000 };
    const cooldown = cooldowns[msg.type];
    if (cooldown) {
      if (now - (ws.lastActions?.get(msg.type) ?? 0) < cooldown) return;
      ws.lastActions ??= new Map(); ws.lastActions.set(msg.type, now);
    }
    if(msg.type==='get_nursery') {
      ws.send(JSON.stringify({type:'nursery_status',...this.engine.nursery.status(this.engine,ws.nurseryIdentity??{visitor:null,address:null})}));
    } else if(msg.type==='nursery_release') {
      const result=this.engine.nursery.submit(this.engine,ws.nurseryIdentity??{visitor:null,address:null},msg);
      ws.send(JSON.stringify({type:'nursery_result',requestId:msg.requestId,...result}));
    } else if (msg.type === 'interact') {
      const res = this.engine.injectInteraction(msg.action, msg.x, msg.y);
      if (res.success) {
        // Broadcast ripple effect to all visitors so they see each other's touch!
        this.broadcast({
          type: 'visitor_ripple',
          action: msg.action,
          x: msg.x,
          y: msg.y
        });
      }
    } else if (msg.type === 'inspect') {
      const profile = this.engine.getOrganismProfile(msg.id);
      ws.send(JSON.stringify({
        type: 'inspect_result',
        id: msg.id,
        profile
      }));
    } else if (msg.type === 'get_tour') {
      const living = this.engine.organisms;
      const healthy=living.filter(o=>!o.isDead() && o.energy>50 && o.age<10000);
      const byId=new Map(healthy.map(o=>[o.id,o]));
      const recentBirth = [...this.engine.history.nodes.values()].reverse().find(n => n.parentId > 0 && n.bornTick !== null && n.bornTick >= this.engine.ticks - 300 && n.bornTick <= this.engine.ticks - 50 && byId.has(n.id));
      const hunter = healthy.find(o => o.carnivory > 0.35 && o.maturity>0.7);
      const descendant = healthy.find(o => o.generation > (this.engine.history.families.get(o.familyId)?.founderGeneration ?? Infinity));
      const choices = [{id:recentBirth?.id,reason:'birth'},{id:hunter?.id,reason:'hunter'},{id:descendant?.id,reason:'family'}];
      const choice = choices[(ws.tourStep ?? 0) % choices.length];
      ws.tourStep = (ws.tourStep ?? 0) + 1;
      const target = choice.id ? choice : choices.find(c => c.id) ?? {id:healthy[0]?.id??living.find(o=>!o.isDead())?.id,reason:'cell'};
      const org = living.find(o => o.id === target.id);
      ws.send(JSON.stringify({type:'tour_target',...target,position:org ? {x:org.x,y:org.y} : null}));
    } else if (msg.type === 'get_family') {
      if (!Number.isSafeInteger(msg.id) || msg.id < 1) return;
      const family = this.engine.history.describe(msg.id, this.engine.organisms, this.engine.ticks);
      const species = family && this.engine.lineage.getSpecies(family.speciesId);
      ws.send(JSON.stringify({ type: 'family_data', id: msg.id, family: family && { ...family, nameLa: species?.nameLa, nameEn: species?.nameEn, nameRu: species?.nameRu } }));
    } else if (msg.type === 'get_codex') {
      ws.send(JSON.stringify(this.codexPage(msg)));
    } else if (msg.type === 'get_atlas') {
      ws.send(JSON.stringify({
        type: 'atlas_data',
        entries: this.engine.atlas ? this.engine.atlas.getAllEntries() : []
      }));
    } else if (msg.type === 'steer') {
      if (typeof msg.id === 'number' && typeof msg.steerX === 'number' && typeof msg.steerY === 'number') {
        const sx = Math.max(-1.5, Math.min(1.5, msg.steerX));
        const sy = Math.max(-1.5, Math.min(1.5, msg.steerY));
        const thrust = typeof msg.thrust === 'number' ? Math.max(-1.0, Math.min(1.5, msg.thrust)) : 1.0;
        this.engine.applySteer(msg.id, sx, sy, thrust, ws.clientId);
      }
    } else if (msg.type === 'dive_start') {
      if (!Number.isSafeInteger(msg.id) || msg.id < 1) return;
      const previous = this.engine.clientPilotMap.get(ws.clientId);
      const granted = this.engine.claimPilot(msg.id, ws.clientId);
      if (granted && previous !== msg.id) ws.pilotStartedAt = now;
      ws.send(JSON.stringify({
        type: 'dive_response',
        id: msg.id,
        granted,
        reason: granted ? 'ok' : 'occupied'
      }));
    } else if (msg.type === 'dive_stop') {
      this.engine.releasePilot(ws.clientId);
    } else if (msg.type === 'found_dynasty' || msg.type === 'name_lineage') {
      const orgId = Number.isSafeInteger(msg.orgId) ? msg.orgId : null;
      if (this.engine.pilotedMap.get(orgId) !== ws.clientId || !ws.pilotStartedAt || now - ws.pilotStartedAt < 30000) return;
      const founderName = typeof msg.founderName === 'string' ? msg.founderName.trim().slice(0, 32) : '';
      if (/^[\p{L}\p{N}\p{M} ._'’-]{1,32}$/u.test(founderName)) {
        let result = null;
        if (orgId !== null) {
          result = this.engine.foundDynasty(orgId, founderName);
        } else if (typeof msg.speciesId === 'number') {
          const wildOrg = this.engine.organisms.find(o => o.speciesId === msg.speciesId && !o.dynastyName);
          if (wildOrg) {
            result = this.engine.foundDynasty(wildOrg.id, founderName);
          } else {
            result = this.engine.nameSpeciesFounder(msg.speciesId, founderName);
          }
        }
        if (result) {
          ws.send(JSON.stringify(this.codexPage({})));

          if (orgId !== null) {
            const profile = this.engine.getOrganismProfile(orgId);
            if (profile) {
              ws.send(JSON.stringify({ type: 'inspect_result', profile }));
            }
          }
        }
      }
    } else if (msg.type === 'track_dynasty') {
      if (typeof msg.name === 'string') {
        const targetOrg = this.engine.organisms.find(o => o.dynastyName === msg.name);
        if (targetOrg) {
          ws.send(JSON.stringify({
            type: 'track_target',
            id: targetOrg.id
          }));
        }
      }
    }
  }

  codexPage(msg) {
    const all = this.engine.lineage.getCatalogSpecies();
    const isFilter = s => s.carnivory < 0.1 && s.size > 4;
    const predicate = {
      all: () => true, alive: s => s.population > 0, extinct: s => s.population === 0,
      hunter: s => s.carnivory > 0.35, grazer: s => s.carnivory <= 0.35 && !isFilter(s), filter: isFilter, dynasties: () => false
    };
    const filter = Object.hasOwn(predicate, msg.filter) ? msg.filter : 'all';
    const q = typeof msg.query === 'string' ? msg.query.slice(0, 64).toLocaleLowerCase() : '';
    const matching = all.filter(s => predicate[filter](s) && (!q || [s.nameLa, s.nameRu, s.nameEn].some(n => n?.toLocaleLowerCase().includes(q))));
    matching.sort((a, b) => Number(b.population > 0) - Number(a.population > 0) || b.population - a.population || b.id - a.id);
    const offset = Number.isSafeInteger(msg.offset) ? Math.max(0, Math.min(msg.offset, matching.length)) : 0;
    const counts = Object.fromEntries(['all','alive','extinct','hunter','grazer','filter'].map(f => [f, all.filter(predicate[f]).length]));
    return { type: 'codex_data', species: matching.slice(offset, offset + 48), journal: this.engine.naturalist.journalEntries,
      dynasties: this.engine.getAllDynasties?.().slice(-256) ?? [], meta: { counts, offset, total: matching.length, pageSize: 48, filter, query: q, legacyAliases: this.engine.lineage.speciesMap.size - all.length } };
  }

  broadcastVisitorCount() {
    const payload = JSON.stringify({
      type: 'visitor_count',
      count: this.clients.size
    });
    this.broadcastRaw(payload);
  }

  // 10 Hz broadcast
  broadcastTick(packet) {
    if (this.clients.size === 0) return;

    this.pendingEvents ??= [];
    this.pendingEvents.push(...(packet.events ?? []));
    this.pendingEvents = this.pendingEvents.slice(-32);
    if (this.engine.ticks % 2 !== 0) return;
    packet.events = this.pendingEvents; this.pendingEvents = [];
    packet.type = 'tick';
    packet.visitors = this.clients.size;

    // Send chemical thumbnail update every 20 ticks (every 2 seconds)
    if (this.engine.ticks % 40 === 0) {
      packet.thumbnail = Array.from(this.engine.grid.getThumbnail(48));
      packet.stats = this.engine.getStats();
    }

    const json = JSON.stringify(packet);
    this.broadcastRaw(json);
  }

  broadcast(obj) {
    this.broadcastRaw(JSON.stringify(obj));
  }

  broadcastRaw(data) {
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > 1024 * 1024) { ws.close(1013, 'Slow connection'); continue; }
        ws.send(data);
      }
    }
  }
}
