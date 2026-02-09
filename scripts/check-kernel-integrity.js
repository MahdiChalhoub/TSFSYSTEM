const fs = require('fs');
const path = require('path');

const KERNEL_SPACE = path.join(__dirname, '../src/app/(privileged)/(saas)');
const APPROVED_DIRS = [
    '[...slug]', // Next.js catch-all dynamic route
    '[code]',
    'connector',
    'dashboard',
    'health',
    'kernel',       // Kernel version management (core infrastructure)
    'modules',
    'organizations',
    'settings',
    'subscription',
    'subscription-plans',
    'switcher',
    'updates',
    'users',
    'apps' // The Dynamic Mounter
];

console.log('🛡️  Checking Kernel Integrity...');

try {
    const items = fs.readdirSync(KERNEL_SPACE);
    const unapproved = items.filter(item => {
        const fullPath = path.join(KERNEL_SPACE, item);
        return fs.statSync(fullPath).isDirectory() && !APPROVED_DIRS.includes(item);
    });

    if (unapproved.length > 0) {
        console.error('\x1b[31m%s\x1b[0m', '❌ KERNEL POLLUTION DETECTED!');
        console.error('The following directories are not allowed in Kernel Space:');
        unapproved.forEach(dir => console.error(` - ${dir}`));
        console.error('\nPlease move business modules to src/modules/ and use Dynamic Mounting.');
        process.exit(1);
    }

    console.log('\x1b[32m%s\x1b[0m', '✅ Kernel Integrity looks clean (Blanc Engine).');
} catch (err) {
    console.error('Failed to audit kernel space:', err);
    process.exit(1);
}
