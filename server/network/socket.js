import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG } from '../config.js';

export class NetworkManager {
  constructor(server, engine) {
    this.engine = engine;
    this.wss = new WebSocketServer({ server });
    this.clients = new Set();
    
    this.setupListeners();

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
      this.clients.add(ws);
      console.log(`[WS] Client connected from ${req.socket.remoteAddress}. Active clients: ${this.clients.size}`);

      // Send initial hand-shake state
      const initialPayload = {
        type: 'init',
        worldSize: CONFIG.WORLD_SIZE,
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
        atlas: this.engine.atlas ? this.engine.atlas.getAllEntries() : []
      };

      ws.send(JSON.stringify(initialPayload));
      this.broadcastVisitorCount();

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (err) {
          console.error('[Network] Error parsing message:', err.message);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Active clients: ${this.clients.size}`);
        this.broadcastVisitorCount();
      });

      ws.on('error', (err) => {
        console.warn('[Network] Client socket error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  handleClientMessage(ws, msg) {
    if (msg.type === 'interact') {
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
        profile
      }));
    } else if (msg.type === 'get_codex') {
      ws.send(JSON.stringify({
        type: 'codex_data',
        species: this.engine.lineage.getAllSpecies(),
        journal: this.engine.naturalist.journalEntries
      }));
    } else if (msg.type === 'get_atlas') {
      ws.send(JSON.stringify({
        type: 'atlas_data',
        entries: this.engine.atlas ? this.engine.atlas.getAllEntries() : []
      }));
    } else if (msg.type === 'steer') {
      if (typeof msg.id === 'number' && typeof msg.steerX === 'number' && typeof msg.steerY === 'number') {
        const sx = Math.max(-1.5, Math.min(1.5, msg.steerX));
        const sy = Math.max(-1.5, Math.min(1.5, msg.steerY));
        this.engine.applySteer(msg.id, sx, sy);
      }
    }
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

    packet.type = 'tick';
    packet.visitors = this.clients.size;

    // Send chemical thumbnail update every 20 ticks (every 2 seconds)
    if (this.engine.ticks % 20 === 0) {
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
        ws.send(data);
      }
    }
  }
}
