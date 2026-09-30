/**
 * AETHEON Species Morphology & Phenotypic Variation Engine
 * Generates deterministic body shapes, distinctive bioluminescent patterns (spots, stripes, spines),
 * flagella, and sensory appendages from species genome signatures.
 */

const morphCache = new Map();

export function getSpeciesMorphology(speciesId, hue = 0.5, carnivory = 0.1, size = 7.0, speed = 1.8) {
  const cacheKey = `${speciesId}_${hue.toFixed(2)}_${carnivory > 0.35 ? 1 : 0}`;
  if (morphCache.has(cacheKey)) {
    return morphCache.get(cacheKey);
  }

  // Deterministic seed based on speciesId
  const seed = (Math.abs(speciesId) * 9301 + 49297) % 233280;
  const rnd = (offset) => {
    const s = (seed + offset * 1103515245 + 12345) & 0x7fffffff;
    return (s % 1000) / 1000;
  };

  const isHunter = carnivory > 0.35;

  // 1. Cell Body Shape
  let shape;
  if (isHunter) {
    shape = 'raptor'; // Armored apex hunter with rostrum & lateral mandibles
  } else {
    const shapeRoll = rnd(1);
    if (shapeRoll < 0.22) shape = 'vibrio';     // Curved comma / crescent
    else if (shapeRoll < 0.44) shape = 'bacillus'; // Elongated cylindrical rod
    else if (shapeRoll < 0.64) shape = 'coccus';   // Spherical plump orb
    else if (shapeRoll < 0.82) shape = 'ovoid';    // Classic streamlined oval
    else shape = 'spirillum';                     // S-curved sinusoidal undulating
  }

  // 2. Marking Pattern (spots / stripes / spine / twin_core / stippled)
  const patternRoll = rnd(2);
  let pattern;
  if (patternRoll < 0.32) pattern = 'spots';       // Leopard bioluminescent photophore spots
  else if (patternRoll < 0.58) pattern = 'stripes'; // Transverse glowing zebra bands
  else if (patternRoll < 0.76) pattern = 'spine';   // Dorsal neon spine ridge
  else if (patternRoll < 0.90) pattern = 'twin_core'; // Dual polar chloroplasts / nuclei
  else pattern = 'stippled';                        // Micro-granule constellation

  // 3. Number of spots or stripes
  const spotCount = 3 + Math.floor(rnd(3) * 3);     // 3 to 5 spots
  const stripeCount = 2 + Math.floor(rnd(4) * 2);   // 2 to 3 stripes

  // 4. Appendages
  const hasFlagellum = isHunter || speed > 2.2 || rnd(5) < 0.50; // Trailing propulsion whip
  const hasAntennae = !isHunter && rnd(6) < 0.38;               // Front sensory whiskers

  // 5. Complementary or Split-Triadic Accent Hue for markings
  const accentOffset = 0.18 + rnd(7) * 0.45;
  const accentHue = Math.round(((hue + accentOffset) % 1.0) * 360);

  // 6. Geometry ratios
  let aspectX = 1.25;
  let aspectY = 0.85;
  if (shape === 'bacillus') {
    aspectX = 1.55;
    aspectY = 0.70;
  } else if (shape === 'coccus') {
    aspectX = 1.05;
    aspectY = 1.00;
  } else if (shape === 'vibrio') {
    aspectX = 1.35;
    aspectY = 0.80;
  } else if (shape === 'spirillum') {
    aspectX = 1.45;
    aspectY = 0.72;
  } else if (shape === 'raptor') {
    aspectX = 1.35;
    aspectY = 0.85;
  }

  const result = {
    speciesId,
    shape,
    pattern,
    spotCount,
    stripeCount,
    hasFlagellum,
    hasAntennae,
    accentHue,
    isHunter,
    aspectX,
    aspectY
  };

  morphCache.set(cacheKey, result);
  return result;
}

/**
 * Draw the primary viscoelastic membrane path for the organism
 */
