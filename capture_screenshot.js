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

  // Click on canvas to drop nutrient food bloom in upper-left
  console.log('Clicking canvas to drop food in upper-left (400, 320)...');
  await page.mouse.click(400, 320);
  await new Promise(r => setTimeout(r, 800));

  // Click canvas again in bottom-right (820, 520)
  console.log('Clicking canvas to drop food in bottom-right (820, 520)...');
  await page.mouse.click(820, 520);
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: 'public/screenshot_zen.png' });
  console.log('Zen screenshot with food blooms saved to public/screenshot_zen.png');

  // Click Lab button
  await page.click('#btn-mode-toggle');
  await new Promise(r => setTimeout(r, 1000));

  // Click canvas in Lab mode to see the scientific reticle
  console.log('Clicking canvas in Lab mode (640, 400)...');
  await page.mouse.click(640, 400);
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: 'public/screenshot_lab.png' });
  console.log('Lab screenshot with food blooms saved to public/screenshot_lab.png');

  // Switch to Russian language
  console.log('Switching to Russian language...');
  await page.click('#btn-lang');
  await new Promise(r => setTimeout(r, 400));

  // Open About Modal
  console.log('Opening About modal...');
  await page.click('#btn-about');
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: 'public/screenshot_about_overview.png' });
  console.log('About Overview screenshot saved to public/screenshot_about_overview.png');

  // Click Expand Math button
  console.log('Clicking Expand Math button...');
  await page.click('#btn-expand-math');
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: 'public/screenshot_about_math.png' });
  console.log('About Math screenshot saved to public/screenshot_about_math.png');

  await browser.close();
}

takeScreenshot().catch(console.error);
