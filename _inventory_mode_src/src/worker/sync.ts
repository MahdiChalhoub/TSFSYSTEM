import { ProductSyncResponseSchema, type ProductSyncResponse, LocationSyncResponseSchema, type LocationSyncResponse } from "../shared/types";

const SYNC_API_URL = "https://www.tsfci.com/API/newInventoryMode/get_products_full_sync.php";
const LOCATION_SYNC_API_URL = "https://tsfci.com/API/location/location.php";
const BATCH_LIMIT = 500; // Increased to reduce API calls
const SYNC_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - auto-reset if stuck longer

/**
 * Sync products from the external API - INCREMENTAL version
 * Processes ONE batch at a time to avoid worker timeout
 * Call repeatedly until done=true
 */
export async function syncProducts(db: D1Database, apiKey: string): Promise<{
  success: boolean;
  done: boolean;
  batchSynced: number;
  totalSynced: number;
  lastId: number;
  error?: string;
}> {
  try {
    // Get current sync state
    const syncState = await db
      .prepare("SELECT * FROM sync_state WHERE sync_type = ?")
      .bind("products")
      .first<{ last_id: number; is_syncing: number; total_synced: number }>();

    if (!syncState) {
      throw new Error("Sync state not initialized");
    }

    // If not syncing, this is a fresh start - reset counters
    if (syncState.is_syncing === 0) {
      await db
        .prepare("UPDATE sync_state SET is_syncing = 1, last_id = 0, total_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
        .bind("products")
        .run();
      
      const updatedState = await db
        .prepare("SELECT * FROM sync_state WHERE sync_type = ?")
        .bind("products")
        .first<{ last_id: number; is_syncing: number; total_synced: number }>();
      
      if (!updatedState) {
        throw new Error("Failed to initialize sync state");
      }
      
      return await processBatch(db, apiKey, updatedState.last_id, updatedState.total_synced || 0);
    }

    // Already syncing - continue from where we left off
    return await processBatch(db, apiKey, syncState.last_id, syncState.total_synced || 0);

  } catch (error) {
    // Mark as not syncing on error
    await db
      .prepare("UPDATE sync_state SET is_syncing = 0, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
      .bind("products")
      .run();

    return {
      success: false,
      done: false,
      batchSynced: 0,
      totalSynced: 0,
      lastId: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process a single batch of products
 */
async function processBatch(
  db: D1Database,
  apiKey: string,
  lastId: number,
  totalSynced: number
): Promise<{
  success: boolean;
  done: boolean;
  batchSynced: number;
  totalSynced: number;
  lastId: number;
  error?: string;
}> {
  // Add timestamp to prevent caching
  const timestamp = Date.now();
  const url = `${SYNC_API_URL}?api_key=${apiKey}&limit=${BATCH_LIMIT}&last_id=${lastId}&_t=${timestamp}`;
  
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API returned ${response.status}: ${text.substring(0, 200)}`);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`API returned invalid JSON. Response starts with: ${text.substring(0, 200)}`);
  }
  
  const parsed = ProductSyncResponseSchema.parse(data);

  // Process products in batch
  await saveProductsBatch(db, parsed.data);
  const batchSynced = parsed.data.length;
  const newTotalSynced = totalSynced + batchSynced;
  const done = parsed.done;
  const newLastId = parsed.last_id;

  // Update sync state
  if (done) {
    // Sync complete - mark as not syncing
    await db
      .prepare("UPDATE sync_state SET is_syncing = 0, last_id = ?, total_synced = ?, last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
      .bind(newLastId, newTotalSynced, "products")
      .run();
  } else {
    // More batches to come - update progress
    await db
      .prepare("UPDATE sync_state SET last_id = ?, total_synced = ?, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
      .bind(newLastId, newTotalSynced, "products")
      .run();
  }

  return {
    success: true,
    done,
    batchSynced,
    totalSynced: newTotalSynced,
    lastId: newLastId,
  };
}



/**
 * Save multiple products in a batch to improve performance
 */
async function saveProductsBatch(db: D1Database, products: ProductSyncResponse['data']) {
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  for (const product of products) {
    // Upsert product
    statements.push(
      db.prepare(`
        INSERT INTO products (
          external_product_id, name, sku, category, brand, image_url, 
          unit, unit_cost, selling_price, margin, total_qty, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(external_product_id) DO UPDATE SET
          name = excluded.name,
          sku = excluded.sku,
          category = excluded.category,
          brand = excluded.brand,
          image_url = excluded.image_url,
          unit = excluded.unit,
          unit_cost = excluded.unit_cost,
          selling_price = excluded.selling_price,
          margin = excluded.margin,
          total_qty = excluded.total_qty,
          updated_at = excluded.updated_at
      `).bind(
        product.product_id,
        product.name,
        product.sku || null,
        product.category || null,
        product.brand || null,
        product.image || null,
        product.unit || 'PC',
        product.unit_cost || null,
        product.selling_price || null,
        product.margin || null,
        product.total_qty || 0,
        now,
        now
      )
    );
  }

  // Execute product upserts in batch
  if (statements.length > 0) {
    await db.batch(statements);
  }

  // NOTE: Supplier processing is disabled to avoid worker timeout with large product counts
  // Products sync successfully, suppliers can be added via a separate lightweight operation if needed
}

/**
 * Sync locations from the external API
 */
export async function syncLocations(db: D1Database, apiKey: string): Promise<{
  success: boolean;
  totalSynced: number;
  error?: string;
}> {
  let totalSynced = 0;
  
  try {
    // Get current sync state
    const syncState = await db
      .prepare("SELECT * FROM sync_state WHERE sync_type = ?")
      .bind("locations")
      .first<{ is_syncing: number }>();

    if (!syncState) {
      throw new Error("Location sync state not initialized");
    }

    // Check if already syncing - but auto-reset if stuck for too long
    if (syncState.is_syncing === 1) {
      const lastUpdate = (syncState as any).updated_at;
      if (lastUpdate) {
        const lastUpdateTime = new Date(lastUpdate).getTime();
        const now = Date.now();
        if (now - lastUpdateTime > SYNC_TIMEOUT_MS) {
          console.log("Location sync stuck for too long, auto-resetting...");
          await db
            .prepare("UPDATE sync_state SET is_syncing = 0, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
            .bind("locations")
            .run();
        } else {
          return {
            success: false,
            totalSynced: 0,
            error: "Location sync already in progress",
          };
        }
      } else {
        return {
          success: false,
          totalSynced: 0,
          error: "Location sync already in progress",
        };
      }
    }

    // Mark as syncing
    await db
      .prepare("UPDATE sync_state SET is_syncing = 1, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
      .bind("locations")
      .run();

    // Add timestamp to prevent caching
    const timestamp = Date.now();
    const url = `${LOCATION_SYNC_API_URL}?api_key=${apiKey}&_t=${timestamp}`;
    
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API returned ${response.status}: ${text.substring(0, 200)}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`API returned invalid JSON. Response starts with: ${text.substring(0, 200)}`);
    }
    
    const parsed = LocationSyncResponseSchema.parse(data);

    // Process each location
    for (const location of parsed) {
      await saveLocation(db, location);
      totalSynced++;
    }

    // Mark as complete
    await db
      .prepare("UPDATE sync_state SET is_syncing = 0, last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
      .bind("locations")
      .run();

    return {
      success: true,
      totalSynced,
    };

  } catch (error) {
    // Mark as not syncing on error
    await db
      .prepare("UPDATE sync_state SET is_syncing = 0, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
      .bind("locations")
      .run();

    return {
      success: false,
      totalSynced,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Save a location to the database
 */
async function saveLocation(db: D1Database, location: LocationSyncResponse[0]) {
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO locations (
        external_location_id, name, landmark, city, state, country, 
        zip_code, mobile, email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(external_location_id) DO UPDATE SET
        name = excluded.name,
        landmark = excluded.landmark,
        city = excluded.city,
        state = excluded.state,
        country = excluded.country,
        zip_code = excluded.zip_code,
        mobile = excluded.mobile,
        email = excluded.email,
        updated_at = excluded.updated_at
    `)
    .bind(
      location.id,
      location.name,
      location.landmark || null,
      location.city || null,
      location.state || null,
      location.country || null,
      location.zip_code || null,
      location.mobile || null,
      location.email || null,
      now,
      now
    )
    .run();
}
