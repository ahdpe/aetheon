import * as THREE from '../lib/three.module.js';
import { DiveEnvironment } from './diveEnvironment.js';
import { DiveCreatureManager } from './diveCreatureManager.js';
import { DiveCockpitHUD } from './diveCockpitHUD.js';
import { DiveAudio } from './diveAudio.js';
import { sound } from '../audio/sound.js';

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
    this.hud = null;
    this.audio = new DiveAudio();

    // Loop & State
    this.animFrameId = null;
    this.prevEnergy = null;
    this.lastSteerSentTime = 0;
    this.steerThrottleMs = 90; // ~10 Hz network steering sync

    // Smooth Camera Interpolation
    this.camPos = new THREE.Vector3(700, 700, 15);
    this.camTarget = new THREE.Vector3(700, 710, 15);
    this.currentHeading = 0;

    this.initThree();
  }

  initThree() {
    if (!this.canvas) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020a14);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1.0, 900);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Initialize subsystems
    const vents = this.app.renderer ? this.app.renderer.vents : [];
    this.environment = new DiveEnvironment(this.scene, 1400, 620);
    this.environment.build(vents);

    this.creatures = new DiveCreatureManager(this.scene);
    this.hud = new DiveCockpitHUD(this);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Dive into organism
  enter(organismId) {
    if (!organismId) return;
    const org = this.app.renderer.currEntities.get(organismId);
    if (!org) return;

    this.trackedId = organismId;
    this.isActive = true;
    this.prevEnergy = org.energy;

    // 1. Hide 2D ocean canvas smoothly and show 3D canvas & HUD
    if (this.app.canvas) {
      this.app.canvas.style.transition = 'opacity 0.4s ease';
      this.app.canvas.style.opacity = '0';
    }
    this.canvas.classList.remove('hidden');
    this.canvas.style.opacity = '1';
    this.hud.show();

    // 2. Play dive sound
    this.audio.start();
    sound.playDroplet(2200);

    // 3. Initialize camera directly at organism coordinates
    this.camPos.set(org.x, org.y, 14);
    this.currentHeading = Math.atan2(org.vy, org.vx) || 0;

    // 4. Start 3D animation loop
    this.loop(performance.now());
  }

  // Exit back to 2D orbit
  exit() {
    if (!this.isActive) return;
    this.isActive = false;

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

    // Resume smooth 2D tracking on current target
    if (this.app.renderer) {
      this.app.renderer.camera.targetZoom = 1.0;
    }
  }

  // Boost propulsion
  triggerBoost() {
    if (!this.isActive || !this.trackedId) return;
    const org = this.app.renderer.currEntities.get(this.trackedId);
    if (!org) return;

    // Boost impulse
    const boostDir = this.currentHeading + this.hud.lookYaw;
    const bx = Math.cos(boostDir) * 1.2;
    const by = Math.sin(boostDir) * 1.2;

    this.sendSteer(bx, by);
    sound.playDroplet(1800);
  }

  sendSteer(sx, sy) {
    if (!this.app.socket || !this.app.isConnected || !this.trackedId) return;
    const now = performance.now();
    if (now - this.lastSteerSentTime < this.steerThrottleMs) return;
    this.lastSteerSentTime = now;

    this.app.socket.send(JSON.stringify({
      type: 'steer',
      id: this.trackedId,
      steerX: sx,
      steerY: sy
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
      if (this.missingFrames > 12) {
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

    // 3. Smooth Heading & Position Lerp
    const targetHeading = Math.atan2(org.vy, org.vx);
    // Smooth angle interpolation without 2PI jumps
    let dHeading = (targetHeading - this.currentHeading) % (Math.PI * 2);
    if (dHeading < -Math.PI) dHeading += Math.PI * 2;
    if (dHeading > Math.PI) dHeading -= Math.PI * 2;
    this.currentHeading += dHeading * 0.12;

    const forwardOffset = (org.size || 6.5) * 0.45;
    const camX = org.x + Math.cos(this.currentHeading) * forwardOffset;
    const camY = org.y + Math.sin(this.currentHeading) * forwardOffset;
    const targetZ = 16.0 + Math.sin(time * 0.003 + org.id) * 3.5;
    this.camPos.lerp(new THREE.Vector3(camX, camY, targetZ), 0.25);
    this.camera.position.copy(this.camPos);

    // Camera look target = Heading + Player freelook yaw/pitch
    const lookAngle = this.currentHeading + this.hud.lookYaw;
    const lookDist = 60.0;
    const lookX = this.camPos.x + Math.cos(lookAngle) * lookDist;
    const lookY = this.camPos.y + Math.sin(lookAngle) * lookDist;
    const lookZ = this.camPos.z + this.hud.lookPitch * 35.0;

    this.camTarget.lerp(new THREE.Vector3(lookX, lookY, lookZ), 0.35);
    this.camera.lookAt(this.camTarget);

    // 4. Send Steering to server
    if (Math.abs(this.hud.steerX) > 0.05 || Math.abs(this.hud.steerY) > 0.05) {
      this.sendSteer(this.hud.steerX, this.hud.steerY);
    }

    // 5. Calculate spatial telemetry
    let nearestVent = null;
    let minVentDist = Infinity;
    const vents = this.app.renderer ? this.app.renderer.vents : [];
    for (let v = 0; v < vents.length; v++) {
      const vent = vents[v];
      const d = Math.hypot(org.x - vent.x, org.y - vent.y);
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

    // 6. Update subsystems
    const speed = Math.hypot(org.vx || 0, org.vy || 0);
    this.environment.update(time);
    this.creatures.update(orgs, this.trackedId, this.app.renderer.colonyBonds, time);
    this.hud.update(org, this.currentHeading, nearestVent, nearestPredatorDist, time);
    this.audio.update(org, speed, minVentDist, org.ciliaryFrequency);
  }

  handleDeath() {
    if (this.isDying) return;
    this.isDying = true;
    this.audio.playRupture();
    this.hud.flashRupture();
    
    // Slow camera rise out of death location
    setTimeout(() => {
      this.exit();
      this.isDying = false;
    }, 1100);
  }
}
