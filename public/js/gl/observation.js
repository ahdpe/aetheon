// Presentation only: a small delayed buffer, never a second simulation.
export const followGain = (elapsedMs, responseMs = 180) => 1 - Math.exp(-Math.max(0, elapsedMs) / responseMs);
export const angleMix = (a, b, amount) => a + Math.atan2(Math.sin(b-a), Math.cos(b-a)) * amount;
export function focusGeometry(width, height) {
  return { x: width / 2, y: height / 2, radius: Math.min(360, Math.min(width, height) * .44) };
}
export function insideFocus(x, y, focus, margin = 0) {
  return (x-focus.x)**2 + (y-focus.y)**2 <= (focus.radius+margin)**2;
}

export class ObservationBuffer {
  constructor(delayMs = 260) { this.delayMs = delayMs; this.frames = []; }
  clear() { this.frames = []; }
  push(entities, at, tick) {
    const last = this.frames.at(-1);
    if (last && (tick < last.tick || at-last.at > 2000)) this.clear();
    else if (last && (tick === last.tick || at <= last.at)) return;
    this.frames.push({ entities, at, tick });
    if (this.frames.length > 8) this.frames.shift();
  }
  sample(now) {
    if (!this.frames.length) return new Map();
    const target = now-this.delayMs;
    let before = this.frames[0], after = before;
    for (const frame of this.frames) {
      after = frame;
      if (frame.at >= target) break;
      before = frame;
    }
    const alpha = after.at===before.at ? 0 : Math.max(0, Math.min(1, (target-before.at)/(after.at-before.at)));
    const latest = this.frames.at(-1).entities, result = new Map();
    for (const org of after.entities.values()) {
      if (!latest.has(org.id)) continue; // No selectable ghosts after a confirmed death.
      const prev = before.entities.get(org.id) ?? org;
      const mixed = { ...org };
      for (const key of ['x','y','vx','vy','size']) mixed[key] = prev[key] + (org[key]-prev[key])*alpha;
      mixed.phase = angleMix(prev.phase ?? 0, org.phase ?? 0, alpha);
      mixed.heading = angleMix(Math.atan2(prev.vy,prev.vx), Math.atan2(org.vy,org.vx), alpha);
      result.set(org.id, mixed);
    }
    return result;
  }
}
