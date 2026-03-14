import { chromium } from 'playwright';
import path from 'path';

const htmlPath = path.resolve(process.cwd(), '..', 'submission', 'pitch-deck.html');
const pdfPath = path.resolve(process.cwd(), '..', 'submission', 'pitch-deck.pdf');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
});
await browser.close();

console.log(pdfPath);
