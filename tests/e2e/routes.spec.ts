import { expect, test } from '@playwright/test';

const viewports = [320, 375, 768, 1024, 1440];
const pages = [
  { path: '/', heading: 'Escape the Ordinary.' },
  { path: '/about/', heading: 'Beyond the Ordinary' },
  { path: '/flavors/', heading: 'Flavors' },
  { path: '/flavors/grape/', heading: 'Grape' },
  { path: '/flavors/lime/', heading: 'Lime' },
  { path: '/contact/', heading: "Let's Connect" },
  { path: '/404.html', heading: 'Page not found' },
];
const navigation = [
  ['Home', '/'],
  ['Flavors', '/flavors/'],
  ['About', '/about/'],
  ['Contact', '/contact/'],
];

for (const pageCase of pages) {
  for (const width of viewports) {
    test(`${pageCase.path} renders cleanly at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(pageCase.path);
      expect(response).not.toBeNull();
      expect([200, 404]).toContain(response!.status());
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageCase.heading);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex,\s*nofollow/);
      await expect(page.getByText('Development-only foundation. Public content and release approval are pending.')).toBeVisible();
      await expect(page.locator('footer.site-footer')).toBeVisible();

      const primary = page.getByRole('navigation', { name: 'Primary' });
      for (const [label, href] of navigation) {
        await expect(primary.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
      }
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.document, `document overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body, `body overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);

      for (const img of await page.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      }
    });
  }
}

test('keyboard focus exposes the skip link and moves focus to main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('navigation works between primary routes and footer links are available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Flavors', exact: true }).click();
  await expect(page).toHaveURL(/\/flavors\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flavors');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  for (const [label, href] of navigation) {
    await expect(footer.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  }
});

test('disabled sales channels and unset WhatsApp Business stay placeholders', async ({ page }) => {
  for (const flavor of ['grape', 'lime']) {
    await page.goto(`/flavors/${flavor}/`);
    await expect(page.getByRole('heading', { name: 'Where to Find Us' })).toHaveCount(0);
    await expect(page.locator('a[href*="splift"], a[href*="cannaland"], a[href*="wa.me"], a[href*="whatsapp.com"]')).toHaveCount(0);
  }
  await page.goto('/contact/');
  await expect(page.getByRole('heading', { name: 'WhatsApp Business' })).toBeVisible();
  await expect(page.getByText('Coming Soon')).toBeVisible();
  await expect(page.getByRole('link', { name: /Message us on WhatsApp/ })).toHaveCount(0);
});

const discoveryRoutes = ['/', '/flavors/'];
for (const route of discoveryRoutes) {
  for (const width of [320, 375]) {
    test(`${route} flavor discovery peeks and scrolls horizontally at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);

      const track = page.getByRole('list', { name: 'Tropical Trance flavors' });
      const cards = track.getByRole('listitem');
      const hrefs = await track.locator('.flavor-card h2 a').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).getAttribute('href')));
      expect(hrefs).toContain('/flavors/grape/');
      expect(hrefs).toContain('/flavors/lime/');
      expect(new Set(hrefs).size, 'Flavor cards should not be duplicated').toBe(hrefs.length);
      await expect(page.getByText('Swipe to explore')).toBeVisible();

      const geometry = await track.evaluate(element => {
        const items = [...element.querySelectorAll<HTMLElement>('.flavor-card')];
        const trackBounds = element.getBoundingClientRect();
        const first = items[0].getBoundingClientRect();
        const next = items[1].getBoundingClientRect();
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          trackLeft: trackBounds.left,
          trackRight: trackBounds.right,
          firstLeft: first.left,
          firstTop: first.top,
          firstWidth: first.width,
          nextLeft: next.left,
          nextTop: next.top,
          nextRight: next.right,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(geometry.firstTop).toBeCloseTo(geometry.nextTop, 0);
      expect(geometry.nextLeft).toBeGreaterThan(geometry.firstLeft);
      expect(geometry.nextLeft).toBeLessThan(geometry.trackRight);
      expect(geometry.nextRight).toBeGreaterThan(geometry.trackRight);
      expect(geometry.firstWidth / geometry.clientWidth).toBeGreaterThan(0.78);
      expect(geometry.firstWidth / geometry.clientWidth).toBeLessThan(0.86);
      expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

      await track.evaluate((element: HTMLElement) => { element.scrollLeft = element.clientWidth; });
      await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      await expect(cards).toHaveCount(hrefs.length);
      await track.getByRole('link', { name: 'Grape', exact: true }).click();
      await expect(page).toHaveURL(/\/flavors\/grape\/$/);
    });
  }
}

for (const route of discoveryRoutes) {
  for (const width of [768, 1440]) {
    test(`${route} flavor discovery remains a desktop grid at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const track = page.getByRole('list', { name: 'Tropical Trance flavors' });
      const layout = await track.evaluate(element => {
        const style = getComputedStyle(element);
        const cards = [...element.querySelectorAll<HTMLElement>('.flavor-card')];
        const first = cards[0].getBoundingClientRect();
        const second = cards[1].getBoundingClientRect();
        return {
          columns: style.gridTemplateColumns.trim().split(/\s+/).length,
          overflowX: style.overflowX,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          firstTop: first.top,
          secondTop: second.top,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(layout.columns).toBe(2);
      expect(layout.overflowX).toBe('visible');
      expect(layout.scrollWidth).toBe(layout.clientWidth);
      expect(layout.secondTop).toBeCloseTo(layout.firstTop, 0);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      await expect(page.getByText('Swipe to explore')).toBeHidden();
    });
  }
}

test('flavor links stay keyboard reachable with visible focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/flavors/');
  const track = page.getByRole('list', { name: 'Tropical Trance flavors' });
  const grape = track.getByRole('link', { name: 'Grape', exact: true });
  const lime = track.getByRole('link', { name: 'Lime', exact: true });
  const limeVisibleFraction = () => track.evaluate(element => {
    const link = element.querySelector<HTMLAnchorElement>('a[href="/flavors/lime/"]');
    if (!link || link.getBoundingClientRect().width === 0) return 0;
    const linkBounds = link.getBoundingClientRect();
    const trackBounds = element.getBoundingClientRect();
    const viewportLeft = trackBounds.left + element.clientLeft;
    const viewportRight = viewportLeft + element.clientWidth;
    const visibleWidth = Math.max(0, Math.min(linkBounds.right, viewportRight) - Math.max(linkBounds.left, viewportLeft));
    return visibleWidth / linkBounds.width;
  });
  const initiallyVisibleFraction = await limeVisibleFraction();
  await grape.focus();
  await page.keyboard.press('Tab');
  await expect(lime).toBeFocused();
  await expect(lime).toHaveCSS('outline-width', '3px');
  await expect.poll(limeVisibleFraction).toBeGreaterThanOrEqual(0.4);
  if (initiallyVisibleFraction < 0.01) {
    await expect.poll(limeVisibleFraction).toBeGreaterThan(initiallyVisibleFraction);
  }
});

test('reduced-motion preference disables carousel snapping and smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/flavors/');
  const track = page.getByRole('list', { name: 'Tropical Trance flavors' });
  await expect(track).toHaveCSS('scroll-snap-type', 'none');
  await expect(track).toHaveCSS('scroll-behavior', 'auto');
});
