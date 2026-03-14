import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'demo-artifacts');
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const baseUrl = (process.env.DEMO_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

const goto = async (page, route) => {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: outDir,
    size: { width: 1440, height: 900 },
  },
});

const page = await context.newPage();
page.setDefaultTimeout(60000);

await goto(page, '/');
await sleep(2000);

await goto(page, '/app');
await sleep(2000);

await goto(page, '/app/goals');
await sleep(1500);

const newGoalButton = page.getByRole('button', { name: /new goal/i }).first();
if (await newGoalButton.isVisible().catch(() => false)) {
  await newGoalButton.click();
  await sleep(1200);

  const nameInput = page.locator('input').first();
  await nameInput.fill('Hackathon Demo Goal');
  const targetInput = page.locator('input').nth(1);
  await targetInput.fill('5000');
  await sleep(1000);

  const prizedMode = page.getByRole('button', { name: /prized yield/i });
  if (await prizedMode.isVisible().catch(() => false)) {
    await prizedMode.click();
    await sleep(900);
  }

  const strategyMode = page.getByRole('button', { name: /select a strategy/i });
  if (await strategyMode.isVisible().catch(() => false)) {
    await strategyMode.click();
    await sleep(1400);
  }

  const close = page.getByRole('button', { name: /close/i }).first();
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await sleep(800);
  }
}

await goto(page, '/app/automation');
await sleep(2500);

const runNow = page.getByRole('button', { name: /run now/i }).first();
if (await runNow.isVisible().catch(() => false)) {
  await runNow.click();
  await sleep(2200);
}

await goto(page, '/app/settings');
await sleep(2500);

await page.screenshot({ path: path.resolve(outDir, 'final-settings.png'), fullPage: true });

const video = page.video();
await context.close();
const rawVideoPath = await video.path();
await browser.close();

const finalVideoPath = path.resolve(process.cwd(), '..', 'submission', 'fundory-demo.webm');
fs.copyFileSync(rawVideoPath, finalVideoPath);

console.log(JSON.stringify({ baseUrl, rawVideoPath, finalVideoPath }, null, 2));
