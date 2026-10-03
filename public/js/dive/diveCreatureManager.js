import { OCEAN_GEOMETRY } from '../shared/habitats.js';
import * as THREE from '../lib/three.module.js';
import { getSpeciesMorphology } from '../gl/morphology.js';

export class DiveCreatureManager {
  constructor(scene) {
    this.scene = scene;
    this.creaturePool = new Map(); // id -> Three.js Group
    this.bondLines = [];
    this.maxVisibleDist = 135.0; // Optimized microscopic field of view (reduces scene load by 75%)
  }

  update(currentEntities, playerOrgId, colonyBonds = [], time = 0, pilotedIds = null) {
    const activeIds = new Set();
    const playerOrg = currentEntities.get(playerOrgId);
    const px = playerOrg ? playerOrg.x : OCEAN_GEOMETRY.cx;
    const py = playerOrg ? playerOrg.y : OCEAN_GEOMETRY.cx;

    // 1. Update or create visible creatures
    for (const [id, org] of currentEntities.entries()) {
      if (id === playerOrgId) continue; // Don't render self from first-person eyes

      const dx = org.x - px;
      const dy = org.y - py;
      const dist = Math.hypot(dx, dy);

      // Distance culling for rock-solid 60 FPS
      if (dist > this.maxVisibleDist) {
        if (this.creaturePool.has(id)) {
          this.creaturePool.get(id).visible = false;
        }
        continue;
      }

      activeIds.add(id);
      let group = this.creaturePool.get(id);

      if (!group) {
        group = this.createCreatureMesh(org);
        this.creaturePool.set(id, group);
        this.scene.add(group);
      }

      group.visible = true;
      const growth=(org.size||6.5)/group.userData.initialSize;
      group.scale.set(growth,growth,growth);

      // Anti-clipping lens fade: prevent organisms right next to the lens from blocking the viewport
      const bodyMat = group.userData.bodyMat;
      if (bodyMat) {
        const lensDist = Math.max(0.0, dist - 6.0);
        bodyMat.opacity = Math.min(0.85, Math.max(0.08, lensDist / 14.0) * 0.85);
      }

      // Convert 2D coordinates (0..worldSize) to 3D centered coordinates (X, Z) with Y as altitude
      const x3d = org.x - OCEAN_GEOMETRY.cx;
      const z3d = org.y - OCEAN_GEOMETRY.cy;
      const y3d = 18.0 + Math.sin(time * 0.003 + org.id) * 3.5;
      group.position.set(x3d, y3d, z3d);

      // Rotation towards velocity vector in XZ plane
      const heading = Math.atan2(org.vy, org.vx);
      // In Three.js, rotation around Y axis: forward vector is (cos(-heading), 0, sin(-heading))
      group.rotation.y = -heading;
      group.rotation.z = Math.sin(time * 0.004 + org.id) * 0.06;
      group.rotation.x = Math.cos(time * 0.003 + org.id) * 0.04;

      // Pilot holographic crown update
      const isPiloted = pilotedIds && pilotedIds.has(id);
      if (group.userData.pilotCrown) {
        group.userData.pilotCrown.visible = Boolean(isPiloted);
        if (isPiloted) {
          group.userData.pilotCrown.rotation.y = time * 0.003;
        }
      }

      // Animate undulating flagellum and pulse nucleus for nearby entities (< 55 units)
      if (dist < 55.0) {
        this.animateFlagellum(group, time, org.id);

        // Pulse nucleus with Kuramoto rhythm
        const pulse = 1.0 + Math.sin(time * 0.008 + org.id) * 0.15;
        if (group.userData.nucleus) {
          group.userData.nucleus.scale.set(pulse, pulse, pulse);
        }
      }
    }

    // 2. Hide entities outside player view and cleanly dispose creatures that died on server
    for (const [id, group] of this.creaturePool.entries()) {
      if (!currentEntities.has(id)) {
        // Creature has died on server: clean up from Three.js scene & GPU memory
        this.scene.remove(group);
        group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
        this.creaturePool.delete(id);
      } else if (!activeIds.has(id)) {
        // Creature is alive, but outside player's visibility range
        group.visible = false;
      }
    }

    // 3. Render 3D Colony Intercellular Bonds
    this.updateColonyBonds(colonyBonds, currentEntities, playerOrgId, time);
  }

