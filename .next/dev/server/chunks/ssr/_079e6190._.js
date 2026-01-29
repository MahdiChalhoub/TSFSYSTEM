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
"[project]/src/app/actions/settings.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00a807184c497eeda9c5e8cf6990b6a6e4c89a0c88":"getProductNamingRule","402b2083a724232a7d5b2af74dd31fd492a1eb67e8":"saveProductNamingRule"},"",""] */ __turbopack_context__.s([
    "getProductNamingRule",
    ()=>getProductNamingRule,
    "saveProductNamingRule",
    ()=>saveProductNamingRule
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
const DEFAULT_NAMING_RULE = {
    components: [
        {
            id: 'category',
            label: 'Category',
            enabled: true,
            useShortName: true
        },
        {
            id: 'brand',
            label: 'Brand',
            enabled: true,
            useShortName: true
        },
        {
            id: 'family',
            label: 'Family',
            enabled: true,
            useShortName: false
        },
        {
            id: 'emballage',
            label: 'Emballage',
            enabled: true,
            useShortName: true
        },
        {
            id: 'country',
            label: 'Country',
            enabled: true,
            useShortName: true
        }
    ],
    separator: ' '
};
async function getProductNamingRule() {
    const setting = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].systemSettings.findUnique({
        where: {
            key: 'product_naming_rule'
        }
    });
    if (!setting) {
        return DEFAULT_NAMING_RULE;
    }
    try {
        return JSON.parse(setting.value);
    } catch  {
        return DEFAULT_NAMING_RULE;
    }
}
async function saveProductNamingRule(rule) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].systemSettings.upsert({
        where: {
            key: 'product_naming_rule'
        },
        update: {
            value: JSON.stringify(rule)
        },
        create: {
            key: 'product_naming_rule',
            value: JSON.stringify(rule)
        }
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/settings');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products/new');
    return {
        success: true
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getProductNamingRule,
    saveProductNamingRule
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getProductNamingRule, "00a807184c497eeda9c5e8cf6990b6a6e4c89a0c88", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(saveProductNamingRule, "402b2083a724232a7d5b2af74dd31fd492a1eb67e8", null);
}),
"[project]/src/app/admin/products/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"60ff500afa3acb861f398fb73f4eaae81e10821e6e":"createProduct"},"",""] */ __turbopack_context__.s([
    "createProduct",
    ()=>createProduct
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
// Validation Schema
const productSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(2, "Name must be at least 2 characters"),
    description: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
    sku: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(3, "SKU is required"),
    barcode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
    categoryId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().optional(),
    unitId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().optional(),
    brandId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().optional(),
    countryId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().optional(),
    costPrice: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().min(0),
    basePrice: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().min(0),
    taxRate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().min(0).max(1),
    isTaxIncluded: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean(),
    minStockLevel: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().int().min(0),
    isExpiryTracked: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean()
});
async function createProduct(prevState, formData) {
    // 1. Extract Data
    const rawData = {
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        sku: formData.get('sku'),
        barcode: formData.get('barcode'),
        categoryId: formData.get('categoryId') || undefined,
        unitId: formData.get('unitId') || undefined,
        brandId: formData.get('brandId') || undefined,
        countryId: formData.get('countryId') || undefined,
        size: formData.get('size') || undefined,
        sizeUnitId: formData.get('sizeUnitId') || undefined,
        costPrice: formData.get('costPrice') || 0,
        basePrice: formData.get('basePrice') || 0,
        taxRate: formData.get('taxRate') || 0,
        isTaxIncluded: formData.get('isTaxIncluded') === 'on',
        minStockLevel: formData.get('minStockLevel') || 0,
        isExpiryTracked: formData.get('isExpiryTracked') === 'on'
    };
    // 2. Validate
    const validatedFields = productSchema.extend({
        size: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().optional(),
        sizeUnitId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].coerce.number().optional()
    }).safeParse(rawData);
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Product.'
        };
    }
    const { data } = validatedFields;
    try {
        // 3. Check Uniqueness
        const existingSku = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.findUnique({
            where: {
                sku: data.sku
            }
        });
        if (existingSku) {
            return {
                message: 'SKU already exists. Please use a unique SKU.'
            };
        }
        // --- Auto-Grouping Logic (Brand + Family) ---
        // Family (stored as Parfum in DB) is a product attribute that groups variants
        const parfumName = formData.get('parfumName'); // Form field name kept for compatibility
        let parfumId = null;
        let productGroupId = null;
        if (parfumName && data.brandId) {
            // A. Upsert Parfum
            const parfum = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.upsert({
                where: {
                    name: parfumName
                },
                update: {
                    categories: data.categoryId ? {
                        connect: {
                            id: data.categoryId
                        }
                    } : undefined
                },
                create: {
                    name: parfumName,
                    categories: data.categoryId ? {
                        connect: {
                            id: data.categoryId
                        }
                    } : undefined
                }
            });
            parfumId = parfum.id;
            // B. Find or Create Group
            const existingGroup = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].productGroup.findFirst({
                where: {
                    brandId: data.brandId,
                    parfumId: parfum.id
                }
            });
            if (existingGroup) {
                productGroupId = existingGroup.id;
            } else {
                const brand = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].brand.findUnique({
                    where: {
                        id: data.brandId
                    }
                });
                const groupName = `${brand?.name || ''} ${parfumName}`.trim();
                const newGroup = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].productGroup.create({
                    data: {
                        name: groupName,
                        brandId: data.brandId,
                        parfumId: parfum.id,
                        categoryId: data.categoryId,
                        description: `Auto-generated group via ${parfumName}`
                    }
                });
                productGroupId = newGroup.id;
            }
        }
        // 4. Create in DB
        const product = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.create({
            data: {
                name: data.name,
                description: data.description,
                sku: data.sku,
                barcode: data.barcode || null,
                categoryId: data.categoryId || null,
                unitId: data.unitId || null,
                brandId: data.brandId || null,
                countryId: data.countryId || null,
                size: data.size,
                sizeUnitId: data.sizeUnitId,
                parfumId: parfumId,
                productGroupId: productGroupId,
                costPrice: data.costPrice,
                basePrice: data.basePrice,
                taxRate: data.taxRate,
                isTaxIncluded: data.isTaxIncluded,
                minStockLevel: data.minStockLevel,
                isExpiryTracked: data.isExpiryTracked
            }
        });
        // 5. Post-Create: Auto-Generate Barcode if missing
        if (!data.barcode && data.categoryId) {
            const category = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].category.findUnique({
                where: {
                    id: data.categoryId
                }
            });
            if (category && category.code) {
                // Format: CATCODE-PRODUCTID (e.g. C001-55)
                const autoBarcode = `${category.code}-${product.id.toString().padStart(4, '0')}`;
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.update({
                    where: {
                        id: product.id
                    },
                    data: {
                        barcode: autoBarcode
                    }
                });
            }
        }
    } catch (e) {
        console.error(e);
        return {
            message: 'Database Error: Failed to Create Product.'
        };
    }
    // 6. Revalidate & Redirect
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])('/admin/products');
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createProduct
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createProduct, "60ff500afa3acb861f398fb73f4eaae81e10821e6e", null);
}),
"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"409714094e6ebe47cc2f212977bed6c0295d53f040":"getBrandsByCategory","607787aeb5cedbf4484aa0ff10850b99e970c18dec":"createBrand","70ee33d3cfe76c1ba392b8fa27bbc51275c6f139b5":"updateBrand"},"",""] */ __turbopack_context__.s([
    "createBrand",
    ()=>createBrand,
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
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createBrand,
    updateBrand,
    getBrandsByCategory
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createBrand, "607787aeb5cedbf4484aa0ff10850b99e970c18dec", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBrand, "70ee33d3cfe76c1ba392b8fa27bbc51275c6f139b5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBrandsByCategory, "409714094e6ebe47cc2f212977bed6c0295d53f040", null);
}),
"[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00308599bb38e7cc4d26aa5ac5dd078e321cd5b87c":"getAttributes","404acc875d246d504e68a98dad4a192c23bf4923bf":"getAttributesByCategory","60e0ced4f753c2784485dbd8d54a834cbbd78b18c5":"createAttribute","70e5192e73955a7e91ce94ba814c68ccc375221106":"updateAttribute"},"",""] */ __turbopack_context__.s([
    "createAttribute",
    ()=>createAttribute,
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
    return await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].parfum.findMany({
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
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getAttributes,
    createAttribute,
    updateAttribute,
    getAttributesByCategory
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAttributes, "00308599bb38e7cc4d26aa5ac5dd078e321cd5b87c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createAttribute, "60e0ced4f753c2784485dbd8d54a834cbbd78b18c5", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateAttribute, "70e5192e73955a7e91ce94ba814c68ccc375221106", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAttributesByCategory, "404acc875d246d504e68a98dad4a192c23bf4923bf", null);
}),
"[project]/.next-internal/server/app/admin/products/new/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/settings.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/app/admin/products/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/settings.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$admin$2f$products$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/admin/products/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)");
;
;
;
;
;
}),
"[project]/.next-internal/server/app/admin/products/new/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/settings.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/app/admin/products/actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "00a807184c497eeda9c5e8cf6990b6a6e4c89a0c88",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProductNamingRule"],
    "402b2083a724232a7d5b2af74dd31fd492a1eb67e8",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["saveProductNamingRule"],
    "404acc875d246d504e68a98dad4a192c23bf4923bf",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAttributesByCategory"],
    "409714094e6ebe47cc2f212977bed6c0295d53f040",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBrandsByCategory"],
    "60ff500afa3acb861f398fb73f4eaae81e10821e6e",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$admin$2f$products$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createProduct"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$products$2f$new$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$app$2f$admin$2f$products$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/products/new/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/settings.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/app/admin/products/actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/settings.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$admin$2f$products$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/admin/products/actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$attributes$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/attributes.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_079e6190._.js.map