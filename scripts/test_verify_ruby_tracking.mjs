import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROD_URL = 'https://emergentia.cloud/aetheon';

async function main() {
  console.log('Testing live tracking of Ruby Whirl (Рубиновый вихрь)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(PROD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Switch to Russian language
  await page.evaluate(() => {
    const langBtn = document.getElementById('btn-lang');
    if (langBtn) langBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Check living count of species 119
  const rubyStats = await page.evaluate(() => {
    const renderer = window.aetheonApp?.renderer;
    const orgs = Array.from(renderer?.currEntities?.values() || []);
    const rubyOrgs = orgs.filter(o => o.speciesId === 119);
    return {
      totalOrgs: orgs.length,
      rubyCount: rubyOrgs.length,
      rubySample: rubyOrgs[0] ? { id: rubyOrgs[0].id, x: rubyOrgs[0].x, y: rubyOrgs[0].y, hue: rubyOrgs[0].hue, size: rubyOrgs[0].size, carnivory: rubyOrgs[0].carnivory } : null
    };
  });
  console.log('Ruby Whirl stats in live ocean:', rubyStats);

  // Open Journal drawer
  console.log('Opening Journal drawer...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-expand-journal');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // Capture Journal drawer with the Ruby Whirl card showing live status and Track button
  const shotJournalPath = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e/screenshot_journal_ruby_track_button.png';
  await page.screenshot({ path: shotJournalPath });
  console.log('Saved journal screenshot to', shotJournalPath);

  // Click "🎯 Найти в чаше" on the Ruby Whirl card
  console.log('Clicking "Найти в чаше" button on Ruby Whirl card...');
  const tracked = await page.evaluate(() => {
    const btn = document.querySelector('.journal-track-btn[data-species-id="119"]');
    if (btn) {
      btn.click();
      return true;
    }
    // Fallback: call trackSpeciesInOcean directly
    if (window.aetheonApp) {
      return window.aetheonApp.trackSpeciesInOcean(119);
    }
    return false;
  });
  console.log('Tracking initiated:', tracked);

  // Wait 3 seconds for camera glide and inspector opening
  await new Promise(r => setTimeout(r, 3000));

  const inspectorInfo = await page.evaluate(() => {
    const title = document.getElementById('inspector-title')?.textContent;
    const status = document.getElementById('inspector-status')?.textContent;
    const trackedId = window.aetheonApp?.renderer?.camera?.trackedEntityId;
    return { title, status, trackedId };
  });
  console.log('Inspector info:', inspectorInfo);

  // Capture screenshot of camera tracking Ruby Whirl
  const shotTrackedPath = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e/screenshot_tracked_ruby_whirl_live.png';
  await page.screenshot({ path: shotTrackedPath });
  console.log('Saved tracked screenshot to', shotTrackedPath);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
