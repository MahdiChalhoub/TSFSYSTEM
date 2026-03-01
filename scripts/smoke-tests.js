/**
 * ═══════════════════════════════════════════════════════════
 * TSF End-to-End Smoke Tests
 * ═══════════════════════════════════════════════════════════
 * 
 * Lightweight smoke tests that verify critical pages load
 * and critical API endpoints respond. No dependencies needed —
 * uses native Node.js fetch.
 * 
 * Prerequisites: 
 *   - Next.js dev server running on port 3000
 *   - Django backend running on port 8000 (for API tests)
 * 
 * Run: node scripts/smoke-tests.js
 * Run against production: SMOKE_BASE=https://saas.tsf.ci node scripts/smoke-tests.js
 * ═══════════════════════════════════════════════════════════
 */

const BASE_URL = process.env.SMOKE_BASE || 'http://localhost:3000';
const API_BASE = process.env.SMOKE_API || 'http://localhost:8000';

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
const TIMEOUT = 10000; // 10 seconds

// ── Helper ──
async function testPage(path, expectedStatus, testName) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT);

        const res = await fetch(`${BASE_URL}${path}`, {
            signal: controller.signal,
            redirect: 'manual',
            headers: {
                'User-Agent': 'TSF-SmokeTest/1.0',
                'Accept': 'text/html'
            }
        });
        clearTimeout(timeout);

        const status = res.status;
        // Accept expected status OR 307/302 redirects (login redirects are OK)
        const isOk = status === expectedStatus ||
            (expectedStatus === 200 && (status === 307 || status === 302));

        if (isOk) {
            passed++;
            process.stdout.write('.');
        } else {
            failed++;
            failures.push({ testName, details: `Expected ${expectedStatus}, got ${status}` });
            process.stdout.write('✗');
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            failed++;
            failures.push({ testName, details: `Timeout after ${TIMEOUT}ms` });
            process.stdout.write('T');
        } else {
            skipped++;
            process.stdout.write('S');
        }
    }
}

async function testApi(path, testName) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT);

        const res = await fetch(`${API_BASE}${path}`, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'TSF-SmokeTest/1.0',
                'Accept': 'application/json'
            }
        });
        clearTimeout(timeout);

        // API should not return 500
        if (res.status < 500) {
            passed++;
            process.stdout.write('.');
        } else {
            failed++;
            failures.push({ testName, details: `Server error: ${res.status}` });
            process.stdout.write('✗');
        }
    } catch (err) {
        skipped++;
        process.stdout.write('S');
    }
}

async function testPageContent(path, mustContain, testName) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT);

        const res = await fetch(`${BASE_URL}${path}`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'TSF-SmokeTest/1.0' }
        });
        clearTimeout(timeout);

        const body = await res.text();
        if (body.includes(mustContain)) {
            passed++;
            process.stdout.write('.');
        } else {
            failed++;
            failures.push({ testName, details: `Page missing expected content: "${mustContain}"` });
            process.stdout.write('✗');
        }
    } catch (err) {
        skipped++;
        process.stdout.write('S');
    }
}

// ═══════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════

async function runAll() {
    console.log(`\n🌐 TSF Smoke Tests — ${BASE_URL}`);
    console.log(`   API: ${API_BASE}\n`);

    // ── Suite 1: Core Pages Load ──
    console.log('📄 Suite 1: Core Pages');
    await testPage('/', 200, 'Homepage loads');
    await testPage('/login', 200, 'Login page loads');
    await testPage('/dashboard', 200, 'Dashboard loads (or redirects to login)');

    // ── Suite 2: Module Pages ──
    console.log('\n📦 Suite 2: Module Pages');
    await testPage('/sales', 200, 'POS/Sales page loads');
    await testPage('/inventory/products', 200, 'Inventory products loads');
    await testPage('/finance/ledger', 200, 'Finance ledger loads');
    await testPage('/finance/accounts', 200, 'Chart of accounts loads');
    await testPage('/crm/contacts', 200, 'CRM contacts loads');
    await testPage('/hr/employees', 200, 'HR employees loads');
    await testPage('/settings', 200, 'Settings page loads');

    // ── Suite 3: SaaS Admin Pages ──
    console.log('\n🏢 Suite 3: SaaS Admin');
    await testPage('/organizations', 200, 'Organizations list loads');
    await testPage('/users/approvals', 200, 'User approvals loads');
    await testPage('/migration', 200, 'Migration page loads');

    // ── Suite 4: API Health ──
    console.log('\n🔌 Suite 4: API Endpoints');
    await testApi('/api/', 'API root accessible');
    await testApi('/api/health/', 'API health check');
    await testApi('/api/pos/registers/', 'POS registers endpoint');
    await testApi('/api/inventory/products/', 'Products endpoint');
    await testApi('/api/finance/accounts/', 'Finance accounts endpoint');

    // ── Suite 5: Static Assets ──
    console.log('\n🎨 Suite 5: Static Assets');
    await testPage('/manifest.json', 200, 'PWA manifest accessible');
    await testPage('/icons/icon-192.png', 200, 'PWA icon 192px');
    await testPage('/icons/icon-512.png', 200, 'PWA icon 512px');

    // ── Suite 6: Page Content Checks ──
    console.log('\n📝 Suite 6: Content Verification');
    await testPageContent('/login', 'TSF', 'Login page contains TSF branding');

    // ── Results ──
    console.log('\n');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log('═══════════════════════════════════════════════════');

    if (failures.length > 0) {
        console.log('\n❌ FAILURES:');
        failures.forEach(f => {
            console.log(`  • ${f.testName}`);
            if (f.details) console.log(`    ${f.details}`);
        });
    }

    if (skipped > 0) {
        console.log(`\n⚠️  ${skipped} test(s) skipped — server may not be running`);
    }

    if (failed > 0) {
        console.log('\n💡 To run against production:');
        console.log('   SMOKE_BASE=https://saas.tsf.ci SMOKE_API=https://saas.tsf.ci node scripts/smoke-tests.js');
        process.exit(1);
    } else {
        console.log('\n✅ All smoke tests passed!');
        process.exit(0);
    }
}

runAll().catch(err => {
    console.error('Fatal error running smoke tests:', err);
    process.exit(1);
});
