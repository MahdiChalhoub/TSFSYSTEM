import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for TSFSYSTEM finance e2e tests.
 *
 * Default base URL points at the live local Next.js (pm2 tsf-frontend on
 * :3000). Override with BASE_URL env when running against staging/prod.
 *
 * Auth: tests authenticate by setting the same cookies the Next.js login
 * action sets — `auth_token` (Django token) and `scope_access` (org's
 * scope authorization). Drop them into `e2e/auth-state.json` once and
 * every test reuses the storage state. See `e2e/auth-setup.ts`.
 */
export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,           // ledger state is shared — keep deterministic
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? 'line' : 'list',

    use: {
        baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // Reuse the auth cookies captured by auth-setup.ts so each test
        // doesn't need to log in again.
        storageState: 'e2e/.auth-state.json',
        extraHTTPHeaders: {
            // Match a real browser host header so multi-tenant resolution works
            // when running locally against pm2 — override for staging/prod.
            host: process.env.TENANT_HOST || 'saas.developos.shop',
        },
    },

    projects: [
        {
            name: 'auth-setup',
            testMatch: /auth-setup\.ts/,
        },
        {
            name: 'finance',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['auth-setup'],
            testMatch: /finance-scope\.spec\.ts/,
        },
    ],
})
