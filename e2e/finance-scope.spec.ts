/**
 * Finance — Scope Toggle e2e Suite
 * ==================================
 * Browser-level invariants for the OFFICIAL ↔ INTERNAL toggle.
 *
 * Locks in:
 *   • Trial Balance always reconciles (Σ Dr == Σ Cr) in BOTH views
 *   • Numbers actually change between OFFICIAL and INTERNAL on the
 *     Chart of Accounts and Fiscal-Year Summary pages
 *   • The accounting identity surfaces a green ✓ in the Summary tab
 *   • OFFICIAL view never leaks the literal word "INTERNAL" in the
 *     Close-Entries panel (badges hidden + description tag stripped)
 *
 * Auth: relies on `e2e/.auth-state.json` produced by `auth-setup.ts`.
 *
 * Run:
 *   npx playwright test e2e/finance-scope.spec.ts
 */
import { test, expect, Page } from '@playwright/test'

// ── Helpers ──────────────────────────────────────────────────────

/** Set the scope cookie + reload the current page so server components re-render. */
async function setScope(page: Page, scope: 'OFFICIAL' | 'INTERNAL') {
    await page.context().addCookies([
        {
            name: 'tsf_view_scope',
            value: scope,
            domain: new URL(page.url()).hostname,
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ])
    await page.reload({ waitUntil: 'networkidle' })
}

/** Pull the first numeric token (handles `1,234.56` and `(1,234.56)`). */
function parseMoney(text: string | null): number | null {
    if (!text) return null
    const m = text.match(/-?\(?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?/)
    if (!m) return null
    const negParen = m[0].startsWith('(') && m[0].endsWith(')')
    const cleaned = m[0].replace(/[(),]/g, '').replace(/^-+/, '-')
    const n = Number(cleaned)
    return negParen ? -n : n
}

// ── Tests ────────────────────────────────────────────────────────

test.describe('Trial Balance reconciles in both views', () => {
    test('Σ debit equals Σ credit per scope', async ({ page }) => {
        for (const scope of ['OFFICIAL', 'INTERNAL'] as const) {
            await page.goto('/finance/reports/trial-balance', { waitUntil: 'networkidle' })
            await setScope(page, scope)

            // The viewer's bottom-bar "Net" diff. If it ever shows a non-zero
            // diff, the reconciliation is broken (the parentId bug fingerprint).
            const totalsBar = await page.getByText(/totals|net/i).first().textContent()
            const diff = parseMoney(totalsBar || '')
            expect(diff, `${scope} TB diff must be ~0`).not.toBeNull()
            expect(Math.abs(diff!)).toBeLessThan(0.05)
        }
    })
})

test.describe('Scope toggle changes numbers', () => {
    test('Chart of Accounts: balances differ between scopes', async ({ page }) => {
        await page.goto('/finance/chart-of-accounts', { waitUntil: 'networkidle' })

        await setScope(page, 'OFFICIAL')
        const officialFirst = await page
            .locator('[data-tour="account-tree"] .tabular-nums').first().textContent()
        const offNum = parseMoney(officialFirst)

        await setScope(page, 'INTERNAL')
        const internalFirst = await page
            .locator('[data-tour="account-tree"] .tabular-nums').first().textContent()
        const intNum = parseMoney(internalFirst)

        expect(offNum, 'official numeric exists').not.toBeNull()
        expect(intNum, 'internal numeric exists').not.toBeNull()
        // For an org that posts INTERNAL JEs, the leading row's balance
        // must change between the two views.
        if (offNum !== 0 || intNum !== 0) {
            expect(offNum).not.toBe(intNum)
        }
    })

    test('Fiscal Year Summary: Net Income differs and identity holds', async ({ page }) => {
        await page.goto('/finance/fiscal-years', { waitUntil: 'networkidle' })
        // Open the Summary tab (any year — uses the first that's expanded)
        const summaryTab = page.getByRole('button', { name: /summary/i }).first()
        await summaryTab.click()

        async function readNetIncome() {
            // Net Income / Net Loss label sits next to the value; read sibling.
            const label = page.getByText(/net income|net loss/i).first()
            const card = label.locator('xpath=..')
            const txt = await card.textContent()
            return parseMoney(txt || '')
        }

        await setScope(page, 'OFFICIAL')
        const officialNet = await readNetIncome()
        await setScope(page, 'INTERNAL')
        const internalNet = await readNetIncome()

        expect(officialNet).not.toBeNull()
        expect(internalNet).not.toBeNull()
        expect(internalNet).not.toBe(officialNet)

        // Self-check line — must show the green ✓, not the red ⚠
        const checkLine = page.getByText(/A − L − E/i)
        const txt = await checkLine.textContent()
        expect(txt, 'identity self-check line must be present').toBeTruthy()
        expect(txt, 'identity must verify ✓ — never ⚠').not.toMatch(/⚠/)
    })
})

test.describe('OFFICIAL view never leaks INTERNAL labels', () => {
    test('Close-Entries panel hides the OFFICIAL/INTERNAL chips in OFFICIAL view', async ({ page }) => {
        await page.goto('/finance/fiscal-years', { waitUntil: 'networkidle' })

        // Pick a closed year that has closing entries — the first year with
        // a "Close Entries" tab is fine.
        const closeEntriesTab = page.getByRole('button', { name: /close entries/i }).first()
        await closeEntriesTab.click()

        await setScope(page, 'OFFICIAL')
        // The Close-Entries body should not show the literal word "INTERNAL"
        // in any row label (the section header in OFFICIAL view says
        // "Closing JE", not "Closing JE — INTERNAL"). We look only inside
        // the panel content, not the page chrome.
        const panel = page.locator('[data-tour="entries-tab"]').or(page.locator('text=Closing JE').locator('xpath=ancestor::div[1]'))
        const html = (await panel.first().textContent()) || ''
        expect(html, 'OFFICIAL view should not surface the word INTERNAL').not.toMatch(/\bINTERNAL\b/)
    })
})
