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
"[project]/src/app/actions/maintenance.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"4042ed5158c8de1d12874a62fc1186b6f4095ecbfd":"getMaintenanceEntities","703412220d3ddbe8446c4668217aa5ecf32c9e05d5":"moveProductsGeneric"},"",""] */ __turbopack_context__.s([
    "getMaintenanceEntities",
    ()=>getMaintenanceEntities,
    "moveProductsGeneric",
    ()=>moveProductsGeneric
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function getMaintenanceEntities(type) {
    if (type === 'category') {
        const categories = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.findMany({
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        // Build Tree
        const map = new Map();
        const roots = [];
        categories.forEach((c)=>map.set(c.id, {
                ...c,
                count: c._count.products,
                children: []
            }));
        categories.forEach((c)=>{
            if (c.parentId) {
                map.get(c.parentId)?.children.push(map.get(c.id));
            } else {
                roots.push(map.get(c.id));
            }
        });
        return JSON.parse(JSON.stringify(roots));
    }
    if (type === 'brand') {
        const brands = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findMany({
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        return brands.map((b)=>({
                id: b.id,
                name: b.name,
                count: b._count.products,
                shortName: b.shortName
            }));
    }
    if (type === 'unit') {
        const units = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].unit.findMany({
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        return units.map((u)=>({
                id: u.id,
                name: u.name,
                count: u._count.products,
                shortName: u.shortName,
                type: u.type
            }));
    }
    if (type === 'attribute') {
        const attributes = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.findMany({
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        return attributes.map((a)=>({
                id: a.id,
                name: a.name,
                count: a._count.products,
                shortName: a.shortName
            }));
    }
    if (type === 'country') {
        const countries = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].country.findMany({
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        return countries.map((c)=>({
                id: c.id,
                name: c.name,
                count: c._count.products,
                code: c.code
            }));
    }
    return [];
}
async function moveProductsGeneric(productIds, targetId, type) {
    try {
        // --- VALIDATION PHASE ---
        // 1. Brand Validity (Moving TO a Brand)
        if (type === 'brand') {
            const targetBrand = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findUnique({
                where: {
                    id: targetId
                },
                include: {
                    countries: true
                }
            });
            if (targetBrand && targetBrand.countries.length > 0) {
                // Brand is restricted to specific countries
                const products = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.findMany({
                    where: {
                        id: {
                            in: productIds
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        countryId: true,
                        country: {
                            select: {
                                name: true
                            }
                        }
                    }
                });
                const invalidProducts = products.filter((p)=>p.countryId && !targetBrand.countries.some((c)=>c.id === p.countryId));
                if (invalidProducts.length > 0) {
                    const names = invalidProducts.slice(0, 3).map((p)=>p.name).join(', ');
                    return {
                        success: false,
                        message: `Validation Failed: Brand '${targetBrand.name}' does not operate in the countries of selected products (${names}${invalidProducts.length > 3 ? '...' : ''}).`
                    };
                }
            }
        }
        // 2. Country Validity (Moving TO a Country)
        if (type === 'country') {
            const products = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.findMany({
                where: {
                    id: {
                        in: productIds
                    }
                },
                include: {
                    brand: {
                        include: {
                            countries: true
                        }
                    }
                }
            });
            const invalidProducts = products.filter((p)=>{
                if (!p.brand || !p.brand.countries || p.brand.countries.length === 0) return false; // Global brand
                return !p.brand.countries.some((c)=>c.id === targetId);
            });
            if (invalidProducts.length > 0) {
                const names = invalidProducts.slice(0, 3).map((p)=>p.name).join(', ');
                return {
                    success: false,
                    message: `Validation Failed: The Brand of products (${names}...) does not support the selected Country.`
                };
            }
        }
        // 3. Attribute/Parfum Validity (Moving TO an Attribute)
        if (type === 'attribute') {
            const targetAttribute = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.findUnique({
                where: {
                    id: targetId
                },
                include: {
                    categories: true
                }
            });
            if (targetAttribute && targetAttribute.categories.length > 0) {
                // Attribute is restricted to specific categories
                const products = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.findMany({
                    where: {
                        id: {
                            in: productIds
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        categoryId: true
                    }
                });
                const invalidProducts = products.filter((p)=>p.categoryId && !targetAttribute.categories.some((c)=>c.id === p.categoryId));
                if (invalidProducts.length > 0) {
                    const names = invalidProducts.slice(0, 3).map((p)=>p.name).join(', ');
                    return {
                        success: false,
                        message: `Validation Failed: Attribute '${targetAttribute.name}' is not compatible with the Category of selected products (${names}...).`
                    };
                }
            }
        }
        // --- EXECUTION PHASE ---
        const data = {};
        if (type === 'category') data.categoryId = targetId;
        if (type === 'brand') data.brandId = targetId;
        if (type === 'unit') data.unitId = targetId;
        if (type === 'country') data.countryId = targetId;
        if (type === 'attribute') data.parfumId = targetId;
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.updateMany({
            where: {
                id: {
                    in: productIds
                }
            },
            data
        });
        // Revalidate basically everything to be safe
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products');
        return {
            success: true,
            message: `Successfully moved ${productIds.length} products.`
        };
    } catch (error) {
        console.error('Bulk Move Error:', error);
        return {
            success: false,
            message: 'Failed to move products.'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getMaintenanceEntities,
    moveProductsGeneric
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getMaintenanceEntities, "4042ed5158c8de1d12874a62fc1186b6f4095ecbfd", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(moveProductsGeneric, "703412220d3ddbe8446c4668217aa5ecf32c9e05d5", null);
}),
"[project]/.next-internal/server/app/admin/inventory/maintenance/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/maintenance.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$maintenance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/maintenance.ts [app-rsc] (ecmascript)");
;
;
;
}),
"[project]/.next-internal/server/app/admin/inventory/maintenance/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/maintenance.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "4042ed5158c8de1d12874a62fc1186b6f4095ecbfd",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$maintenance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getMaintenanceEntities"],
    "703412220d3ddbe8446c4668217aa5ecf32c9e05d5",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$maintenance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["moveProductsGeneric"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$inventory$2f$maintenance$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$maintenance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/inventory/maintenance/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/maintenance.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$maintenance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/maintenance.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_d9ad2a5a._.js.map