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

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('https://emergentia.cloud/aetheon/', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded, waiting for live ticks...');

    // Wait 5 seconds for simulation ticks and substrate thumbnail buffer
    await new Promise(r => setTimeout(r, 5000));

    const state = await page.evaluate(() => {
      const app = window.aetheonApp;
      const renderer = app?.renderer;
      const orgs = renderer?.organisms || [];
      const reefs = renderer?.biogenicReefs || [];
      const hasReefs = renderer?.hasReefs || false;
      const shapes = {};
      for (const org of orgs) {
        const morph = window.aetheonApp?.getSpeciesMorphology ? window.aetheonApp.getSpeciesMorphology(org.speciesId, org.hue, org.carnivory, org.size) : null;
        if (morph?.shape) {
          shapes[morph.shape] = (shapes[morph.shape] || 0) + 1;
        }
      }
      return {
        connected: app?.net?.connected || false,
        organismCount: orgs.length,
        reefCount: reefs.length,
        hasReefs,
        shapes,
        dayPhase: renderer?.dayPhase
      };
    });

    console.log('Live Ocean State:', state);

    // 1. Capture Full Ocean with Biogenic Reefs & Living Creatures
    const fullShotPath = path.join(artifactDir, 'screenshot_live_radical_ocean.png');
    await page.screenshot({ path: fullShotPath });
    console.log(`Saved ${fullShotPath}`);

    // 2. Zoom in smoothly to examine morphology and biogenic coral details
    await page.evaluate(() => {
      const cam = window.aetheonApp?.camera;
      if (cam) {
        cam.zoom = 2.4;
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    const zoomShotPath = path.join(artifactDir, 'screenshot_live_closeup_reefs.png');
    await page.screenshot({ path: zoomShotPath });
    console.log(`Saved ${zoomShotPath}`);

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

main();
