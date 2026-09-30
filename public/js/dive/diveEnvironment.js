import * as THREE from '../lib/three.module.js';

export class DiveEnvironment {
  constructor(scene, worldSize = 1400, chamberRadius = 620) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.chamberRadius = chamberRadius;

    this.plumeParticles = [];
    this.marineSnow = null;
    this.terrainMesh = null;
    this.vents = [];
    this.ventLights = [];
    this.ventPositions3D = []; // Array of { x, z, col, hue, power }

    this.ambLight = null;
    this.hemiLight = null;
    this.sunLight = null;

    // Target colors for smooth atmospheric lerp
    this.currentFogColor = new THREE.Color(0x061e33);
    this.targetFogColor = new THREE.Color(0x061e33);
    this.currentAmbColor = new THREE.Color(0x0e3554);
    this.targetAmbColor = new THREE.Color(0x0e3554);
  }

  build(rawVents = []) {
    if (!rawVents || rawVents.length === 0) {
      // Symmetrically arranged canonical vents in a regular pentagon (matches server chemicalGrid.js)
      this.vents = [];
      const cx = 64;
      const cy = 64;
      const dist = 32;
      const hues = [0.12, 0.52, 0.95, 0.38, 0.78];
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI * 0.5;
        this.vents.push({
          x: Math.round(cx + Math.cos(angle) * dist),
          y: Math.round(cy + Math.sin(angle) * dist),
          radius: 7,
          power: 0.70,
          hue: hues[i]
        });
      }
    } else {
      this.vents = rawVents;
    }

    this.calculateVentCoordinates();
    this.setupLightingAndFog();
    this.setupDropletDome();
    this.setupSeafloor();
    this.setupHydrothermalSmokers();
    this.setupMarineSnow();
  }

  calculateVentCoordinates() {
    const ventScale = this.worldSize / 128; // 10.9375
    const ventColors = [0xf59e0b, 0x06b6d4, 0xf43f5e, 0x10b981, 0x8b5cf6]; // Amber, Cyan, Rose, Emerald, Violet
    const ventAtmosphere = [0x3b1c04, 0x06283b, 0x380518, 0x052e16, 0x240e45];

    this.ventPositions3D = [];
    for (let i = 0; i < this.vents.length; i++) {
      const v = this.vents[i];
      // Convert server grid coordinate (0..128) to 3D centered coordinate (-700..700)
      const worldX = (v.x !== undefined ? v.x : 64) * ventScale;
      const worldY = (v.y !== undefined ? v.y : 64) * ventScale;

      const x3d = worldX - 700;
      const z3d = worldY - 700;
      const color = ventColors[i % ventColors.length];
      const atmoColor = ventAtmosphere[i % ventAtmosphere.length];

      this.ventPositions3D.push({
        x: x3d,
        z: z3d,
        color,
        atmoColor,
        hue: v.hue !== undefined ? v.hue : (i / 5),
        power: v.power || 1.0
      });
    }
  }

  setupLightingAndFog() {
    // 1. Deep Oceanic Volumetric Fog (Horizontal Level)
    this.scene.fog = new THREE.FogExp2(0x061e33, 0.0035);

    // 2. Ambient Bioluminescent Glow (Bright enough so organisms are always luminous)
    this.ambLight = new THREE.AmbientLight(0x0e3554, 1.8);
    this.scene.add(this.ambLight);

    // 3. Meniscus Sunlight rays shining straight down along -Y
    this.sunLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    this.sunLight.position.set(0, 160, 0);
    this.scene.add(this.sunLight);

    // 4. Liquid Sky Hemisphere Light
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x04192b, 1.2);
    this.scene.add(this.hemiLight);
  }

  setupDropletDome() {
    // Surface Meniscus Liquid Ceiling overhead at Y = 75
    const domeGeo = new THREE.SphereGeometry(this.chamberRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: false,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.rotation.x = Math.PI; // Inverted dome covering the ceiling
    dome.position.set(0, 80, 0);
    dome.scale.set(1.0, 0.40, 1.0); // Flattened liquid droplet boundary
    this.scene.add(dome);

    // Meniscus perimeter boundary ring on XZ plane
    const ringGeo = new THREE.RingGeometry(this.chamberRadius - 6, this.chamberRadius + 6, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(0, 30, 0);
    this.scene.add(ring);
  }

  setupSeafloor() {
    // 3D Bio-Calcite Reef Floor on XZ plane
    const gridSegs = 72;
    const planeGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, gridSegs, gridSegs);
    // Rotate to lie flat on XZ plane: X is horizontal, Z is depth, Y is altitude
    planeGeo.rotateX(-Math.PI * 0.5);

    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const distFromCenter = Math.hypot(vx, vz);

      let elevation = 0;
      if (distFromCenter < this.chamberRadius) {
        // Natural undulating seabed
        elevation += Math.sin(vx * 0.015) * Math.cos(vz * 0.015) * 7.0;
        elevation += Math.sin(vx * 0.035 + vz * 0.03) * 4.0;

        // Elevated vent mounds beneath each hydrothermal chimney
        for (let v = 0; v < this.ventPositions3D.length; v++) {
          const vent = this.ventPositions3D[v];
          const vdist = Math.hypot(vx - vent.x, vz - vent.z);
          if (vdist < 140) {
            elevation += Math.cos((vdist / 140) * (Math.PI * 0.5)) * 24.0;
          }
        }
      } else {
        elevation -= 35.0; // Shelf drops off outside petri chamber
      }

      pos.setY(i, elevation);
    }
    planeGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x09223a,
      roughness: 0.85,
      metalness: 0.2,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    this.terrainMesh.position.set(0, 0, 0);
    this.scene.add(this.terrainMesh);
  }

  setupHydrothermalSmokers() {
    for (let i = 0; i < this.ventPositions3D.length; i++) {
      const vent = this.ventPositions3D[i];

      // 1. Basalt Chimney Spire Column standing upright on XZ plane
      const spireGeo = new THREE.CylinderGeometry(8, 22, 38, 10);
      const spireMat = new THREE.MeshStandardMaterial({
        color: 0x081320,
        roughness: 0.9,
        metalness: 0.1,
        emissive: new THREE.Color(vent.color),
        emissiveIntensity: 0.45
      });
      const spire = new THREE.Mesh(spireGeo, spireMat);
      spire.position.set(vent.x, 19, vent.z);
      this.scene.add(spire);

      // 2. Vent Hearth Core (Glowing orifice at top of chimney)
      const glowGeo = new THREE.SphereGeometry(10, 14, 14);
      const glowMat = new THREE.MeshBasicMaterial({
        color: vent.color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(vent.x, 38, vent.z);
      this.scene.add(glow);

      // 3. High-Intensity Volumetric Point Light illuminating surrounding waters
      const pLight = new THREE.PointLight(vent.color, 4.2, 340);
      pLight.position.set(vent.x, 44, vent.z);
      this.scene.add(pLight);
      this.ventLights.push(pLight);

      // 4. Ascending Chimney Mineral Plume Particles
      this.createChimneyPlume(vent.x, vent.z, vent.color);
    }
  }

  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.8)');
    grad.addColorStop(0.7, 'rgba(6, 182, 212, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  createChimneyPlume(x, z, colorHex) {
    if (!this.particleTexture) {
      this.particleTexture = this.createParticleTexture();
    }
    const particleCount = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = 38 + Math.random() * 38; // Y rises from chimney mouth to surface
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 12;

      velocities.push({
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.35 + Math.random() * 0.55,
        vz: (Math.random() - 0.5) * 0.35,
        origX: x,
        origZ: z
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 7.5,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const plume = new THREE.Points(geo, mat);
    this.scene.add(plume);
    this.plumeParticles.push({ mesh: plume, velocities, count: particleCount });
  }

  setupMarineSnow() {
    if (!this.particleTexture) {
      this.particleTexture = this.createParticleTexture();
    }
    // 850 bioluminescent micro-particles suspended throughout the water column
    const count = 850;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.chamberRadius;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 4.0 + Math.random() * 68.0; // Suspended between seabed and surface
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 4.5,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.marineSnow = new THREE.Points(geo, mat);
    this.scene.add(this.marineSnow);
  }

  // Dynamically update fog, ambient lighting, and water color based on player's position
  updateAtmosphere(playerX3D, playerZ3D) {
    if (this.ventPositions3D.length === 0) return;

    let nearestVent = null;
    let minVentDist = Infinity;

    for (let i = 0; i < this.ventPositions3D.length; i++) {
      const vent = this.ventPositions3D[i];
      const d = Math.hypot(playerX3D - vent.x, playerZ3D - vent.z);
      if (d < minVentDist) {
        minVentDist = d;
        nearestVent = vent;
      }
    }

    const defaultFog = new THREE.Color(0x061e33);
    const defaultAmb = new THREE.Color(0x0e3554);

    if (nearestVent && minVentDist < 260) {
      // Transition smoothly into vent's glowing chromatic aura!
      const ventFactor = Math.pow(1.0 - (minVentDist / 260), 1.2);
      const ventAtmoCol = new THREE.Color(nearestVent.atmoColor);
      const ventCoreCol = new THREE.Color(nearestVent.color);

      this.targetFogColor.copy(defaultFog).lerp(ventAtmoCol, ventFactor * 0.85);
      this.targetAmbColor.copy(defaultAmb).lerp(ventCoreCol, ventFactor * 0.45);
    } else {
      this.targetFogColor.copy(defaultFog);
      this.targetAmbColor.copy(defaultAmb);
    }

    // Smooth lerp fog and ambient color
    this.currentFogColor.lerp(this.targetFogColor, 0.08);
    this.currentAmbColor.lerp(this.targetAmbColor, 0.08);

    if (this.scene.fog) {
      this.scene.fog.color.copy(this.currentFogColor);
    }
    if (this.scene.background) {
      this.scene.background.copy(this.currentFogColor);
    }
    if (this.ambLight) {
      this.ambLight.color.copy(this.currentAmbColor);
    }
  }

  update(time, playerX3D = 0, playerZ3D = 0) {
    // 1. Dynamic water atmosphere & vent lighting matching 2D
    this.updateAtmosphere(playerX3D, playerZ3D);

    // 2. Animate chimney mineral plumes rising along +Y to surface
    for (let p = 0; p < this.plumeParticles.length; p++) {
      const plume = this.plumeParticles[p];
      const pos = plume.mesh.geometry.attributes.position;
      
      for (let i = 0; i < plume.count; i++) {
        let px = pos.getX(i);
        let py = pos.getY(i);
        let pz = pos.getZ(i);
        const vel = plume.velocities[i];

        py += vel.vy; // Rise upwards
        px += vel.vx + Math.sin(time * 0.002 + i) * 0.18;
        pz += vel.vz + Math.cos(time * 0.002 + i) * 0.18;

        if (py > 76.0) {
          py = 38.0; // Reset at chimney mouth
          px = vel.origX + (Math.random() - 0.5) * 8;
          pz = vel.origZ + (Math.random() - 0.5) * 8;
        }

        pos.setXYZ(i, px, py, pz);
      }
      pos.needsUpdate = true;
    }

    // 3. Animate suspended marine snow drift
    if (this.marineSnow) {
      const pos = this.marineSnow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let py = pos.getY(i);
        py -= 0.06; // Slow sinking drift
        if (py < 4.0) py = 72.0;
        pos.setY(i, py);
      }
      pos.needsUpdate = true;
    }
  }
}
