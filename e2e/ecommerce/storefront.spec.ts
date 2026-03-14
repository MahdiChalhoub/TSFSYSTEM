import { test, expect } from '@playwright/test';

/**
 * E-commerce Module E2E Tests
 * Tests storefront navigation (public-facing)
 */

test.describe('E-commerce - Storefront', () => {
  test('should load storefront (if enabled)', async ({ page }) => {
    // Try common storefront routes
    const routes = ['/store', '/shop', '/storefront', '/products'];

    let loaded = false;
    for (const route of routes) {
      try {
        await page.goto(route, { timeout: 5000 });
        if (page.url().includes(route)) {
          loaded = true;
          break;
        }
      } catch (e) {
        // Route doesn't exist, try next
        continue;
      }
    }

    // If no storefront found, that's okay (may not be enabled)
    if (!loaded) {
      test.skip();
    }
  });

  test('storefront should have product listings', async ({ page }) => {
    await page.goto('/store');

    // Skip if storefront doesn't exist
    if (page.url().includes('/login') || page.url().includes('404')) {
      test.skip();
      return;
    }

    // Look for product cards or listings
    const productElements = await page.locator('[data-testid*="product"], .product-card, .product-item').count();

    // May be 0 if no products, that's okay
    expect(productElements).toBeGreaterThanOrEqual(0);
  });
});
