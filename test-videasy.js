import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const extensionPath = path.join(__dirname, 'dist');
  console.log(`Loading extension from: ${extensionPath}`);
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Extractor]') || text.includes('[Detector]') || text.includes('[Translator]') || text.includes('[Health]')) {
      console.log(`[EXTENSION LOG] ${text}`);
    }
  });

  const url = 'https://player.videasy.to/tv/70523/1/5:9)';
  console.log(`Navigating to ${url}...`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('Page loaded. Waiting for video element...');
    
    // Inject debug mode
    await page.evaluate(() => { window.__subtitleDebug = true; }).catch(e => {});

    // Try to click anywhere to bypass initial interaction barriers
    await page.mouse.click(640, 360);
    await new Promise(r => setTimeout(r, 2000));
    await page.mouse.click(640, 360);

    const artifactDir = '/Users/yashchowdhary/.gemini/antigravity-ide/brain/9574d540-5344-40ef-b813-4341ad14f8b7';
    
    // Take screenshot of initial state
    await page.screenshot({ path: path.join(artifactDir, 'test-screenshot-1.png') });
    console.log('Saved screenshot 1');

    await page.waitForFunction(() => {
      return document.querySelector('video') !== null;
    }, { timeout: 30000 });

    console.log('Video element detected! Playing video...');
    
    // Try playing
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v) v.play().catch(() => {});
    });

    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: path.join(artifactDir, 'test-screenshot-2.png') });
    console.log('Saved screenshot 2 (after 5s playback)');

    // Get health monitor status
    const status = await page.evaluate(() => {
      let result = { text: "Not Found", color: "N/A", dom: "" };
      const badge = document.querySelector('#dual-subtitle-health-badge');
      if (badge && badge.shadowRoot) {
        const dot = badge.shadowRoot.querySelector('#status-dot');
        const st = badge.shadowRoot.querySelector('#status-text');
        if (st) result.text = st.textContent;
        if (dot) result.color = dot.className;
        const panel = badge.shadowRoot.querySelector('.debug-panel');
        if (panel) result.dom = panel.innerHTML;
      }
      return result;
    });

    console.log('Final Status:', status);

  } catch (err) {
    console.error('Test script encountered an error:', err);
    try {
      await page.screenshot({ path: '/Users/yashchowdhary/.gemini/antigravity-ide/brain/9574d540-5344-40ef-b813-4341ad14f8b7/test-screenshot-error.png' });
    } catch (e) {}
  } finally {
    await browser.close();
  }
})();
