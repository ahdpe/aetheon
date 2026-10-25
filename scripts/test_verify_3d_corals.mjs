import puppeteer from 'puppeteer-core';
import path from 'path';

const artifactDir = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e';

async function main() {
  console.log('Connecting to live production at https://emergentia.cloud/aetheon/ ...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => {
      console.log('[Browser Console]', msg.text());
    });

    await page.goto('https://emergentia.cloud/aetheon/', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded, waiting for live entities...');
    await new Promise(r => setTimeout(r, 4000));

    // Ensure Russian language is active
    await page.evaluate(() => {
      const langBtn = document.getElementById('btn-lang');
      if (langBtn) {
        langBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 1200));

    // 1. Select a healthy organism located right next to a biogenic coral reef
    const selection = await page.evaluate(async () => {
      const app = window.aetheonApp;
      const orgs = Array.from(app.renderer.currEntities.values());
      const reefs = app.renderer.biogenicReefs || [];
      const piloted = app.renderer.pilotedIds || new Set();

      let bestTarget = null;
      let minReefDist = Infinity;
      let associatedReef = null;

      for (const org of orgs) {
        if (piloted.has(org.id) || piloted.has(Number(org.id))) continue;
        for (const r of reefs) {
          const d = Math.hypot(org.x - r.x, org.y - r.y);
          if (d < minReefDist) {
            minReefDist = d;
            bestTarget = org;
            associatedReef = r;
          }
        }
      }

      if (!bestTarget) bestTarget = orgs[0];
      app.inspector.select(bestTarget.id);

      const btn = document.getElementById('btn-dive-target');
      return {
        targetId: bestTarget.id,
        minReefDist,
        btnText: btn ? btn.innerText.trim() : null,
        btnHtml: btn ? btn.innerHTML : null,
        associatedReef: associatedReef ? { x: associatedReef.x, y: associatedReef.y, density: associatedReef.density } : null
      };
    });

    console.log('Selected Reef Shelter Target (RU):', selection);

    // Save Inspector 2D screenshot with «Погрузиться внутрь (3D)»
    const inspectorShotPath = path.join(artifactDir, 'screenshot_inspector_dive_button.png');
    await page.screenshot({ path: inspectorShotPath });
    console.log(`Saved ${inspectorShotPath}`);

    // 2. Click Dive button «Погрузиться внутрь (3D)»
    console.log('Entering 3D Dive mode...');
    await page.evaluate(async () => {
      const btn = document.getElementById('btn-dive-target');
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        const engine = await window.aetheonApp.getDiveEngine();
        engine.enter(window.aetheonApp.inspector.selectedId);
      }
    });

    await page.waitForFunction(() => window.aetheonApp?.diveEngine?.isActive === true, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Orient the cockpit camera to look down and directly at the reef
    const diveState = await page.evaluate((targetReef) => {
      const engine = window.aetheonApp?.diveEngine;
      if (!engine) return { error: 'No dive engine' };

      const rx = targetReef ? targetReef.x - 700 : 0;
      const rz = targetReef ? targetReef.y - 700 : 0;

      // Point heading toward the reef and pitch downward to view the seafloor tendrils
      const dx = rx - engine.camera.position.x;
      const dz = rz - engine.camera.position.z;
      const targetHeading = Math.atan2(dz, dx);

      engine.currentHeading = targetHeading;
      if (engine.hud) {
        engine.hud.lookYaw = 0;
        engine.hud.lookPitch = -0.48; // Look downward at seabed corals
      }

      return {
        isActive: engine.isActive,
        meshCount: engine.environment?.coralReefMeshes?.length || 0,
        camPos: { x: engine.camera.position.x, y: engine.camera.position.y, z: engine.camera.position.z },
        heading: targetHeading,
        pitch: engine.hud?.lookPitch
      };
    }, selection.associatedReef);

    console.log('Oriented 3D Cockpit View:', diveState);
    await new Promise(r => setTimeout(r, 1500));

    // Capture 3D Refined Reefs in-cockpit view
    const diveShotPath = path.join(artifactDir, 'screenshot_3d_refined_reefs.png');
    await page.screenshot({ path: diveShotPath });
    console.log(`Saved ${diveShotPath}`);

    // Adjust pitch steeper downward for close seafloor inspection
    await page.evaluate(() => {
      const engine = window.aetheonApp?.diveEngine;
      if (engine && engine.hud) {
        engine.hud.lookPitch = -0.58;
      }
    });

    await new Promise(r => setTimeout(r, 1200));
    const closeupShotPath = path.join(artifactDir, 'screenshot_3d_refined_reefs_closeup.png');
    await page.screenshot({ path: closeupShotPath });
    console.log(`Saved ${closeupShotPath}`);

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

main();
