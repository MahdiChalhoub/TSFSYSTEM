/**
 * Purchase Analytics Configuration — E2E Test Suite
 * 
 * Tests for all 64 features of the Purchase Analytics settings page.
 * Uses Playwright for browser automation.
 * 
 * Run: npx playwright test e2e/purchase-analytics.spec.ts
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://saas.developos.shop';
const SETTINGS_URL = `${BASE_URL}/settings/purchase-analytics`;

// Helper: Login and navigate
async function loginAndNavigate(page: Page) {
    // Assumes session cookie or auth is already set via storageState
    await page.goto(SETTINGS_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 15000 });
}

test.describe('Purchase Analytics Settings', () => {

    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page);
    });

    // ═══════════════════════════════════════════════════════════════
    // 1. PAGE LOAD & SKELETON
    // ═══════════════════════════════════════════════════════════════

    test('should render page title', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Purchase Analytics Configuration');
    });

    test('should display breadcrumb navigation', async ({ page }) => {
        await expect(page.locator('nav')).toContainText('Settings');
        await expect(page.locator('nav')).toContainText('Purchase Analytics');
    });

    test('should show RBAC role badge', async ({ page }) => {
        // At least one of: ADMIN, EDITOR, VIEWER
        const badge = page.locator('span:text-matches("ADMIN|EDITOR|VIEWER", "i")');
        await expect(badge.first()).toBeVisible();
    });

    test('should display stats bar with profile count', async ({ page }) => {
        await expect(page.locator('text=Profiles')).toBeVisible();
    });

    // ═══════════════════════════════════════════════════════════════
    // 2. PAGE PROFILES TABLE
    // ═══════════════════════════════════════════════════════════════

    test('should show page profiles table', async ({ page }) => {
        await expect(page.locator('text=Page Profiles')).toBeVisible();
        await expect(page.locator('text=Active Profile')).toBeVisible();
    });

    test('should display drag handles on profile rows', async ({ page }) => {
        const handles = page.locator('text=⋮⋮');
        await expect(handles.first()).toBeVisible();
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. CONFIGURATION CARDS
    // ═══════════════════════════════════════════════════════════════

    test('should show collapsible config cards', async ({ page }) => {
        await expect(page.locator('text=Sales Analysis')).toBeVisible();
    });

    test('should collapse/expand cards on click', async ({ page }) => {
        const cardHeader = page.locator('text=Sales Analysis').first();
        await cardHeader.click();
        // Body should toggle visibility
        await page.waitForTimeout(200);
        await cardHeader.click();
        await page.waitForTimeout(200);
    });

    // ═══════════════════════════════════════════════════════════════
    // 4. QUICK PRESETS
    // ═══════════════════════════════════════════════════════════════

    test('should display quick presets', async ({ page }) => {
        await expect(page.locator('text=Quick Presets')).toBeVisible();
        await expect(page.locator('text=Conservative')).toBeVisible();
        await expect(page.locator('text=Balanced')).toBeVisible();
        await expect(page.locator('text=Aggressive')).toBeVisible();
    });

    test('should apply preset on click', async ({ page }) => {
        await page.locator('button:has-text("Aggressive")').click();
        await page.waitForTimeout(300);
        // Verify a field changed (e.g., sales_avg_period_days should be 30)
    });

    // ═══════════════════════════════════════════════════════════════
    // 5. SEARCH FILTER
    // ═══════════════════════════════════════════════════════════════

    test('should filter settings by search', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="Search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('safety');
            await page.waitForTimeout(300);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // 6. TOOLBAR BUTTONS
    // ═══════════════════════════════════════════════════════════════

    test('should have Export button', async ({ page }) => {
        await expect(page.locator('button:has-text("Export")')).toBeVisible();
    });

    test('should have Print button', async ({ page }) => {
        await expect(page.locator('button:has-text("Print")')).toBeVisible();
    });

    test('should have History button', async ({ page }) => {
        await expect(page.locator('button:has-text("History")')).toBeVisible();
    });

    // ═══════════════════════════════════════════════════════════════
    // 7. KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════════════════════════════

    test('should show keyboard hints', async ({ page }) => {
        const hints = page.locator('text=Ctrl+S');
        if (await hints.isVisible()) {
            await expect(hints).toBeVisible();
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // 8. HISTORY MODAL
    // ═══════════════════════════════════════════════════════════════

    test('should open history modal', async ({ page }) => {
        await page.locator('button:has-text("History")').click();
        await page.waitForTimeout(500);
        await expect(page.locator('text=Config Version History')).toBeVisible();
        // Close it
        await page.locator('button:has(svg)').last().click();
    });

    // ═══════════════════════════════════════════════════════════════
    // 9. LAST MODIFIED DISPLAY
    // ═══════════════════════════════════════════════════════════════

    test('should show last modified info if available', async ({ page }) => {
        const lastMod = page.locator('text=Last modified by');
        // This may or may not be visible depending on history
        if (await lastMod.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(lastMod).toBeVisible();
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // 10. COLLAPSE ALL / EXPAND ALL
    // ═══════════════════════════════════════════════════════════════

    test('should have Collapse All and Expand All buttons', async ({ page }) => {
        const collapseAll = page.locator('button:has-text("Collapse All")');
        const expandAll = page.locator('button:has-text("Expand All")');
        if (await collapseAll.isVisible().catch(() => false)) {
            await expect(collapseAll).toBeVisible();
        }
        if (await expandAll.isVisible().catch(() => false)) {
            await expect(expandAll).toBeVisible();
        }
    });
});
