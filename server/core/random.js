import { randomBytes } from 'node:crypto';
let state = randomBytes(4).readUInt32LE();
export function random() {
  state = (state + 0x6D2B79F5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const getRandomState = () => state;
export function setRandomState(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Invalid RNG state');
  state = value >>> 0;
}
