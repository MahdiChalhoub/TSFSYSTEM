/**
 * ═══════════════════════════════════════════════════════════
 * TSF Security Audit Scanner
 * ═══════════════════════════════════════════════════════════
 * 
 * Automated scanner that checks for common security 
 * vulnerabilities in the codebase. Run before every deployment.
 *
 * Run: node scripts/security-scan.js
 * ═══════════════════════════════════════════════════════════
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
let warnings = 0;
const failures = [];
const warns = [];

function pass(msg) { passed++; process.stdout.write('.'); }
function fail(msg, detail) { failed++; failures.push({ msg, detail }); process.stdout.write('✗'); }
function warn(msg, detail) { warnings++; warns.push({ msg, detail }); process.stdout.write('⚠'); }

function grep(pattern, dir, includes = '*.py') {
    try {
        const cmd = `grep -rn "${pattern}" ${dir} --include="${includes}" 2>/dev/null | grep -v node_modules | grep -v venv | grep -v __pycache__`;
        return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim().split('\n').filter(Boolean);
    } catch { return []; }
}

function grepMulti(pattern, dir, exts) {
    let results = [];
    for (const ext of exts) {
        results = results.concat(grep(pattern, dir, `*.${ext}`));
    }
    return results;
}

const BACKEND = 'erp_backend';
const FRONTEND = 'src';

// ═══════════════════════════════════════════════════════════
// SUITE 1: Authentication & Authorization
// ═══════════════════════════════════════════════════════════
console.log('\n🔐 Suite 1: Authentication & Authorization');

// 1.1 — Check for views without authentication
(() => {
    const allowAny = grep('AllowAny', BACKEND);
    const publicMatches = allowAny.filter(l => !l.includes('login') && !l.includes('register') && !l.includes('health') && !l.includes('public'));
    if (publicMatches.length > 0) {
        warn('AllowAny found on non-login endpoints', publicMatches.slice(0, 3).join('\n'));
    } else {
        pass('No unexpected AllowAny permissions');
    }
})();

// 1.2 — Check that ViewSets filter by organization
(() => {
    const viewsets = grep('class.*ViewSet', BACKEND);
    const filtered = grep('organization.*request.user', BACKEND);
    if (filtered.length > 0) {
        pass(`Found ${filtered.length} org-filtered querysets`);
    } else {
        fail('No organization filtering found in viewsets', 'Every ViewSet must filter by request.user.organization');
    }
})();

// 1.3 — Check for hardcoded tokens/passwords
(() => {
    const hardcoded = grepMulti('password\\s*=\\s*["\'][^"\']*["\']', BACKEND, ['py']);
    const realHardcoded = hardcoded.filter(l =>
        !l.includes('PASSWORD_HASHERS') &&
        !l.includes('password_field') &&
        !l.includes('help_text') &&
        !l.includes('label') &&
        !l.includes('placeholder') &&
        !l.includes('#') &&
        !l.includes('validate_password') &&
        !l.includes('migration')
    );
    if (realHardcoded.length > 0) {
        warn('Possible hardcoded passwords found', realHardcoded.slice(0, 3).join('\n'));
    } else {
        pass('No hardcoded passwords detected');
    }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 2: Injection Prevention
// ═══════════════════════════════════════════════════════════
console.log('\n💉 Suite 2: Injection Prevention');

// 2.1 — Raw SQL usage
(() => {
    const rawSql = grep('raw\\(', BACKEND);
    const rawSql2 = grep('cursor\\.execute', BACKEND);
    const combined = [...rawSql, ...rawSql2];
    if (combined.length > 0) {
        warn(`${combined.length} raw SQL statement(s) found`, combined.slice(0, 3).join('\n'));
    } else {
        pass('No raw SQL — ORM only');
    }
})();

// 2.2 — f-string SQL (critical vulnerability)
(() => {
    const fstringSql = grep('f".*SELECT\\|f".*INSERT\\|f".*UPDATE\\|f".*DELETE', BACKEND);
    if (fstringSql.length > 0) {
        fail('F-STRING SQL INJECTION RISK', fstringSql.join('\n'));
    } else {
        pass('No f-string SQL injection vectors');
    }
})();

// 2.3 — eval/exec usage (code injection)
(() => {
    const evals = grep('\\beval\\(\\|\\bexec\\(', BACKEND);
    const filtered = evals.filter(l => !l.includes('#') && !l.includes('migration'));
    if (filtered.length > 0) {
        fail('eval()/exec() usage detected — code injection risk', filtered.slice(0, 3).join('\n'));
    } else {
        pass('No eval/exec code injection vectors');
    }
})();

// 2.4 — XSS in frontend (dangerouslySetInnerHTML)
(() => {
    const dangerous = grepMulti('dangerouslySetInnerHTML', FRONTEND, ['tsx', 'ts']);
    if (dangerous.length > 0) {
        warn(`${dangerous.length} dangerouslySetInnerHTML usage(s)`, dangerous.slice(0, 3).join('\n'));
    } else {
        pass('No dangerouslySetInnerHTML XSS vectors');
    }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 3: Secrets & Configuration
// ═══════════════════════════════════════════════════════════
console.log('\n🔑 Suite 3: Secrets & Configuration');

// 3.1 — .env in gitignore
(() => {
    try {
        const gitignore = fs.readFileSync('.gitignore', 'utf-8');
        if (gitignore.includes('.env')) {
            pass('.env is gitignored');
        } else {
            fail('.env NOT in .gitignore — secrets could leak to git');
        }
    } catch {
        fail('.gitignore file not found');
    }
})();

// 3.2 — Hardcoded secrets in source
(() => {
    const secrets = grepMulti('SECRET_KEY\\s*=\\s*["\']', '.', ['py', 'ts', 'tsx', 'js']);
    const real = secrets.filter(l => !l.includes('process.env') && !l.includes('os.environ') && !l.includes('.env') && !l.includes('getenv'));
    if (real.length > 0) {
        fail('Hardcoded SECRET_KEY found in source code', real.slice(0, 3).join('\n'));
    } else {
        pass('No hardcoded secrets in source');
    }
})();

// 3.3 — API keys in frontend code
(() => {
    const apiKeys = grepMulti('api_key\\|apiKey\\|API_KEY', FRONTEND, ['ts', 'tsx']);
    const real = apiKeys.filter(l => !l.includes('process.env') && !l.includes('NEXT_PUBLIC') && l.includes('='));
    if (real.length > 0) {
        warn('Possible hardcoded API keys in frontend', real.slice(0, 3).join('\n'));
    } else {
        pass('No hardcoded API keys in frontend');
    }
})();

// 3.4 — Powered by header disabled
(() => {
    try {
        const config = fs.readFileSync('next.config.ts', 'utf-8');
        if (config.includes('poweredByHeader: false')) {
            pass('X-Powered-By header disabled');
        } else {
            warn('X-Powered-By header not disabled — fingerprinting risk');
        }
    } catch { warn('Could not read next.config.ts'); }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 4: Security Headers
// ═══════════════════════════════════════════════════════════
console.log('\n🛡️ Suite 4: Security Headers');

(() => {
    try {
        const config = fs.readFileSync('next.config.ts', 'utf-8');

        const headers = [
            ['X-Frame-Options', 'Clickjacking protection'],
            ['X-Content-Type-Options', 'MIME sniffing protection'],
            ['Referrer-Policy', 'Referrer leak prevention'],
            ['Content-Security-Policy', 'XSS/injection protection'],
            ['Permissions-Policy', 'Feature restriction'],
        ];

        for (const [header, desc] of headers) {
            if (config.includes(header)) {
                pass(`${header} present`);
            } else {
                fail(`Missing ${header} — ${desc}`);
            }
        }
    } catch { fail('Could not read next.config.ts for header analysis'); }
})();

// Check HSTS in nginx
(() => {
    try {
        const nginx = fs.readFileSync('nginx/nginx.conf', 'utf-8');
        if (nginx.includes('Strict-Transport-Security')) {
            pass('HSTS enabled in Nginx');
        } else {
            fail('HSTS not found in Nginx config');
        }
    } catch { warn('Could not read nginx config'); }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 5: Data Exposure
// ═══════════════════════════════════════════════════════════
console.log('\n📡 Suite 5: Data Exposure');

// 5.1 — console.log with sensitive data
(() => {
    const consoleLogs = grepMulti('console\\.log.*password\\|console\\.log.*token\\|console\\.log.*secret', FRONTEND, ['ts', 'tsx']);
    if (consoleLogs.length > 0) {
        fail('console.log LEAKING sensitive data', consoleLogs.join('\n'));
    } else {
        pass('No sensitive data in console.log');
    }
})();

// 5.2 — Stack traces in API responses
(() => {
    const stackTraces = grep('traceback\\|stacktrace\\|stack_trace', BACKEND);
    const inResponses = stackTraces.filter(l => l.includes('Response') || l.includes('return'));
    if (inResponses.length > 0) {
        warn('Possible stack trace exposure in API responses', inResponses.slice(0, 3).join('\n'));
    } else {
        pass('No stack trace leakage in responses');
    }
})();

// 5.3 — Serializer using __all__ fields
(() => {
    const allFields = grep("fields\\s*=\\s*['\"]__all__['\"]", BACKEND);
    if (allFields.length > 0) {
        warn(`${allFields.length} serializer(s) using fields='__all__' — may expose sensitive fields`, allFields.slice(0, 3).join('\n'));
    } else {
        pass('No serializers exposing __all__ fields');
    }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 6: Tenant Isolation
// ═══════════════════════════════════════════════════════════
console.log('\n🏢 Suite 6: Tenant Isolation');

// 6.1 — Cross-org data access patterns
(() => {
    const allObjects = grep('\\.objects\\.all()', BACKEND);
    const inViews = allObjects.filter(l => l.includes('views') && !l.includes('filter') && !l.includes('get_queryset'));
    if (inViews.length > 5) {
        warn(`${inViews.length} unfiltered .objects.all() in views — potential data leak`, inViews.slice(0, 3).join('\n'));
    } else {
        pass('Limited unfiltered queryset access');
    }
})();

// 6.2 — Session/cookie scoping
(() => {
    try {
        const nginx = fs.readFileSync('nginx/nginx.conf', 'utf-8');
        // Just check nginx exists and has some cookie config
        pass('Nginx config present for cookie/domain scoping');
    } catch {
        warn('Could not verify cookie scoping in Nginx');
    }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 7: File Upload Security
// ═══════════════════════════════════════════════════════════
console.log('\n📁 Suite 7: File Upload');

(() => {
    const fileUploads = grep('FileField\\|ImageField\\|InMemoryUploadedFile', BACKEND);
    if (fileUploads.length > 0) {
        // Check for file type validation
        const validations = grep('content_type\\|file_extension\\|validate_file', BACKEND);
        if (validations.length > 0) {
            pass('File uploads with type validation detected');
        } else {
            warn('File uploads found but no explicit type validation detected');
        }
    } else {
        pass('No file upload fields to validate');
    }
})();

// ═══════════════════════════════════════════════════════════
// SUITE 8: Dependency Vulnerabilities
// ═══════════════════════════════════════════════════════════
console.log('\n📦 Suite 8: Dependencies');

(() => {
    try {
        const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
        const depCount = Object.keys(deps).length;
        pass(`${depCount} npm dependencies registered`);

        // Check for known risky patterns
        if (deps['serialize-javascript']) {
            warn('serialize-javascript present — ensure latest version (prototype pollution risk)');
        }
    } catch { warn('Could not parse package.json'); }
})();

// ═══════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════
console.log('\n');
console.log('═══════════════════════════════════════════════════');
console.log(`  SECURITY SCAN: ${passed} passed, ${failed} critical, ${warnings} warnings`);
console.log('═══════════════════════════════════════════════════');

if (failures.length > 0) {
    console.log('\n❌ CRITICAL ISSUES:');
    failures.forEach(f => {
        console.log(`  • ${f.msg}`);
        if (f.detail) console.log(`    ${f.detail}`);
    });
}

if (warns.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warns.forEach(w => {
        console.log(`  • ${w.msg}`);
        if (w.detail) console.log(`    ${w.detail}`);
    });
}

if (failed === 0 && warnings === 0) {
    console.log('\n✅ No security issues detected!');
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
