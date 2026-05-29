import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, 'temporary screenshots');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

// Auto-increment: find the next available screenshot-N[-label].png
function nextFilename() {
  const existing = fs.readdirSync(OUT_DIR)
    .map(f => { const m = f.match(/^screenshot-(\d+)/); return m ? parseInt(m[1]) : 0; })
    .filter(Boolean);
  const n = existing.length ? Math.max(...existing) + 1 : 1;
  return label
    ? `screenshot-${n}-${label}.png`
    : `screenshot-${n}.png`;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log(`Navigating to ${url} …`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Force all scroll-reveal elements visible instantly (for screenshot accuracy)
  await page.addStyleTag({
    content: '.reveal { opacity: 1 !important; transform: none !important; transition-duration: 0ms !important; transition-delay: 0ms !important; }'
  });

  // Scroll through to trigger any lazy-loaded images / IntersectionObservers
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < pageHeight; y += 800) {
    await page.evaluate(yPos => window.scrollTo(0, yPos), y);
    await new Promise(r => setTimeout(r, 60));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));

  const filename = nextFilename();
  const filepath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });

  await browser.close();
  console.log(`Saved → ${filepath}`);
})();
