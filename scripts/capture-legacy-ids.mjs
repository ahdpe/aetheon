import fs from 'node:fs';
import WebSocket from 'ws';
const file = process.argv[2];
if (!file) throw new Error('Supply snapshot.json.ids path');
const ws = new WebSocket('ws://127.0.0.1:3000');
let captured = false;
const timeout = setTimeout(() => { ws.terminate(); process.exit(captured ? 0 : 1); }, 60000);
ws.on('message', buffer => {
  const packet = JSON.parse(buffer);
  if (packet.type !== 'tick') return;
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({t:packet.t,n:packet.n,orgs:packet.orgs}), {mode:0o600});
  fs.renameSync(temp,file);
  if (!captured) { console.log('Capturing final live IDs'); captured = true; }
});
ws.on('close', () => { clearTimeout(timeout); console.log('Final live IDs captured'); process.exit(captured ? 0 : 1); });
ws.on('error', error => { console.error(error.message); clearTimeout(timeout); process.exit(1); });