  createCreatureMesh(org) {
    const group = new THREE.Group();
    const hue = Math.round(org.hue * 360);
    const isHunter = org.carnivory > 0.35;
    const morph = getSpeciesMorphology(org.speciesId || 1, org.hue, org.carnivory || 0.1, org.size || 7, 1.8, org.anatomy);
    const accentHue = morph.accentHue !== undefined ? morph.accentHue : ((hue + 140) % 360);

    const bodyR = Math.max(2.2, (org.size || 6.5) * 0.65);
    const shape = morph.shape || (isHunter ? 'raptor' : 'ovoid');

    // 1. Soft-body Outer Membrane (Species-specific distinct 3D geometries strictly matching 2D silhouette)
    let bodyGeo;
    if (shape === 'bacillus') {
      // Elongated cylindrical capsule aligned along local X axis (direction of motion)
      if (THREE.CapsuleGeometry) {
        bodyGeo = new THREE.CapsuleGeometry(bodyR * 0.65, bodyR * 1.5, 14, 20);
        bodyGeo.rotateZ(Math.PI * 0.5); // Align length with X
      } else {
        bodyGeo = new THREE.CylinderGeometry(bodyR * 0.65, bodyR * 0.65, bodyR * 1.5, 16);
        bodyGeo.rotateZ(Math.PI * 0.5);
      }
    } else if (shape === 'vibrio') {
      // Curved comma / crescent deformed sphere matching 2D crescent bean
      bodyGeo = new THREE.SphereGeometry(bodyR, 24, 20);
      const pos = bodyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        let vz = pos.getZ(i);

        // Normalize x from 0 (posterior/tail) to 1 (anterior/head)
        const t = (vx + bodyR) / (bodyR * 2.0);
        // Lateral C-curve arch along Z in horizontal XZ plane
        const curveZ = Math.sin(t * Math.PI) * (bodyR * 0.55);
        const taper = 0.48 + 0.65 * t;
        pos.setXYZ(i, vx * 1.35, vy * 0.72 * taper, (vz * 0.75 + curveZ) * taper);
      }
      bodyGeo.computeVertexNormals();
    } else if (shape === 'spirillum') {
      // Sinusoidal wavy body matching 2D S-curve
      bodyGeo = new THREE.SphereGeometry(bodyR, 24, 20);
      const pos = bodyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        let vz = pos.getZ(i);

        const nx = vx / bodyR; // -1 to 1
        const waveZ = Math.sin(nx * Math.PI * 1.5) * (bodyR * 0.40);
        pos.setXYZ(i, vx * 1.45, vy * 0.68, vz * 0.70 + waveZ);
      }
      bodyGeo.computeVertexNormals();
    } else if (shape === 'coccus') {
      // Plump spheroid orb
      bodyGeo = new THREE.SphereGeometry(bodyR, 22, 20);
      bodyGeo.scale(1.05, 0.95, 1.05);
    } else if (shape === 'raptor') {
      // Apex hunter: faceted predatory carapace matching 2D triangular rostrum & wide shoulders
      bodyGeo = new THREE.SphereGeometry(bodyR, 24, 20);
      const pos = bodyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        let vz = pos.getZ(i);
        const nx = vx / bodyR; // -1 to +1
        let lateralWidth;
        if (nx > 0.35) {
          // Sharp forward rostrum
          lateralWidth = 1.15 * (1.0 - (nx - 0.35) / 0.65 * 0.70);
        } else {
          // Tapered posterior tail
          lateralWidth = 1.15 * (0.45 + ((nx + 1.0) / 1.35) * 0.55);
        }
        pos.setXYZ(i, vx * 1.35, vy * 0.70 * lateralWidth, vz * lateralWidth);
      }
      bodyGeo.computeVertexNormals();
    } else {
      // Ovoid: Streamlined oval matching 2D aspect ratios
      bodyGeo = new THREE.SphereGeometry(bodyR, 22, 20);
      bodyGeo.scale(morph.aspectX || 1.25, 0.75, morph.aspectY || 0.85);
    }

    // Material: rich bioluminescent self-luminous cell body matching 2D vibrancy
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(`hsl(${hue}, 90%, ${isHunter ? '55%' : '65%'})`),
      emissive: new THREE.Color(`hsl(${hue}, 100%, ${isHunter ? '45%' : '38%'})`),
      emissiveIntensity: 0.70,
      transparent: true,
      opacity: 0.88,
      roughness: 0.22,
      metalness: 0.08
    });

    bodyGeo.scale(morph.aspectX/1.25,1,morph.aspectY/0.85);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    group.userData.bodyMat = bodyMat;

    // Membrane Rim Outline Glow (smooth inverted-hull rim glow matching 2D microscopic outline, NO wireframe)
    const rimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(`hsl(${hue}, 100%, 80%)`),
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rimMesh = new THREE.Mesh(bodyGeo, rimMat);
    rimMesh.scale.set(1.06, 1.06, 1.06);
    group.add(rimMesh);

    // 2. Bioluminescent Internal Nucleus
    const nucleusGeo = new THREE.SphereGeometry(bodyR * 0.35, 12, 12);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending
    });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    nucleus.position.set(-bodyR * 0.25, 0, 0); // Positioned inside posterior, matching 2D (-rx * 0.22)
    group.add(nucleus);
    group.userData.nucleus = nucleus;

    // 3. Markings strictly matching 2D morphology
    if (morph.pattern === 'stripes') {
      // Transverse glowing zebra bands across body (matching 2D drawCellMarkings stripes)
      const count = morph.stripeCount || 2;
      const stripeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 100%, 75%)`),
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending
      });
      const step = (bodyR * 1.2) / (count + 1);
      for (let i = 1; i <= count; i++) {
        const sx = -bodyR * 0.6 + i * step;
        const ringGeo = new THREE.TorusGeometry(bodyR * 0.72, bodyR * 0.055, 6, 24);
        ringGeo.rotateY(Math.PI * 0.5); // Encircle X axis
        const ring = new THREE.Mesh(ringGeo, stripeMat);
        ring.position.set(sx, 0, 0);
        group.add(ring);
      }
    } else if (morph.pattern === 'spots') {
      // Bioluminescent photophore spots with bright white centers (matching 2D drawCellMarkings spots)
      const count = morph.spotCount || 4;
      const spotHaloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 100%, 72%)`),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const spotCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const spotR = Math.max(0.35, bodyR * 0.16);

      const startX = -bodyR * 0.55;
      const endX = bodyR * 0.55;
      const step = (endX - startX) / (count > 1 ? count - 1 : 1);

      for (let i = 0; i < count; i++) {
        const sx = startX + i * step;
        const sign = (i % 2 === 0 ? 1 : -1);
        const sz = sign * bodyR * 0.58;
        const sy = (i % 2 === 0 ? bodyR * 0.35 : -bodyR * 0.2);

        const halo = new THREE.Mesh(new THREE.SphereGeometry(spotR, 6, 6), spotHaloMat);
        halo.position.set(sx, sy, sz);
        const core = new THREE.Mesh(new THREE.SphereGeometry(spotR * 0.45, 4, 4), spotCoreMat);
        core.position.set(sx, sy, sz);
        group.add(halo);
        group.add(core);
      }
    } else if (morph.pattern === 'spine') {
      // Glowing dorsal neon ridge along top +Y (matching 2D drawCellMarkings spine)
      const spineMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 100%, 75%)`),
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending
      });
      const ridgeGeo = new THREE.CylinderGeometry(bodyR * 0.05, bodyR * 0.05, bodyR * 1.5, 6);
      ridgeGeo.rotateZ(Math.PI * 0.5); // Along X
      const ridge = new THREE.Mesh(ridgeGeo, spineMat);
      ridge.position.set(0, bodyR * 0.65, 0);
      group.add(ridge);

      // Bright node spheres
      const nodeGeo = new THREE.SphereGeometry(bodyR * 0.14, 6, 6);
      const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const n1 = new THREE.Mesh(nodeGeo, nodeMat);
      n1.position.set(bodyR * 0.2, bodyR * 0.67, 0);
      const n2 = new THREE.Mesh(nodeGeo, nodeMat);
      n2.position.set(-bodyR * 0.3, bodyR * 0.67, 0);
      group.add(n1);
      group.add(n2);
    } else if (morph.pattern === 'twin_core') {
      // Dual polar organelles (matching 2D drawCellMarkings twin_core)
      const coreR = Math.max(0.5, bodyR * 0.28);
      const coreMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 95%, 70%)`),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const nucMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const c1 = new THREE.Mesh(new THREE.SphereGeometry(coreR, 8, 8), coreMat);
      c1.position.set(-bodyR * 0.40, 0, -bodyR * 0.2);
      const nu1 = new THREE.Mesh(new THREE.SphereGeometry(coreR * 0.4, 6, 6), nucMat);
      nu1.position.copy(c1.position);

      const c2 = new THREE.Mesh(new THREE.SphereGeometry(coreR * 0.85, 8, 8), coreMat);
      c2.position.set(bodyR * 0.35, 0, bodyR * 0.2);
      const nu2 = new THREE.Mesh(new THREE.SphereGeometry(coreR * 0.35, 6, 6), nucMat);
      nu2.position.copy(c2.position);

      group.add(c1); group.add(nu1);
      group.add(c2); group.add(nu2);
    } else {
      // Stippled glowing granules
      const granMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 90%, 80%)`),
        transparent: true,
        opacity: 0.80,
        blending: THREE.AdditiveBlending
      });
      const granGeo = new THREE.SphereGeometry(bodyR * 0.09, 5, 5);
      for (let g = 0; g < 5; g++) {
        const gm = new THREE.Mesh(granGeo, granMat);
        gm.position.set(
          -bodyR * 0.4 + g * bodyR * 0.2,
          (Math.sin(g * 2.3) * 0.3) * bodyR,
          (Math.cos(g * 1.9) * 0.35) * bodyR
        );
        group.add(gm);
      }
    }

    // 4. Raptor-Specific Weaponry (Rostrum beak & Lateral hunting horns in XZ plane matching 2D!)
    if (isHunter) {
      // Anterior Rostrum Jaw Spike
      const rostrumGeo = new THREE.ConeGeometry(bodyR * 0.28, bodyR * 0.95, 8);
      rostrumGeo.rotateZ(-Math.PI * 0.5); // Point forward along +X
      const rostrumMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 100%, 65%)`),
        emissive: new THREE.Color(`hsl(${accentHue}, 100%, 45%)`),
        roughness: 0.25
      });
      const rostrum = new THREE.Mesh(rostrumGeo, rostrumMat);
      rostrum.position.set(bodyR * 1.35, 0, 0);
      group.add(rostrum);

      // Lateral Hunting Thorns (extending horizontally along +/- Z in XZ plane, exactly as seen in 2D!)
      const thornGeo = new THREE.ConeGeometry(bodyR * 0.16, bodyR * 0.75, 6);
      thornGeo.rotateZ(-Math.PI * 0.5);
      const thornMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 100%, 70%)`),
        emissive: new THREE.Color(`hsl(${accentHue}, 100%, 45%)`),
        roughness: 0.25
      });

      const thornLeft = new THREE.Mesh(thornGeo, thornMat);
      thornLeft.position.set(bodyR * 0.35, 0, bodyR * 0.95);
      thornLeft.rotation.y = 0.55; // Angled forward and outward
      group.add(thornLeft);

      const thornRight = new THREE.Mesh(thornGeo, thornMat);
      thornRight.position.set(bodyR * 0.35, 0, -bodyR * 0.95);
      thornRight.rotation.y = -0.55; // Angled forward and outward
      group.add(thornRight);

      // Crimson Photophore Eyes on lateral flanks (+Z and -Z)
      const eyeGeo = new THREE.SphereGeometry(bodyR * 0.18, 10, 10);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e46 });
      const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
      eye1.position.set(bodyR * 0.85, bodyR * 0.12, bodyR * 0.45);
      const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
      eye2.position.set(bodyR * 0.85, bodyR * 0.12, -bodyR * 0.45);
      group.add(eye1);
      group.add(eye2);
    }

    // 4.5. Forward Sensory Antennule Whiskers (in XZ horizontal plane matching 2D!)
    if (morph.hasAntennae) {
      const antMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 95%, 75%)`),
        transparent: true,
        opacity: 0.85,
        linewidth: 2
      });
      const antTipMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 100%, 80%)`),
        transparent: true,
        opacity: 0.95
      });
      const tipGeo = new THREE.SphereGeometry(bodyR * 0.10, 6, 6);

      // Left whisker (forward & outward along +Z)
      const pLeft = [
        new THREE.Vector3(bodyR * 1.0, 0, bodyR * 0.2),
        new THREE.Vector3(bodyR * 1.5, 0, bodyR * 0.55),
        new THREE.Vector3(bodyR * 2.0, 0, bodyR * 0.75)
      ];
      const gLeft = new THREE.BufferGeometry().setFromPoints(pLeft);
      group.add(new THREE.Line(gLeft, antMat));
      const tipLeft = new THREE.Mesh(tipGeo, antTipMat);
      tipLeft.position.copy(pLeft[2]);
      group.add(tipLeft);

      // Right whisker (forward & outward along -Z)
      const pRight = [
        new THREE.Vector3(bodyR * 1.0, 0, -bodyR * 0.2),
        new THREE.Vector3(bodyR * 1.5, 0, -bodyR * 0.55),
        new THREE.Vector3(bodyR * 2.0, 0, -bodyR * 0.75)
      ];
      const gRight = new THREE.BufferGeometry().setFromPoints(pRight);
      group.add(new THREE.Line(gRight, antMat));
      const tipRight = new THREE.Mesh(tipGeo, antTipMat);
      tipRight.position.copy(pRight[2]);
      group.add(tipRight);
    }

    // 5. Trailing Propulsion Flagellum (Whip Line along -X local axis)
    if (morph.hasFlagellum) {
      const pointsCount = 14;
      const flagGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(pointsCount * 3);
      flagGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const flagMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(`hsl(${hue}, 95%, 75%)`),
        transparent: true,
        opacity: 0.80,
        linewidth: 2
      });

      const flagellum = new THREE.Line(flagGeo, flagMat);
      group.add(flagellum);
      group.userData.flagellum = flagellum;
    }

    // 6. 3D Multiplayer Pilot Holographic Crown / Beacon (Shown if piloted by human visitor)
    const crown = new THREE.Group();
    crown.position.set(0, bodyR * 1.35 + 3.5, 0);

    const ringOuterGeo = new THREE.RingGeometry(bodyR * 0.9, bodyR * 1.05, 24);
    ringOuterGeo.rotateX(Math.PI * 0.5); // Lie flat horizontally
    const ringOuterMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const ringOuter = new THREE.Mesh(ringOuterGeo, ringOuterMat);
    crown.add(ringOuter);

    const ringInnerGeo = new THREE.RingGeometry(bodyR * 0.65, bodyR * 0.78, 20);
    ringInnerGeo.rotateX(Math.PI * 0.5);
    const ringInnerMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.80,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const ringInner = new THREE.Mesh(ringInnerGeo, ringInnerMat);
    crown.add(ringInner);

    const beaconGeo = new THREE.SphereGeometry(bodyR * 0.22, 10, 10);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0.5, 0);
    crown.add(beacon);

    crown.visible = false; // Hidden until piloted
    group.add(crown);
    group.userData.pilotCrown = crown;

    group.userData.initialSize = org.size || 6.5;
    group.userData.bodyR = bodyR;
    group.userData.morph = morph;

    return group;
  }

  animateFlagellum(group, time, orgId) {
    const flag = group.userData.flagellum;
    if (!flag) return;

    const pos = flag.geometry.attributes.position;
    const bodyR = group.userData.bodyR || 4.5;
    const count = 14;
    const length = bodyR * 3.2;

    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const x = -bodyR - frac * length;
      const yWave = Math.sin(time * 0.012 - frac * 4.5 + orgId) * (frac * bodyR * 0.35);
      const zWave = Math.cos(time * 0.010 - frac * 3.8 + orgId) * (frac * bodyR * 0.65);

      pos.setXYZ(i, x, yWave, zWave);
    }
    pos.needsUpdate = true;
  }

  updateColonyBonds(colonyBonds, currentEntities, playerOrgId, time) {
    // Clean old lines
    for (let i = 0; i < this.bondLines.length; i++) {
      this.bondLines[i].visible = false;
    }

    if (!colonyBonds || colonyBonds.length === 0) return;

    let lineIdx = 0;
    for (let b = 0; b < colonyBonds.length; b++) {
      const bond = colonyBonds[b];
      const orgA = currentEntities.get(bond.id1);
      const orgB = currentEntities.get(bond.id2);
      if (!orgA || !orgB) continue;

      let lineMesh = this.bondLines[lineIdx];
      if (!lineMesh) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(6);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.75,
          linewidth: 2.5
        });
        lineMesh = new THREE.Line(geo, mat);
        this.scene.add(lineMesh);
        this.bondLines.push(lineMesh);
      }

      const ax = orgA.x - OCEAN_GEOMETRY.cx;
      const az = orgA.y - OCEAN_GEOMETRY.cy;
      const ay = 30.0 + Math.sin(time * 0.003 + orgA.id) * 4.5;

      const bx = orgB.x - OCEAN_GEOMETRY.cx;
      const bz = orgB.y - OCEAN_GEOMETRY.cy;
      const by = 30.0 + Math.sin(time * 0.003 + orgB.id) * 4.5;

      const posAttr = lineMesh.geometry.attributes.position;
      posAttr.setXYZ(0, ax, ay, az);
      posAttr.setXYZ(1, bx, by, bz);
      posAttr.needsUpdate = true;
      lineMesh.visible = true;

      lineIdx++;
    }
  }

  cleanup() {
    for (const group of this.creaturePool.values()) {
      this.scene.remove(group);
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.creaturePool.clear();

    for (const line of this.bondLines) {
      this.scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }
    this.bondLines = [];
  }
}
