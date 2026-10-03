import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { SimulationEngine } from './core/engine.js';
import { NetworkManager } from './network/socket.js';
import { visitorCookie,newVisitorToken } from './core/nursery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const stepTimes = [];
let lastHealthTick = 0, lastHealthTime = performance.now();

// Create zero-dependency lightweight HTTP server
const server = http.createServer((req, res) => {
  const rawUrl = req.url.split('?')[0];
  if (rawUrl === '/aetheon') {
    res.writeHead(301, { Location: '/aetheon/' });
    res.end();
    return;
  }

  let reqPath = rawUrl;
  // Support both root "/" and subpath "/aetheon" reverse proxies
  if (reqPath.startsWith('/aetheon')) {
    reqPath = reqPath.slice('/aetheon'.length);
  }
  if (reqPath === '/health') {
    const times = [...stepTimes].sort((a,b) => a-b), now = performance.now();
    const measuredHz = (engine.ticks - lastHealthTick) / Math.max(0.001, (now-lastHealthTime)/1000);
    lastHealthTick = engine.ticks; lastHealthTime = now;
    res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify({ status:'ok', version:'2.9-terrain', pid:process.pid, ticks:engine.ticks, worldCreatedAt:engine.genesisTime,
      remains:engine.remains.getStats(), terrain:engine.terrainState,
      organisms:engine.organisms.length, plants:engine.algae.isles.length, worldSize:CONFIG.WORLD_SIZE, gridSize:CONFIG.GRID_SIZE, expansionTick:engine.expansionState?.tick, chamberRadius:CONFIG.CHAMBER_RADIUS,geographyStartedAtTick:engine.geography.state.startedAtTick,geographySamples:engine.geography.state.samples.length,floraBirths:engine.algae.totals.births, floraDeaths:engine.algae.totals.deaths, ecologyEpoch:engine.ecologyEpoch, nurseryIntroduced:engine.nursery.introduced, nurseryQueued:engine.nursery.records.filter(r=>r.status==='queued').length, registeredMorphs:engine.lineage.getCatalogSpecies().length, archivedLabels:engine.lineage.speciesMap.size, visitors:network.clients.size,
      measuredHz:Math.round(measuredHz*100)/100, stepP95Ms:Math.round((times[Math.floor(times.length*.95)]??0)*100)/100,
      snapshotBytes:engine.persistence.lastSnapshotBytes, snapshotSaveMs:Math.round(engine.persistence.lastSaveMs??0) }));
    return;
  }
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  console.log('[HTTP]', req.method, reqPath);

  let filePath;
  try { filePath = path.resolve(PUBLIC_DIR, '.' + decodeURIComponent(reqPath)); }
  catch { res.writeHead(400); res.end(); return; }

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    if(reqPath==='/index.html'&&!visitorCookie(req.headers.cookie)) {
      const secure=req.headers['x-forwarded-proto']==='https';
      res.setHeader('Set-Cookie',`aetheon_visitor=${newVisitorToken()}; Path=${secure?'/aetheon/':'/'}; HttpOnly; SameSite=Strict; Max-Age=31536000${secure?'; Secure':''}`);
    }

    // Disable caching so clients always get fresh code without stale cache mismatch
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

// Initialize simulation core
console.log('[Server] Initializing AETHEON simulation engine...');
const engine = new SimulationEngine();
// Commit the upgraded full checkpoint before accepting visitors, including the first migration.
if (!engine.persistence.saveSnapshot(engine)) throw new Error('Initial world checkpoint could not be committed');
lastHealthTick = engine.ticks; lastHealthTime = performance.now();

// Attach WebSocket network manager
const network = new NetworkManager(server, engine);

// 10 Hz canonical simulation loop (100 ms)
const TICK_INTERVAL = CONFIG.TICK_INTERVAL_MS;
let lastTickTime = performance.now();

setInterval(() => {
  const now = performance.now();
  // Step simulation
  engine.step();
  stepTimes.push(performance.now() - now);
  if (stepTimes.length > 600) stepTimes.shift();

  // Broadcast delta packet to connected clients
  if (network.clients.size > 0) network.broadcastTick(engine.getBroadcastPacket());

  lastTickTime = now;
}, TICK_INTERVAL);

// Start listening
server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`=======================================================`);
  console.log(`🌊 AETHEON: The Autocatalytic Ocean is LIVE!`);
  console.log(`📡 URL: http://localhost:${CONFIG.PORT}`);
  console.log(`⚙️  Tick Rate: ${CONFIG.TICK_RATE_HZ} Hz`);
  console.log(`🧬 Organisms: ${engine.organisms.length}`);
  console.log(`🤖 AI Observer: ${CONFIG.VENICE_API_KEY ? 'Venice AI (' + CONFIG.VENICE_MODEL + ')' : 'Procedural Xenobiologist'}`);
  console.log(`=======================================================`);
});

// Graceful shutdown: save state to disk before exiting
const handleExit = (signal) => {
  console.log(`\n[Server] Received ${signal}. Saving canonical world snapshot...`);
  engine.persistence.saveSnapshot(engine);
  process.exit(0);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
