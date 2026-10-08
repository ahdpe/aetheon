/**
 * AETHEON Species Morphology & Phenotypic Variation Engine
 * Generates deterministic body shapes, distinctive bioluminescent patterns (spots, stripes, spines),
 * flagella, and sensory appendages from species genome signatures.
 */

import { developBody } from '../shared/anatomy.js';
const morphCache = new Map();
export function getSpeciesMorphology(speciesId, hue=0.5, carnivory=0.1, size=7, speed=1.8, anatomy=null) {
  const body=developBody({size,hue,carnivory,speedMax:speed,...anatomy});
  const cacheKey=[hue.toFixed(2),carnivory>0.35,...['elongation','shell','flagella','sensing'].map(k=>body[k].toFixed(2))].join(':');
  if(morphCache.has(cacheKey)) return morphCache.get(cacheKey);
  const isHunter=carnivory>0.35, e=body.elongation, s=body.shell, f=body.flagella;

  // Radical morphological archetypes
  let shape;
  if (isHunter && (s > 0.45 || e > 0.45)) {
    shape = 'raptor'; // Streamlined predatory arrowhead
  } else if (e >= 0.72) {
    shape = 'serpent'; // Sinuous undulating micro-eel / spirochaete
  } else if (!isHunter && s > 0.55 && e < 0.45) {
    shape = 'radiolarian'; // Crystalline mineralized star with radial spicules
  } else if (!isHunter && (f > 0.58 || s > 0.45) && e >= 0.45 && e < 0.72) {
    shape = 'medusa'; // Pulsing umbrella dome hydrozoan / siphonophore
  } else if (e < 0.23) {
    shape = 'coccus';
  } else if (e < 0.43) {
    shape = 'ovoid';
  } else if (e < 0.65) {
    shape = 'vibrio';
  } else if (e < 0.84) {
    shape = 'bacillus';
  } else {
    shape = 'spirillum';
  }

  let pattern;
  if (shape === 'radiolarian') pattern = 'crystal_lattice';
  else if (shape === 'serpent') pattern = 'metamere_spine';
  else if (shape === 'medusa') pattern = 'gastric_ring';
  else pattern = s > 0.68 ? 'spine' : f > 0.65 ? 'stripes' : body.sensing > 0.65 ? 'stippled' : e < 0.3 ? 'twin_core' : 'spots';

  const result={speciesId,shape,pattern,spotCount:3+Math.round(body.sensing*3),stripeCount:2+Math.round(body.flagella*3),
    hasFlagellum:shape !== 'medusa' && (body.flagella>0.18 || shape === 'serpent'),
    flagellumCount:shape === 'serpent' ? 1 : 1+Math.floor(body.flagella*3),
    hasAntennae:shape !== 'medusa' && body.sensing>0.4,
    accentHue:Math.round(((hue+0.16+body.shell*0.25)%1)*360),isHunter,...body};
  if(morphCache.size>=512) morphCache.delete(morphCache.keys().next().value);
  morphCache.set(cacheKey,result);return result;
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
  } else if (shape === 'serpent') {
    // Sinuous undulating micro-eel / spirochaete
    const segs = 7;
    const waveFreq = time * 0.014 + seedId;
    const headX = rx * 1.1;
    const tailX = -rx * 1.35;
    const span = headX - tailX;
    
    // Top contour from head to tail
    ctx.moveTo(headX, 0);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const px = headX - span * t;
      const wave = Math.sin(waveFreq - t * 4.2) * (ry * 0.75 * t);
      const halfW = ry * (0.85 * (1.0 - t * 0.65) * Math.sin(Math.acos(Math.max(-1, Math.min(1, t * 2.0 - 1.0)))));
      const thick = Math.max(1.2, halfW);
      ctx.lineTo(px, wave - thick);
    }
    // Tip of tail
    const tailWave = Math.sin(waveFreq - 4.2) * (ry * 0.75);
    ctx.lineTo(tailX, tailWave);
    // Bottom contour back to head
    for (let i = segs; i >= 0; i--) {
      const t = i / segs;
      const px = headX - span * t;
      const wave = Math.sin(waveFreq - t * 4.2) * (ry * 0.75 * t);
      const halfW = ry * (0.85 * (1.0 - t * 0.65) * Math.sin(Math.acos(Math.max(-1, Math.min(1, t * 2.0 - 1.0)))));
      const thick = Math.max(1.2, halfW);
      ctx.lineTo(px, wave + thick);
    }
    ctx.closePath();
  } else if (shape === 'radiolarian') {
    // Geometrical 6-pointed crystalline star / faceted diatom carapace
    const points = 6;
    const outerR = Math.max(rx, ry) * 1.05;
    const innerR = Math.min(rx, ry) * 0.68;
    for (let p = 0; p < points * 2; p++) {
      const angle = (p / (points * 2)) * Math.PI * 2;
      const rad = (p % 2 === 0) ? outerR : innerR;
      const px = Math.cos(angle) * rad;
      const py = Math.sin(angle) * rad;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'medusa') {
    // Pulsing hydrozoan umbrella bell / siphonophore
    const pulsePhase = Math.sin(time * 0.008 + seedId);
    const contract = 0.85 + 0.15 * pulsePhase;
    const bellW = rx * 0.95;
    const bellH = ry * 1.15 * contract;
    
    ctx.moveTo(bellW * 0.95, 0);
    ctx.bezierCurveTo(bellW * 0.85, -bellH, -bellW * 0.3, -bellH * 0.9, -bellW * 0.6, -bellH * 0.4);
    ctx.quadraticCurveTo(-bellW * 0.4, 0, -bellW * 0.6, bellH * 0.4);
    ctx.bezierCurveTo(-bellW * 0.3, bellH * 0.9, bellW * 0.85, bellH, bellW * 0.95, 0);
    ctx.closePath();
  } else if (shape === 'raptor') {
    // Streamlined predatory carapace with angular facets
    ctx.moveTo(rx * 1.35, 0);
    ctx.lineTo(rx * 0.3, -ry * 1.1);
    ctx.lineTo(-rx * 0.4, -ry * 0.85);
    ctx.lineTo(-rx * 1.15, -ry * 0.35);
    ctx.lineTo(-rx * 0.7, 0);
    ctx.lineTo(-rx * 1.15, ry * 0.35);
    ctx.lineTo(-rx * 0.4, ry * 0.85);
    ctx.lineTo(rx * 0.3, ry * 1.1);
    ctx.closePath();
  } else {
    // Default ovoid
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  }
}

