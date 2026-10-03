import { OCEAN_GEOMETRY } from '../shared/habitats.js';
import * as THREE from '../lib/three.module.js';
import {drawRemains} from '../gl/remainsDrawing.js';

export class DiveFoodManager {
  constructor(scene, worldSize = OCEAN_GEOMETRY.worldSize, floorHeight = () => -16) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.floorHeight = floorHeight;
    this.bloomGroups = new Map(); // id -> { group, cloud, core, light, crystals, radius, x, z, targetScale, curScale }
    this.remainsMeshes = new Map();
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
    const isDetritus = (bloom.d === 1 || bloom.isDetritus);
    const radius = Math.max(22, (bloom.r || 50) * 0.65);
    const group = new THREE.Group();

    // 1. Soft Volumetric Cloud Sprite (Feathered radial halo, zero sharp polygon edges!)
    const cloudMat = new THREE.SpriteMaterial({
      map: this.particleTexture,
      color: isDetritus ? 0xf59e0b : 0x84cc16,
      transparent: true,
      opacity: isDetritus ? 0.30 : 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const cloud = new THREE.Sprite(cloudMat);
    cloud.scale.set(radius * 2.2, radius * 2.2, 1.0);
    group.add(cloud);

    // 2. Soft Radial Core Sprite (Feathered falloff matching 2D view, no sharp polygon disk!)
    const coreMat = new THREE.SpriteMaterial({
      map: this.particleTexture,
      color: isDetritus ? 0xd97706 : 0xa3e635,
      transparent: true,
      opacity: 0.50,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.set(radius * 1.3, radius * 1.3, 1.0);
    group.add(core);

    // 3. Volumetric Nutrient Point Light (localized to immediate bloom cluster)
    const light = new THREE.PointLight(isDetritus ? 0xf59e0b : 0xa3e635, 1.4, radius * 1.5, 1.5);
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
    const x3D = bloom.x - OCEAN_GEOMETRY.cx;
    const z3D = bloom.y - OCEAN_GEOMETRY.cy;
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

  updateRemains(bodies, playerPos) {
    // Only nearby bodies need textures/meshes in the submerged view. No lights,
    // physics or living animation is added for these settled membranes.
    const nearby=playerPos ? bodies.map(p=>({p,d:Math.hypot(p.x-OCEAN_GEOMETRY.cx-playerPos.x,p.y-OCEAN_GEOMETRY.cy-playerPos.z)}))
      .filter(v=>v.d<240).sort((a,b)=>a.d-b.d).slice(0,24).map(v=>v.p):[];
    const active=new Set(nearby.map(p=>p.id));
    for(const [id,obj] of this.remainsMeshes) if(!active.has(id)) {
      this.scene.remove(obj.mesh);obj.mesh.geometry.dispose();obj.mesh.material.dispose();obj.texture.dispose();this.remainsMeshes.delete(id);
    }
    for(const p of nearby) {
      let obj=this.remainsMeshes.get(p.id);
      if(!obj) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
        const texture=new THREE.CanvasTexture(canvas),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
        const width=p.size*5.5,mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width),material);
        mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x-OCEAN_GEOMETRY.cx,0,p.y-OCEAN_GEOMETRY.cy);
        this.scene.add(mesh);obj={mesh,canvas,texture,age:-1};this.remainsMeshes.set(p.id,obj);
      }
      const x=p.x-OCEAN_GEOMETRY.cx,z=p.y-OCEAN_GEOMETRY.cy,r=p.size*1.6;
      obj.mesh.position.y=.6+Math.max(this.floorHeight(x-r,z-r),this.floorHeight(x+r,z-r),this.floorHeight(x-r,z+r),this.floorHeight(x+r,z+r));
      if(obj.age!==p.age) {
        const ctx=obj.canvas.getContext('2d');ctx.clearRect(0,0,128,128);
        drawRemains(ctx,p,64,64,128/5.5,true);obj.texture.needsUpdate=true;obj.age=p.age;
      }
    }
  }

  update(serverBlooms = [], time = performance.now(), playerPos3D = null, bodies = []) {
    this.updateRemains(bodies,playerPos3D);
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
            if (bloomObj.cloud.geometry) bloomObj.cloud.geometry.dispose();
            if (bloomObj.cloud.material) bloomObj.cloud.material.dispose();
            if (bloomObj.core.geometry) bloomObj.core.geometry.dispose();
            if (bloomObj.core.material) bloomObj.core.material.dispose();
            if (bloomObj.crystals.geometry) bloomObj.crystals.geometry.dispose();
            if (bloomObj.crystals.material) bloomObj.crystals.material.dispose();
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
        if (bloomObj.cloud.geometry) bloomObj.cloud.geometry.dispose();
        if (bloomObj.cloud.material) bloomObj.cloud.material.dispose();
        if (bloomObj.core.geometry) bloomObj.core.geometry.dispose();
        if (bloomObj.core.material) bloomObj.core.material.dispose();
        if (bloomObj.crystals.geometry) bloomObj.crystals.geometry.dispose();
        if (bloomObj.crystals.material) bloomObj.crystals.material.dispose();
      } catch (e) {}
    }
    this.bloomGroups.clear();
    for(const obj of this.remainsMeshes.values()) {
      this.scene.remove(obj.mesh);obj.mesh.geometry.dispose();obj.mesh.material.dispose();obj.texture.dispose();
    }
    this.remainsMeshes.clear();

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
