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
"[project]/src/app/actions/categories.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"008e75a48f61f72abdc0c98de51a85a4a419794543":"getCategoryWithCounts","402980a56eb64ebd4c657ce3f4364610767cf3e5c6":"deleteCategory","609bf24031c32c3cdc96cdc4e39ab990eefbf5cc02":"moveProducts","60c2de21ea56ebed45997f824e60b731a966f6174a":"createCategory","70a8e0fe6b308f732c73fdd83d6e97bdb7b7d7a6e7":"updateCategory"},"",""] */ __turbopack_context__.s([
    "createCategory",
    ()=>createCategory,
    "deleteCategory",
    ()=>deleteCategory,
    "getCategoryWithCounts",
    ()=>getCategoryWithCounts,
    "moveProducts",
    ()=>moveProducts,
    "updateCategory",
    ()=>updateCategory
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function createCategory(prevState, formData) {
    const name = formData.get('name');
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId')) : null;
    const code = formData.get('code') || null;
    const shortName = formData.get('shortName') || null;
    if (!name || name.length < 2) {
        return {
            message: 'Failed to create category',
            errors: {
                name: [
                    'Name must be at least 2 characters'
                ]
            }
        };
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.create({
            data: {
                name,
                parentId,
                code,
                shortName
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/categories');
        return {
            message: 'success'
        };
    } catch (e) {
        if (e.code === 'P2002') {
            return {
                message: 'Category code must be unique'
            };
        }
        return {
            message: 'Failed to create category'
        };
    }
}
async function updateCategory(id, prevState, formData) {
    const name = formData.get('name');
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId')) : null;
    const code = formData.get('code') || null;
    const shortName = formData.get('shortName') || null;
    try {
        // Prevent setting parent to itself
        if (parentId === id) {
            return {
                message: 'Category cannot be its own parent'
            };
        }
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.update({
            where: {
                id
            },
            data: {
                name,
                parentId,
                code,
                shortName
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/categories');
        return {
            message: 'success'
        };
    } catch (e) {
        if (e.code === 'P2002') {
            return {
                message: 'Category code must be unique'
            };
        }
        return {
            message: 'Failed to update category'
        };
    }
}
async function deleteCategory(id) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.delete({
            where: {
                id
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/categories');
        return {
            success: true
        };
    } catch (e) {
        return {
            success: false,
            message: 'Failed to delete category'
        };
    }
}
async function getCategoryWithCounts() {
    return await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.findMany({
        orderBy: {
            name: 'asc'
        },
        include: {
            _count: {
                select: {
                    products: true
                }
            }
        }
    });
}
async function moveProducts(productIds, targetCategoryId) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.updateMany({
            where: {
                id: {
                    in: productIds
                }
            },
            data: {
                categoryId: targetCategoryId
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/categories/maintenance');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/categories'); // Update main list too
        return {
            success: true
        };
    } catch (e) {
        console.error('Move products error:', e);
        return {
            success: false,
            message: 'Failed to move products'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryWithCounts,
    moveProducts
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createCategory, "60c2de21ea56ebed45997f824e60b731a966f6174a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateCategory, "70a8e0fe6b308f732c73fdd83d6e97bdb7b7d7a6e7", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteCategory, "402980a56eb64ebd4c657ce3f4364610767cf3e5c6", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getCategoryWithCounts, "008e75a48f61f72abdc0c98de51a85a4a419794543", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(moveProducts, "609bf24031c32c3cdc96cdc4e39ab990eefbf5cc02", null);
}),
"[project]/.next-internal/server/app/admin/inventory/categories/maintenance/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/categories.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/categories.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
}),
"[project]/.next-internal/server/app/admin/inventory/categories/maintenance/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/categories.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "008e75a48f61f72abdc0c98de51a85a4a419794543",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCategoryWithCounts"],
    "402980a56eb64ebd4c657ce3f4364610767cf3e5c6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteCategory"],
    "609bf24031c32c3cdc96cdc4e39ab990eefbf5cc02",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["moveProducts"],
    "60c2de21ea56ebed45997f824e60b731a966f6174a",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createCategory"],
    "70a8e0fe6b308f732c73fdd83d6e97bdb7b7d7a6e7",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateCategory"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$inventory$2f$categories$2f$maintenance$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/inventory/categories/maintenance/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/categories.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$categories$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/categories.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_a54e8652._.js.map