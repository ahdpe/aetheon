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
    this.ventHemispheres = [];
    this.ventPositions3D = []; // Array of { x, z, col, hue, power }

    this.ambLight = null;
    this.hemiLight = null;
    this.sunLight = null;

    // Dynamic Bioluminescent Seafloor Canvas Texture
    this.seafloorCanvas = document.createElement('canvas');
    this.seafloorCanvas.width = 512;
    this.seafloorCanvas.height = 512;
    this.seafloorCtx = this.seafloorCanvas.getContext('2d');
    this.seafloorTexture = new THREE.CanvasTexture(this.seafloorCanvas);
    this.lastSeafloorUpdate = 0;

    // Target colors for smooth atmospheric lerp
    this.currentFogColor = new THREE.Color(0x0a2d48);
    this.targetFogColor = new THREE.Color(0x0a2d48);
    this.currentAmbColor = new THREE.Color(0x16466b);
    this.targetAmbColor = new THREE.Color(0x16466b);
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
    // 1. Crystal-clear Deep Oceanic Fog (Zero fog nearby: 340 to 1100 units)
    this.scene.fog = new THREE.Fog(0x020d1a, 340, 1100);
    this.scene.background = new THREE.Color(0x020d1a);

    // 2. Ambient Bioluminescent Glow (Rich, luminous, crystal-clear oceanic blue)
    this.ambLight = new THREE.AmbientLight(0x163b5c, 2.0);
    this.scene.add(this.ambLight);

    // 3. Meniscus Sunlight rays shining at a gentle angle for 3D specular relief
    this.sunLight = new THREE.DirectionalLight(0xbbe8f8, 2.2);
    this.sunLight.position.set(60, 220, 80);
    this.scene.add(this.sunLight);

    // 4. Liquid Sky Hemisphere Light (Vibrant cyan sky / deep navy floor)
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x020d1a, 1.8);
    this.scene.add(this.hemiLight);
  }

  setupDropletDome() {
    // 1. Surface Meniscus Liquid Ceiling overhead at Y = 55 (curving gently upward)
    const domeGeo = new THREE.SphereGeometry(this.chamberRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, 50, 0);
    dome.scale.set(1.0, 0.12, 1.0); // Gentle liquid meniscus curve overhead
    this.scene.add(dome);

    // 2. Laboratory Petri Dish Glass Cylinder Boundary (radius 620)
    const wallGeo = new THREE.CylinderGeometry(this.chamberRadius, this.chamberRadius, 85, 64, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.10,
      side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 15, 0);
    this.scene.add(wall);

    // 3. Meniscus perimeter boundary ring on XZ plane
    const ringGeo = new THREE.RingGeometry(this.chamberRadius - 6, this.chamberRadius + 6, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(0, 20, 0);
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

      let elevation = -16.0;
      if (distFromCenter < this.chamberRadius) {
        // Natural undulating seabed
        elevation += Math.sin(vx * 0.015) * Math.cos(vz * 0.015) * 3.2;
        elevation += Math.sin(vx * 0.035 + vz * 0.03) * 1.8;

        // Elevated vent mounds beneath each hydrothermal chimney (peaks at Y = -9.5)
        for (let v = 0; v < this.ventPositions3D.length; v++) {
          const vent = this.ventPositions3D[v];
          const vdist = Math.hypot(vx - vent.x, vz - vent.z);
          if (vdist < 110) {
            elevation += Math.cos((vdist / 110) * (Math.PI * 0.5)) * 6.5;
          }
        }
      } else {
        elevation -= 22.0; // Shelf drops off outside petri chamber
      }

      pos.setY(i, elevation);
    }
    planeGeo.computeVertexNormals();

    this.renderSeafloorCanvas(null);

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.seafloorTexture,
      emissiveMap: this.seafloorTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.78,
      roughness: 0.45,
      metalness: 0.20,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    this.terrainMesh.position.set(0, 0, 0);
    this.scene.add(this.terrainMesh);
  }

  // Draw vibrant bioluminescent seabed canvas texture matching 2D chemical map & local light
  renderSeafloorCanvas(thumbCanvas = null, playerX3D = 0, playerZ3D = 0, serverBlooms = [], playerColor = '#00f0ff') {
    const ctx = this.seafloorCtx;
    const w = 512;
    const h = 512;
    const cx = w * 0.5;
    const cy = h * 0.5;

    // 1. Deep abyssal substrate gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 260);
    bgGrad.addColorStop(0, '#0e3a5f');
    bgGrad.addColorStop(0.65, '#072640');
    bgGrad.addColorStop(1, '#02101b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Procedural organic sediment speckles & bio-calcite mineral grit
    ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
    for (let s = 0; s < 300; s++) {
      const rx = (Math.sin(s * 12.9898) * 0.5 + 0.5) * w;
      const ry = (Math.cos(s * 78.233) * 0.5 + 0.5) * h;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // 2. Draw live chemical and bio-calcite reef field from thumbnail if available
    if (thumbCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(thumbCanvas, 0, 0, w, h);
      ctx.restore();
    }

    // 2.5. Draw Server Nutrient Blooms (Bioluminescent emerald/lime glowing carpets on seafloor)
    if (serverBlooms && serverBlooms.length > 0) {
      for (let b = 0; b < serverBlooms.length; b++) {
        const bl = serverBlooms[b];
        const bx = (bl.x / this.worldSize) * w;
        const bz = (bl.y / this.worldSize) * h;
        const br = Math.max(25, ((bl.r || 60) / this.worldSize) * w * 1.5);

        const bGrad = ctx.createRadialGradient(bx, bz, 3, bx, bz, br);
        bGrad.addColorStop(0, 'rgba(190, 242, 100, 0.92)');
        bGrad.addColorStop(0.4, 'rgba(163, 230, 53, 0.65)');
        bGrad.addColorStop(0.75, 'rgba(34, 197, 94, 0.25)');
        bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bx, bz, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 3. Draw Chamber Floor Boundary ring
    const chamberR = (this.chamberRadius / this.worldSize) * w;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 3.0;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, chamberR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Draw Radiant Hydrothermal Vent Hearths & Geothermal Auras
    for (let i = 0; i < this.ventPositions3D.length; i++) {
      const vent = this.ventPositions3D[i];
      // Convert centered 3D (-700..700) to seafloor canvas (0..512)
      const vx = ((vent.x + this.worldSize * 0.5) / this.worldSize) * w;
      const vz = ((vent.z + this.worldSize * 0.5) / this.worldSize) * h;
      const vr = 48; // Crisp, concentrated radiant pool directly beneath hemisphere

      const ventGrad = ctx.createRadialGradient(vx, vz, 4, vx, vz, vr);
      const hex = vent.color.toString(16).padStart(6, '0');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      ventGrad.addColorStop(0, `#${hex}`);
      ventGrad.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.75)`);
      ventGrad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, 0.20)`);
      ventGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.fillStyle = ventGrad;
      ctx.beginPath();
      ctx.arc(vx, vz, vr, 0, Math.PI * 2);
      ctx.fill();

      // Incandescent core orifice
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = `#${hex}`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(vx, vz, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Dynamic Cellular Illumination Halo directly beneath Piloted Organism
    if (playerX3D !== undefined && playerZ3D !== undefined) {
      const px = ((playerX3D + this.worldSize * 0.5) / this.worldSize) * w;
      const pz = ((playerZ3D + this.worldSize * 0.5) / this.worldSize) * h;
      const pRadius = 42;

      const pGrad = ctx.createRadialGradient(px, pz, 2, px, pz, pRadius);
      pGrad.addColorStop(0, playerColor || 'rgba(0, 240, 255, 0.75)');
      pGrad.addColorStop(0.45, 'rgba(0, 240, 255, 0.28)');
      pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(px, pz, pRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.seafloorTexture.needsUpdate = true;
  }

  setupHydrothermalSmokers() {
    for (let i = 0; i < this.ventPositions3D.length; i++) {
      const vent = this.ventPositions3D[i];

      // 1. Luminous Bio-Calcite Hemisphere Dome (Outer translucent mantle, radius 18, soft glow)
      const outerGeo = new THREE.SphereGeometry(18, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const outerMat = new THREE.MeshBasicMaterial({
        color: vent.color,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const outerDome = new THREE.Mesh(outerGeo, outerMat);
      outerDome.position.set(vent.x, -11.5, vent.z);
      this.scene.add(outerDome);

      // 2. Soft Inner Radiant Hearth (Small gentle nucleus, radius 5.5, soft white glow)
      const coreGeo = new THREE.SphereGeometry(5.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const coreDome = new THREE.Mesh(coreGeo, coreMat);
      coreDome.position.set(vent.x, -11.5, vent.z);
      this.scene.add(coreDome);

      // 3. Concentric Seabed Radiant Halo Ring on seafloor plane
      const haloGeo = new THREE.RingGeometry(14, 34, 48);
      const haloMat = new THREE.MeshBasicMaterial({
        color: vent.color,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = -Math.PI * 0.5;
      halo.position.set(vent.x, -11.0, vent.z);
      this.scene.add(halo);

      // 4. Soft Pulsating Volumetric Point Light illuminating surrounding waters
      const pLight = new THREE.PointLight(vent.color, 3.2, 280, 1.2);
      pLight.position.set(vent.x, 6, vent.z);
      this.scene.add(pLight);
      this.ventLights.push(pLight);
      this.ventHemispheres.push({
        light: pLight,
        outerDome,
        coreDome,
        baseIntensity: 3.2,
        x: vent.x,
        z: vent.z
      });

      // 5. Ascending Thermal Micro-Embers & Mineral Spores
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
      positions[i * 3] = x + (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = -2.0 + Math.random() * 54.0; // Y rises gently from dome into water column
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 14;

      velocities.push({
        vx: (Math.random() - 0.5) * 0.28,
        vy: 0.28 + Math.random() * 0.45,
        vz: (Math.random() - 0.5) * 0.28,
        origX: x,
        origZ: z
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 7.0,
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

  // Dynamically update fog and lighting: Pristine crystal-clear oceanic sapphire water
  updateAtmosphere(playerX3D, playerZ3D) {
    if (this.ventPositions3D.length === 0) return;

    let minVentDist = Infinity;
    for (let i = 0; i < this.ventPositions3D.length; i++) {
      const vent = this.ventPositions3D[i];
      const d = Math.hypot(playerX3D - vent.x, playerZ3D - vent.z);
      if (d < minVentDist) minVentDist = d;
    }

    // Pristine, crystal-clear oceanic sapphire water (NEVER murky or brown)
    const baseFog = new THREE.Color(0x020d1a);
    const baseAmb = new THREE.Color(0x163b5c);

    // Subtle brightness lift when near geothermal energy without corrupting water purity
    if (minVentDist < 220) {
      const ventFactor = Math.pow(1.0 - (minVentDist / 220), 1.5);
      if (this.ambLight) {
        this.ambLight.intensity = 2.0 + ventFactor * 0.45;
      }
    } else {
      if (this.ambLight) {
        this.ambLight.intensity = 2.0;
      }
    }

    if (this.scene.fog) {
      this.scene.fog.color.copy(baseFog);
    }
    if (this.scene.background) {
      this.scene.background.copy(baseFog);
    }
    if (this.ambLight) {
      this.ambLight.color.copy(baseAmb);
    }
  }

  update(time, playerX3D = 0, playerZ3D = 0, thumbCanvas = null, serverBlooms = [], playerColor = '#00f0ff') {
    // 1. Dynamic water atmosphere & vent lighting matching 2D
    this.updateAtmosphere(playerX3D, playerZ3D);

    // 1.5. Dynamic Seafloor texture update (throttled every 450ms)
    if (!this.lastSeafloorUpdate || time - this.lastSeafloorUpdate > 450) {
      this.lastSeafloorUpdate = time;
      this.renderSeafloorCanvas(thumbCanvas, playerX3D, playerZ3D, serverBlooms, playerColor);
    }

    // 1.8. Breathing pulsation of luminous bio-calcite hemispheres
    if (this.ventHemispheres) {
      for (let i = 0; i < this.ventHemispheres.length; i++) {
        const vh = this.ventHemispheres[i];
        const pulse = Math.sin(time * 0.0022 + i * 1.4);
        vh.light.intensity = vh.baseIntensity + pulse * 0.45;
        if (vh.outerDome) {
          const s = 1.0 + pulse * 0.035;
          vh.outerDome.scale.set(s, s, s);
        }
        if (vh.coreDome) {
          const cs = 1.0 + pulse * 0.05;
          vh.coreDome.scale.set(cs, cs, cs);
        }
      }
    }

    // 2. Animate ascending thermal mineral plumes rising along +Y to surface
    for (let p = 0; p < this.plumeParticles.length; p++) {
      const plume = this.plumeParticles[p];
      const pos = plume.mesh.geometry.attributes.position;
      
      for (let i = 0; i < plume.count; i++) {
        let px = pos.getX(i);
        let py = pos.getY(i);
        let pz = pos.getZ(i);
        const vel = plume.velocities[i];

        py += vel.vy; // Rise upwards
        px += vel.vx + Math.sin(time * 0.002 + i) * 0.16;
        pz += vel.vz + Math.cos(time * 0.002 + i) * 0.16;

        if (py > 54.0) {
          py = -2.0; // Reset at hemisphere crest
          px = vel.origX + (Math.random() - 0.5) * 14;
          pz = vel.origZ + (Math.random() - 0.5) * 14;
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
