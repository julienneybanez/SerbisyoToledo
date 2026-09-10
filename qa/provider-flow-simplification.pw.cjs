const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:4173';
const PROVIDER = {
  id: 202,
  userType: 'tradesperson',
  fullName: 'QA Provider',
  email: 'provider@example.com',
  isVerified: true,
  emailVerified: true,
};

const PROFILE = {
  id: 11,
  userId: 202,
  name: 'QA Provider',
  fullName: 'QA Provider',
  profession: 'Plumber',
  location: 'Poblacion, Toledo City',
  barangayAddress: 'Poblacion, Toledo City',
  startingPrice: 500,
  pricingUnit: 'per_day',
  categories: ['Plumbing'],
  serviceTypes: [{ key: 'leak_repair', label: 'Leak Repair' }],
  image: null,
  isPublished: true,
  isVerified: true,
};

const TAXONOMY = {
  categories: [
    {
      key: 'plumbing',
      label: 'Plumbing',
      slug: 'plumbing',
      serviceTypes: [
        { key: 'leak_repair', label: 'Leak Repair' },
        { key: 'fixture_installation', label: 'Fixture Installation' },
      ],
    },
    {
      key: 'electrical',
      label: 'Electrical',
      slug: 'electrical',
      serviceTypes: [{ key: 'general_electrical_work', label: 'General Electrical Work' }],
    },
  ],
};

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installMocks(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith('/auth/csrf')) return json(route, { success: true, data: { csrfToken: 'qa' } });
    if (path.endsWith('/auth/me')) return json(route, { success: true, data: { user: PROVIDER } });
    if (path.endsWith('/messages/unread-count') || path.endsWith('/notifications/unread-count')) return json(route, { success: true, data: { count: 0 } });
    if (path.endsWith('/service-requests/provider')) return json(route, { success: true, data: { requests: [] } });
    if (path.endsWith('/service-profiles/taxonomy')) return json(route, { success: true, data: TAXONOMY });
    if (path.endsWith('/service-profiles/user/me')) return json(route, { success: true, data: PROFILE });
    if (path.endsWith('/service-profiles/portfolio/me')) {
      return json(route, {
        success: true,
        data: {
          aboutMe: 'Local plumber serving Toledo City.',
          responseTime: 'Within 24 hours',
          skills: ['Pipe Repair'],
          portfolio: [],
        },
      });
    }
    if (path.endsWith('/service-profiles/languages/me')) return json(route, { success: true, data: { languages: ['ceb', 'en'] } });
    if (path.endsWith('/service-profiles/credentials/me')) return json(route, { success: true, data: { credentials: [] } });
    if (path.endsWith('/service-profiles/portfolio/completed-requests')) return json(route, { success: true, data: { requests: [] } });
    if (path.endsWith('/service-profiles/availability/me')) {
      return json(route, {
        success: true,
        data: {
          acceptingBookings: true,
          availableSlots: [{ date: '2026-09-15', startTime: '08:00', endTime: '17:00' }],
          settings: { availability_status: 'available' },
        },
      });
    }
    if (path.endsWith('/user/profile')) {
      return json(route, {
        success: true,
        data: {
          id: 202,
          fullName: 'QA Provider',
          email: 'provider@example.com',
          phone: '09171234567',
          profilePhoto: null,
          emailVerified: true,
        },
      });
    }
    if (path.endsWith('/user/verification-status')) return json(route, { success: true, data: { status: 'approved', isVerified: true } });
    if (/\/service-profiles\/11$/.test(path)) return json(route, { success: true, data: PROFILE });

    return json(route, { success: true, data: {} });
  });
}

async function openProvider(browser, path, width = 1366, height = 900) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript((user) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('serbisyo-toledo-theme', 'light');
    localStorage.setItem('serbisyo-toledo-language', 'en');
  }, PROVIDER);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message || String(error)));
  await installMocks(page);
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 2);
  expect(errors).toEqual([]);
  return { context, page };
}

