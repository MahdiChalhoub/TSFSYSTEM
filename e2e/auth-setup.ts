/**
 * One-time auth setup for the finance e2e suite.
 *
 * Reads credentials from env (`E2E_USERNAME`, `E2E_PASSWORD`) and the
 * tenant host (`TENANT_HOST`, default `saas.developos.shop`). Logs in
 * via the Next.js login form, then persists the resulting cookie jar
 * to `e2e/.auth-state.json`. Every other test file inherits this state
 * via `playwright.config.ts → use.storageState`.
 *
 * Run manually:
 *   E2E_USERNAME=admin E2E_PASSWORD='secret' npx playwright test --project=auth-setup
 */
import { test as setup } from '@playwright/test'
import { existsSync } from 'fs'
import path from 'path'

const AUTH_FILE = path.resolve('e2e/.auth-state.json')

setup('authenticate', async ({ page, baseURL }) => {
    const user = process.env.E2E_USERNAME
    const pass = process.env.E2E_PASSWORD
    if (!user || !pass) {
        // If a usable storage state already exists, accept it and skip the
        // interactive login. Lets devs hand-craft auth-state.json from a
        // browser session and reuse it across runs.
        if (existsSync(AUTH_FILE)) {
            console.warn(
                `[auth-setup] No E2E_USERNAME/E2E_PASSWORD set; reusing existing ${AUTH_FILE}.`,
            )
            return
        }
        throw new Error(
            'auth-setup needs E2E_USERNAME + E2E_PASSWORD env vars (or a pre-built e2e/.auth-state.json).',
        )
    }
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel(/username|email/i).fill(user)
    await page.getByLabel(/password/i).fill(pass)
    await page.getByRole('button', { name: /log\s*in|sign\s*in/i }).click()
    // Wait until we land on a privileged route (post-login redirect)
    await page.waitForURL(/\/(home|dashboard|finance|workspace)/, { timeout: 15_000 })
    await page.context().storageState({ path: AUTH_FILE })
})
