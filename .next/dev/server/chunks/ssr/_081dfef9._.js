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
"[project]/src/app/actions/countries.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"40ec7c20f88e3bbc72b164035c7489c840de9ca525":"getCountryHierarchy","60ad29976c0d6bc2ab5bebfd0b5ec4a351b9068588":"createCountry","704cc25a605757d371bfc28aafaffd0b8f3afa765f":"updateCountry"},"",""] */ __turbopack_context__.s([
    "createCountry",
    ()=>createCountry,
    "getCountryHierarchy",
    ()=>getCountryHierarchy,
    "updateCountry",
    ()=>updateCountry
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function createCountry(prevState, formData) {
    const name = formData.get('name');
    const code = formData.get('code');
    if (!name || name.length < 2) {
        return {
            message: 'Failed to create country',
            errors: {
                name: [
                    'Name must be at least 2 characters'
                ]
            }
        };
    }
    if (!code || code.length < 2) {
        return {
            message: 'Failed to create country',
            errors: {
                code: [
                    'Code must be valid (e.g. TR)'
                ]
            }
        };
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].country.create({
            data: {
                name,
                code: code.toUpperCase()
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/countries');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Database Error: Failed to create country.'
        };
    }
}
async function updateCountry(id, prevState, formData) {
    const name = formData.get('name');
    const code = formData.get('code');
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].country.update({
            where: {
                id
            },
            data: {
                name,
                code: code.toUpperCase()
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/countries');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Failed to update country'
        };
    }
}
async function getCountryHierarchy(countryId) {
    const brands = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findMany({
        where: {
            products: {
                some: {
                    countryId
                }
            }
        },
        select: {
            id: true,
            name: true,
            logo: true,
            products: {
                where: {
                    countryId
                },
                select: {
                    id: true,
                    name: true,
                    size: true,
                    sku: true,
                    unit: {
                        select: {
                            name: true
                        }
                    },
                    inventory: {
                        select: {
                            quantity: true
                        }
                    }
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });
    return brands.map((b)=>{
        // Convert Decimal to Number for serialization
        const productsWithStock = b.products.map((p)=>({
                ...p,
                size: p.size ? Number(p.size) : null,
                stock: p.inventory.reduce((sum, inv)=>sum + Number(inv.quantity), 0)
            }));
        return {
            ...b,
            products: productsWithStock,
            totalStock: productsWithStock.reduce((sum, p)=>sum + p.stock, 0)
        };
    });
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createCountry,
    updateCountry,
    getCountryHierarchy
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createCountry, "60ad29976c0d6bc2ab5bebfd0b5ec4a351b9068588", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateCountry, "704cc25a605757d371bfc28aafaffd0b8f3afa765f", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getCountryHierarchy, "40ec7c20f88e3bbc72b164035c7489c840de9ca525", null);
}),
"[project]/.next-internal/server/app/admin/inventory/countries/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/countries.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$countries$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/countries.ts [app-rsc] (ecmascript)");
;
;
;
}),
"[project]/.next-internal/server/app/admin/inventory/countries/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/countries.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "40ec7c20f88e3bbc72b164035c7489c840de9ca525",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$countries$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCountryHierarchy"],
    "60ad29976c0d6bc2ab5bebfd0b5ec4a351b9068588",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$countries$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createCountry"],
    "704cc25a605757d371bfc28aafaffd0b8f3afa765f",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$countries$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateCountry"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$inventory$2f$countries$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$countries$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/inventory/countries/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/countries.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$countries$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/countries.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_081dfef9._.js.map