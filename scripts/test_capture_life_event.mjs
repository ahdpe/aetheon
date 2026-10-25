import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROD_URL = 'https://emergentia.cloud/aetheon';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(PROD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('Waiting for a birth or death event in the live ocean...');
  let eventCaptured = false;
  const startTime = Date.now();

  while (Date.now() - startTime < 20000) {
    const counts = await page.evaluate(() => {
      const r = window.aetheonApp?.renderer;
      return {
        births: r?.birthEvents?.length || 0,
        deaths: r?.deathEvents?.length || 0
      };
    });

    if (counts.births > 0 || counts.deaths > 0) {
      console.log(`Captured active life transition! Births: ${counts.births}, Deaths: ${counts.deaths}`);
      eventCaptured = true;
      const shotPath = '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e/screenshot_2d_life_event_capture.png';
      await page.screenshot({ path: shotPath });
      console.log('Saved screenshot to', shotPath);
      break;
    }
    await new Promise(r => setTimeout(r, 100)); // check every 100ms
  }

  if (!eventCaptured) {
    console.log('No event fired during window, capturing general live state');
    await page.screenshot({ path: '/Users/Ulana/.gemini/antigravity/brain/1aaea190-a37a-4527-8356-24d933f1f67e/screenshot_2d_life_event_capture.png' });
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
