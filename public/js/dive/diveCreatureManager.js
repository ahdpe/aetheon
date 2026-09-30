import * as THREE from '../lib/three.module.js';
import { getSpeciesMorphology } from '../gl/morphology.js';

export class DiveCreatureManager {
  constructor(scene) {
    this.scene = scene;
    this.creaturePool = new Map(); // id -> Three.js Group
    this.bondLines = [];
    this.maxVisibleDist = 280.0;
  }

  update(currentEntities, playerOrgId, colonyBonds = [], time = 0) {
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
      const y3d = 30.0 + Math.sin(time * 0.003 + org.id) * 4.5;
      group.position.set(x3d, y3d, z3d);

      // Rotation towards velocity vector in XZ plane
      const heading = Math.atan2(org.vy, org.vx);
      // In Three.js, rotation around Y axis: forward vector is (cos(-heading), 0, sin(-heading))
      group.rotation.y = -heading;
      group.rotation.z = Math.sin(time * 0.004 + org.id) * 0.08;
      group.rotation.x = Math.cos(time * 0.003 + org.id) * 0.05;

      // Animate undulating flagellum
      this.animateFlagellum(group, time, org.id);

      // Pulse nucleus with Kuramoto rhythm
      const pulse = 1.0 + Math.sin(time * 0.008 + org.id) * 0.15;
      if (group.userData.nucleus) {
        group.userData.nucleus.scale.set(pulse, pulse, pulse);
      }
    }

    // 2. Hide entities that died or moved far out of range
    for (const [id, group] of this.creaturePool.entries()) {
      if (!activeIds.has(id)) {
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

    // 1. Soft-body Outer Membrane (Glassmorphic Bioluminescent Micro-Capsule)
    const bodyR = Math.max(2.2, (org.size || 6.5) * 0.65);
    const bodyGeo = new THREE.SphereGeometry(bodyR, 24, 20);
    
    // Scale for aspect ratio (elongated streamlined hunter vs rounded grazer)
    bodyGeo.scale(morph.aspectX || 1.35, morph.aspectY || 0.85, 0.85);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(`hsl(${hue}, 85%, ${isHunter ? '55%' : '65%'})`),
      emissive: new THREE.Color(`hsl(${hue}, 95%, ${isHunter ? '45%' : '35%'})`),
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.82,
      roughness: 0.18,
      metalness: 0.05,
      transmission: 0.60,
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

    // 3. For Phytobionts / Grazers: Glowing Chloroplast Spherules inside cytoplasm
    if (!isHunter) {
      const chloroGeo = new THREE.SphereGeometry(bodyR * 0.18, 8, 8);
      const chloroMat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const c1 = new THREE.Mesh(chloroGeo, chloroMat);
      c1.position.set(-bodyR * 0.3, bodyR * 0.25, bodyR * 0.15);
      const c2 = new THREE.Mesh(chloroGeo, chloroMat);
      c2.position.set(-bodyR * 0.3, -bodyR * 0.25, -bodyR * 0.15);
      group.add(c1);
      group.add(c2);
    }

    // 4. Glowing Photophore Eyes & Spines for Predators
    if (isHunter) {
      const eyeGeo = new THREE.SphereGeometry(bodyR * 0.20, 10, 10);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e46 });
      const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
      eye1.position.set(bodyR * 0.9, bodyR * 0.42, bodyR * 0.2);
      const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
      eye2.position.set(bodyR * 0.9, -bodyR * 0.42, bodyR * 0.2);
      group.add(eye1);
      group.add(eye2);

      // Predatory Oral Spines
      const spineGeo = new THREE.ConeGeometry(bodyR * 0.12, bodyR * 0.6, 6);
      spineGeo.rotateZ(-Math.PI * 0.5); // Point forward along +X
      const spineMat = new THREE.MeshStandardMaterial({ color: 0xffe4e6, roughness: 0.3 });
      const spineTop = new THREE.Mesh(spineGeo, spineMat);
      spineTop.position.set(bodyR * 1.05, bodyR * 0.2, 0);
      const spineBot = new THREE.Mesh(spineGeo, spineMat);
      spineBot.position.set(bodyR * 1.05, -bodyR * 0.2, 0);
      group.add(spineTop);
      group.add(spineBot);
    }

    // 5. Trailing Flagellum (Whip Line along -X local axis)
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
      const yWave = Math.sin(time * 0.012 - frac * 4.5 + orgId) * (frac * bodyR * 0.65);
      const zWave = Math.cos(time * 0.010 - frac * 3.8 + orgId) * (frac * bodyR * 0.45);

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
    }
    this.creaturePool.clear();

    for (const line of this.bondLines) {
      this.scene.remove(line);
    }
    this.bondLines = [];
  }
}