test('provider desktop navigation exposes six clear areas without profile fragmentation', async ({ browser }) => {
  const { context, page } = await openProvider(browser, '/dashboard', 1440, 950);
  const sidebar = page.locator('.workspace-sidebar');
  await expect(sidebar).toBeVisible();

  const navText = await sidebar.innerText();
  for (const label of ['Dashboard', 'Requests', 'Calendar', 'Messages', 'Profile', 'Settings']) {
    expect(navText).toContain(label);
  }
  expect(navText).not.toContain('Service Listing');
  expect(navText).not.toContain('Credentials');
  expect(navText).not.toContain('Availability');
  expect(navText).not.toContain('Notifications');

  await page.screenshot({ path: 'artifacts/ui-phone/provider-simplified-dashboard.png', fullPage: true });
  await context.close();
});

test('provider profile consolidates services profile credentials and portfolio', async ({ browser }) => {
  const { context, page } = await openProvider(browser, '/provider-credentials', 1440, 1000);

  await expect(page.getByRole('heading', { name: 'Provider Profile' })).toBeVisible();
  await expect(page.locator('#services')).toBeVisible();
  await expect(page.locator('#about')).toBeVisible();
  await expect(page.locator('#credentials')).toBeVisible();
  await expect(page.locator('#portfolio')).toBeVisible();
  await expect(page.getByText('Services & Pricing').first()).toBeVisible();
  await expect(page.getByText('Credentials & Certifications').first()).toBeVisible();
  await expect(page.getByText('Portfolio & Completed Work').first()).toBeVisible();

  await expect(page.locator('.provider-credential-inline-form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Credential' }).click();
  await expect(page.locator('.provider-credential-inline-form')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const manager = document.querySelector('.provider-profile-manager')?.getBoundingClientRect();
    const fields = [...document.querySelectorAll('.provider-credential-inline-form input, .provider-credential-inline-form select')]
      .filter((element) => getComputedStyle(element).display !== 'none')
      .map((element) => element.getBoundingClientRect().width)
      .filter((width) => width > 0);
    return {
      managerWidth: manager?.width || 0,
      minFieldWidth: fields.length ? Math.min(...fields) : 0,
    };
  });
  expect(metrics.managerWidth).toBeGreaterThan(900);
  expect(metrics.minFieldWidth).toBeGreaterThan(240);

  await page.screenshot({ path: 'artifacts/ui-phone/provider-profile-consolidated.png', fullPage: true });
  await context.close();
});

test('calendar combines booked jobs and availability with advanced scheduling hidden by default', async ({ browser }) => {
  const { context, page } = await openProvider(browser, '/provider-schedule', 1366, 950);
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'My Jobs' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Availability' }).click();
  await expect(page.getByText('Quick setup')).toBeVisible();
  await expect(page.getByText('Which days do you normally work?')).toBeVisible();
  await expect(page.locator('.availability-advanced-content')).toHaveCount(0);
  await page.getByRole('button', { name: /Customize specific dates or hours/i }).click();
  await expect(page.locator('.availability-advanced-content')).toBeVisible();
  await context.close();
});

test('provider mobile bottom navigation uses direct Calendar and Profile destinations', async ({ browser }) => {
  const { context, page } = await openProvider(browser, '/dashboard', 390, 844);
  const bottom = page.locator('.mobile-bottom-nav');
  await expect(bottom).toBeVisible();
  const navText = await bottom.innerText();
  for (const label of ['Dashboard', 'Requests', 'Calendar', 'Messages', 'Profile']) {
    expect(navText).toContain(label);
  }
  await page.screenshot({ path: 'artifacts/ui-phone/provider-simplified-mobile.png', fullPage: true });
  await context.close();
});

test('legacy availability route still opens the simplified availability experience', async ({ browser }) => {
  const { context, page } = await openProvider(browser, '/provider-availability', 390, 844);
  await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible();
  await expect(page.getByText('Quick setup')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Availability' })).toBeVisible();
  await context.close();
});
