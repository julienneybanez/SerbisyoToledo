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
  acceptingRequests: true,
  aboutMe: 'Local service provider with several years of experience serving Toledo City.',
  categories: ['Plumbing'],
  serviceTypes: [{ key: 'leak_repair', label: 'Leak Repair' }],
  skills: ['Pipe Repair', 'Fixture Installation'],
  languages: ['Cebuano', 'English'],
  portfolio: [],
  reviews: [],
  rating: 4.8,
  reviewCount: 12,
  nextAvailableDate: '2026-09-09',
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
      return user ? json(route, { success: true, data: { user } }) : json(route, { success: false, message: 'Not authenticated' }, 401);
    }
    if (path.endsWith('/messages/unread-count') || path.endsWith('/notifications/unread-count')) return json(route, { success: true, data: { count: 0 } });
    if (path.endsWith('/messages')) return json(route, { success: true, data: { conversations: [] } });
    if (path.endsWith('/notifications')) return json(route, { success: true, data: { notifications: [], total: 0 } });
    if (path.endsWith('/service-requests/client') || path.endsWith('/service-requests/provider')) return json(route, { success: true, data: { requests: [] } });
    if (path.endsWith('/service-profiles/taxonomy')) return json(route, { success: true, data: { categories: [] } });
    if (path.endsWith('/service-profiles/all')) return json(route, { success: true, data: [PROFILE] });
    if (path.endsWith('/service-profiles/user/me')) return json(route, { success: true, data: PROFILE });
    if (path.endsWith('/service-profiles/portfolio/me')) return json(route, { success: true, data: { portfolio: [] } });
    if (path.endsWith('/service-profiles/credentials/me')) return json(route, { success: true, data: { credentials: [] } });
    if (path.endsWith('/service-profiles/availability/me')) return json(route, { success: true, data: { acceptingBookings: true, availableSlots: [], weeklyBlocks: [], availability: [], settings: { availability_status: 'available' } } });
    if (/\/service-profiles\/11\/available-dates$/.test(path)) return json(route, { success: true, data: { dates: ['2026-09-09', '2026-09-10', '2026-09-12'] } });
    if (/\/service-profiles\/11\/available-slots$/.test(path)) return json(route, { success: true, data: { slots: [{ time: '09:00' }, { time: '10:00' }, { time: '13:00' }, { time: '15:00' }] } });
    if (/\/service-profiles\/11$/.test(path)) return json(route, { success: true, data: PROFILE });

    if (path.endsWith('/user/profile')) return json(route, { success: true, data: { id: user?.id || 0, fullName: user?.fullName || 'QA User', email: user?.email || 'qa@example.com', phone: '09171234567', address: 'Poblacion, Toledo City', profilePhoto: null } });
    if (path.endsWith('/user/onboarding-progress')) return json(route, { success: true, data: { percentage: 100, completed: 3, total: 3, isComplete: true, tasks: [] } });
    if (path.endsWith('/user/verification-status')) return json(route, { success: true, data: { status: 'approved', isVerified: true } });

    if (path.endsWith('/admin/dashboard-stats')) return json(route, { success: true, data: { pendingVerifications: 0, activeReports: 0, verifiedProviders: 0, totalUsers: 0 } });
    if (path.endsWith('/admin/users') || path.endsWith('/admin/verification-requests') || path.endsWith('/admin/provider-credentials') || path.endsWith('/admin/reports')) return json(route, { success: true, data: [] });
    if (path.endsWith('/health')) return json(route, { success: true, status: 'healthy', database: 'connected' });

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

  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    textLength: document.body.innerText.trim().length,
  }));

  expect(geometry.textLength).toBeGreaterThan(5);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 2);
  expect(pageErrors).toEqual([]);
  return { context, page };
}

test('public pages stay contained across phone tablet and desktop widths', async ({ browser }) => {
  test.setTimeout(240000);
  const widths = [320, 360, 390, 430, 768, 1024, 1366, 1440];
  const paths = ['/', '/about', '/feed', '/login', '/register', '/provider/11'];
  for (const width of widths) {
    for (const path of paths) {
      const { context } = await openPage(browser, { path, width, height: width <= 430 ? 844 : 900 });
      await context.close();
    }
  }
});

