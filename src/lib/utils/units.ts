import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Converts a quantity from a source unit to a target unit.
 * If source and target are linked in a hierarchy, it uses the conversionFactor.
 */
export async function convertQuantity(
    quantity: number | Decimal,
    fromUnitId: number,
    toUnitId: number
): Promise<Decimal> {
    if (fromUnitId === toUnitId) return new Decimal(quantity.toString());

    const fromUnit = await prisma.unit.findUnique({ where: { id: fromUnitId } });
    const toUnit = await prisma.unit.findUnique({ where: { id: toUnitId } });

    if (!fromUnit || !toUnit) throw new Error("Units not found");

    // Logic: 
    // All units should eventually relate to the same "Base Unit" for conversion.
    // Case 1: From Child to Parent (Base)
    if (fromUnit.baseUnitId === toUnitId) {
        return new Decimal(quantity.toString()).mul(new Decimal(fromUnit.conversionFactor.toString()));
    }

    // Case 2: From Parent (Base) to Child
    if (toUnit.baseUnitId === fromUnitId) {
        return new Decimal(quantity.toString()).div(new Decimal(toUnit.conversionFactor.toString()));
    }

    // Case 3: Complex (Sibling units sharing the same parent)
    if (fromUnit.baseUnitId && fromUnit.baseUnitId === toUnit.baseUnitId) {
        // Convert to base first, then to target
        const inBase = new Decimal(quantity.toString()).mul(new Decimal(fromUnit.conversionFactor.toString()));
        return inBase.div(new Decimal(toUnit.conversionFactor.toString()));
    }

    // Default: Return original if no relation (Safe fallback or throw?)
    return new Decimal(quantity.toString());
}

/**
 * Normalizes a price to the Base Unit.
 * If I buy a BOX (Factor 12) for $120, the base unit (Piece) cost is $10.
 */
export async function normalizePriceToBaseUnit(
    price: number | Decimal,
    purchasedUnitId: number,
    baseUnitId: number
): Promise<Decimal> {
    if (purchasedUnitId === baseUnitId) return new Decimal(price.toString());

    const pUnit = await prisma.unit.findUnique({ where: { id: purchasedUnitId } });
    if (!pUnit) return new Decimal(price.toString());

    // If pUnit is a child of baseUnit, multiply qty = divide price
    if (pUnit.baseUnitId === baseUnitId) {
        return new Decimal(price.toString()).div(new Decimal(pUnit.conversionFactor.toString()));
    }

    return new Decimal(price.toString());
}
