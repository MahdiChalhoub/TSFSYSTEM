'use server';

import { prisma } from '@/lib/db';
import { generateBarcode } from '@/lib/barcode';
import { revalidatePath } from 'next/cache';

export async function getBarcodeSettings() {
    try {
        let settings = await prisma.barcodeSettings.findFirst();
        if (!settings) {
            settings = await prisma.barcodeSettings.create({
                data: {
                    prefix: "200",
                    length: 13,
                    nextSequence: 1000,
                    isEnabled: true
                }
            });
        }
        return { success: true, data: settings };
    } catch (error) {
        console.error("Failed to fetch barcode settings:", error);
        return { success: false, error: "Failed to fetch settings" };
    }
}

export async function updateBarcodeSettings(data: {
    prefix: string;
    nextSequence: number;
    isEnabled: boolean;
}) {
    try {
        const first = await prisma.barcodeSettings.findFirst();
        if (!first) throw new Error("Settings not found");

        await prisma.barcodeSettings.update({
            where: { id: first.id },
            data: {
                prefix: data.prefix,
                nextSequence: Number(data.nextSequence),
                isEnabled: data.isEnabled
            }
        });

        revalidatePath('/admin/settings/barcode');
        return { success: true };
    } catch (error) {
        console.error("Update failed:", error);
        return { success: false, error: "Failed to update settings" };
    }
}

export async function generateNewBarcodeAction() {
    try {
        const code = await generateBarcode();
        return { success: true, code };
    } catch (error: any) {
        console.error("Generate failed:", error);
        return { success: false, error: error.message };
    }
}
