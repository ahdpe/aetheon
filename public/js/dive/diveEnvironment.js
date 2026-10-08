import * as THREE from '../lib/three.module.js';
import { OCEAN_GEOMETRY } from '../shared/habitats.js';
import {TerrainField} from '../shared/terrain.js';
import {makeTerrainCanvas} from '../gl/terrainDrawing.js';

export class DiveEnvironment {
  constructor(scene, worldSize = OCEAN_GEOMETRY.worldSize, chamberRadius = OCEAN_GEOMETRY.radius) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.chamberRadius = chamberRadius;
    this.terrain=new TerrainField();
    this.reliefCanvas=makeTerrainCanvas(512,this.terrain);

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

    // Dynamic Phytobenthic Algae Sanctuaries
    this.algaeIsles = [];
    this.algaeFrondsGroup = null;
    this.algaeFrondMeshes = [];
    this.algaeBubbles = null;

    // Dynamic 3D Biogenic Coral Reefs & Sanctuaries
    this.biogenicReefs = [];
    this.coralReefsGroup = new THREE.Group();
    this.scene.add(this.coralReefsGroup);
    this.coralReefMeshes = [];
    this.coralReefsSignature = '';
  }

  build(rawVents = []) {
    if (!rawVents || rawVents.length === 0) {
      // Symmetrically arranged canonical vents in a regular pentagon (matches server chemicalGrid.js)
      this.vents = [];
      const cx = OCEAN_GEOMETRY.gridSize / 2;
      const cy = OCEAN_GEOMETRY.gridSize / 2;
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
    const ventScale = this.worldSize / OCEAN_GEOMETRY.gridSize; // 10.9375
    const ventColors = [0xf59e0b, 0x06b6d4, 0xf43f5e, 0x10b981, 0x8b5cf6]; // Amber, Cyan, Rose, Emerald, Violet
    const ventAtmosphere = [0x3b1c04, 0x06283b, 0x380518, 0x052e16, 0x240e45];

    this.ventPositions3D = [];
    for (let i = 0; i < this.vents.length; i++) {
      const v = this.vents[i];
      // Convert server grid coordinate (0..gridSize) to 3D centered coordinate (centered world)
      const worldX = (v.x !== undefined ? v.x : OCEAN_GEOMETRY.gridSize / 2) * ventScale;
      const worldY = (v.y !== undefined ? v.y : OCEAN_GEOMETRY.gridSize / 2) * ventScale;

      const x3d = worldX - OCEAN_GEOMETRY.cx;
      const z3d = worldY - OCEAN_GEOMETRY.cy;
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
    // 1. Crystal-clear Deep Oceanic Fog (Pristine within 60 units, smooth atmospheric depth fade 60 to 140 units)
    this.scene.fog = new THREE.Fog(0x020d1a, 60, 140);
    this.scene.background = new THREE.Color(0x020d1a);

    // 2. Ambient Bioluminescent Glow (Deep oceanic abyssal ambiance)
    this.ambLight = new THREE.AmbientLight(0x071b2d, 0.85);
    this.scene.add(this.ambLight);

    // 3. Meniscus Sunlight rays shining at a gentle angle for 3D specular relief
    this.sunLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    this.sunLight.position.set(60, 220, 80);
    this.scene.add(this.sunLight);

    // 4. Liquid Sky Hemisphere Light (Subtle cyan sky / deep navy floor)
    this.hemiLight = new THREE.HemisphereLight(0x0e3a5f, 0x010c18, 0.55);
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

    // 2. Laboratory Petri Dish Glass Cylinder Boundary
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
    const gridSegs = 96;
    const planeGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, gridSegs, gridSegs);
    // Rotate to lie flat on XZ plane: X is horizontal, Z is depth, Y is altitude
    planeGeo.rotateX(-Math.PI * 0.5);

    this.planeGeo = planeGeo;
    const pos = planeGeo.attributes.position;
    this.baseElevations = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const distFromCenter = Math.hypot(vx, vz);

      const elevation=distFromCenter<this.chamberRadius?this.terrain.sample(vx+this.worldSize/2,vz+this.worldSize/2).floorHeight:-42;

      this.baseElevations[i] = elevation;
      pos.setY(i, elevation);
    }
    planeGeo.computeVertexNormals();

    this.renderSeafloorCanvas(null);

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.seafloorTexture,
      emissiveMap: this.seafloorTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.18,
      roughness: 0.85,
      metalness: 0.12,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    this.terrainMesh.position.set(0, 0, 0);
    this.scene.add(this.terrainMesh);
  }

  // Sample the displayed floor, so settled bodies remain above its relief.
  getFloorHeight(x,z) {
    const segments=this.planeGeo.parameters.widthSegments,span=this.worldSize;
    const gx=Math.max(0,Math.min(segments-.00001,(x/span+.5)*segments));
    const gy=Math.max(0,Math.min(segments-.00001,(z/span+.5)*segments));
    const ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,w=segments+1,pos=this.planeGeo.attributes.position;
    const a=pos.getY(iy*w+ix),b=pos.getY(iy*w+ix+1),c=pos.getY((iy+1)*w+ix),d=pos.getY((iy+1)*w+ix+1);
    return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
  }

  // Dynamically carve real 3D coral reef ridges from live substrate field
  updateTerrainMeshHeights(thumbCanvas) {
    if (!thumbCanvas || !this.planeGeo || !this.baseElevations) return;
    try {
      const ctx = thumbCanvas.getContext('2d');
      if (!ctx) return;
      const w = thumbCanvas.width;
      const h = thumbCanvas.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const pos = this.planeGeo.attributes.position;
      const halfSize = this.worldSize * 0.5;

      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const distFromCenter = Math.hypot(vx, vz);
        let elev = this.baseElevations[i];

        if (distFromCenter < this.chamberRadius) {
          const gx = Math.max(0, Math.min(w - 1, Math.round(((vx + halfSize) / this.worldSize) * w)));
          const gy = Math.max(0, Math.min(h - 1, Math.round(((vz + halfSize) / this.worldSize) * h)));
          const pIdx = (gy * w + gx) * 4;

          // Alpha channel is substrate bio-calcite (0..255)
          const sub = data[pIdx + 3] / 255;
          if (sub > 0.08) {
            elev += Math.pow(sub, 1.25) * 12.0;
          }
        }
        pos.setY(i, elev);
      }
      pos.needsUpdate = true;
      this.planeGeo.computeVertexNormals();
    } catch (_) {}
  }

  updateVents(rawVents) {
    if (!rawVents || !Array.isArray(rawVents)) return;
    this.vents = rawVents;
    this.calculateVentCoordinates();
    if (this.ventHemispheres) {
      for (let i = 0; i < Math.min(this.ventHemispheres.length, this.ventPositions3D.length); i++) {
        const vh = this.ventHemispheres[i];
        const vpos = this.ventPositions3D[i];
        if (vh.outerDome) vh.outerDome.position.set(vpos.x, -10.0, vpos.z);
        if (vh.coreDome) vh.coreDome.position.set(vpos.x, -10.0, vpos.z);
        if (vh.halo) vh.halo.position.set(vpos.x, -12.4, vpos.z);
        if (vh.light) vh.light.position.set(vpos.x, -2.0, vpos.z);
      }
    }
  }

  updateAlgae(rawAlgae) {
    if (!rawAlgae || !Array.isArray(rawAlgae)) return;
    const changed = this.algaeIsles.map(p=>p.id).join(',') !== rawAlgae.map(p=>p.id).join(',');
    this.algaeIsles = rawAlgae;
    if (!this.algaeFrondsGroup) {
      this.algaeFrondsGroup = new THREE.Group();
      this.scene.add(this.algaeFrondsGroup);
      this.setupAlgaeFronds();
      this.setupAlgaeBubbles();
    } else if(changed) this.setupAlgaeFronds();
    if(this.algaeBubbles) {
      this.algaeBubbles.mesh.visible=rawAlgae.length>0;
      for(let i=0;i<this.algaeBubbles.velocities.length && rawAlgae.length;i++) {
        const p=rawAlgae[i%rawAlgae.length],v=this.algaeBubbles.velocities[i];
        v.centerX=p.x-OCEAN_GEOMETRY.cx;v.centerZ=p.y-OCEAN_GEOMETRY.cy;v.isleRadius=p.r*0.75;
      }
    }
    const byId=new Map(rawAlgae.map(p=>[p.id,p]));
    for(const f of this.algaeFrondMeshes) {
      const p=byId.get(f.isleId);
      if(p) {const scale=p.r/f.initialRadius;f.mesh.scale.set(scale,Math.max(0.15,p.d),scale);f.mesh.material.opacity=0.3+0.55*p.d;}
    }
  }

  clearCoralReefs() {
    if (!this.coralReefsGroup) return;
    while (this.coralReefsGroup.children.length > 0) {
      const child = this.coralReefsGroup.children[0];
      this.coralReefsGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      child.material?.dispose();
    }
    this.coralReefMeshes = [];
    this.coralReefsSignature = '';
  }

  updateBiogenicReefs(biogenicReefs, dayPhase = 0.5, time = 0) {
    if (!biogenicReefs || !Array.isArray(biogenicReefs) || biogenicReefs.length === 0) {
      if (this.coralReefMeshes.length > 0) {
        this.clearCoralReefs();
      }
      return;
    }

    const sig = biogenicReefs.length + ':' + biogenicReefs.slice(0, 6).map(r => r.seed).join('-');
    if (sig === this.coralReefsSignature) {
      // Modulate polyp night glow emission intensity smoothly
      const night = Math.max(0, 1.0 - dayPhase * 1.3);
      for (let i = 0; i < this.coralReefMeshes.length; i++) {
        const item = this.coralReefMeshes[i];
        if (item.polyp && item.polyp.material) {
          item.polyp.material.emissiveIntensity = 0.50 + night * 0.90;
        }
      }
      return;
    }

    this.coralReefsSignature = sig;
    this.biogenicReefs = biogenicReefs;
    this.buildCoralReefs3D(biogenicReefs, dayPhase, time);
  }

  buildCoralReefs3D(biogenicReefs, dayPhase = 0.5, time = 0) {
    this.clearCoralReefs();
    this.coralReefsSignature = biogenicReefs.length + ':' + biogenicReefs.slice(0, 6).map(r => r.seed).join('-');

    const night = Math.max(0, 1.0 - (dayPhase ?? 0.5) * 1.3);

    const calciteMat = new THREE.MeshStandardMaterial({
      color: 0xede4ce,       // Warm ivory calcite
      emissive: 0x443622,    // Subterranean amber glow
      emissiveIntensity: 0.35,
      roughness: 0.78,
      metalness: 0.12,
      flatShading: false
    });

    const polypMat = new THREE.MeshStandardMaterial({
      color: night > 0.25 ? 0x6ee7b7 : 0xfef08a,
      emissive: night > 0.25 ? 0x10b981 : 0xeab308,
      emissiveIntensity: 0.55 + night * 0.90,
      roughness: 0.25,
      metalness: 0.1
    });

    for (let i = 0; i < biogenicReefs.length; i++) {
      const reef = biogenicReefs[i];
      const x3D = reef.x - OCEAN_GEOMETRY.cx;
      const z3D = reef.y - OCEAN_GEOMETRY.cy;
      const dist = Math.hypot(x3D, z3D);
      if (dist > this.chamberRadius * 0.96) continue;

      const floorY = this.getFloorHeight(x3D, z3D);
      const moundR = 4.5 + reef.density * 9.5;
      const moundH = 2.5 + reef.density * 5.0;

      // 1. Calcified Coral Base Mound
      const baseGeo = new THREE.CylinderGeometry(moundR * 0.65, moundR, moundH, 8);
      baseGeo.translate(0, moundH * 0.5, 0);
      const baseMesh = new THREE.Mesh(baseGeo, calciteMat);
      baseMesh.position.set(x3D, floorY, z3D);
      this.coralReefsGroup.add(baseMesh);

      // 2. Branching Staghorn Calcite Arms (3 to 6 branches matching 2D morphology)
      const armCount = 3 + (reef.seed % 4);
      const baseRot = (reef.seed * 0.082);

      for (let a = 0; a < armCount; a++) {
        const angJitter = Math.sin(a * 2.7 + reef.seed * 0.3) * 0.32;
        const armAngle = (a / armCount) * Math.PI * 2 + baseRot + angJitter;
        const armHeight = (7.0 + reef.density * 13.0) * (0.65 + 0.35 * Math.sin(a * 2.1 + reef.seed * 0.17));
        const armR = Math.max(0.45, moundR * 0.11);

        const branchGeo = new THREE.CylinderGeometry(armR * 0.5, armR, armHeight, 6);
        branchGeo.translate(0, armHeight * 0.5, 0);
        const branchMesh = new THREE.Mesh(branchGeo, calciteMat);

        const startR = moundR * 0.32;
        const bx = x3D + Math.cos(armAngle) * startR;
        const by = floorY + moundH * 0.8;
        const bz = z3D + Math.sin(armAngle) * startR;
        branchMesh.position.set(bx, by, bz);

        const leanAngle = 0.22 + 0.18 * Math.sin(a + reef.seed);
        branchMesh.rotation.y = -armAngle;
        branchMesh.rotation.z = leanAngle;
        this.coralReefsGroup.add(branchMesh);

        // Living Coral Polyp at branch tip
        const tipY = by + Math.cos(leanAngle) * armHeight;
        const tipX = bx + Math.sin(leanAngle) * Math.cos(armAngle) * armHeight;
        const tipZ = bz + Math.sin(leanAngle) * Math.sin(armAngle) * armHeight;

        const polypGeo = new THREE.SphereGeometry(armR * 1.5, 6, 6);
        const polypMesh = new THREE.Mesh(polypGeo, polypMat);
        polypMesh.position.set(tipX, tipY, tipZ);
        this.coralReefsGroup.add(polypMesh);

        this.coralReefMeshes.push({
          mesh: branchMesh,
          polyp: polypMesh,
          initialRotZ: leanAngle,
          phase: reef.seed + a * 1.5,
          speed: 0.0012 + (a % 3) * 0.0004
        });

        // Forked secondary branch for dense mature reefs
        if (reef.density > 0.32) {
          const forkHeight = armHeight * 0.48;
          const forkGeo = new THREE.CylinderGeometry(armR * 0.4, armR * 0.65, forkHeight, 5);
          forkGeo.translate(0, forkHeight * 0.5, 0);
          const forkMesh = new THREE.Mesh(forkGeo, calciteMat);

          const midFrac = 0.55;
          const fBaseX = bx + Math.sin(leanAngle) * Math.cos(armAngle) * (armHeight * midFrac);
          const fBaseY = by + Math.cos(leanAngle) * (armHeight * midFrac);
          const fBaseZ = bz + Math.sin(leanAngle) * Math.sin(armAngle) * (armHeight * midFrac);
          forkMesh.position.set(fBaseX, fBaseY, fBaseZ);
          forkMesh.rotation.y = -armAngle;
          forkMesh.rotation.z = leanAngle + 0.42;
          this.coralReefsGroup.add(forkMesh);

          // Fork polyp
          const fTipGeo = new THREE.SphereGeometry(armR * 1.2, 5, 5);
          const fPolyp = new THREE.Mesh(fTipGeo, polypMat);
          fPolyp.position.set(
            fBaseX + Math.sin(leanAngle + 0.42) * Math.cos(armAngle) * forkHeight,
            fBaseY + Math.cos(leanAngle + 0.42) * forkHeight,
            fBaseZ + Math.sin(leanAngle + 0.42) * Math.sin(armAngle) * forkHeight
          );
          this.coralReefsGroup.add(fPolyp);
        }
      }
    }
  }

  setupAlgaeFronds() {
    if (!this.algaeFrondsGroup) return;

    while (this.algaeFrondsGroup.children.length > 0) {
      const child = this.algaeFrondsGroup.children[0];
      this.algaeFrondsGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      child.material?.dispose();
    }
    this.algaeFrondMeshes = [];

    const kelpMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x065f46,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    const ribbonWidth = 3.2;
    const ribbonHeight = 24.0;
    const segsY = 7;

    for (let i = 0; i < this.algaeIsles.length; i++) {
      const isle = this.algaeIsles[i];
      const centerX = (isle.x ?? OCEAN_GEOMETRY.cx) - OCEAN_GEOMETRY.cx;
      const centerZ = (isle.y ?? OCEAN_GEOMETRY.cy) - OCEAN_GEOMETRY.cy;
      const rawR = Number(isle.r !== undefined ? isle.r : (isle.radius || 40));
      const isleR = rawR * 0.72;
      const frondCount = Math.min(9, Math.max(6, Math.floor(((isle.f || isle.frondCount || 12)) * 0.6)));

      for (let f = 0; f < frondCount; f++) {
        const angle = (f / frondCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = (0.2 + 0.75 * Math.sqrt(Math.random())) * isleR;
        const fx = centerX + Math.cos(angle) * dist;
        const fz = centerZ + Math.sin(angle) * dist;

        const height=ribbonHeight*(0.4+(isle.height??0.6));
        const geo = new THREE.PlaneGeometry(ribbonWidth*(0.5+(isle.branching??0.5)),height,1,segsY);
        geo.translate(0,height*0.5,0);

        const pos = geo.attributes.position;
        const basePositions = new Float32Array(pos.array.length);
        basePositions.set(pos.array);

        const mat=kelpMat.clone();mat.color.setHSL(isle.h??0.4,0.7,0.4);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(fx, -15.5, fz);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        this.algaeFrondsGroup.add(mesh);

        this.algaeFrondMeshes.push({
          mesh,
          isleId:isle.id,initialRadius:rawR,
          geo,
          basePositions,
          phase: Math.random() * Math.PI * 2 + i * 0.8,
          swaySpeed: 0.0018 + Math.random() * 0.0008,
          swayAmp: 2.4 + Math.random() * 1.8
        });
      }
    }
    kelpMat.dispose();
  }

  setupAlgaeBubbles() {
    if (!this.particleTexture) {
      this.particleTexture = this.createParticleTexture();
    }
    if (!this.algaeIsles || this.algaeIsles.length === 0) return;

    const count = 70;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      const isle = this.algaeIsles[i % this.algaeIsles.length];
      const centerX = (isle.x ?? OCEAN_GEOMETRY.cx) - OCEAN_GEOMETRY.cx;
      const centerZ = (isle.y ?? OCEAN_GEOMETRY.cy) - OCEAN_GEOMETRY.cy;
      const rawR = Number(isle.r !== undefined ? isle.r : (isle.radius || 40));
      const r = Math.random() * rawR * 0.75;
      const ang = Math.random() * Math.PI * 2;

      const bx = centerX + Math.cos(ang) * r;
      const bz = centerZ + Math.sin(ang) * r;
      const by = -14.0 + Math.random() * 35.0;

      positions[i * 3] = bx;
      positions[i * 3 + 1] = by;
      positions[i * 3 + 2] = bz;

      velocities.push({
        vx: (Math.random() - 0.5) * 0.12,
        vy: 0.14 + Math.random() * 0.22,
        vz: (Math.random() - 0.5) * 0.12,
        centerX,
        centerZ,
        isleRadius: rawR * 0.75
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x34d399,
      size: 4.8,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.algaeBubbles = {
      mesh: new THREE.Points(geo, mat),
      velocities,
      count
    };
    this.scene.add(this.algaeBubbles.mesh);
  }

  // Draw vibrant bioluminescent seabed canvas texture matching 2D chemical map & local light
  renderSeafloorCanvas(thumbCanvas = null, playerX3D = 0, playerZ3D = 0, serverBlooms = [], playerColor = '#00f0ff', biogenicReefs = null, dayPhase = 0.5) {
    const ctx = this.seafloorCtx;
    const w = 512;
    const h = 512;
    const cx = w * 0.5;
    const cy = h * 0.5;

    // 1. Deep abyssal substrate gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 260);
    bgGrad.addColorStop(0, '#042845');
    bgGrad.addColorStop(0.65, '#02182b');
    bgGrad.addColorStop(1, '#010c18');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(this.reliefCanvas,0,0,w,h);

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
      ctx.globalAlpha = 0.45;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(thumbCanvas, 0, 0, w, h);
      ctx.restore();
    }

    // 2.5. Draw Server Nutrient Blooms (Bioluminescent emerald/lime glowing carpets on seafloor)
    if (serverBlooms && serverBlooms.length > 0) {
      for (let b = 0; b < serverBlooms.length; b++) {
        const bl = serverBlooms[b];
        const bx = ((bl.x || 0) / this.worldSize) * w;
        const bz = ((bl.y || 0) / this.worldSize) * h;
        const br = Math.max(25, ((bl.r || 60) / this.worldSize) * w * 1.5);
        if (!Number.isFinite(bx) || !Number.isFinite(bz) || !Number.isFinite(br) || br <= 0) continue;

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

    // 2.6. Draw Biogenic Living Coral Reefs on Seafloor Canvas
    const reefs = biogenicReefs || this.biogenicReefs;
    if (reefs && reefs.length > 0) {
      const night = Math.max(0, 1.0 - (dayPhase ?? 0.5) * 1.3);
      for (let i = 0; i < reefs.length; i++) {
        const reef = reefs[i];
        const rx = (reef.x / this.worldSize) * w;
        const rz = (reef.y / this.worldSize) * h;
        const rR = Math.max(6, (reef.density * 22 + 8) * (w / this.worldSize) * 2.2);

        const cGrad = ctx.createRadialGradient(rx, rz, 1, rx, rz, rR);
        cGrad.addColorStop(0, 'rgba(245, 238, 215, 0.85)');
        cGrad.addColorStop(0.5, 'rgba(215, 185, 140, 0.50)');
        cGrad.addColorStop(0.85, 'rgba(40, 180, 160, 0.20)');
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(rx, rz, rR, 0, Math.PI * 2);
        ctx.fill();

        const arms = 3 + (reef.seed % 4);
        const baseRot = (reef.seed * 0.082);
        ctx.strokeStyle = 'rgba(245, 238, 215, 0.65)';
        ctx.lineWidth = 1.3;
        for (let a = 0; a < arms; a++) {
          const angJitter = Math.sin(a * 2.7 + reef.seed * 0.3) * 0.32;
          const armAngle = (a / arms) * Math.PI * 2 + baseRot + angJitter;
          const aLen = rR * (0.7 + 0.35 * Math.sin(a * 2.1 + reef.seed * 0.17));
          ctx.beginPath();
          ctx.moveTo(rx, rz);
          ctx.lineTo(rx + Math.cos(armAngle) * aLen, rz + Math.sin(armAngle) * aLen);
          ctx.stroke();

          // Tip polyp
          ctx.fillStyle = night > 0.25 ? 'rgba(110, 245, 215, 0.90)' : 'rgba(250, 204, 21, 0.85)';
          ctx.beginPath();
          ctx.arc(rx + Math.cos(armAngle) * aLen, rz + Math.sin(armAngle) * aLen, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2.7. Draw Phytobenthic Algae Thickets & Sanctuaries
    if (this.algaeIsles && this.algaeIsles.length > 0) {
      for (let a = 0; a < this.algaeIsles.length; a++) {
        const isle = this.algaeIsles[a];
        const isleRadius = Number(isle.r !== undefined ? isle.r : (isle.radius || 40));
        const ax = ((isle.x || 0) / this.worldSize) * w;
        const az = ((isle.y || 0) / this.worldSize) * h;
        const ar = Math.max(16, (isleRadius / this.worldSize) * w * 1.35);
        if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(ar) || ar <= 0) continue;

        const aGrad = ctx.createRadialGradient(ax, az, 2, ax, az, ar);
        aGrad.addColorStop(0, 'rgba(16, 185, 129, 0.88)');
        aGrad.addColorStop(0.45, 'rgba(5, 150, 105, 0.60)');
        aGrad.addColorStop(0.75, 'rgba(4, 120, 87, 0.25)');
        aGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.fillStyle = aGrad;
        ctx.beginPath();
        ctx.arc(ax, az, ar, 0, Math.PI * 2);
        ctx.fill();

        // Frond filaments radiating outward
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
        ctx.lineWidth = 1.5;
        const fCount = isle.f || isle.frondCount || 12;
        for (let f = 0; f < fCount; f++) {
          const angle = (f / fCount) * Math.PI * 2;
          const flen = ar * (0.65 + (f % 3) * 0.18);
          ctx.beginPath();
          ctx.moveTo(ax, az);
          ctx.quadraticCurveTo(
            ax + Math.cos(angle + 0.3) * (flen * 0.6),
            az + Math.sin(angle + 0.3) * (flen * 0.6),
            ax + Math.cos(angle) * flen,
            az + Math.sin(angle) * flen
          );
          ctx.stroke();
        }
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
      // Convert centered 3D (centered world) to seafloor canvas (0..512)
      const vx = ((vent.x + this.worldSize * 0.5) / this.worldSize) * w;
      const vz = ((vent.z + this.worldSize * 0.5) / this.worldSize) * h;
      const vr = 48; // Crisp, concentrated radiant pool directly beneath hemisphere
      if (!Number.isFinite(vx) || !Number.isFinite(vz) || !Number.isFinite(vr) || vr <= 0) continue;

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
    if (Number.isFinite(playerX3D) && Number.isFinite(playerZ3D)) {
      const px = ((playerX3D + this.worldSize * 0.5) / this.worldSize) * w;
      const pz = ((playerZ3D + this.worldSize * 0.5) / this.worldSize) * h;
      const pRadius = 42;

      if (Number.isFinite(px) && Number.isFinite(pz)) {
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

      // 3. Soft Pulsating Volumetric Point Light illuminating surrounding waters and seafloor
      const pLight = new THREE.PointLight(vent.color, 2.5, 150, 1.4);
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

  update(time, playerX3D = 0, playerZ3D = 0, thumbCanvas = null, serverBlooms = [], playerColor = '#00f0ff', substrateCanvas = null, biogenicReefs = null, dayPhase = 0.5) {
    // 1. Dynamic water atmosphere & vent lighting matching 2D
    this.updateAtmosphere(playerX3D, playerZ3D);

    // 1.4. Dynamic 3D Biogenic Living Coral Reefs
    if (biogenicReefs && biogenicReefs.length > 0) {
      this.updateBiogenicReefs(biogenicReefs, dayPhase, time);
    }

    // 1.45. Animate swaying biogenic coral reef branches
    if (this.coralReefMeshes && this.coralReefMeshes.length > 0) {
      for (let i = 0; i < this.coralReefMeshes.length; i++) {
        const b = this.coralReefMeshes[i];
        const sway = Math.sin(time * b.speed + b.phase) * 0.05;
        b.mesh.rotation.z = b.initialRotZ + sway;
      }
    }

    // 1.5. Dynamic Seafloor texture update (throttled every 1200ms for smooth 60fps)
    if (!this.lastSeafloorUpdate || time - this.lastSeafloorUpdate > 1200) {
      this.lastSeafloorUpdate = time;
      this.renderSeafloorCanvas(thumbCanvas, playerX3D, playerZ3D, serverBlooms, playerColor, biogenicReefs, dayPhase);
    }

    // 1.6. Dynamic 3D seafloor topography update (throttled every 5000ms)
    if (!this.lastTerrainUpdate || time - this.lastTerrainUpdate > 5000) {
      this.lastTerrainUpdate = time;
      this.updateTerrainMeshHeights(substrateCanvas);
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

    // 1.85. Animate swaying phytobenthic kelp ribbons (GPU mesh rotation, zero CPU buffer uploads)
    if (this.algaeFrondMeshes && this.algaeFrondMeshes.length > 0) {
      for (let i = 0; i < this.algaeFrondMeshes.length; i++) {
        const frond = this.algaeFrondMeshes[i];
        const timePhase = time * frond.swaySpeed + frond.phase;
        frond.mesh.rotation.z = Math.sin(timePhase) * 0.15;
        frond.mesh.rotation.x = Math.cos(timePhase * 0.85) * 0.08;
      }
    }

    // 1.86. Animate rising photosynthetic micro-bubbles
    if (this.algaeBubbles) {
      const pos = this.algaeBubbles.mesh.geometry.attributes.position;
      for (let i = 0; i < this.algaeBubbles.count; i++) {
        let px = pos.getX(i);
        let py = pos.getY(i);
        let pz = pos.getZ(i);
        const vel = this.algaeBubbles.velocities[i];

        py += vel.vy;
        px += vel.vx + Math.sin(time * 0.002 + i) * 0.08;
        pz += vel.vz + Math.cos(time * 0.002 + i) * 0.08;

        if (py > 25.0) {
          py = -15.0;
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * vel.isleRadius;
          px = vel.centerX + Math.cos(ang) * r;
          pz = vel.centerZ + Math.sin(ang) * r;
        }

        pos.setXYZ(i, px, py, pz);
      }
      pos.needsUpdate = true;
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
