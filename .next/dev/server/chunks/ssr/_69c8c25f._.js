module.exports = [
"[project]/src/lib/db.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
// Get DATABASE_URL with fallback for build time
const getDatabaseUrl = ()=>{
    // During build, use a dummy URL if DATABASE_URL is not set
    // This prevents build errors on Hostinger
    if (!process.env.DATABASE_URL) {
        console.warn('[Prisma] DATABASE_URL not found, using fallback for build');
        return 'file:./dev.db';
    }
    return process.env.DATABASE_URL;
};
const prisma = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: ("TURBOPACK compile-time truthy", 1) ? [
        'error',
        'warn'
    ] : "TURBOPACK unreachable",
    // Query timeout configuration for Hostinger shared hosting
    datasources: {
        db: {
            url: getDatabaseUrl()
        }
    }
});
// Connection pool timeout management
// Note: SQLite doesn't support connection pooling, but MySQL does
// When you migrate to MySQL, these settings will take effect
if ("TURBOPACK compile-time truthy", 1) {
    globalForPrisma.prisma = prisma;
}
// Graceful shutdown
if ("TURBOPACK compile-time truthy", 1) {
    process.on('beforeExit', async ()=>{
        await prisma.$disconnect();
    });
}
}),
"[project]/src/app/actions/inventory.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"40ce637e5c9ae44c7465461ac81cec813aa9330517":"deleteUnit","6039a627cd5099fe581bb5ee21f1edc67d4c7d72ba":"createUnit","70985d21e121d87bd7c0a39d41e9c9168f3c4b6c4e":"updateUnit"},"",""] */ __turbopack_context__.s([
    "createUnit",
    ()=>createUnit,
    "deleteUnit",
    ()=>deleteUnit,
    "updateUnit",
    ()=>updateUnit
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function createUnit(prevState, formData) {
    const name = formData.get('name');
    const code = formData.get('code');
    const baseUnitId = formData.get('baseUnitId') ? parseInt(formData.get('baseUnitId')) : null;
    const conversionFactor = formData.get('conversionFactor') ? parseFloat(formData.get('conversionFactor')) : 1.0;
    // New Fields
    const shortName = formData.get('shortName') || null;
    const type = formData.get('type') || 'COUNT';
    const allowFraction = formData.get('allowFraction') === 'on';
    const needsBalance = formData.get('needsBalance') === 'on';
    let balanceCodeStructure = null;
    if (needsBalance) {
        const itemDigits = formData.get('balanceItemDigits') || '6';
        const intDigits = formData.get('balanceIntDigits') || '3';
        const decDigits = formData.get('balanceDecDigits') || '3';
        balanceCodeStructure = `${itemDigits},${intDigits},${decDigits}`;
    }
    if (!name || name.length < 2) {
        return {
            message: 'Failed to create unit',
            errors: {
                name: [
                    'Name must be at least 2 characters'
                ]
            }
        };
    }
    if (!code) {
        return {
            message: 'Failed to create unit',
            errors: {
                code: [
                    'Code is required'
                ]
            }
        };
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].unit.create({
            data: {
                name,
                code: code.toUpperCase(),
                baseUnitId,
                conversionFactor,
                shortName,
                type,
                allowFraction,
                needsBalance,
                balanceCodeStructure
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/units');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Database Error: Failed to create unit.'
        };
    }
}
async function deleteUnit(id) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].unit.delete({
            where: {
                id
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/units');
        return {
            success: true
        };
    } catch (e) {
        return {
            success: false,
            message: 'Failed to delete unit'
        };
    }
}
async function updateUnit(id, prevState, formData) {
    const name = formData.get('name');
    const code = formData.get('code');
    const conversionFactor = formData.get('conversionFactor') ? parseFloat(formData.get('conversionFactor')) : 1.0;
    const baseUnitId = formData.get('baseUnitId') ? parseInt(formData.get('baseUnitId')) : null;
    // New Fields
    const shortName = formData.get('shortName') || null;
    const type = formData.get('type') || 'COUNT';
    const allowFraction = formData.get('allowFraction') === 'on';
    const needsBalance = formData.get('needsBalance') === 'on';
    let balanceCodeStructure = null;
    if (needsBalance) {
        const itemDigits = formData.get('balanceItemDigits') || '6';
        const intDigits = formData.get('balanceIntDigits') || '3';
        const decDigits = formData.get('balanceDecDigits') || '3';
        balanceCodeStructure = `${itemDigits},${intDigits},${decDigits}`;
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].unit.update({
            where: {
                id
            },
            data: {
                name,
                code: code.toUpperCase(),
                conversionFactor,
                baseUnitId,
                shortName,
                type,
                allowFraction,
                needsBalance,
                balanceCodeStructure
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/units');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Failed to update unit'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createUnit,
    deleteUnit,
    updateUnit
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createUnit, "6039a627cd5099fe581bb5ee21f1edc67d4c7d72ba", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteUnit, "40ce637e5c9ae44c7465461ac81cec813aa9330517", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateUnit, "70985d21e121d87bd7c0a39d41e9c9168f3c4b6c4e", null);
}),
"[project]/.next-internal/server/app/admin/inventory/units/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/inventory.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$inventory$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/inventory.ts [app-rsc] (ecmascript)");
;
;
;
}),
"[project]/.next-internal/server/app/admin/inventory/units/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/inventory.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "40ce637e5c9ae44c7465461ac81cec813aa9330517",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$inventory$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteUnit"],
    "6039a627cd5099fe581bb5ee21f1edc67d4c7d72ba",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$inventory$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createUnit"],
    "70985d21e121d87bd7c0a39d41e9c9168f3c4b6c4e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$inventory$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateUnit"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$inventory$2f$units$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$inventory$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/inventory/units/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/inventory.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$inventory$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/inventory.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_69c8c25f._.js.map