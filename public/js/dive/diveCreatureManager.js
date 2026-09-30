import * as THREE from '../lib/three.module.js';
import { getSpeciesMorphology } from '../gl/morphology.js';

export class DiveCreatureManager {
  constructor(scene) {
    this.scene = scene;
    this.creaturePool = new Map(); // id -> Three.js Group
    this.bondLines = [];
    this.maxVisibleDist = 260.0;
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
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Distance culling for rock-solid 60 FPS on mobile
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

      // Anti-clipping lens fade: prevent creatures right next to the lens from blocking the whole screen
      const bodyMat = group.userData.bodyMat;
      if (bodyMat) {
        const lensDist = Math.max(0.0, dist - 6.0);
        bodyMat.opacity = Math.min(0.72, Math.max(0.05, lensDist / 12.0) * 0.72);
      }

      // Buoyancy height in water column
      const pz = 14.0 + Math.sin(time * 0.003 + org.id) * 5.0;
      group.position.set(org.x, org.y, pz);

      // Rotation towards velocity vector
      const heading = Math.atan2(org.vy, org.vx);
      group.rotation.z = heading;
      group.rotation.x = Math.sin(time * 0.004 + org.id) * 0.12;

      // Animate undulating flagellum
      this.animateFlagellum(group, time, org.id);

      // Pulse nucleus
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

    // 1. Soft-body Outer Membrane (Translucent Glowing Micro-Capsule)
    const bodyR = Math.max(1.8, (org.size || 6.5) * 0.55);
    const bodyGeo = new THREE.SphereGeometry(bodyR, 20, 16);
    
    // Scale for aspect ratio (elongated streamlined hunter vs rounded grazer)
    bodyGeo.scale(morph.aspectX || 1.35, morph.aspectY || 0.8, 0.8);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(`hsl(${hue}, 85%, ${isHunter ? '55%' : '65%'})`),
      emissive: new THREE.Color(`hsl(${hue}, 95%, ${isHunter ? '45%' : '35%'})`),
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.72,
      roughness: 0.25,
      metalness: 0.15
    });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    group.userData.bodyMat = bodyMat;

    // 2. Bioluminescent Internal Organelle / Nucleus
    const nucleusGeo = new THREE.SphereGeometry(bodyR * 0.32, 10, 10);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    nucleus.position.set(bodyR * 0.2, 0, 0);
    group.add(nucleus);
    group.userData.nucleus = nucleus;

    // 3. Glowing Eyes / Sensory Photophores for Predators
    if (isHunter) {
      const eyeGeo = new THREE.SphereGeometry(bodyR * 0.18, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1844 });
      const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
      eye1.position.set(bodyR * 0.85, bodyR * 0.4, bodyR * 0.15);
      const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
      eye2.position.set(bodyR * 0.85, -bodyR * 0.4, bodyR * 0.15);
      group.add(eye1);
      group.add(eye2);
    }

    // 4. Trailing Flagellum (Whip Line)
    const pointsCount = 12;
    const flagGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pointsCount * 3);
    flagGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const flagMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(`hsl(${hue}, 95%, 75%)`),
      transparent: true,
      opacity: 0.75,
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
    const bodyR = group.userData.bodyR || 4.0;
    const count = 10;
    const length = bodyR * 2.8;

    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const x = -bodyR - frac * length;
      const wave = Math.sin(time * 0.012 - frac * 4.0 + orgId) * (frac * bodyR * 0.6);
      const zWave = Math.cos(time * 0.010 - frac * 3.5 + orgId) * (frac * bodyR * 0.3);

      pos.setXYZ(i, x, wave, zWave);
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
          opacity: 0.7,
          linewidth: 2
        });
        lineMesh = new THREE.Line(geo, mat);
        this.scene.add(lineMesh);
        this.bondLines.push(lineMesh);
      }

      const az = 14.0 + Math.sin(time * 0.003 + orgA.id) * 6.0;
      const bz = 14.0 + Math.sin(time * 0.003 + orgB.id) * 6.0;

      const posAttr = lineMesh.geometry.attributes.position;
      posAttr.setXYZ(0, orgA.x, orgA.y, az);
      posAttr.setXYZ(1, orgB.x, orgB.y, bz);
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
