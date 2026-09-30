import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { SimulationEngine } from './core/engine.js';
import { NetworkManager } from './network/socket.js';

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

// Create zero-dependency lightweight HTTP server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
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

    // Enable gzip/caching headers if appropriate
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

// Initialize simulation core
console.log('[Server] Initializing AETHEON simulation engine...');
const engine = new SimulationEngine();

// Attach WebSocket network manager
const network = new NetworkManager(server, engine);

// 10 Hz canonical simulation loop (100 ms)
const TICK_INTERVAL = CONFIG.TICK_INTERVAL_MS;
let lastTickTime = performance.now();

setInterval(() => {
  const now = performance.now();
  // Step simulation
  engine.step();

  // Broadcast delta packet to connected clients
  const packet = engine.getBroadcastPacket();
  network.broadcastTick(packet);

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
