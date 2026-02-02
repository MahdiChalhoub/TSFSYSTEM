import { prisma } from './db';

/**
 * Generates a valid EAN-13 barcode
 * Format: [Prefix(3)] [Sequence(9)] [CheckDigit(1)]
 */
export async function generateBarcode(productId?: number): Promise<string> {
    // 1. Get Settings
    let settings = await prisma.barcodeSettings.findFirst();

    if (!settings) {
        // Create default if missing
        settings = await prisma.barcodeSettings.create({
            data: {
                prefix: "200",
                nextSequence: 1000,
                length: 13
            }
        });
    }

    if (!settings.isEnabled) {
        throw new Error("Automatic barcode generation is disabled.");
    }

    // 2. Calculate next sequence
    // If productId is provided, we might use it, but usually we use a counter
    const currentSeq = settings.nextSequence;

    // 3. Construct the code (without check digit)
    // Structure: PPP + SSSSSSSSS
    const prefix = settings.prefix; // e.g. "200"
    const seqStr = currentSeq.toString().padStart(12 - prefix.length, '0');
    const rawCode = `${prefix}${seqStr}`;

    // 4. Calculate Check Digit (EAN-13 algorithm)
    const checkDigit = calculateEan13CheckDigit(rawCode);

    const finalBarcode = `${rawCode}${checkDigit}`;

    // 5. Update Schema for next time
    // We increment by 1
    await prisma.barcodeSettings.update({
        where: { id: settings.id },
        data: { nextSequence: { increment: 1 } }
    });

    // 6. Final verification (Recursion if collision - unlikely with sequence)
    const exists = await prisma.product.findUnique({ where: { barcode: finalBarcode } });
    if (exists) {
        return generateBarcode(); // Try again
    }

    return finalBarcode;
}

function calculateEan13CheckDigit(digits: string): number {
    // Sum odd positions (1, 3, 5...) * 1
    // Sum even positions (2, 4, 6...) * 3
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        const num = parseInt(digits[i]);
        if (i % 2 === 0) {
            sum += num * 1; // Even index is actually Odd position (1st, 3rd) in 0-indexed array
        } else {
            sum += num * 3;
        }
    }

    const remainder = sum % 10;
    return (10 - remainder) % 10;
}
