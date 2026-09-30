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
  }

  build(vents = []) {
    this.vents = vents;
    this.setupLightingAndFog();
    this.setupDropletDome();
    this.setupSeafloor();
    this.setupHydrothermalSmokers();
    this.setupMarineSnow();
  }

  setupLightingAndFog() {
    // 1. Deep Oceanic Volumetric Fog
    this.scene.fog = new THREE.FogExp2(0x030d1a, 0.0042);

    // 2. Ambient Bioluminescent Glow
    const ambLight = new THREE.AmbientLight(0x0a223a, 1.2);
    this.scene.add(ambLight);

    // 3. Directional Caustic Sun Rays from Meniscus Ceiling
    const causticLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    causticLight.position.set(700, 700, 450);
    this.scene.add(causticLight);

    // 4. Subtle Rim Light from chamber perimeter
    const rimLight = new THREE.HemisphereLight(0x00f0ff, 0x02111e, 0.8);
    this.scene.add(rimLight);
  }

  setupDropletDome() {
    // Meniscus Ceiling (Liquid Sky / Interfacial Tension Membrane)
    const domeGeo = new THREE.SphereGeometry(this.chamberRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: false,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(700, 700, 0);
    dome.scale.set(1.0, 1.0, 0.45); // Flattened liquid droplet dome
    this.scene.add(dome);

    // Outer meniscus ring
    const ringGeo = new THREE.RingGeometry(this.chamberRadius - 4, this.chamberRadius + 4, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(700, 700, 2);
    this.scene.add(ring);
  }

  setupSeafloor() {
    // 3D Bio-Calcite Reef Floor
    const gridSegs = 64;
    const planeGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, gridSegs, gridSegs);
    
    // Deform vertices to create natural underwater topography and reef hills
    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i) + 700;
      const vy = pos.getY(i) + 700;
      
      const dx = vx - 700;
      const dy = vy - 700;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Elevated rim meniscus + reef knolls around vents
      let elevation = 0;
      if (distFromCenter < this.chamberRadius) {
        // Natural undulating seabed
        elevation += Math.sin(vx * 0.015) * Math.cos(vy * 0.015) * 8.0;
        elevation += Math.sin(vx * 0.04 + vy * 0.03) * 4.0;

        // Elevated vents mounds
        for (let v = 0; v < this.vents.length; v++) {
          const vent = this.vents[v];
          const vdx = vx - vent.x;
          const vdy = vy - vent.y;
          const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
          if (vdist < 90) {
            elevation += Math.cos((vdist / 90) * (Math.PI * 0.5)) * 26.0;
          }
        }
      } else {
        elevation -= 30.0; // Shelf drops off outside chamber
      }

      pos.setZ(i, elevation - 18.0);
    }
    planeGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x081c2f,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    this.terrainMesh.position.set(700, 700, 0);
    this.scene.add(this.terrainMesh);
  }

  setupHydrothermalSmokers() {
    // 5 Hydrothermal Chimney Spire Formations
    const colors = [0x10b981, 0x8b5cf6, 0x00f0ff, 0xef4444, 0xf59e0b];

    for (let i = 0; i < this.vents.length; i++) {
      const vent = this.vents[i];
      const col = colors[i % colors.length];

      // Mineral Spire Column
      const spireGeo = new THREE.CylinderGeometry(6, 16, 38, 8);
      const spireMat = new THREE.MeshStandardMaterial({
        color: 0x050e18,
        roughness: 0.9,
        emissive: col,
        emissiveIntensity: 0.25
      });
      const spire = new THREE.Mesh(spireGeo, spireMat);
      spire.position.set(vent.x, vent.y, 8);
      spire.rotation.x = Math.PI * 0.5;
      this.scene.add(spire);

      // Vent Orifice Glow
      const glowGeo = new THREE.SphereGeometry(9, 12, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(vent.x, vent.y, 24);
      this.scene.add(glow);

      // Point Light for the chimney
      const pLight = new THREE.PointLight(col, 2.5, 140);
      pLight.position.set(vent.x, vent.y, 30);
      this.scene.add(pLight);

      // Plume particle emitter
      this.createChimneyPlume(vent.x, vent.y, col);
    }
  }

  createChimneyPlume(x, y, colorHex) {
    const particleCount = 70;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = 20 + Math.random() * 80;

      velocities.push({
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: 0.4 + Math.random() * 0.7,
        origX: x,
        origY: y
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 4.5,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const plume = new THREE.Points(geo, mat);
    this.scene.add(plume);
    this.plumeParticles.push({ mesh: plume, velocities, count: particleCount });
  }

  setupMarineSnow() {
    // Ambient floating plankton & marine snow (floating suspended particulate)
    const count = 750;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.chamberRadius;
      positions[i * 3] = 700 + Math.cos(angle) * r;
      positions[i * 3 + 1] = 700 + Math.sin(angle) * r;
      positions[i * 3 + 2] = 2.0 + Math.random() * 110.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 2.2,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.marineSnow = new THREE.Points(geo, mat);
    this.scene.add(this.marineSnow);
  }

  update(time) {
    // 1. Animate chimney mineral plumes rising into water column
    for (let p = 0; p < this.plumeParticles.length; p++) {
      const plume = this.plumeParticles[p];
      const pos = plume.mesh.geometry.attributes.position;
      
      for (let i = 0; i < plume.count; i++) {
        let px = pos.getX(i);
        let py = pos.getY(i);
        let pz = pos.getZ(i);
        const vel = plume.velocities[i];

        pz += vel.vz;
        px += vel.vx + Math.sin(time * 0.002 + i) * 0.2;
        py += vel.vy + Math.cos(time * 0.002 + i) * 0.2;

        if (pz > 120.0) {
          pz = 20.0;
          px = vel.origX + (Math.random() - 0.5) * 10;
          py = vel.origY + (Math.random() - 0.5) * 10;
        }

        pos.setXYZ(i, px, py, pz);
      }
      pos.needsUpdate = true;
    }

    // 2. Animate marine snow drift
    if (this.marineSnow) {
      const pos = this.marineSnow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let pz = pos.getZ(i);
        pz -= 0.08;
        if (pz < 1.0) pz = 110.0;
        pos.setZ(i, pz);
      }
      pos.needsUpdate = true;
    }
  }
}
