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
"[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00308599bb38e7cc4d26aa5ac5dd078e321cd5b87c":"getAttributes","404acc875d246d504e68a98dad4a192c23bf4923bf":"getAttributesByCategory","40cfdef511bf9624674c2f5565dc91f5ba4bdb80fd":"getAttributeHierarchy","60e0ced4f753c2784485dbd8d54a834cbbd78b18c5":"createAttribute","70e5192e73955a7e91ce94ba814c68ccc375221106":"updateAttribute","70f1f3f1ce4b2439d7200b77ab401bae103b542935":"deleteAttribute"},"",""] */ __turbopack_context__.s([
    "createAttribute",
    ()=>createAttribute,
    "deleteAttribute",
    ()=>deleteAttribute,
    "getAttributeHierarchy",
    ()=>getAttributeHierarchy,
    "getAttributes",
    ()=>getAttributes,
    "getAttributesByCategory",
    ()=>getAttributesByCategory,
    "updateAttribute",
    ()=>updateAttribute
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function getAttributes() {
    return await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.findMany({
        include: {
            categories: true,
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
}
async function createAttribute(prevState, formData) {
    const name = formData.get('name');
    const shortName = formData.get('shortName');
    const categoryIds = formData.getAll('categoryIds').map((id)=>Number(id));
    if (!name || name.length < 2) {
        return {
            message: 'Failed to create attribute',
            errors: {
                name: [
                    'Name must be at least 2 characters'
                ]
            }
        };
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.create({
            data: {
                name,
                shortName: shortName || null,
                categories: {
                    connect: categoryIds.map((id)=>({
                            id
                        }))
                }
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/attributes');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Database Error: Failed to create attribute.'
        };
    }
}
async function updateAttribute(id, prevState, formData) {
    const name = formData.get('name');
    const shortName = formData.get('shortName');
    const categoryIds = formData.getAll('categoryIds').map((id)=>Number(id));
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.update({
            where: {
                id
            },
            data: {
                name,
                shortName: shortName || null,
                categories: {
                    set: categoryIds.map((id)=>({
                            id
                        }))
                }
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/attributes');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Failed to update attribute'
        };
    }
}
async function deleteAttribute(id, prevState, formData) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.delete({
            where: {
                id
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/attributes');
        return {
            message: 'success'
        };
    } catch (e) {
        return {
            message: 'Failed to delete attribute. It may be in use.'
        };
    }
}
async function getAttributesByCategory(categoryId) {
    if (!categoryId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.findMany({
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
    if (!category) return [];
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
    // Get attributes that match criteria
    const attributes = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.findMany({
        where: {
            OR: [
                // Universal attributes (no categories linked)
                {
                    categories: {
                        none: {}
                    }
                },
                // Attributes linked to this category or its parents
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
    return attributes;
}
async function getAttributeHierarchy(parfumId) {
    const brands = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findMany({
        where: {
            products: {
                some: {
                    parfumId
                }
            }
        },
        select: {
            id: true,
            name: true,
            logo: true,
            products: {
                where: {
                    parfumId
                },
                select: {
                    id: true,
                    name: true,
                    size: true,
                    sku: true,
                    country: {
                        select: {
                            name: true,
                            code: true
                        }
                    },
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
    if (!brands) return [];
    return brands.map((b)=>{
        // Fix Decimal serialization for size
        const productsWithStock = b.products.map((p)=>({
                ...p,
                size: p.size ? Number(p.size) : null,
                stock: p.inventory.reduce((sum, inv)=>sum + Number(inv.quantity), 0)
            }));
        return {
            id: b.id,
            name: b.name,
            logo: b.logo,
            products: productsWithStock,
            totalStock: productsWithStock.reduce((sum, p)=>sum + p.stock, 0)
        };
    });
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getAttributes,
    createAttribute,
    updateAttribute,
    deleteAttribute,
    getAttributesByCategory,
    getAttributeHierarchy
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAttributes, "00308599bb38e7cc4d26aa5ac5dd078e321cd5b87c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createAttribute, "60e0ced4f753c2784485dbd8d54a834cbbd78b18c5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateAttribute, "70e5192e73955a7e91ce94ba814c68ccc375221106", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteAttribute, "70f1f3f1ce4b2439d7200b77ab401bae103b542935", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAttributesByCategory, "404acc875d246d504e68a98dad4a192c23bf4923bf", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAttributeHierarchy, "40cfdef511bf9624674c2f5565dc91f5ba4bdb80fd", null);
}),
"[project]/.next-internal/server/app/admin/inventory/attributes/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
}),
"[project]/.next-internal/server/app/admin/inventory/attributes/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "00308599bb38e7cc4d26aa5ac5dd078e321cd5b87c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAttributes"],
    "404acc875d246d504e68a98dad4a192c23bf4923bf",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAttributesByCategory"],
    "40cfdef511bf9624674c2f5565dc91f5ba4bdb80fd",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAttributeHierarchy"],
    "60e0ced4f753c2784485dbd8d54a834cbbd78b18c5",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createAttribute"],
    "70e5192e73955a7e91ce94ba814c68ccc375221106",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateAttribute"],
    "70f1f3f1ce4b2439d7200b77ab401bae103b542935",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteAttribute"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$inventory$2f$attributes$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/inventory/attributes/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_40017ece._.js.map