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
"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"409714094e6ebe47cc2f212977bed6c0295d53f040":"getBrandsByCategory","409e9958d6c0755814323016895c6cdc031c87dfd8":"getBrandHierarchy","607787aeb5cedbf4484aa0ff10850b99e970c18dec":"createBrand","70ee33d3cfe76c1ba392b8fa27bbc51275c6f139b5":"updateBrand"},"",""] */ __turbopack_context__.s([
    "createBrand",
    ()=>createBrand,
    "getBrandHierarchy",
    ()=>getBrandHierarchy,
    "getBrandsByCategory",
    ()=>getBrandsByCategory,
    "updateBrand",
    ()=>updateBrand
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function createBrand(prevState, formData) {
    const name = formData.get('name');
    const shortName = formData.get('shortName');
    const countryIds = formData.getAll('countryIds').map((id)=>Number(id));
    const categoryIds = formData.getAll('categoryIds').map((id)=>Number(id));
    if (!name || name.length < 2) {
        return {
            message: 'Failed to create brand',
            errors: {
                name: [
                    'Name must be at least 2 characters'
                ]
            }
        };
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.create({
            data: {
                name,
                shortName,
                countries: {
                    connect: countryIds.map((id)=>({
                            id
                        }))
                },
                categories: {
                    connect: categoryIds.map((id)=>({
                            id
                        }))
                }
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/brands');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Database Error: Failed to create brand.'
        };
    }
}
async function updateBrand(id, prevState, formData) {
    const name = formData.get('name');
    const shortName = formData.get('shortName');
    const countryIds = formData.getAll('countryIds').map((id)=>Number(id));
    const categoryIds = formData.getAll('categoryIds').map((id)=>Number(id));
    try {
        // For implicit M-N, we can use set: [{id:1}, {id:2}] to replace.
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.update({
            where: {
                id
            },
            data: {
                name,
                shortName,
                countries: {
                    set: countryIds.map((id)=>({
                            id
                        }))
                },
                categories: {
                    set: categoryIds.map((id)=>({
                            id
                        }))
                }
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/brands');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/countries'); // Update country view too
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Failed to update brand'
        };
    }
}
async function getBrandsByCategory(categoryId) {
    // If no category selected, return all brands
    if (!categoryId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findMany({
            orderBy: {
                name: 'asc'
            },
            select: {
                id: true,
                name: true,
                shortName: true
            }
        });
    }
    // Get the category with its parent hierarchy
    const category = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.findUnique({
        where: {
            id: categoryId
        },
        select: {
            id: true,
            parentId: true
        }
    });
    if (!category) {
        return [];
    }
    // Build array of category IDs to check (self + all parents)
    const categoryIdsToCheck = [
        category.id
    ];
    let currentParentId = category.parentId;
    // Walk up the parent tree
    while(currentParentId){
        categoryIdsToCheck.push(currentParentId);
        const parent = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.findUnique({
            where: {
                id: currentParentId
            },
            select: {
                parentId: true
            }
        });
        currentParentId = parent?.parentId || null;
    }
    // Get brands that match criteria
    const brands = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findMany({
        where: {
            OR: [
                // Universal brands (no categories linked)
                {
                    categories: {
                        none: {}
                    }
                },
                // Brands linked to this category or its parents
                {
                    categories: {
                        some: {
                            id: {
                                in: categoryIdsToCheck
                            }
                        }
                    }
                }
            ]
        },
        orderBy: {
            name: 'asc'
        },
        select: {
            id: true,
            name: true,
            shortName: true,
            categories: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });
    return brands;
}
async function getBrandHierarchy(brandId) {
    try {
        const brand = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findUnique({
            where: {
                id: brandId
            },
            include: {
                productGroups: {
                    include: {
                        products: {
                            include: {
                                country: true,
                                inventory: true,
                                unit: true
                            }
                        }
                    }
                },
                products: {
                    where: {
                        productGroupId: null
                    },
                    include: {
                        country: true,
                        inventory: true,
                        unit: true
                    }
                }
            }
        });
        if (!brand) return null;
        return {
            groups: brand.productGroups.map((g)=>({
                    id: g.id,
                    name: g.name,
                    products: g.products.map((p)=>({
                            id: p.id,
                            name: p.name,
                            sku: p.sku,
                            countryName: p.country?.name,
                            size: Number(p.size),
                            unitName: p.unit?.shortName,
                            stock: p.inventory.reduce((a, b)=>a + Number(b.quantity), 0)
                        })),
                    totalStock: g.products.reduce((acc, p)=>acc + p.inventory.reduce((a, b)=>a + Number(b.quantity), 0), 0)
                })),
            looseProducts: brand.products.map((p)=>({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    countryName: p.country?.name,
                    size: Number(p.size),
                    unitName: p.unit?.shortName,
                    stock: p.inventory.reduce((a, b)=>a + Number(b.quantity), 0)
                }))
        };
    } catch (e) {
        console.error("Error fetching hierarchy:", e);
        return null;
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createBrand,
    updateBrand,
    getBrandsByCategory,
    getBrandHierarchy
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createBrand, "607787aeb5cedbf4484aa0ff10850b99e970c18dec", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBrand, "70ee33d3cfe76c1ba392b8fa27bbc51275c6f139b5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBrandsByCategory, "409714094e6ebe47cc2f212977bed6c0295d53f040", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBrandHierarchy, "409e9958d6c0755814323016895c6cdc031c87dfd8", null);
}),
"[project]/.next-internal/server/app/admin/inventory/brands/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)");
;
;
;
}),
"[project]/.next-internal/server/app/admin/inventory/brands/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "409e9958d6c0755814323016895c6cdc031c87dfd8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBrandHierarchy"],
    "607787aeb5cedbf4484aa0ff10850b99e970c18dec",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createBrand"],
    "70ee33d3cfe76c1ba392b8fa27bbc51275c6f139b5",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBrand"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$inventory$2f$brands$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/inventory/brands/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_68f7a5c7._.js.map