/**
 * Draw distinctive surface markings: spots, stripes, spine ridge, crystal lattice, or metamere cord
 */
export function drawCellMarkings(ctx, morph, rx, ry, mainHue, time, seedId) {
  const accent = morph.accentHue;

  if (morph.pattern === 'crystal_lattice') {
    // Radiolarian crystalline lattice: radial spicules & geometric inner ring
    const points = 6;
    const outerR = Math.max(rx, ry) * 1.05;
    const innerR = Math.min(rx, ry) * 0.68;
    
    // 1. Radiating silica spicules
    ctx.strokeStyle = `hsla(${accent}, 95%, 85%, 0.85)`;
    ctx.lineWidth = Math.max(1.0, rx * 0.08);
    for (let p = 0; p < points; p++) {
      const angle = (p / points) * Math.PI * 2;
      const sx = Math.cos(angle) * (outerR * 0.88);
      const sy = Math.sin(angle) * (outerR * 0.88);
      const ex = Math.cos(angle) * (outerR * 1.45);
      const ey = Math.sin(angle) * (outerR * 1.45);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Gleaming diamond tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(0.9, rx * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Inner concentric hexagonal facet
    ctx.strokeStyle = `hsla(${accent}, 80%, 75%, 0.45)`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let p = 0; p < points; p++) {
      const angle = (p / points) * Math.PI * 2;
      const px = Math.cos(angle) * (innerR * 0.55);
      const py = Math.sin(angle) * (innerR * 0.55);
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // 3. Central silica core node
    ctx.fillStyle = `hsla(${accent}, 100%, 90%, 0.95)`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, rx * 0.22), 0, Math.PI * 2);
    ctx.fill();
  } else if (morph.pattern === 'metamere_spine') {
    // Segmented undulating nerve cord with metamere rib arches
    const segs = 6;
    const waveFreq = time * 0.014 + seedId;
    const headX = rx * 0.9;
    const tailX = -rx * 1.15;
    const span = headX - tailX;

    ctx.strokeStyle = `hsla(${accent}, 95%, 80%, 0.85)`;
    ctx.lineWidth = Math.max(1.2, ry * 0.16);
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const px = headX - span * t;
      const wave = Math.sin(waveFreq - t * 4.2) * (ry * 0.65 * t);
      if (i === 0) ctx.moveTo(px, wave);
      else ctx.lineTo(px, wave);
    }
    ctx.stroke();

    // Rib flares
    ctx.fillStyle = '#ffffff';
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const px = headX - span * t;
      const wave = Math.sin(waveFreq - t * 4.2) * (ry * 0.65 * t);
      ctx.beginPath();
      ctx.arc(px, wave, Math.max(0.9, ry * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (morph.pattern === 'gastric_ring') {
    // Central gastric cavity with radial canals & trailing margin tentacles
    const pulsePhase = Math.sin(time * 0.008 + seedId);
    const contract = 0.85 + 0.15 * pulsePhase;
    const coreR = Math.max(1.8, ry * 0.35 * contract);

    // Central stomach
    ctx.fillStyle = `hsla(${accent}, 90%, 75%, 0.75)`;
    ctx.beginPath();
    ctx.arc(rx * 0.2, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    // White gastric nucleus
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx * 0.2, 0, coreR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 4 radial canals
    ctx.strokeStyle = `hsla(${accent}, 95%, 85%, 0.6)`;
    ctx.lineWidth = 1.0;
    for (let a = 0; a < 4; a++) {
      const ang = a * Math.PI * 0.5 + 0.35;
      ctx.beginPath();
      ctx.moveTo(rx * 0.2, 0);
      ctx.lineTo(rx * 0.2 + Math.cos(ang) * (ry * 0.85), Math.sin(ang) * (ry * 0.85));
      ctx.stroke();
    }

    // Trailing tentacles from the posterior margin
    const tentCount = 4;
    ctx.strokeStyle = `hsla(${accent}, 85%, 75%, 0.65)`;
    ctx.lineWidth = 1.1;
    for (let t = 0; t < tentCount; t++) {
      const yOffset = ((t - (tentCount - 1) / 2) / (tentCount / 2)) * (ry * 0.6);
      const tentLen = rx * 1.5;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.6, yOffset);
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const tx = -rx * 0.6 - frac * tentLen;
        const wave = Math.sin(time * 0.012 + frac * 4.0 + t + seedId) * (ry * 0.35 * frac);
        ctx.lineTo(tx, yOffset + wave);
      }
      ctx.stroke();
    }
  } else if (morph.pattern === 'spots') {
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

  const flagLen = rx * (1 + 1.3 * morph.flagella);
  const waveRate = time * 0.018 * Math.max(1.0, speed) + seedId;
  const crestAmp = ry * (morph.isHunter ? 0.42 : 0.35);

  ctx.strokeStyle = `hsla(${morph.accentHue}, 90%, 75%, 0.70)`;
  ctx.lineWidth = morph.isHunter ? 1.6 : 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for(let f=0;f<(morph.flagellumCount??1);f++) {
  const offset=(f-((morph.flagellumCount??1)-1)/2)*ry*0.45;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.95, offset);

  const steps = 7;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const fx = -rx * 0.95 - t * flagLen;
    const fy = offset + Math.sin(waveRate + t * Math.PI * 2.6 + f) * (crestAmp * t);
    ctx.lineTo(fx, fy);
  }
  ctx.stroke();
  }
}

/**
 * Draw forward sensory antennules
 */
export function drawAntennae(ctx, rx, ry, morph, time, seedId) {
  if (!morph.hasAntennae) return;

  const antLen = rx * (0.25 + 0.6 * morph.sensing);
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
