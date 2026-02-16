import z from "zod";

/**
 * Types shared between the client and server go here.
 */

// Product Sync API Response
export const ProductSyncResponseSchema = z.object({
  done: z.boolean(),
  last_id: z.number(),
  count: z.number().optional(),
  data: z.array(z.object({
    product_id: z.union([z.string(), z.number()]).transform(val => String(val)),
    name: z.string(),
    sku: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    unit: z.string().nullable(),
    unit_cost: z.number().optional().nullable(),
    selling_price: z.number().optional().nullable(),
    margin: z.number().optional().nullable(),
    total_qty: z.number().optional().nullable(),
    suppliers: z.array(z.object({
      supplier_id: z.union([z.string(), z.number()]).transform(val => String(val)),
      supplier_name: z.string().nullable(),
    })).optional().nullable(),
  })),
});

export type ProductSyncResponse = z.infer<typeof ProductSyncResponseSchema>;

// Location Sync API Response
export const LocationSyncResponseSchema = z.array(z.object({
  id: z.union([z.string(), z.number()]).transform(val => String(val)),
  name: z.string(),
  landmark: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  zip_code: z.string().nullable(),
  mobile: z.string().nullable(),
  email: z.string().nullable(),
}));

export type LocationSyncResponse = z.infer<typeof LocationSyncResponseSchema>;

// Database types
export interface Location {
  id: number;
  external_location_id: string;
  name: string;
  landmark: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  mobile: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}
export interface Product {
  id: number;
  external_product_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
  image_url: string | null;
  unit: string | null;
  unit_cost: number | null;
  selling_price: number | null;
  margin: number | null;
  total_qty: number;
  supplier: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: number;
  external_supplier_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface InventorySession {
  id: number;
  location: string;
  section: string;
  person1_name: string;
  person2_name: string;
  session_date: string;
  status: 'IN_PROGRESS' | 'WAITING_VERIFICATION' | 'VERIFIED' | 'ADJUSTED';
  created_at: string;
  updated_at: string;
}

export interface InventoryLine {
  id: number;
  session_id: number;
  product_id: number;
  system_qty: number;
  physical_qty_person1: number | null;
  physical_qty_person2: number | null;
  difference_person1: number | null;
  difference_person2: number | null;
  is_same_difference: boolean;
  needs_adjustment: boolean;
  is_verified: boolean;
  is_adjusted: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncState {
  id: number;
  sync_type: string;
  last_id: number;
  last_sync_at: string | null;
  is_syncing: boolean;
  created_at: string;
  updated_at: string;
}
