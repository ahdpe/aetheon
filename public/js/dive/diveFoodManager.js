import * as THREE from '../lib/three.module.js';

export class DiveFoodManager {
  constructor(scene, worldSize = 1400) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.bloomGroups = new Map(); // id -> { group, cloud, core, light, crystals, radius, x, z, targetScale, curScale }
    this.ambientSpores = null;
    this.particleTexture = null;
    this.lastGrazingSoundTime = 0;

    this.setupParticleTexture();
    this.setupAmbientSpores();
  }

  setupParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(190, 242, 100, 0.95)');
    grad.addColorStop(0.65, 'rgba(132, 204, 22, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    this.particleTexture = new THREE.CanvasTexture(canvas);
  }

  // Floating ambient phytomanna spores dispersed across water column
  setupAmbientSpores() {
    const count = 350;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 580;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 6.0 + Math.random() * 45.0; // Water column depth
      positions[i * 3 + 2] = Math.sin(angle) * r;

      velocities.push({
        vy: (Math.random() - 0.5) * 0.08,
        swirlAngle: angle,
        swirlSpeed: 0.0008 + Math.random() * 0.0012,
        r: r
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xbbf7d0,
      size: 5.5,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.ambientSpores = new THREE.Points(geo, mat);
    this.ambientSporesData = { velocities, count };
    this.scene.add(this.ambientSpores);
  }

  // Create a 3D Volumetric Nutrient Bloom at water column level (Y = 18)
  createBloom3D(bloom) {
    const radius = Math.max(22, (bloom.r || 50) * 0.65);
    const group = new THREE.Group();

    // 1. Volumetric Cloud Sphere
    const cloudGeo = new THREE.SphereGeometry(radius, 24, 16);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0x84cc16, // Vibrant emerald lime
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);

    // 2. Dense Golden Radiant Core
    const coreGeo = new THREE.SphereGeometry(radius * 0.45, 18, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a, // Warm golden nectar core
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // 3. Volumetric Nutrient Point Light
    const light = new THREE.PointLight(0xa3e635, 2.8, radius * 3.5, 1.2);
    group.add(light);

    // 4. Drifting Phytomanna Crystals / Sparkling Flakes inside bloom
    const flakeCount = 28;
    const flakeGeo = new THREE.BufferGeometry();
    const flakePos = new Float32Array(flakeCount * 3);
    const flakeOffsets = [];

    for (let f = 0; f < flakeCount; f++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const fr = Math.cbrt(Math.random()) * radius * 0.88;

      const fx = fr * Math.sin(phi) * Math.cos(theta);
      const fy = (fr * Math.sin(phi) * Math.sin(theta)) * 0.6; // Slightly flattened vertically
      const fz = fr * Math.cos(phi);

      flakePos[f * 3] = fx;
      flakePos[f * 3 + 1] = fy;
      flakePos[f * 3 + 2] = fz;

      flakeOffsets.push({
        origX: fx,
        origY: fy,
        origZ: fz,
        freq: 0.002 + Math.random() * 0.003,
        phase: Math.random() * Math.PI * 2
      });
    }

    flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));

    const flakeMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 7.0,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const crystals = new THREE.Points(flakeGeo, flakeMat);
    group.add(crystals);

    // Position at 3D water column coordinates
    const x3D = bloom.x - 700;
    const z3D = bloom.y - 700;
    const y3D = 18.0;
    group.position.set(x3D, y3D, z3D);

    this.scene.add(group);

    return {
      group,
      cloud,
      core,
      light,
      crystals,
      flakeOffsets,
      flakeCount,
      radius,
      x: x3D,
      z: z3D,
      y: y3D,
      curScale: 0.1,
      targetScale: 1.0,
      isFading: false
    };
  }

  update(serverBlooms = [], time = performance.now(), playerPos3D = null) {
    const activeIds = new Set();
    let isPlayerGrazing = false;

    // 1. Sync active server blooms
    if (serverBlooms && serverBlooms.length > 0) {
      for (let i = 0; i < serverBlooms.length; i++) {
        const b = serverBlooms[i];
        const bloomId = b.id || `${Math.round(b.x)}_${Math.round(b.y)}`;
        activeIds.add(bloomId);

        let bloomObj = this.bloomGroups.get(bloomId);
        if (!bloomObj) {
          bloomObj = this.createBloom3D(b);
          this.bloomGroups.set(bloomId, bloomObj);
        }

        // Animate entrance scale
        if (bloomObj.curScale < 1.0) {
          bloomObj.curScale += 0.08;
          if (bloomObj.curScale > 1.0) bloomObj.curScale = 1.0;
        }

        // Breathing pulsation
        const pulse = Math.sin(time * 0.003 + (b.id || i) * 1.5);
        const s = bloomObj.curScale * (1.0 + pulse * 0.06);
        bloomObj.group.scale.set(s, s, s);

        bloomObj.light.intensity = 2.4 + pulse * 0.5;

        // Animate internal phytomanna crystals
        if (bloomObj.crystals && bloomObj.flakeOffsets) {
          const pos = bloomObj.crystals.geometry.attributes.position;
          for (let f = 0; f < bloomObj.flakeCount; f++) {
            const off = bloomObj.flakeOffsets[f];
            const bobY = off.origY + Math.sin(time * off.freq + off.phase) * 3.5;
            const swirl = Math.cos(time * (off.freq * 0.7) + off.phase) * 2.5;
            pos.setXYZ(f, off.origX + swirl, bobY, off.origZ + swirl);
          }
          pos.needsUpdate = true;
        }

        // Check if player organism is inside this nutrient bloom cloud
        if (playerPos3D) {
          const distToBloom = Math.hypot(playerPos3D.x - bloomObj.x, playerPos3D.z - bloomObj.z);
          if (distToBloom < bloomObj.radius + 14.0) {
            isPlayerGrazing = true;
          }
        }
      }
    }

    // 2. Fade out and remove expired blooms
    for (const [id, bloomObj] of this.bloomGroups.entries()) {
      if (!activeIds.has(id)) {
        bloomObj.curScale -= 0.06;
        if (bloomObj.curScale <= 0.05) {
          this.scene.remove(bloomObj.group);
          // Dispose geometries & materials
          try {
            bloomObj.cloud.geometry.dispose();
            bloomObj.cloud.material.dispose();
            bloomObj.core.geometry.dispose();
            bloomObj.core.material.dispose();
            bloomObj.crystals.geometry.dispose();
            bloomObj.crystals.material.dispose();
          } catch (e) {}
          this.bloomGroups.delete(id);
        } else {
          bloomObj.group.scale.set(bloomObj.curScale, bloomObj.curScale, bloomObj.curScale);
        }
      }
    }

    // 3. Animate ambient water column phytomanna spores
    if (this.ambientSpores && this.ambientSporesData) {
      const pos = this.ambientSpores.geometry.attributes.position;
      const vels = this.ambientSporesData.velocities;
      for (let i = 0; i < this.ambientSporesData.count; i++) {
        const vel = vels[i];
        vel.swirlAngle += vel.swirlSpeed;
        const px = Math.cos(vel.swirlAngle) * vel.r;
        let py = pos.getY(i) + vel.vy;
        const pz = Math.sin(vel.swirlAngle) * vel.r;

        if (py < 6.0) py = 45.0;
        if (py > 45.0) py = 6.0;

        pos.setXYZ(i, px, py, pz);
      }
      pos.needsUpdate = true;
    }

    return { isPlayerGrazing };
  }

  cleanup() {
    for (const [, bloomObj] of this.bloomGroups.entries()) {
      try {
        this.scene.remove(bloomObj.group);
        bloomObj.cloud.geometry.dispose();
        bloomObj.cloud.material.dispose();
        bloomObj.core.geometry.dispose();
        bloomObj.core.material.dispose();
        bloomObj.crystals.geometry.dispose();
        bloomObj.crystals.material.dispose();
      } catch (e) {}
    }
    this.bloomGroups.clear();

    if (this.ambientSpores) {
      try {
        this.scene.remove(this.ambientSpores);
        this.ambientSpores.geometry.dispose();
        this.ambientSpores.material.dispose();
      } catch (e) {}
      this.ambientSpores = null;
    }
  }
}
