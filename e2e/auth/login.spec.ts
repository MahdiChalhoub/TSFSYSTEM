import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Critical: User login flow
 */

test.describe('Authentication', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/login');

    // Check page loaded
    await expect(page).toHaveTitle(/Login|Sign in|TSFSYSTEM/i);

    // Check form elements exist
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill invalid credentials
    await page.locator('input[type="email"], input[name="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"], input[name="password"]').fill('wrongpassword');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Check for error message
    await expect(page.locator('text=/invalid|incorrect|error/i')).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty form submission', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form
    await page.locator('button[type="submit"]').click();

    // Check for validation errors
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  // Note: Actual login test requires valid credentials
  // test('should login successfully with valid credentials', async ({ page }) => {
  //   await page.goto('/login');
  //   await page.fill('input[type="email"]', 'admin@example.com');
  //   await page.fill('input[type="password"]', 'validpassword');
  //   await page.click('button[type="submit"]');
  //   await expect(page).toHaveURL(/dashboard|home/);
  // });
});
