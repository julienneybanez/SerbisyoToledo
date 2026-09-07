const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:4173';

async function openPublic(page, { width, height = 1080, theme = 'light' }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('serbisyo-toledo-theme', selectedTheme);
    localStorage.setItem('serbisyo-toledo-language', 'en');
    localStorage.removeItem('user');
  }, theme);

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not authenticated' }) });
    }
    if (path.endsWith('/service-profiles/all')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);
}

test('homepage and footer expand proportionally on large monitors', async ({ page }) => {
  for (const width of [1920, 2560]) {
    await openPublic(page, { width, height: 1200 });

    const metrics = await page.evaluate(() => {
      const hero = document.querySelector('.home-hero > .container')?.getBoundingClientRect();
      const footer = document.querySelector('.footer')?.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        pageScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        heroWidth: hero?.width || 0,
        footerWidth: footer?.width || 0,
      };
    });

    expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewport + 2);
    expect(metrics.heroWidth / metrics.viewport).toBeGreaterThan(0.84);
    expect(metrics.heroWidth / metrics.viewport).toBeLessThan(0.94);
    expect(metrics.footerWidth / metrics.viewport).toBeGreaterThan(0.84);
    expect(metrics.footerWidth / metrics.viewport).toBeLessThan(0.94);
  }

  await page.screenshot({ path: 'artifacts/ui-phone/home-1920-light.png', fullPage: true });
});

test('dark homepage uses one continuous public canvas between sections', async ({ page }) => {
  await openPublic(page, { width: 1920, height: 1200, theme: 'dark' });

  const colors = await page.evaluate(() => {
    const color = (selector) => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).backgroundColor : null;
    };
    return {
      body: getComputedStyle(document.body).backgroundColor,
      app: color('.app'),
      main: color('.main-content'),
      page: color('.home-page'),
      heroSection: color('.home-hero'),
      popularSection: color('.home-popular-section'),
      howSection: color('.how-it-works-section'),
      faqSection: color('.home-faq-section'),
    };
  });

  expect(colors.body).toBe(colors.app);
  expect(colors.app).toBe(colors.main);
  expect(colors.main).toBe(colors.page);
  for (const sectionColor of [colors.heroSection, colors.popularSection, colors.howSection, colors.faqSection]) {
    expect(sectionColor === 'rgba(0, 0, 0, 0)' || sectionColor === 'transparent').toBe(true);
  }

  await page.screenshot({ path: 'artifacts/ui-phone/home-1920-dark.png', fullPage: true });
});
