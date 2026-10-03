import * as THREE from '../lib/three.module.js';
import { DiveEnvironment } from './diveEnvironment.js';
import { DiveCreatureManager } from './diveCreatureManager.js';
import { DiveFoodManager } from './diveFoodManager.js';
import { DiveCockpitHUD } from './diveCockpitHUD.js';
import { DiveAudio } from './diveAudio.js';
import { sound } from '../audio/sound.js';
import { OCEAN_GEOMETRY } from '../shared/habitats.js';

export class DiveEngine {
  constructor(app) {
    this.app = app;
    this.canvas = document.getElementById('dive-canvas');
    this.isActive = false;
    this.trackedId = null;

    // Three.js Core
    this.renderer = null;
    this.scene = null;
    this.camera = null;

    // Subsystems
    this.environment = null;
    this.creatures = null;
    this.food = null;
    this.hud = null;
    this.audio = new DiveAudio();
    this.lastGrazingChimeTime = 0;

    // Loop & State
    this.animFrameId = null;
    this.prevEnergy = null;
    this.lastSteerSentTime = 0;
    this.steerThrottleMs = 75; // ~13 Hz network steering sync

    // Smooth Camera Coordinates in XZ plane (Y is altitude)
    this.camPos = new THREE.Vector3(0, 30, 0);
    this.camTarget = new THREE.Vector3(50, 30, 0);
    this.currentHeading = 0;
    this.missingFrames = 0;
    this.isDying = false;

    this.initThree();
  }

  initThree() {
    if (!this.canvas) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020d1a);
    
