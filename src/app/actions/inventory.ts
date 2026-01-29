'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type UnitState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
        conversionFactor?: string[];
    };
};

export async function createUnit(prevState: UnitState, formData: FormData): Promise<UnitState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const baseUnitId = formData.get('baseUnitId') ? parseInt(formData.get('baseUnitId') as string) : null;
    const conversionFactor = formData.get('conversionFactor') ? parseFloat(formData.get('conversionFactor') as string) : 1.0;

    // New Fields
    const shortName = (formData.get('shortName') as string) || null;
    const type = (formData.get('type') as string) || 'COUNT';
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
        return { message: 'Failed to create unit', errors: { name: ['Name must be at least 2 characters'] } };
    }
    if (!code) {
        return { message: 'Failed to create unit', errors: { code: ['Code is required'] } };
    }

    try {
        await prisma.unit.create({
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

        revalidatePath('/admin/inventory/units');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Database Error: Failed to create unit.' };
    }
}

export async function deleteUnit(id: number) {
    try {
        await prisma.unit.delete({
            where: { id }
        });
        revalidatePath('/admin/inventory/units');
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Failed to delete unit' };
    }
}

export async function updateUnit(id: number, prevState: UnitState, formData: FormData): Promise<UnitState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const conversionFactor = formData.get('conversionFactor') ? parseFloat(formData.get('conversionFactor') as string) : 1.0;
    const baseUnitId = formData.get('baseUnitId') ? parseInt(formData.get('baseUnitId') as string) : null;

    // New Fields
    const shortName = (formData.get('shortName') as string) || null;
    const type = (formData.get('type') as string) || 'COUNT';
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
        await prisma.unit.update({
            where: { id },
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
        revalidatePath('/admin/inventory/units');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update unit' };
    }
}
