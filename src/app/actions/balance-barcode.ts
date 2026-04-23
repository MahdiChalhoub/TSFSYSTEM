'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from 'next/cache';

/**
 * The variable-data barcode. Same layout for weight / volume / price / count
 * — only the *meaning* of the integer + decimal digits changes per mode.
 *
 *   [prefix][item code][integer part][decimal part][check digit]
 *
 * Field names on the wire stay `weight_int_digits` / `weight_dec_digits` for
 * backward compat; the UI treats them as generic integer/decimal slots and
 * labels them per `mode`.
 */
export type VariableBarcodeMode = 'WEIGHT' | 'VOLUME' | 'PRICE' | 'COUNT';

export type BalanceBarcodeConfig = {
    mode: VariableBarcodeMode;
    prefix: string;           // e.g. "2"
    itemDigits: number;       // e.g. 6 — digits for item code
    weightIntDigits: number;  // integer part (kg / L / whole price / count)
    weightDecDigits: number;  // decimal part (g / ml / cents); 0 for COUNT
    isEnabled: boolean;
};

/**
 * Each mode is configured independently. A scan-time dispatcher uses the
 * `prefix` of the incoming barcode to decide which config applies.
 * Typical sensible defaults below.
 */
export type BalanceBarcodeConfigMap = Record<VariableBarcodeMode, BalanceBarcodeConfig>;

const MODE_DEFAULTS: BalanceBarcodeConfigMap = {
    WEIGHT: { mode: 'WEIGHT', prefix: '20', itemDigits: 5, weightIntDigits: 3, weightDecDigits: 3, isEnabled: true },
    VOLUME: { mode: 'VOLUME', prefix: '21', itemDigits: 5, weightIntDigits: 3, weightDecDigits: 3, isEnabled: false },
    PRICE:  { mode: 'PRICE',  prefix: '22', itemDigits: 5, weightIntDigits: 4, weightDecDigits: 2, isEnabled: false },
    COUNT:  { mode: 'COUNT',  prefix: '23', itemDigits: 7, weightIntDigits: 4, weightDecDigits: 0, isEnabled: false },
};

const DEFAULT_CONFIG: BalanceBarcodeConfig = MODE_DEFAULTS.WEIGHT;

/**
 * Normalise wire → frontend shape for a single mode's config row.
 * Unknown keys fall back to the mode's default.
 */
function fromWire(mode: VariableBarcodeMode, row: any): BalanceBarcodeConfig {
    const d = MODE_DEFAULTS[mode];
    if (!row || typeof row !== 'object') return { ...d };
    return {
        mode,
        prefix: row.prefix ?? d.prefix,
        itemDigits: row.item_digits ?? row.itemDigits ?? d.itemDigits,
        weightIntDigits: row.weight_int_digits ?? row.weightIntDigits ?? d.weightIntDigits,
        weightDecDigits: row.weight_dec_digits ?? row.weightDecDigits ?? d.weightDecDigits,
        isEnabled: row.is_enabled ?? row.isEnabled ?? d.isEnabled,
    };
}

function toWire(c: BalanceBarcodeConfig) {
    return {
        mode: c.mode,
        prefix: c.prefix,
        item_digits: c.itemDigits,
        weight_int_digits: c.weightIntDigits,
        weight_dec_digits: c.weightDecDigits,
        is_enabled: c.isEnabled,
    };
}

/**
 * Legacy single-config loader — returns the WEIGHT slot from the multi-config
 * payload. Kept for callers that only care about weight barcodes (POS).
 */
export async function getBalanceBarcodeConfig(): Promise<{ success: boolean; data: BalanceBarcodeConfig; error?: string }> {
    const all = await getBalanceBarcodeConfigMap();
    if (!all.success) return { success: false, data: { ...DEFAULT_CONFIG }, error: all.error };
    return { success: true, data: all.data.WEIGHT };
}

/** Fetches all four mode configs in one shot. */
export async function getBalanceBarcodeConfigMap(): Promise<{ success: boolean; data: BalanceBarcodeConfigMap; error?: string }> {
    try {
        const settings = await erpFetch('settings/balance-barcode/');
        const out: BalanceBarcodeConfigMap = { ...MODE_DEFAULTS };
        // Backend may return either:
        //   • A map: { configs: { WEIGHT: {...}, VOLUME: {...}, ... } }
        //   • Legacy flat shape treated as the WEIGHT row
        const configs = settings?.configs && typeof settings.configs === 'object' ? settings.configs : null;
        if (configs) {
            (['WEIGHT','VOLUME','PRICE','COUNT'] as VariableBarcodeMode[]).forEach(m => {
                if (configs[m]) out[m] = fromWire(m, configs[m]);
            });
        } else if (settings && typeof settings === 'object') {
            // Legacy single-blob — treat as WEIGHT
            out.WEIGHT = fromWire('WEIGHT', settings);
        }
        return { success: true, data: out };
    } catch (error) {
        console.warn('Variable barcode config not found, using defaults:', error);
        return { success: true, data: { ...MODE_DEFAULTS } };
    }
}

/** Legacy single-config saver — updates only the WEIGHT slot. */
export async function updateBalanceBarcodeConfig(config: BalanceBarcodeConfig): Promise<{ success: boolean; error?: string }> {
    const all = await getBalanceBarcodeConfigMap();
    const merged: BalanceBarcodeConfigMap = { ...all.data, [config.mode]: config };
    return updateBalanceBarcodeConfigMap(merged);
}

/** Saves all four mode configs together. Payload uses `configs` map to
 *  match the multi-config shape accepted by the backend. */
export async function updateBalanceBarcodeConfigMap(map: BalanceBarcodeConfigMap): Promise<{ success: boolean; error?: string }> {
    try {
        const payload: any = {
            configs: {
                WEIGHT: toWire(map.WEIGHT),
                VOLUME: toWire(map.VOLUME),
                PRICE: toWire(map.PRICE),
                COUNT: toWire(map.COUNT),
            },
            // Legacy mirror so old callers reading flat keys still work —
            // we keep the WEIGHT config duplicated at the top level.
            ...toWire(map.WEIGHT),
        };
        await erpFetch('settings/balance-barcode/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        revalidatePath('/inventory/units');
        revalidatePath('/inventory/barcode');
        revalidatePath('/sales/pos-settings');
        return { success: true };
    } catch (error) {
        console.error('Failed to update variable barcode config:', error);
        return { success: false, error: 'Failed to save configuration' };
    }
}