    // Perspective camera with wide immersive micro-lens FOV (72 deg, range up to 1200)
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.5, 1200);
    // Explicitly guarantee Y is up-vector: zero sideways tilt, zero roll!
    this.camera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // Initialize subsystems
    const vents = this.app.renderer ? this.app.renderer.vents : [];
    this.environment = new DiveEnvironment(this.scene, this.app.renderer.worldSize, OCEAN_GEOMETRY.radius);
    this.environment.build(vents);

    this.creatures = new DiveCreatureManager(this.scene);
    this.food = new DiveFoodManager(this.scene, OCEAN_GEOMETRY.worldSize,(x,z)=>this.environment.getFloorHeight(x,z));
    this.hud = new DiveCockpitHUD(this);

    // Dynamic cellular bioluminescent illumination from piloted organism
    this.pilotLight = new THREE.PointLight(0x00f0ff, 3.2, 140, 1.1);
    this.scene.add(this.pilotLight);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  get currentOrg() {
    return this.app?.renderer?.currEntities?.get(this.trackedId) || null;
  }

  // Dive into organism
  enter(organismId) {
    if (!organismId) return;
    const org = this.app.renderer.currEntities.get(organismId);
    if (!org) return;

    this.trackedId = organismId;
    this.isActive = true;
    this.isDying = false;
    this.missingFrames = 0;
    this.prevEnergy = org.energy;

    // 1. Hide 2D ocean canvas smoothly and show 3D canvas & HUD
    if (this.app.canvas) {
      this.app.canvas.style.transition = 'opacity 0.35s ease';
      this.app.canvas.style.opacity = '0';
    }
    this.canvas.classList.remove('hidden');
    this.canvas.style.opacity = '1';
    this.hud.show();

    // 2. Play dive immersion sound & ensure sound engine is unmuted
    sound.unmute();
    this.audio.start();
    sound.playDroplet(2400);

    // 2.5. Claim exclusive pilot authority on server
    if (this.app.socket && this.app.isConnected) {
      this.app.socket.send(JSON.stringify({
        type: 'dive_start',
        id: organismId
      }));
    }

    // 3. Initialize camera directly at organism coordinates in 3D centered space
    const x3d = org.x - OCEAN_GEOMETRY.cx;
    const z3d = org.y - OCEAN_GEOMETRY.cy;
    this.camPos.set(x3d, 18, z3d);
    this.currentHeading = Math.atan2(org.vy, org.vx) || 0;

    // 4. Start 3D animation loop
    this.loop(performance.now());
  }

  // Exit back to 2D orbit
  exit() {
    if (!this.isActive) return;
    this.isActive = false;

    // Release pilot authority on server
    if (this.app.socket && this.app.isConnected) {
      this.app.socket.send(JSON.stringify({
        type: 'dive_stop'
      }));
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Restore 2D canvas visibility
    if (this.app.canvas) {
      this.app.canvas.style.opacity = '1';
    }

    this.canvas.style.opacity = '0';
    setTimeout(() => {
      this.canvas.classList.add('hidden');
    }, 300);

    this.hud.hide();
    this.audio.stop();
    this.creatures.cleanup();
    if (this.food) {
      this.food.cleanup();
    }

    if (this.app.renderer) {
      this.app.renderer.camera.targetZoom = 1.0;
    }
  }

  // Boost propulsion
  triggerBoost() {
    if (!this.isActive || !this.trackedId) return;
    const org = this.app.renderer.currEntities.get(this.trackedId);
    if (!org) return;

    const boostDir = this.currentHeading + this.hud.lookYaw;
    const bx = Math.cos(boostDir) * 1.5;
    const by = Math.sin(boostDir) * 1.5;

    // Local client prediction impulse
    org.vx += bx * 1.8;
    org.vy += by * 1.8;

    this.sendSteer(bx, by);
    sound.playDroplet(1900);
  }

  // Drop nutrient bloom ahead of cell while diving
  triggerFeedDrop() {
    if (!this.isActive || !this.trackedId) return;
    const org = this.app.renderer.currEntities.get(this.trackedId);
    if (!org) return;

    // 30-second feeding cooldown
    const now = Date.now();
    const elapsed = now - (this.lastFeedTime || 0);
    const cooldownMs = 30000;
    if (elapsed < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
      const isRu = (window.i18n?.getLang?.() === 'ru');
      const msg = isRu ? `Подкормка: еще ${remainingSec} сек` : `Feeding ready in ${remainingSec}s`;
      this.hud?.showFeedCooldownNotice?.(msg);
      sound.playDroplet(420);
      return;
    }

    this.lastFeedTime = now;
    const dropDist = 45;
    const fx = org.x + Math.cos(this.currentHeading) * dropDist;
    const fy = org.y + Math.sin(this.currentHeading) * dropDist;

    // Send nutrient drop to server
    if (this.app.socket && this.app.isConnected) {
      this.app.socket.send(JSON.stringify({
        type: 'interaction',
        action: 'nutrient_drop',
        x: fx,
        y: fy
      }));
    }

    if (this.app.renderer) {
      this.app.renderer.spawnFoodBloom(fx, fy);
    }

    sound.playDroplet(720);
  }

  sendSteer(sx, sy, thrust = 1.0) {
    if (!this.app.socket || !this.app.isConnected || !this.trackedId) return;
    const now = performance.now();
    if (now - this.lastSteerSentTime < this.steerThrottleMs) return;
    this.lastSteerSentTime = now;

    this.app.socket.send(JSON.stringify({
      type: 'steer',
      id: this.trackedId,
      steerX: sx,
      steerY: sy,
      thrust
    }));
  }

  // Main 3D loop
  loop(time) {
    if (!this.isActive) return;

    this.update(time);
    this.renderer.render(this.scene, this.camera);

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  update(time) {
    const orgs = this.app.renderer.currEntities;
    const org = orgs.get(this.trackedId);

    // 1. Detect if creature died or was consumed
    if (!org) {
      this.missingFrames = (this.missingFrames || 0) + 1;
      if (this.missingFrames > 60) {
        this.handleDeath();
      }
      return;
    }
    this.missingFrames = 0;

    // 2. Detect feeding events (energy jump > 12)
    if (this.prevEnergy !== null && org.energy > this.prevEnergy + 12) {
      this.audio.playFeedChime();
      this.hud.flashFeeding();
    }
    this.prevEnergy = org.energy;

    // 3. Client-Side Steering & Zero-Latency Heading Prediction
    const isPlayerSteering = Math.hypot(this.hud.steerX, this.hud.steerY) > 0.05;
    const thrust = (typeof this.hud.thrust === 'number') ? this.hud.thrust : 1.0;

    if (isPlayerSteering) {
      // Immediate local turn in player's intended direction
      const desiredHeading = Math.atan2(this.hud.steerY, this.hud.steerX);
      let dH = (desiredHeading - this.currentHeading) % (Math.PI * 2);
      if (dH < -Math.PI) dH += Math.PI * 2;
      if (dH > Math.PI) dH -= Math.PI * 2;
      this.currentHeading += dH * 0.25; // Quick, responsive turning

      // Local client acceleration based on active throttle thrust
      const baseMaxSpd = (org.size || 6) > 5 ? 2.8 : 3.6;
      const spdFactor = thrust > 0.1 ? 1.9 : (thrust < -0.1 ? -0.35 : 0.45);
      const targetSpd = baseMaxSpd * spdFactor;

      org.vx += (Math.cos(this.currentHeading) * targetSpd - org.vx) * 0.22;
      org.vy += (Math.sin(this.currentHeading) * targetSpd - org.vy) * 0.22;
      org.x += org.vx * 0.12;
      org.y += org.vy * 0.12;

      // Broadcast to server with thrust
      this.sendSteer(this.hud.steerX, this.hud.steerY, thrust);
    } else {
      // Autonomous heading tracking
      const targetHeading = Math.atan2(org.vy, org.vx);
      let dH = (targetHeading - this.currentHeading) % (Math.PI * 2);
      if (dH < -Math.PI) dH += Math.PI * 2;
      if (dH > Math.PI) dH -= Math.PI * 2;
      this.currentHeading += dH * 0.12;
    }

    // 4. Position Camera at Organism Coordinates in 3D centered space (XZ plane)
    const forwardOffset = (org.size || 6.5) * 0.45;
    const orgX3D = org.x - OCEAN_GEOMETRY.cx;
    const orgZ3D = org.y - OCEAN_GEOMETRY.cy;

    const camX = orgX3D + Math.cos(this.currentHeading) * forwardOffset;
    const camZ = orgZ3D + Math.sin(this.currentHeading) * forwardOffset;
    const camY = 18.0 + Math.sin(time * 0.003 + org.id) * 2.5;

    this.camPos.lerp(new THREE.Vector3(camX, camY, camZ), 0.28);
    this.camera.position.copy(this.camPos);

    // 5. Look Target (Heading + Freelook Yaw & Pitch)
    const totalYaw = this.currentHeading + this.hud.lookYaw;
    const pitch = this.hud.lookPitch; // Range: -0.5 to +0.5 rad
    const lookDist = 70.0;

    const fx = Math.cos(totalYaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = Math.sin(totalYaw) * Math.cos(pitch);

    const targetLook = new THREE.Vector3(
      this.camPos.x + fx * lookDist,
      this.camPos.y + fy * lookDist,
      this.camPos.z + fz * lookDist
    );

    this.camTarget.lerp(targetLook, 0.35);
    this.camera.lookAt(this.camTarget);

    // 6. Calculate Spatial Telemetry (nearest vent & nearest predator)
    let nearestVent = null;
    let minVentDist = Infinity;
    const vents = this.app.renderer ? this.app.renderer.vents : [];
    const ventScale = OCEAN_GEOMETRY.worldSize / OCEAN_GEOMETRY.gridSize; // 10.9375

    for (let v = 0; v < vents.length; v++) {
      const vent = vents[v];
      const vwx = (vent.x !== undefined ? vent.x : 64) * ventScale;
      const vwy = (vent.y !== undefined ? vent.y : 64) * ventScale;
      const d = Math.hypot(org.x - vwx, org.y - vwy);
      if (d < minVentDist) {
        minVentDist = d;
        nearestVent = vent;
      }
    }

    let nearestPredatorDist = null;
    if (org.carnivory <= 0.35) {
      for (const [otherId, other] of orgs.entries()) {
        if (otherId !== org.id && other.carnivory > 0.35) {
          const d = Math.hypot(org.x - other.x, org.y - other.y);
          if (nearestPredatorDist === null || d < nearestPredatorDist) {
            nearestPredatorDist = d;
          }
        }
      }
    }

    // 6.5. Update dynamic cellular pilot light
    if (this.pilotLight) {
      this.pilotLight.position.set(camX, camY - 2.0, camZ);
      if (org.color) {
        this.pilotLight.color.set(org.color);
      }
    }

    // 7. Update Subsystems
    const speed = Math.hypot(org.vx || 0, org.vy || 0);
    const serverBlooms = this.app.renderer ? this.app.renderer.serverBlooms : [];

    // 7.1. 3D Volumetric Food Blooms & Floating Phytomanna Crystals
    let grazingState = { isPlayerGrazing: false };
    if (this.food) {
      grazingState = this.food.update(serverBlooms, time, this.camPos, this.app.renderer.serverRemains);
    }
    if (grazingState.isPlayerGrazing && time - this.lastGrazingChimeTime > 550) {
      this.lastGrazingChimeTime = time;
      this.audio.playFeedChime();
      this.hud.flashFeeding();
    }

    this.environment.update(time, orgX3D, orgZ3D, this.app.renderer.thumbCanvas, serverBlooms, org.color, this.app.renderer.substrateCanvas);
    this.creatures.update(orgs, this.trackedId, this.app.renderer.colonyBonds, time, this.app.renderer.pilotedIds);
    this.hud.update(org, this.currentHeading, nearestVent, nearestPredatorDist, time);
    this.audio.update(org, speed, minVentDist, org.ciliaryFrequency);
  }

  handleDeath() {
    if (this.isDying) return;
    this.isDying = true;
    this.audio.playRupture();
    this.hud.flashRupture();
    
    setTimeout(() => {
      this.exit();
      this.isDying = false;
    }, 1100);
  }
}
