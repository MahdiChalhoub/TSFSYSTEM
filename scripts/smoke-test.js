const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const CRITICAL_FILES = [
    // Finance
    'src/app/(privileged)/finance/(transactions)/ledger/page.tsx',
    'src/app/actions/people.ts',
    'src/app/(privileged)/finance/(definitions)/fiscal-years/page.tsx',
    'src/lib/utils/units.ts',

    // SaaS
    'src/app/(privileged)/saas/switcher/page.tsx',
    'src/app/(privileged)/saas/subscription-plans/[id]/page.tsx',
    'src/app/actions/saas/modules.ts',

    // Core
    'src/app/(privileged)/layout.tsx',
    'src/components/ui/sidebar.tsx',
    'src/types/lucide-react.d.ts',
    'src/shims.d.ts',

    // Restored Features
    'src/app/(privileged)/finance/(reports)/dashboard/page.tsx',
    'src/app/(privileged)/finance/(definitions)/chart-of-accounts/migrate/page.tsx',
    'src/modules/packages/page.tsx',
    'src/app/(privileged)/saas/[code]/page.tsx',
    'src/app/(privileged)/saas/connector/contracts/page.tsx'
];

const LOGIC_CHECKS = [
    {
        file: 'src/app/actions/people.ts',
        pattern: /export async function linkGLAccount/g,
        description: 'GL Linking function in people actions'
    },
    {
        file: 'src/app/(privileged)/layout.tsx',
        pattern: /'OFFICIAL' | 'INTERNAL'/g,
        description: 'Case-sensitive Scope Access enum'
    },
    {
        file: 'src/app/(privileged)/finance/(transactions)/ledger/page.tsx',
        pattern: /TabType = 'MANUAL' | 'AUTO'/g,
        description: 'Ledger Manual/Auto tabs'
    },
    {
        file: 'src/app/(privileged)/saas/[code]/page.tsx',
        pattern: /dynamic\(\(\) => import\(`@\/modules\/\${moduleCode}\/page`\)/g,
        description: 'Dynamic Module Injection with security boundaries'
    },
    {
        file: 'src/app/(privileged)/finance/(reports)/dashboard/page.tsx',
        pattern: /<FinanceDashboardViewer/g,
        description: 'Restored Finance Dashboard component'
    }
];

console.log('🚀 Running TSF System Smoke Tests...');
let failures = 0;

// 1. Check File Existence
console.log('\n📁 Verifying Critical Files:');
CRITICAL_FILES.forEach(relPath => {
    const fullPath = path.join(ROOT, relPath);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${relPath}`);
    } else {
        console.error(`  ❌ MISSING: ${relPath}`);
        failures++;
    }
});

// 2. Check Critical Logic Patterns
console.log('\n🧠 Verifying Critical Logic Patterns:');
LOGIC_CHECKS.forEach(check => {
    const fullPath = path.join(ROOT, check.file);
    if (!fs.existsSync(fullPath)) return;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (check.pattern.test(content)) {
        console.log(`  ✅ ${check.description}`);
    } else {
        console.error(`  ❌ FAILED: ${check.description} (Pattern not found in ${check.file})`);
        failures++;
    }
});

// 3. Final Result
console.log('\n---');
if (failures === 0) {
    console.log('\x1b[32m%s\x1b[0m', '✨ ALL SMOKE TESTS PASSED! Feature Safety Net is active.');
    process.exit(0);
} else {
    console.error('\x1b[31m%s\x1b[0m', `💥 SMOKE TEST FAILED: ${failures} errors found.`);
    process.exit(1);
}
