const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:4173';

const USERS = {
  client: { id: 101, userType: 'client', fullName: 'QA Client', email: 'client@example.com', isVerified: true, emailVerified: true },
  provider: { id: 202, userType: 'tradesperson', fullName: 'QA Provider', email: 'provider@example.com', isVerified: true, emailVerified: true },
  admin: { id: 303, userType: 'admin', fullName: 'QA Admin', email: 'admin@example.com', isVerified: true, emailVerified: true },
};

const PROFILE = {
  id: 11,
  userId: 202,
  fullName: 'QA Provider',
  name: 'QA Provider',
  profession: 'Plumber',
  barangayAddress: 'Poblacion, Toledo City',
  location: 'Poblacion, Toledo City',
  startingPrice: 500,
  dailyRate: 500,
  pricingUnit: 'per_day',
  isPublished: true,
  isVerified: true,
  verificationStatus: 'approved',
  acceptingBookings: true,
  aboutMe: 'Local service provider.',
  categories: ['Plumbing'],
  serviceTypes: [{ key: 'leak_repair', label: 'Leak Repair' }],
  skills: ['Pipe Repair'],
  languages: ['Cebuano', 'English'],
  portfolio: [],
  reviews: [],
  rating: 0,
  reviewCount: 0,
};

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installMocks(page, user) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/csrf')) return json(route, { success: true, data: { csrfToken: 'qa' } });
    if (path.endsWith('/auth/me')) {
      return user
        ? json(route, { success: true, data: { user } })
        : json(route, { success: false, message: 'Not authenticated' }, 401);
    }

    if (path.endsWith('/messages/unread-count') || path.endsWith('/notifications/unread-count')) {
      return json(route, { success: true, data: { count: 0 } });
    }
    if (path.endsWith('/messages')) return json(route, { success: true, data: { conversations: [] } });
    if (path.endsWith('/notifications')) return json(route, { success: true, data: { notifications: [], total: 0 } });
    if (path.endsWith('/service-requests/client') || path.endsWith('/service-requests/provider')) {
      return json(route, { success: true, data: { requests: [] } });
    }
    if (path.endsWith('/service-profiles/taxonomy')) {
      return json(route, { success: true, data: { categories: [] } });
    }
    if (path.endsWith('/service-profiles/all')) return json(route, { success: true, data: [] });
    if (path.endsWith('/service-profiles/user/me')) return json(route, { success: true, data: PROFILE });
    if (path.endsWith('/service-profiles/portfolio/me')) return json(route, { success: true, data: { portfolio: [] } });
    if (path.endsWith('/service-profiles/credentials/me')) return json(route, { success: true, data: { credentials: [] } });
    if (path.endsWith('/service-profiles/availability/me')) {
      return json(route, { success: true, data: { acceptingBookings: true, availableSlots: [], weeklyBlocks: [], availability: [], settings: { availability_status: 'available' } } });
    }
    if (/\/service-profiles\/11$/.test(path)) return json(route, { success: true, data: PROFILE });

    if (path.endsWith('/user/profile')) {
      return json(route, { success: true, data: { id: user?.id || 0, fullName: user?.fullName || 'QA User', email: user?.email || 'qa@example.com', phone: '09171234567', address: 'Poblacion, Toledo City', profilePhoto: null } });
    }
    if (path.endsWith('/user/onboarding-progress')) {
      return json(route, { success: true, data: { percentage: 100, completed: 3, total: 3, isComplete: true, tasks: [] } });
    }
    if (path.endsWith('/user/verification-status')) {
      return json(route, { success: true, data: { status: 'approved', isVerified: true } });
    }

    if (path.endsWith('/admin/dashboard-stats')) {
      return json(route, { success: true, data: { pendingVerifications: 0, activeReports: 0, verifiedProviders: 0, totalUsers: 0 } });
    }
    if (path.endsWith('/admin/users') || path.endsWith('/admin/verification-requests') || path.endsWith('/admin/provider-credentials') || path.endsWith('/admin/reports')) {
      return json(route, { success: true, data: [] });
    }
    if (path.endsWith('/health')) {
      return json(route, { success: true, status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    }

    return json(route, { success: true, data: {} });
  });
}