export function drawCellMembranePath(ctx, shape, rx, ry, time, seedId) {
  ctx.beginPath();

  if (shape === 'coccus') {
    const r = (rx + ry) * 0.5;
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else if (shape === 'bacillus') {
    // Pill / capsule shape with rounded polar caps
    const capR = ry;
    const bodyW = Math.max(2, rx - capR);
    ctx.moveTo(bodyW, -ry);
    ctx.arc(bodyW, 0, capR, -Math.PI * 0.5, Math.PI * 0.5, false);
    ctx.lineTo(-bodyW, ry);
    ctx.arc(-bodyW, 0, capR, Math.PI * 0.5, -Math.PI * 0.5, false);
    ctx.closePath();
  } else if (shape === 'vibrio') {
    // Curved comma / crescent bean
    const wave = Math.sin(time * 0.008 + seedId) * 0.12;
    const bend = ry * (0.45 + wave);
    ctx.moveTo(rx, 0);
    ctx.bezierCurveTo(rx * 0.7, -ry * 0.95 - bend, -rx * 0.6, -ry * 0.85 + bend, -rx, 0);
    ctx.bezierCurveTo(-rx * 0.5, ry * 0.65 + bend, rx * 0.6, ry * 0.75 - bend, rx, 0);
    ctx.closePath();
  } else if (shape === 'spirillum') {
    // Sinusoidal wavy body
    const wave = Math.sin(time * 0.015 + seedId) * (ry * 0.25);
    ctx.moveTo(rx, wave);
    ctx.quadraticCurveTo(rx * 0.5, -ry * 0.9 + wave, 0, wave * 0.5);
    ctx.quadraticCurveTo(-rx * 0.5, ry * 0.9 + wave, -rx, -wave);
    ctx.quadraticCurveTo(-rx * 0.5, ry * 0.4 - wave, 0, -wave * 0.5);
    ctx.quadraticCurveTo(rx * 0.5, -ry * 0.4 - wave, rx, wave);
    ctx.closePath();
  } else if (shape === 'raptor') {
    // Streamlined predatory carapace with angular facets
    ctx.moveTo(rx * 1.1, 0);
    ctx.lineTo(rx * 0.4, -ry * 1.05);
    ctx.lineTo(-rx * 0.7, -ry * 0.75);
    ctx.lineTo(-rx * 1.05, 0);
    ctx.lineTo(-rx * 0.7, ry * 0.75);
    ctx.lineTo(rx * 0.4, ry * 1.05);
    ctx.closePath();
  } else {
    // Default ovoid
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  }
}

/**
 * Draw distinctive surface markings: spots, stripes, spine ridge, or twin cores
 */
export function drawCellMarkings(ctx, morph, rx, ry, mainHue, time, seedId) {
  const accent = morph.accentHue;

  if (morph.pattern === 'spots') {
    // Bioluminescent photophore spots along body
    const count = morph.spotCount;
    ctx.fillStyle = `hsla(${accent}, 95%, 75%, 0.85)`;
    ctx.shadowColor = `hsla(${accent}, 100%, 65%, 0.9)`;
    ctx.shadowBlur = Math.min(8, rx * 0.4);

    const startX = -rx * 0.45;
    const endX = rx * 0.45;
    const step = (endX - startX) / (count > 1 ? count - 1 : 1);
    const spotR = Math.max(1.2, ry * 0.16);

    for (let i = 0; i < count; i++) {
      const sx = startX + i * step;
      // Stagger above and below midline
      const sy = ((i % 2 === 0 ? 1 : -1) * ry * 0.28);
      ctx.beginPath();
      ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
      ctx.fill();

      // Bright white central photophore node
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, spotR * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${accent}, 95%, 75%, 0.85)`;
    }
    ctx.shadowBlur = 0;
  } else if (morph.pattern === 'stripes') {
    // Transverse glowing zebra rings across membrane
    const count = morph.stripeCount;
    ctx.strokeStyle = `hsla(${accent}, 95%, 70%, 0.75)`;
    ctx.lineWidth = Math.max(1.2, rx * 0.08);
    ctx.lineCap = 'round';

    const step = (rx * 0.9) / (count + 1);
    for (let i = 1; i <= count; i++) {
      const sx = -rx * 0.45 + i * step;
      const hSpan = ry * 0.65;
      ctx.beginPath();
      ctx.moveTo(sx - rx * 0.08, -hSpan);
      ctx.quadraticCurveTo(sx + rx * 0.08, 0, sx - rx * 0.08, hSpan);
      ctx.stroke();
    }
  } else if (morph.pattern === 'spine') {
    // Glowing dorsal ridge along the longitudinal axis
    ctx.strokeStyle = `hsla(${accent}, 100%, 75%, 0.85)`;
    ctx.lineWidth = Math.max(1.4, ry * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-rx * 0.55, 0);
    ctx.lineTo(rx * 0.60, 0);
    ctx.stroke();

    // Node flares
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx * 0.1, 0, Math.max(1.2, ry * 0.15), 0, Math.PI * 2);
    ctx.arc(-rx * 0.2, 0, Math.max(1.0, ry * 0.12), 0, Math.PI * 2);
    ctx.fill();
  } else if (morph.pattern === 'twin_core') {
    // Dual polar organelles (e.g., chloroplasts / paired nuclei)
    const coreR = Math.max(1.6, ry * 0.26);
    ctx.fillStyle = `hsla(${accent}, 90%, 70%, 0.85)`;
    ctx.beginPath();
    ctx.arc(-rx * 0.35, -ry * 0.15, coreR, 0, Math.PI * 2);
    ctx.arc(rx * 0.35, ry * 0.15, coreR * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Nucleoli
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-rx * 0.35, -ry * 0.15, coreR * 0.4, 0, Math.PI * 2);
    ctx.arc(rx * 0.35, ry * 0.15, coreR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Stippled constellation of glowing granules
    ctx.fillStyle = `hsla(${accent}, 85%, 80%, 0.7)`;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const gx = -rx * 0.3 + (i * rx * 0.16);
      const gy = Math.sin(i * 2.3 + seedId) * (ry * 0.35);
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(1.0, ry * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw undulating trailing propulsion flagellum (whip)
 */
export function drawFlagellum(ctx, rx, ry, morph, speed, time, seedId) {
  if (!morph.hasFlagellum) return;

  const flagLen = rx * (morph.isHunter ? 1.9 : 1.6);
  const waveRate = time * 0.018 * Math.max(1.0, speed) + seedId;
  const crestAmp = ry * (morph.isHunter ? 0.42 : 0.35);

  ctx.strokeStyle = `hsla(${morph.accentHue}, 90%, 75%, 0.70)`;
  ctx.lineWidth = morph.isHunter ? 1.6 : 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-rx * 0.95, 0);

  const steps = 7;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const fx = -rx * 0.95 - t * flagLen;
    const fy = Math.sin(waveRate + t * Math.PI * 2.6) * (crestAmp * t);
    ctx.lineTo(fx, fy);
  }
  ctx.stroke();
}

/**
 * Draw forward sensory antennules
 */
export function drawAntennae(ctx, rx, ry, morph, time, seedId) {
  if (!morph.hasAntennae || morph.isHunter) return;

  const antLen = rx * 0.55;
  const tick = Math.sin(time * 0.008 + seedId) * (ry * 0.15);

  ctx.strokeStyle = `hsla(${morph.accentHue}, 95%, 85%, 0.65)`;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';

  // Upper antennule
  ctx.beginPath();
  ctx.moveTo(rx * 0.85, -ry * 0.3);
  ctx.quadraticCurveTo(rx + antLen * 0.4, -ry * 0.7 + tick, rx + antLen, -ry * 0.5);
  ctx.stroke();

  // Lower antennule
  ctx.beginPath();
  ctx.moveTo(rx * 0.85, ry * 0.3);
  ctx.quadraticCurveTo(rx + antLen * 0.4, ry * 0.7 - tick, rx + antLen, ry * 0.5);
  ctx.stroke();
}
