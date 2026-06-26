import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../dist');
const outPath = path.resolve(__dirname, '../releases');

async function createZip(sourceDir, outPath, filename) {
  const zip = new JSZip();

  function addFiles(dir, currentZip) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        addFiles(fullPath, currentZip.folder(file));
      } else {
        currentZip.file(file, fs.readFileSync(fullPath));
      }
    }
  }

  addFiles(sourceDir, zip);

  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath, { recursive: true });
  }

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(outPath, filename), content);
  console.log(`Created ${filename}`);
}

async function build() {
  if (!fs.existsSync(distPath)) {
    console.error('dist directory not found. Run npm run build first.');
    process.exit(1);
  }

  // Build Chrome Extension
  await createZip(distPath, outPath, 'chrome-extension.zip');

  // Build Firefox Add-on
  // Modify manifest for Firefox
  const manifestPath = path.join(distPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Add Firefox specific settings
    manifest.browser_specific_settings = {
      gecko: {
        id: "live-dual-subtitle-translator@yashchowdhary14.github.io",
        strict_min_version: "109.0"
      }
    };
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Create Firefox zip
    await createZip(distPath, outPath, 'firefox-extension.zip');
    
    // Revert manifest changes so dist remains pure
    delete manifest.browser_specific_settings;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } else {
    console.warn('manifest.json not found in dist. Skipping Firefox modifications.');
    await createZip(distPath, outPath, 'firefox-extension.zip');
  }

  console.log('Extensions built successfully in /releases');
}

build().catch(console.error);