async function openPage(browser, { role = 'guest', path = '/', width = 390, height = 844, theme = 'light', language = 'en' }) {
  const user = role === 'guest' ? null : USERS[role];
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((state) => {
    localStorage.setItem('serbisyo-toledo-theme', state.theme);
    localStorage.setItem('serbisyo-toledo-language', state.language);
    if (state.user) localStorage.setItem('user', JSON.stringify(state.user));
    else localStorage.removeItem('user');
  }, { user, theme, language });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  await installMocks(page, user);
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(450);

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewport = window.innerWidth;
    return {
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
      viewport,
      textLength: body.innerText.trim().length,
    };
  });

  expect(metrics.textLength).toBeGreaterThan(5);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 2);
  expect(pageErrors).toEqual([]);

  return { context, page };
}

test('mobile app chrome is present and stable at phone widths', async ({ browser }) => {
  test.setTimeout(120000);
  for (const width of [320, 360, 390, 430]) {
    for (const [role, path] of [['client', '/client-dashboard'], ['provider', '/dashboard']]) {
      const { context, page } = await openPage(browser, { role, path, width, height: 844 });
      await expect(page.locator('.mobile-topbar')).toBeVisible();
      await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
      const chrome = await page.evaluate(() => {
        const top = document.querySelector('.mobile-topbar')?.getBoundingClientRect();
        const bottom = document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect();
        return {
          topY: top?.top,
          bottomGap: bottom ? window.innerHeight - bottom.bottom : null,
          bottomWidth: bottom?.width,
          viewport: window.innerWidth,
        };
      });
      expect(Math.abs(chrome.topY || 0)).toBeLessThanOrEqual(1);
      expect(chrome.bottomGap).toBeGreaterThanOrEqual(0);
      expect(chrome.bottomWidth).toBeLessThan(chrome.viewport);
      await page.screenshot({ path: `artifacts/ui-phone/${role}-${width}.png`, fullPage: true });
      await context.close();
    }
  }
});

test('core client/provider routes have no page-level mobile overflow', async ({ browser }) => {
  test.setTimeout(120000);
  const matrix = {
    client: ['/client-dashboard', '/feed', '/requests', '/messages', '/notifications', '/client-settings'],
    provider: ['/dashboard', '/requests', '/messages', '/provider-schedule', '/provider-availability', '/provider-credentials', '/provider-settings'],
  };
  for (const [role, paths] of Object.entries(matrix)) {
    for (const path of paths) {
      const { context } = await openPage(browser, { role, path, width: 390, height: 844 });
      await context.close();
    }
  }
});

test('dark mode and Cebuano representative screens remain readable and contained', async ({ browser }) => {
  test.setTimeout(120000);
  const cases = [
    ['client', '/client-dashboard'],
    ['provider', '/provider-availability'],
    ['admin', '/admin/dashboard'],
    ['guest', '/feed'],
  ];
  for (const [role, path] of cases) {
    for (const width of [390, 1366]) {
      const { context, page } = await openPage(browser, { role, path, width, height: width === 390 ? 844 : 900, theme: 'dark', language: 'ceb' });
      await page.screenshot({ path: `artifacts/ui-phone/${role}-${width}-dark-ceb.png`, fullPage: true });
      await context.close();
    }
  }
});

test('canonical mockup components render on migrated screens', async ({ browser }) => {
  const { context, page } = await openPage(browser, { role: 'client', path: '/client-dashboard', width: 1366, height: 900 });
  await expect(page.locator('.mock-pagehead')).toBeVisible();
  await expect(page.locator('.mock-stat').first()).toBeVisible();
  await expect(page.locator('.mock-card').first()).toBeVisible();
  await context.close();

  const feed = await openPage(browser, { role: 'client', path: '/feed', width: 1366, height: 900 });
  await expect(feed.page.locator('.mock-input').first()).toBeVisible();
  await expect(feed.page.locator('.mock-chip').first()).toBeVisible();
  await feed.context.close();
});
