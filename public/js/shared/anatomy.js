// Shared development rules: the server pays for the same body the browser draws.
export const ANATOMY_GENES = ['elongation', 'shell', 'flagella', 'sensing'];
const clamp = x => Math.max(0, Math.min(1, x));
export function completeGenome(genome) {
  const g = { ...genome };
  const defaults = {
    elongation: 0.12 + 0.7 * clamp((g.speedMax - 0.8) / 4.2),
    shell: 0.1 + 0.65 * clamp(g.adhesion ?? 0.35),
    flagella: 0.12 + 0.72 * clamp((g.speedMax - 0.8) / 4.2),
    sensing: 0.15 + 0.65 * clamp(Math.abs(g.chemotaxisNutrient ?? 0.5) / 2.5)
  };
  for (const key of ANATOMY_GENES) g[key] = clamp(Number.isFinite(g[key]) ? g[key] : defaults[key]);
  return g;
}
export function developBody(genome) {
  const g = completeGenome(genome), aspect = 1 + 0.85 * g.elongation;
  return {
    elongation:g.elongation, shell:g.shell, flagella:g.flagella, sensing:g.sensing,
    aspectX:aspect, aspectY:1 / aspect,
    propulsion:(0.8 + 0.5 * g.flagella) * (1 - 0.22 * g.shell) * (1 + 0.15 * g.elongation),
    upkeep:0.035 * g.shell + 0.045 * g.flagella + 0.025 * g.sensing + 0.012 * g.elongation,
    feeding:(1 + 0.15 * g.elongation) * (1 - 0.2 * g.shell),
    damageTaken:1 - 0.65 * g.shell,
    senseRadius:0.8 + 0.7 * g.sensing
  };
}
