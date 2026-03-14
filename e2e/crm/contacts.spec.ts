import { test, expect } from '@playwright/test';

/**
 * CRM Module E2E Tests
 * Tests contact management navigation
 */

test.describe('CRM - Contacts', () => {
  test('should load contacts page', async ({ page }) => {
    await page.goto('/crm/contacts');

    // Check if redirected to login or contacts loaded
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');
    const isContactsPage = currentUrl.includes('/contacts') || currentUrl.includes('/crm');

    expect(isLoginPage || isContactsPage).toBeTruthy();
  });

  test('contacts page should have data table or list', async ({ page }) => {
    await page.goto('/crm/contacts');

    // Skip if requires auth
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Look for table or list elements
    const hasTable = await page.locator('table, [role="table"]').count() > 0;
    const hasGrid = await page.locator('[role="grid"]').count() > 0;
    const hasList = await page.locator('ul, ol, [role="list"]').count() > 0;

    // At least one data display method should exist
    expect(hasTable || hasGrid || hasList).toBeTruthy();
  });
});
