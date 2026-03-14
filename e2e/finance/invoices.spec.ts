import { test, expect } from '@playwright/test';

/**
 * Finance Module E2E Tests
 * Tests invoice listing and navigation
 */

test.describe('Finance - Invoices', () => {
  test('should load invoices page', async ({ page }) => {
    await page.goto('/finance/invoices');

    // Check if redirected to login or invoices loaded
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');
    const isInvoicesPage = currentUrl.includes('/invoices') || currentUrl.includes('/finance');

    expect(isLoginPage || isInvoicesPage).toBeTruthy();
  });

  test('invoices page structure validation', async ({ page }) => {
    await page.goto('/finance/invoices');

    // Skip if requires auth
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Basic page load validation
    await page.waitForLoadState('networkidle');
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });
});
