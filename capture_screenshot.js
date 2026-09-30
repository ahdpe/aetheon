import puppeteer from 'puppeteer-core';

async function takeScreenshot() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Wait 1.5 seconds for animation to settle
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: 'public/screenshot_zen.png' });
  console.log('Zen screenshot saved to public/screenshot_zen.png');

  // Click Lab button
  await page.click('#btn-mode-toggle');
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: 'public/screenshot_lab.png' });
  console.log('Lab screenshot saved to public/screenshot_lab.png');

  await browser.close();
}

takeScreenshot().catch(console.error);
