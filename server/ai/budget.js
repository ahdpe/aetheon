import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';

// Reservations survive failed requests and restarts. Missing usage is charged conservatively.
export class VeniceBudget {
  constructor({ file = path.join(path.dirname(CONFIG.SNAPSHOT_FILE), 'venice-budget.json'), fetcher = fetch, clock = Date.now, key = CONFIG.VENICE_API_KEY, bootstrap = true, limit = CONFIG.VENICE_BUDGET_LIMIT || 300000 } = {}) {
    this.file = file; this.fetcher = fetcher; this.clock = clock; this.key = key;
    this.limit = limit; // USD micro-units: $0.30 (300,000 micro-units)
    this.bootstrap = bootstrap; this.catalog = null; this.catalogDay = null;
  }
  day() { return new Date(this.clock()).toISOString().slice(0, 10); }
  load() {
    let state;
    if (fs.existsSync(this.file)) {
      state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!Number.isSafeInteger(state.spent) || state.spent < 0 || typeof state.day !== 'string' || !state.calls) throw new Error('Invalid AI budget ledger');
      if (!Number.isSafeInteger(state.calls.text)) state.calls.text = 0;
      if (!Number.isSafeInteger(state.calls.decision)) state.calls.decision = 0;
      if (!Number.isSafeInteger(state.calls.image)) state.calls.image = 0;
    } else state = { day: this.day(), spent: this.bootstrap ? this.limit : 0, calls: { text: 0, decision: 0, image: 0 }, legacyDay: this.bootstrap };
    if (state.day > this.day()) throw new Error('Clock moved backwards; AI spending disabled');
    if (state.day < this.day()) state = { day: this.day(), spent: 0, calls: { text: 0, decision: 0, image: 0 } };
    return state;
  }
  save(state) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`, fd = fs.openSync(temp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, this.file);
    const dir = fs.openSync(path.dirname(this.file), 'r');
    try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  }
  async prices(model) {
    if (this.catalogDay !== this.day()) {
      const response = await this.fetcher('https://api.venice.ai/api/v1/models?type=all', { headers: { Authorization: `Bearer ${this.key}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Cannot verify current Venice prices');
      const data = await response.json();
      this.catalog = new Map(data.data.map(m => [m.id, m.model_spec])); this.catalogDay = this.day();
    }
    const spec = this.catalog.get(model);
    const input = spec?.pricing?.input?.usd ?? 0.1875;
    const output = spec?.pricing?.output?.usd ?? 0.75;
    const context = spec?.availableContextTokens ?? spec?.maxTotalTokens ?? spec?.maxStateTokens ?? 8192;
    const imageCost = spec?.pricing?.generation?.usd;
    return { input, output, context, imageCost };
  }
  async request(kind, url, body) {
    if (!this.key || this.busy) return null;
    this.busy = true;
    try {
      let ledger = this.load(); this.save(ledger);
      const maxCalls = kind === 'text' ? (CONFIG.VENICE_TEXT_CALLS_LIMIT || 240) : (kind === 'image' ? 30 : (CONFIG.VENICE_DECISION_CALLS_LIMIT || 400));
      if (ledger.spent >= this.limit || (ledger.calls[kind] ?? 0) >= maxCalls) return null;
      const prices = await this.prices(body.model);
      
      let reservation = 0;
      let inputBound = 0;
      let outputBound = 0;

      if (kind === 'image') {
        reservation = prices.imageCost ? Math.ceil(prices.imageCost * 1000000) : 10000;
      } else if (kind === 'text') {
        inputBound = Buffer.byteLength(JSON.stringify(body.messages)) + 2048;
        outputBound = body.max_tokens;
        if (!Number.isSafeInteger(outputBound) || outputBound < 1 || (inputBound + outputBound > prices.context)) return null;
        reservation = Math.ceil(inputBound * prices.input + outputBound * prices.output);
      } else {
        const qCount = Object.keys(body.questions ?? {}).length || 1;
        inputBound = Math.min(prices.context, Math.max(512, Math.ceil(Buffer.byteLength(JSON.stringify(body)) / 2.0) + 384 * qCount));
        outputBound = Math.min(prices.context, 128 * qCount);
        reservation = Math.ceil(inputBound * prices.input + outputBound * prices.output);
      }

      ledger = this.load();
      if (ledger.spent + reservation > this.limit) return null;
      ledger.spent += reservation; ledger.calls[kind] = (ledger.calls[kind] ?? 0) + 1; this.save(ledger);
      const response = await this.fetcher(url, { method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Venice HTTP ${response.status}`);
      const data = await response.json();
      const input = data.usage?.prompt_tokens ?? data.usage?.input_tokens;
      const output = data.usage?.completion_tokens ?? data.usage?.output_tokens;
      
      if ((kind === 'text' || kind === 'decision') && Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0) {
        const actual = Math.ceil(input * prices.input + output * prices.output);
        const current = this.load();
        if (current.day === ledger.day && actual < reservation) { current.spent -= (reservation - actual); this.save(current); }
      }
      return data;
    } catch (err) { console.warn('[AI Budget] Request skipped/failed:', err.message); return null; }
    finally { this.busy = false; }
  }
}
