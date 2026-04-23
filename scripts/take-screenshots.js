const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:80';
const OUT  = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'login',            path: '/login' },
  { name: 'dashboard',        path: '/dashboard' },
  { name: 'swatch-orders',    path: '/swatch-orders' },
  { name: 'style-orders',     path: '/style-orders' },
  { name: 'clients',          path: '/masters/clients' },
  { name: 'vendors',          path: '/masters/vendors' },
  { name: 'materials',        path: '/masters/materials' },
  { name: 'accounts',         path: '/accounts/dashboard' },
  { name: 'invoices',         path: '/accounts/invoices' },
  { name: 'inventory',        path: '/inventory/dashboard' },
  { name: 'packing-lists',    path: '/logistics/packing-lists' },
  { name: 'shipping',         path: '/shipping' },
  { name: 'purchase-orders',  path: '/procurement/purchase-orders' },
  { name: 'quotations',       path: '/quotation' },
  { name: 'user-management',  path: '/user-management' },
  { name: 'settings',         path: '/settings' },
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login first
  await page.goto(`${BASE}/login`);
  await page.screenshot({ path: `${OUT}/login.jpg` });
  await page.fill('input[placeholder="name@zarierp.com"]', 'admin@zarierp.com');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(1500);

  for (const pg of PAGES.filter(p => p.name !== 'login')) {
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 12000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${pg.name}.jpg`, fullPage: false });
      console.log(`✓ ${pg.name}`);
    } catch (e) {
      console.log(`✗ ${pg.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Done.');
})();
