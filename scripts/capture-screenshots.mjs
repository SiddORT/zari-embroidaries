import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'artifacts', 'zari-erp', 'public', 'manual-screenshots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:80';

const PAGES = [
  { file: 'dashboard',        path: '/dashboard' },
  { file: 'clients',          path: '/masters/clients' },
  { file: 'vendors',          path: '/masters/vendors' },
  { file: 'materials',        path: '/masters/materials' },
  { file: 'swatch-orders',    path: '/swatch-orders' },
  { file: 'style-orders',     path: '/style-orders' },
  { file: 'quotations',       path: '/quotation' },
  { file: 'accounts',         path: '/accounts/dashboard' },
  { file: 'invoices',         path: '/accounts/invoices' },
  { file: 'inventory',        path: '/inventory/dashboard' },
  { file: 'inventory-items',  path: '/inventory/items' },
  { file: 'purchase-orders',  path: '/procurement/purchase-orders' },
  { file: 'packing-lists',    path: '/logistics/packing-lists' },
  { file: 'shipping',         path: '/shipping' },
  { file: 'settings',         path: '/settings' },
];

(async () => {
  const executablePath = '/home/runner/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[placeholder="name@zarierp.com"]', 'admin@zarierp.com');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/dashboard', { timeout: 12000 });
  console.log('Logged in ✓');

  for (const pg of PAGES) {
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const dest = join(OUT, `${pg.file}.jpg`);
      await page.screenshot({ path: dest, type: 'jpeg', quality: 85 });
      console.log(`✓  ${pg.file}`);
    } catch (e) {
      console.log(`✗  ${pg.file}: ${e.message.slice(0, 120)}`);
    }
  }

  await browser.close();
  console.log('\nDone — screenshots in', OUT);
})();
