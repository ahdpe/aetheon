import puppeteer from 'puppeteer-core';

async function run() {
  console.log('[Browser Test] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.error(`[Browser HTTP Error] ${res.status()}: ${res.url()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error(`[Browser PageError]`, err);
  });

  console.log('[Browser Test] Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  console.log('[Browser Test] Page loaded. Measuring frame loop for 3s in Zen Mode...');
  
  // Track animation frames
  const zenMetrics = await page.evaluate(async () => {
    return new Promise(resolve => {
      let frames = 0;
      const startTime = performance.now();
      
      function onFrame() {
        frames++;
        if (performance.now() - startTime >= 2000) {
          resolve({
            fps: Math.round((frames / (performance.now() - startTime)) * 1000),
            orgCount: window.aetheonApp?.renderer?.currEntities?.size || 0,
            hasCanvas: Boolean(document.getElementById('ocean-canvas'))
          });
        } else {
          requestAnimationFrame(onFrame);
        }
      }
      requestAnimationFrame(onFrame);
    });
  });

  console.log('[Browser Test] Zen Mode metrics:', zenMetrics);

  // Check if organisms positions are updating
  const posCheck = await page.evaluate(async () => {
    const app = window.aetheonApp;
    if (!app || !app.renderer) return { error: 'No app or renderer on window' };
    
    const getSamplePos = () => {
      const first = app.renderer.currEntities.values().next().value;
      return first ? { id: first.id, x: first.x, y: first.y } : null;
    };

    const p1 = getSamplePos();
    await new Promise(r => setTimeout(r, 600));
    const p2 = getSamplePos();

    return { p1, p2, changed: p1 && p2 && (p1.x !== p2.x || p1.y !== p2.y) };
  });

  console.log('[Browser Test] Position change check in Zen Mode:', posCheck);

  console.log('[Browser Test] Clicking Lab Mode button (#btn-mode-toggle)...');
  await page.click('#btn-mode-toggle');

  const labMetrics = await page.evaluate(async () => {
    return new Promise(resolve => {
      let frames = 0;
      const startTime = performance.now();
      
      function onFrame() {
        frames++;
        if (performance.now() - startTime >= 2000) {
          resolve({
            fps: Math.round((frames / (performance.now() - startTime)) * 1000),
            isLabClass: document.body.classList.contains('mode-lab'),
            labRibbonVisible: document.getElementById('lab-ribbon')?.offsetHeight > 0
          });
        } else {
          requestAnimationFrame(onFrame);
        }
      }
      requestAnimationFrame(onFrame);
    });
  });

  console.log('[Browser Test] Lab Mode metrics:', labMetrics);

  console.log('[Browser Test] Console messages logged:', consoleMessages.length);
  console.log('[Browser Test] Page errors logged:', pageErrors.length);

  await browser.close();

  if (pageErrors.length > 0) {
    console.error('[Browser Test] FAILED with page errors:', pageErrors);
    process.exit(1);
  } else {
    console.log('[Browser Test] SUCCESS!');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('[Browser Test] Fatal error running test:', err);
  process.exit(1);
});
