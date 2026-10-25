import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROD_URL = 'https://emergentia.cloud/aetheon';

async function main() {
  console.log('Launching browser to test live production stability and transitions...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to', PROD_URL);
  await page.goto(PROD_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait 4 seconds for simulation stream to connect and stabilize
  await new Promise(r => setTimeout(r, 4000));

  console.log('Tracking biogenic coral reefs over 10 seconds to verify position stability...');
  const reefSamples = [];
  for (let s = 0; s < 5; s++) {
    const reefs = await page.evaluate(() => {
      const r = window.aetheonApp?.renderer?.biogenicReefs;
      if (!r) return [];
      return r.map(c => ({ x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, sub: c.sub }));
    });
    reefSamples.push(reefs);
    console.log(`Sample ${s + 1}: ${reefs.length} reefs detected. First 3 positions:`, reefs.slice(0, 3));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Check if initial reefs remained stable in position
  const initialReefs = reefSamples[0];
  let stableCount = 0;
  for (const r0 of initialReefs) {
    const lastSample = reefSamples[reefSamples.length - 1];
    const match = lastSample.find(r => Math.hypot(r.x - r0.x, r.y - r0.y) < 1.0);
    if (match) stableCount++;
  }
  const stabilityPct = initialReefs.length > 0 ? ((stableCount / initialReefs.length) * 100).toFixed(1) : 0;
  console.log(`Reef stability over 10 seconds: ${stableCount}/${initialReefs.length} (${stabilityPct}%)`);

  // Check life cycle events in renderer
  const lifeStatus = await page.evaluate(() => {
    const r = window.aetheonApp?.renderer;
    return {
      hasBirthTimes: r?.birthTimes instanceof Map,
      birthEventsLen: r?.birthEvents?.length || 0,
      deathEventsLen: r?.deathEvents?.length || 0,
      entitiesCount: r?.currEntities?.size || 0
    };
  });
  console.log('Life events status:', lifeStatus);

  // Take top-down screenshot
  const shot2DPath = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e/screenshot_2d_stable_reefs_and_life.png';
  await page.screenshot({ path: shot2DPath });
  console.log('Saved 2D screenshot to', shot2DPath);

  // Test 3D Dive mode
  console.log('Switching language to RU and diving into 3D...');
  await page.evaluate(() => {
    const langBtn = document.getElementById('btn-lang');
    if (langBtn) langBtn.click();
    const app = window.aetheonApp;
    const orgs = Array.from(app.renderer.currEntities.values());
    if (orgs.length > 0) {
      app.inspector.select(orgs[0].id);
    }
  });

  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    const btn = document.getElementById('btn-dive-target');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 3500));

  const diveStatus = await page.evaluate(() => {
    const de = window.aetheonApp?.diveEngine;
    const cm = de?.creatureManager;
    return {
      active: de?.active,
      creaturesCount: cm?.creaturePool?.size || 0,
      dyingCount: cm?.dyingPool?.size || 0
    };
  });
  console.log('Dive mode status:', diveStatus);

  const shot3DPath = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e/screenshot_3d_dive_transitions_live.png';
  await page.screenshot({ path: shot3DPath });
  console.log('Saved 3D screenshot to', shot3DPath);

  await browser.close();
  console.log('Verification finished successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
