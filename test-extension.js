import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const extensionPath = path.join(__dirname, 'dist');
  console.log(`Loading extension from: ${extensionPath}`);
  
  const browser = await puppeteer.launch({
    headless: false, // Heads up: false is required for extensions to load properly in older Puppeteer versions, or "new" in newer ones
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  
  // Intercept logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Extractor]') || text.includes('[Detector]') || text.includes('[Translator]') || text.includes('[Health]')) {
      console.log(`[EXTENSION PAGE LOG] ${text}`);
    }
  });

  console.log('Navigating to target URL...');
  await page.goto('https://7reels.cc/tv/70523/watch?s=1', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Enable debug logging
  try {
    await page.evaluate(() => {
      window.__subtitleDebug = true;
    });
  } catch (e) {}

  console.log('Waiting for video and subtitles to load (up to 30s)...');
  
  try {
    // Check main frame and iframes for video
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      if (v) return true;
      const iframes = document.querySelectorAll('iframe');
      for (let f of iframes) {
        try {
          if (f.contentDocument && f.contentDocument.querySelector('video')) return true;
        } catch(e) {}
      }
      return false;
    }, { timeout: 30000 });
    console.log('Video element detected!');
    
    // Attempt to start playback if paused
    await page.evaluate(() => {
      try {
        const v = document.querySelector('video');
        if (v && v.paused) {
          v.play().catch(e => console.log('Autoplay blocked:', e));
        } else {
          const iframes = document.querySelectorAll('iframe');
          for (let f of iframes) {
            const fv = f.contentDocument && f.contentDocument.querySelector('video');
            if (fv && fv.paused) fv.play().catch(e => {});
          }
        }
      } catch (e) {}
    });

    // Give it 15 seconds to load captions and translate
    await new Promise(r => setTimeout(r, 15000));
    
    // Check health badge status in all frames
    const status = await page.evaluate(() => {
      let result = { text: "Not Found", color: "N/A" };
      
      const checkBadge = (doc) => {
        const badge = doc.querySelector('#dual-subtitle-health-badge');
        if (badge && badge.shadowRoot) {
          const dot = badge.shadowRoot.querySelector('#status-dot');
          const st = badge.shadowRoot.querySelector('#status-text');
          if (st) result.text = st.textContent;
          if (dot) result.color = dot.className;
        }
      };

      checkBadge(document);
      
      const iframes = document.querySelectorAll('iframe');
      for (let f of iframes) {
        try { if (f.contentDocument) checkBadge(f.contentDocument); } catch(e) {}
      }
      
      return result;
    });
    
    console.log('Final Health Badge Status:', status);

  } catch (err) {
    console.error('Test script encountered an error or timeout:', err);
  } finally {
    console.log('Test finished. Closing browser...');
    await browser.close();
  }
})();
