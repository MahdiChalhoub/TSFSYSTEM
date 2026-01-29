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
"[project]/src/app/actions/product-groups.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"6071072402571cbfc8d3ca0f9a66f7988ebb22acba":"updateProductGroup","608038562b22c4f82c07102bc2eb7e8e1470bc029c":"createProductGroupWithVariants","60cdc99283959808de788cc718d3d993a12ec2ad1e":"linkProductsToGroup","60f2830be8313d3a1f0552b69b7ec7847d5c7aa18e":"createGroupFromProducts"},"",""] */ __turbopack_context__.s([
    "createGroupFromProducts",
    ()=>createGroupFromProducts,
    "createProductGroupWithVariants",
    ()=>createProductGroupWithVariants,
    "linkProductsToGroup",
    ()=>linkProductsToGroup,
    "updateProductGroup",
    ()=>updateProductGroup
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function createProductGroupWithVariants(prevState, data) {
    const { name, brandId, categoryId, description, baseUnitId, variants } = data;
    if (!name || variants.length === 0) {
        return {
            message: "Name and at least one variant are required."
        };
    }
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
            const group = await tx.productGroup.create({
                data: {
                    name,
                    brandId,
                    categoryId,
                    description
                }
            });
            for (const v of variants){
                await tx.product.create({
                    data: {
                        name: `${name}`,
                        productGroupId: group.id,
                        brandId,
                        categoryId,
                        unitId: baseUnitId,
                        countryId: v.countryId,
                        sku: v.sku,
                        barcode: v.barcode,
                        size: v.size,
                        sizeUnitId: v.sizeUnitId,
                        costPrice: v.costPrice,
                        basePrice: v.basePrice,
                        minStockLevel: v.minStockLevel || 0,
                        isTaxIncluded: true
                    }
                });
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products');
        return {
            message: 'success'
        };
    } catch (e) {
        console.error(e);
        return {
            message: e.message || 'Failed to create product group.'
        };
    }
}
async function updateProductGroup(prevState, data) {
    const { groupId, name, brandId, categoryId, description, baseUnitId, variants } = data;
    if (!groupId || !name) return {
        message: "Group ID and Name are required."
    };
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
            // 1. Update Group
            await tx.productGroup.update({
                where: {
                    id: groupId
                },
                data: {
                    name,
                    brandId,
                    categoryId,
                    description
                }
            });
            // 2. Handle Variants
            // Get existing IDs to detect deletions (optional, for now just upsert/create)
            // Strategy: Loop through input variants.
            // If id exists -> Update.
            // If no id -> Create.
            // (Deletions: Not handling explicit deletion in this pass unless UI requests it, but usually 'save' implies current state. 
            // Better to only process what's sent. Deletion needs explicit 'delete' action or diffing.)
            for (const v of variants){
                if (v.id) {
                    // Update existing
                    await tx.product.update({
                        where: {
                            id: v.id
                        },
                        data: {
                            countryId: v.countryId,
                            sku: v.sku,
                            barcode: v.barcode,
                            size: v.size,
                            sizeUnitId: v.sizeUnitId,
                            costPrice: v.costPrice,
                            basePrice: v.basePrice,
                            unitId: baseUnitId,
                            name: name // Update name if group name changed
                        }
                    });
                } else {
                    // Create new
                    await tx.product.create({
                        data: {
                            name: name,
                            productGroupId: groupId,
                            brandId,
                            categoryId,
                            unitId: baseUnitId,
                            countryId: v.countryId,
                            sku: v.sku,
                            barcode: v.barcode,
                            size: v.size,
                            sizeUnitId: v.sizeUnitId,
                            costPrice: v.costPrice,
                            basePrice: v.basePrice,
                            minStockLevel: v.minStockLevel || 0,
                            isTaxIncluded: true
                        }
                    });
                }
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])(`/admin/inventory/brands/${brandId}`); // Revalidate brand page
        return {
            message: 'success'
        };
    } catch (e) {
        console.error(e);
        return {
            message: e.message || 'Failed to update product group.'
        };
    }
}
async function linkProductsToGroup(productIds, groupId) {
    try {
        const group = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].productGroup.findUnique({
            where: {
                id: groupId
            }
        });
        if (!group) return {
            success: false,
            message: 'Group not found.'
        };
        // Link and Align metadata
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.updateMany({
            where: {
                id: {
                    in: productIds
                }
            },
            data: {
                productGroupId: groupId,
                brandId: group.brandId || undefined,
                categoryId: group.categoryId || undefined
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/maintenance');
        return {
            success: true,
            message: 'Successfully linked products to group.'
        };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            message: e.message || 'Failed to link products.'
        };
    }
}
async function createGroupFromProducts(productIds, data) {
    try {
        const products = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.findMany({
            where: {
                id: {
                    in: productIds
                }
            }
        });
        if (products.length === 0) return {
            success: false,
            message: 'No products selected.'
        };
        const template = products[0];
        if (!template.brandId) return {
            success: false,
            message: 'Selected reference product must have a Brand.'
        };
        // Create Group
        const group = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].productGroup.create({
            data: {
                name: data.name,
                description: data.description,
                brandId: template.brandId,
                categoryId: template.categoryId
            }
        });
        // Link Products
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["prisma"].product.updateMany({
            where: {
                id: {
                    in: productIds
                }
            },
            data: {
                productGroupId: group.id,
                brandId: template.brandId,
                categoryId: template.categoryId
            }
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/products');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])('/admin/inventory/maintenance');
        return {
            success: true,
            message: 'Successfully created group from products.'
        };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            message: e.message || 'Failed to create group.'
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createProductGroupWithVariants,
    updateProductGroup,
    linkProductsToGroup,
    createGroupFromProducts
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createProductGroupWithVariants, "608038562b22c4f82c07102bc2eb7e8e1470bc029c", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateProductGroup, "6071072402571cbfc8d3ca0f9a66f7988ebb22acba", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(linkProductsToGroup, "60cdc99283959808de788cc718d3d993a12ec2ad1e", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createGroupFromProducts, "60f2830be8313d3a1f0552b69b7ec7847d5c7aa18e", null);
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
"[project]/.next-internal/server/app/admin/products/groups/[id]/edit/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/product-groups.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$product$2d$groups$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/product-groups.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)");
;
;
;
}),
"[project]/.next-internal/server/app/admin/products/groups/[id]/edit/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/product-groups.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "409714094e6ebe47cc2f212977bed6c0295d53f040",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBrandsByCategory"],
    "6071072402571cbfc8d3ca0f9a66f7988ebb22acba",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$product$2d$groups$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateProductGroup"],
    "608038562b22c4f82c07102bc2eb7e8e1470bc029c",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$product$2d$groups$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createProductGroupWithVariants"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$products$2f$groups$2f5b$id$5d2f$edit$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$product$2d$groups$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/products/groups/[id]/edit/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/product-groups.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$product$2d$groups$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/product-groups.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$brands$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/brands.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_ff125d30._.js.map