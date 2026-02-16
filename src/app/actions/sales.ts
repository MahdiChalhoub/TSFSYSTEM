'use server'

import { erpFetch } from '@/lib/erp-api';
import { revalidatePath } from 'next/cache';

export async function importSalesAction(formData: FormData) {
    // formData contains: file, mapping (JSON string), warehouse_id, scope
    return erpFetch('sales/import-csv/', {
        method: 'POST',
        body: formData,
    });
}
