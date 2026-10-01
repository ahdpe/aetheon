import * as THREE from '../lib/three.module.js';
import { getSpeciesMorphology } from '../gl/morphology.js';

export class DiveCreatureManager {
  constructor(scene) {
    this.scene = scene;
    this.creaturePool = new Map(); // id -> Three.js Group
    this.bondLines = [];
    this.maxVisibleDist = 280.0;
  }

  update(currentEntities, playerOrgId, colonyBonds = [], time = 0, pilotedIds = null) {
    const activeIds = new Set();
    const playerOrg = currentEntities.get(playerOrgId);
    const px = playerOrg ? playerOrg.x : 700;
    const py = playerOrg ? playerOrg.y : 700;

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

      // Anti-clipping lens fade: prevent organisms right next to the lens from blocking the viewport
      const bodyMat = group.userData.bodyMat;
      if (bodyMat) {
        const lensDist = Math.max(0.0, dist - 6.0);
        bodyMat.opacity = Math.min(0.85, Math.max(0.08, lensDist / 14.0) * 0.85);
      }

      // Convert 2D coordinates (0..1400) to 3D centered coordinates (X, Z) with Y as altitude
      const x3d = org.x - 700;
      const z3d = org.y - 700;
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

      // Animate undulating flagellum and pulse nucleus for nearby entities (< 160 units)
      if (dist < 160.0) {
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
    const morph = getSpeciesMorphology(org.speciesId || 1, org.hue, org.carnivory || 0.1, org.size || 7);
    const accentHue = morph.accentHue !== undefined ? morph.accentHue : ((hue + 140) % 360);

    const bodyR = Math.max(2.2, (org.size || 6.5) * 0.65);
    const shape = morph.shape || (isHunter ? 'raptor' : 'ovoid');

    // 1. Soft-body Outer Membrane (Species-specific distinct 3D geometries)
    let bodyGeo;
    if (shape === 'bacillus') {
      // Elongated cylindrical capsule aligned along local X axis (direction of motion)
      if (THREE.CapsuleGeometry) {
        bodyGeo = new THREE.CapsuleGeometry(bodyR * 0.55, bodyR * 1.5, 12, 16);
        bodyGeo.rotateZ(Math.PI * 0.5); // Align length with X
      } else {
        bodyGeo = new THREE.CylinderGeometry(bodyR * 0.55, bodyR * 0.55, bodyR * 1.5, 16);
        bodyGeo.rotateZ(Math.PI * 0.5);
      }
    } else if (shape === 'vibrio') {
      // Curved comma / crescent deformed sphere
      bodyGeo = new THREE.SphereGeometry(bodyR, 24, 20);
      const pos = bodyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        let vz = pos.getZ(i);

        // Normalize x from 0 (posterior/tail) to 1 (anterior/head)
        const t = (vx + bodyR) / (bodyR * 2.0);
        // Lateral C-curve arch along Z
        const curveZ = Math.sin(t * Math.PI) * (bodyR * 0.45);
        // Taper tail
        const taper = 0.55 + 0.65 * t;

        pos.setXYZ(i, vx * 1.4, vy * 0.72 * taper, (vz * 0.75 + curveZ) * taper);
      }
      bodyGeo.computeVertexNormals();
    } else if (shape === 'coccus') {
      // Plump spheroid orb
      bodyGeo = new THREE.SphereGeometry(bodyR, 20, 18);
      bodyGeo.scale(1.05, 0.95, 1.05);
    } else if (shape === 'raptor') {
      // Apex hunter: streamlined armored teardrop
      bodyGeo = new THREE.SphereGeometry(bodyR, 24, 20);
      const pos = bodyGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i);
        let vy = pos.getY(i);
        let vz = pos.getZ(i);
        // Taper posterior tail, expand anterior shoulders
        const t = (vx + bodyR) / (bodyR * 2.0);
        const taper = 0.45 + 0.75 * t;
        pos.setXYZ(i, vx * 1.35, vy * 0.70 * taper, vz * 0.85 * taper);
      }
      bodyGeo.computeVertexNormals();
    } else {
      // Ovoid / Spirillum: Streamlined oval
      bodyGeo = new THREE.SphereGeometry(bodyR, 20, 18);
      bodyGeo.scale(morph.aspectX || 1.30, 0.75, morph.aspectY || 0.85);
    }

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(`hsl(${hue}, 85%, ${isHunter ? '55%' : '65%'})`),
      emissive: new THREE.Color(`hsl(${hue}, 95%, ${isHunter ? '45%' : '35%'})`),
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.82,
      roughness: 0.18,
      metalness: 0.05,
      transmission: 0.58,
      ior: 1.34
    });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    group.userData.bodyMat = bodyMat;

    // 2. Bioluminescent Internal Nucleus
    const nucleusGeo = new THREE.SphereGeometry(bodyR * 0.35, 12, 12);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    nucleus.position.set(bodyR * 0.25, 0, 0);
    group.add(nucleus);
    group.userData.nucleus = nucleus;

    // 3. Organelles & Markings based on Phenotype / Morphology
    if (shape === 'bacillus') {
      // Transverse glowing rib bands around capsule body
      const bandMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 95%, 70%)`),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const ringGeo = new THREE.TorusGeometry(bodyR * 0.56, bodyR * 0.05, 6, 20);
      ringGeo.rotateY(Math.PI * 0.5); // Perpendicular to X
      const ring1 = new THREE.Mesh(ringGeo, bandMat);
      ring1.position.set(-bodyR * 0.45, 0, 0);
      const ring2 = new THREE.Mesh(ringGeo, bandMat);
      ring2.position.set(bodyR * 0.35, 0, 0);
      group.add(ring1);
      group.add(ring2);
    } else if (shape === 'coccus' || morph.pattern === 'spots') {
      // Dotted surface photophore vesicles
      const spotMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(`hsl(${accentHue}, 95%, 68%)`),
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending
      });
      const spotGeo = new THREE.SphereGeometry(bodyR * 0.15, 6, 6);
      const spotOffsets = [
        [bodyR * 0.2, bodyR * 0.55, bodyR * 0.4],
        [bodyR * 0.2, bodyR * 0.55, -bodyR * 0.4],
        [-bodyR * 0.3, bodyR * 0.6, 0],
        [-bodyR * 0.2, -bodyR * 0.55, bodyR * 0.35],
        [-bodyR * 0.2, -bodyR * 0.55, -bodyR * 0.35]
      ];
      for (let s = 0; s < spotOffsets.length; s++) {
        const spot = new THREE.Mesh(spotGeo, spotMat);
        spot.position.set(...spotOffsets[s]);
        group.add(spot);
      }
    } else if (!isHunter) {
      // Grazers / Phytobionts: 2 emerald chloroplasts inside cytoplasm
      const chloroGeo = new THREE.SphereGeometry(bodyR * 0.18, 8, 8);
      const chloroMat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const c1 = new THREE.Mesh(chloroGeo, chloroMat);
      c1.position.set(-bodyR * 0.3, bodyR * 0.15, bodyR * 0.25);
      const c2 = new THREE.Mesh(chloroGeo, chloroMat);
      c2.position.set(-bodyR * 0.3, bodyR * 0.15, -bodyR * 0.25);
      group.add(c1);
      group.add(c2);
    }

    // 4. Raptor-Specific Weaponry (Rostrum beak, lateral pincers/mandibles, glowing crimson eyes)
    if (isHunter) {
      // Anterior Rostrum Beak
      const rostrumGeo = new THREE.ConeGeometry(bodyR * 0.25, bodyR * 0.85, 8);
      rostrumGeo.rotateZ(-Math.PI * 0.5); // Point forward along +X
      const rostrumMat = new THREE.MeshStandardMaterial({
        color: 0xff4757,
        emissive: 0x8b0000,
        roughness: 0.3
      });
      const rostrum = new THREE.Mesh(rostrumGeo, rostrumMat);
      rostrum.position.set(bodyR * 1.35, 0, 0);
      group.add(rostrum);

      // Lateral Predatory Mandibles on left (+Z) and right (-Z)
      const pincerGeo = new THREE.ConeGeometry(bodyR * 0.14, bodyR * 0.65, 6);
      pincerGeo.rotateZ(-Math.PI * 0.5); // Point forward along +X
      const pincerMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xff2244,
        roughness: 0.25
      });

      const pincerLeft = new THREE.Mesh(pincerGeo, pincerMat);
      pincerLeft.position.set(bodyR * 1.1, 0, bodyR * 0.42);
      pincerLeft.rotation.y = 0.25; // Angled slightly inward

      const pincerRight = new THREE.Mesh(pincerGeo, pincerMat);
      pincerRight.position.set(bodyR * 1.1, 0, -bodyR * 0.42);
      pincerRight.rotation.y = -0.25; // Angled slightly inward

      group.add(pincerLeft);
      group.add(pincerRight);

      // Crimson Photophore Eyes on lateral flanks (+Z and -Z)
      const eyeGeo = new THREE.SphereGeometry(bodyR * 0.18, 10, 10);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e46 });
      const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
      eye1.position.set(bodyR * 0.85, bodyR * 0.12, bodyR * 0.45);
      const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
      eye2.position.set(bodyR * 0.85, bodyR * 0.12, -bodyR * 0.45);
      group.add(eye1);
      group.add(eye2);

      // Dorsal Predator Spines along top (+Y)
      const spineGeo = new THREE.ConeGeometry(bodyR * 0.10, bodyR * 0.45, 5);
      const spineMat = new THREE.MeshStandardMaterial({ color: 0xffd2d7, roughness: 0.4 });
      for (let sp = 0; sp < 3; sp++) {
        const spine = new THREE.Mesh(spineGeo, spineMat);
        spine.position.set(-bodyR * 0.2 + sp * bodyR * 0.4, bodyR * 0.65, 0);
        group.add(spine);
      }
    }

    // 4.5. Forward Sensory Antennule Whiskers for Ovoid/Spirillum
    if (morph.hasAntennae && !isHunter) {
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

      // Left whisker
      const pLeft = [
        new THREE.Vector3(bodyR * 1.1, 0, bodyR * 0.2),
        new THREE.Vector3(bodyR * 1.6, bodyR * 0.1, bodyR * 0.5),
        new THREE.Vector3(bodyR * 2.1, bodyR * 0.05, bodyR * 0.7)
      ];
      const gLeft = new THREE.BufferGeometry().setFromPoints(pLeft);
      group.add(new THREE.Line(gLeft, antMat));
      const tipLeft = new THREE.Mesh(tipGeo, antTipMat);
      tipLeft.position.copy(pLeft[2]);
      group.add(tipLeft);

      // Right whisker
      const pRight = [
        new THREE.Vector3(bodyR * 1.1, 0, -bodyR * 0.2),
        new THREE.Vector3(bodyR * 1.6, bodyR * 0.1, -bodyR * 0.5),
        new THREE.Vector3(bodyR * 2.1, bodyR * 0.05, -bodyR * 0.7)
      ];
      const gRight = new THREE.BufferGeometry().setFromPoints(pRight);
      group.add(new THREE.Line(gRight, antMat));
      const tipRight = new THREE.Mesh(tipGeo, antTipMat);
      tipRight.position.copy(pRight[2]);
      group.add(tipRight);
    }

    // 5. Trailing Propulsion Flagellum (Whip Line along -X local axis)
    if (morph.hasFlagellum || isHunter) {
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

      const ax = orgA.x - 700;
      const az = orgA.y - 700;
      const ay = 30.0 + Math.sin(time * 0.003 + orgA.id) * 4.5;

      const bx = orgB.x - 700;
      const bz = orgB.y - 700;
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
