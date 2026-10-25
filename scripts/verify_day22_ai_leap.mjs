import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACTS_DIR = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e';

async function run() {
  console.log('[Test] Launching Chrome to inspect live Day 22 AI Genesis & loading speed...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const t0 = Date.now();
  await page.goto('https://emergentia.cloud/aetheon/', { waitUntil: 'domcontentloaded' });
  console.log(`[Test] Page DOM loaded in ${Date.now() - t0} ms`);

  // Wait 1.5 seconds for first frame
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_day22_instant_ocean_load.png` });
  console.log(`[Test] Saved instant ocean load screenshot.`);

  // Click on the live journal / header button to open Journal drawer
  const liveBadge = await page.$('#btn-live-header');
  if (liveBadge) {
    await liveBadge.click();
    console.log('[Test] Clicked live header badge to open Journal.');
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_day22_journal_open.png` });
  }

  // Switch to Daily Atlas tab
  const atlasTab = await page.$('#tab-journal-atlas-btn');
  if (atlasTab) {
    await atlasTab.click();
    console.log('[Test] Switched to Daily Atlas tab.');
    await page.evaluate(() => {
      const b = document.querySelector('.drawer-body');
      if (b) b.scrollTop = 600;
      const c = document.querySelector('.atlas-day-card');
      if (c) c.scrollIntoView(false);
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACTS_DIR}/screenshot_day22_atlas_details.png` });
  }

  await browser.close();
  console.log('[Test] Verification complete!');
}

run().catch(err => {
  console.error('[Test] Error:', err);
  process.exit(1);
});