test('auth branding is centered and Manrope is the active UI family', async ({ browser }) => {
  for (const path of ['/login', '/register']) {
    for (const width of [390, 1440]) {
      const { context, page } = await openPage(browser, { path, width, height: width === 390 ? 844 : 1000 });
      const result = await page.evaluate(() => {
        const pane = document.querySelector('.auth-form-pane')?.getBoundingClientRect();
        const logo = document.querySelector('.auth-page-logo')?.getBoundingClientRect();
        const wordmark = document.querySelector('.auth-brand-wordmark')?.getBoundingClientRect();
        const visual = document.querySelector('.auth-visual-pane');
        const fontFamily = getComputedStyle(document.body).fontFamily;
        const center = (rect) => rect ? rect.left + rect.width / 2 : 0;
        return {
          logoDelta: pane && logo ? Math.abs(center(pane) - center(logo)) : 999,
          wordmarkDelta: pane && wordmark ? Math.abs(center(pane) - center(wordmark)) : 999,
          fontFamily,
          visualDisplay: visual ? getComputedStyle(visual).display : 'none',
        };
      });
      expect(result.logoDelta).toBeLessThanOrEqual(3);
      expect(result.wordmarkDelta).toBeLessThanOrEqual(3);
      expect(result.fontFamily.toLowerCase()).toContain('manrope');
      if (width <= 768) expect(result.visualDisplay).toBe('none');
      else expect(result.visualDisplay).not.toBe('none');
      await context.close();
    }
  }
});

test('provider profile uses desktop width efficiently and stacks on smaller screens', async ({ browser }) => {
  const desktop = await openPage(browser, { path: '/provider/11', width: 1440, height: 1000 });
  const desktopGeometry = await desktop.page.evaluate(() => {
    const container = document.querySelector('.portfolio-container')?.getBoundingClientRect();
    const availability = document.querySelector('.provider-availability-panel')?.getBoundingClientRect();
    return { containerWidth: container?.width || 0, availabilityWidth: availability?.width || 0 };
  });
  expect(desktopGeometry.containerWidth).toBeGreaterThan(1180);
  expect(desktopGeometry.availabilityWidth).toBeGreaterThan(320);
  await desktop.context.close();

  const tablet = await openPage(browser, { path: '/provider/11', width: 768, height: 1024 });
  const tabletGeometry = await tablet.page.evaluate(() => {
    const summary = document.querySelector('.profile-summary')?.getBoundingClientRect();
    const availability = document.querySelector('.provider-availability-panel')?.getBoundingClientRect();
    return { availabilityBelow: Boolean(summary && availability && availability.top >= summary.bottom - 2) };
  });
  expect(tabletGeometry.availabilityBelow).toBe(true);
  await tablet.context.close();
});

test('representative authenticated routes stay responsive through all layout bands', async ({ browser }) => {
  test.setTimeout(240000);
  const cases = [
    ['client', '/client-dashboard'],
    ['client', '/requests'],
    ['client', '/messages'],
    ['provider', '/dashboard'],
    ['provider', '/provider-availability'],
    ['provider', '/provider-credentials'],
    ['admin', '/admin/dashboard'],
    ['admin', '/admin/verifications'],
  ];
  for (const width of [320, 390, 768, 1024, 1440]) {
    for (const [role, path] of cases) {
      const { context } = await openPage(browser, { role, path, width, height: width <= 390 ? 844 : 950 });
      await context.close();
    }
  }
});

test('dark mode representative public and authenticated pages remain contained', async ({ browser }) => {
  const cases = [
    ['guest', '/'],
    ['guest', '/login'],
    ['guest', '/provider/11'],
    ['client', '/client-dashboard'],
    ['provider', '/provider-credentials'],
    ['admin', '/admin/dashboard'],
  ];
  for (const width of [390, 1366]) {
    for (const [role, path] of cases) {
      const { context } = await openPage(browser, { role, path, width, height: width === 390 ? 844 : 900, theme: 'dark', language: 'ceb' });
      await context.close();
    }
  }
});
