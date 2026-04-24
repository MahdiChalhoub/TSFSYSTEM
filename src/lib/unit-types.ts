/**
 * UNIT_TYPES — the canonical taxonomy used by every frontend surface that
 * cares about what kind of unit it is dealing with.
 *
 * Single source of truth: imported by
 *   • src/components/admin/UnitFormModal.tsx  — type-picker tiles
 *   • src/components/admin/BalanceBarcodeConfigModal.tsx — barcode modes
 *   • any future "unit aware" component
 *
 * The `id` string mirrors the backend `UNIT_TYPE_CHOICES` CharField values.
 * `canEmbedInBarcode` flags which types make sense as variable-barcode
 * modes — only numeric-measurable types (weight / volume / count).
 */

import { Hash, Scale, Milestone, Ruler, Grid2X2, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type UnitTypeId =
    | 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA' | 'TIME';

export interface UnitTypeDef {
    id: UnitTypeId;
    label: string;
    hint: string;
    icon: LucideIcon;
    color: string;
    /** Can this type be embedded into a variable-data barcode? */
    canEmbedInBarcode: boolean;
    /** Default integer + decimal digit widths when embedded. */
    barcodeDefaults?: { intDigits: number; decDigits: number };
    /** Rendering metadata for the Variable Barcode Config modal. Present
     * only when `canEmbedInBarcode` is true. */
    barcodeRender?: {
        prefix: string;          // default leading digits
        unit: string;            // "kg" / "L" / "pcs"
        intHint: string;
        decHint: string;
        exampleInt: string;
        exampleDec: string;
        /** Verb / phrase to describe a product having this measurement. */
        verbPhrase: string;      // "weighing", "volume", "count"
    };
}

export const UNIT_TYPES: ReadonlyArray<UnitTypeDef> = [
    {
        id: 'COUNT',
        label: 'Count',
        hint: 'Integer quantities — pieces, units, items',
        icon: Hash,
        color: 'var(--app-primary)',
        canEmbedInBarcode: true,
        barcodeDefaults: { intDigits: 4, decDigits: 0 },
        barcodeRender: {
            prefix: '23', unit: 'pcs',
            intHint: 'Unit count digits', decHint: 'Count uses no decimal',
            exampleInt: '42', exampleDec: '', verbPhrase: 'count',
        },
    },
    {
        id: 'WEIGHT',
        label: 'Weight',
        hint: 'Grams, kg, lb — needs scale',
        icon: Scale,
        color: 'var(--app-warning, #f59e0b)',
        canEmbedInBarcode: true,
        barcodeDefaults: { intDigits: 3, decDigits: 3 },
        barcodeRender: {
            prefix: '20', unit: 'kg',
            intHint: 'Whole kg digits', decHint: 'Grams',
            exampleInt: '1', exampleDec: '250', verbPhrase: 'weighing',
        },
    },
    {
        id: 'VOLUME',
        label: 'Volume',
        hint: 'Litre, ml, gallon — liquids',
        icon: Milestone,
        color: 'var(--app-info, #3b82f6)',
        canEmbedInBarcode: true,
        barcodeDefaults: { intDigits: 3, decDigits: 3 },
        barcodeRender: {
            prefix: '21', unit: 'L',
            intHint: 'Whole litre digits', decHint: 'Millilitres',
            exampleInt: '1', exampleDec: '500', verbPhrase: 'volume',
        },
    },
    {
        id: 'LENGTH',
        label: 'Length',
        hint: 'Metres, cm, inches — distance/dimension',
        icon: Ruler,
        color: '#8b5cf6',
        canEmbedInBarcode: false,
    },
    {
        id: 'AREA',
        label: 'Area',
        hint: 'm², ft² — surface measurement',
        icon: Grid2X2,
        color: '#ec4899',
        canEmbedInBarcode: false,
    },
    {
        id: 'TIME',
        label: 'Time',
        hint: 'Hours, minutes — labor/service billing',
        icon: Clock,
        color: '#14b8a6',
        canEmbedInBarcode: false,
    },
];

export const BARCODE_EMBEDDABLE_TYPES: ReadonlyArray<UnitTypeDef> =
    UNIT_TYPES.filter(t => t.canEmbedInBarcode);

export const UNIT_TYPE_BY_ID: Readonly<Record<UnitTypeId, UnitTypeDef>> =
    Object.fromEntries(UNIT_TYPES.map(t => [t.id, t])) as any;
