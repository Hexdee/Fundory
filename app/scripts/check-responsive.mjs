import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const baseUrl = (process.env.DEMO_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outDir = path.resolve(process.cwd(), '..', 'submission', 'responsive-check');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(`${baseUrl}/app/goals`, { waitUntil: 'networkidle' });
await desktop.screenshot({ path: path.join(outDir, 'goals-desktop.png'), fullPage: true });

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
});
const mobile = await mobileContext.newPage();
await mobile.goto(`${baseUrl}/app/goals`, { waitUntil: 'networkidle' });
await mobile.screenshot({ path: path.join(outDir, 'goals-mobile.png'), fullPage: true });

await mobileContext.close();
await browser.close();

console.log(JSON.stringify({ baseUrl, outDir }, null, 2));
