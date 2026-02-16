import { Hono } from "hono";
import { syncProducts, syncLocations } from "./sync";
import type { InventorySession, InventoryLine, Product, SyncState } from "../shared/types";
import {
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  authMiddleware,
  deleteSession,
  getCurrentUser,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import { createAdjustmentOrder, getAdjustmentOrders, updateAdjustmentOrderStatus } from "./adjustment-orders";

interface Env {
  DB: D1Database;
  TSFCI_API_KEY: string;
  ADMIN_CODE: string;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// Authentication endpoints
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

// Exchange code for session token - SDK expects POST /api/sessions
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  // Get user data and store in database
  const mochaUser = await getCurrentUser(sessionToken, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  if (mochaUser) {
    // Store or update user in database
    const existingUser = await c.env.DB
      .prepare("SELECT * FROM users WHERE external_user_id = ?")
      .bind(mochaUser.id)
      .first();

    if (!existingUser) {
      await c.env.DB
        .prepare(`
          INSERT INTO users (external_user_id, email, name, picture_url)
          VALUES (?, ?, ?, ?)
        `)
        .bind(
          mochaUser.id,
          mochaUser.email,
          mochaUser.google_user_data.name,
          mochaUser.google_user_data.picture
        )
        .run();
    } else {
      await c.env.DB
        .prepare(`
          UPDATE users 
          SET email = ?, name = ?, picture_url = ?, updated_at = CURRENT_TIMESTAMP
          WHERE external_user_id = ?
        `)
        .bind(
          mochaUser.email,
          mochaUser.google_user_data.name,
          mochaUser.google_user_data.picture,
          mochaUser.id
        )
        .run();
    }
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  return c.json(mochaUser);
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// User endpoints
app.get("/api/users", authMiddleware, async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT * FROM users ORDER BY name ASC, email ASC")
    .all();

  return c.json(results);
});

app.delete("/api/users/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const result = await c.env.DB
    .prepare("DELETE FROM users WHERE id = ?")
    .bind(id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to delete user" }, 500);
  }

  return c.json({ success: true });
});

// Sync endpoints - protected
app.post("/api/sync/products", authMiddleware, async (c) => {
  const apiKey = c.env.TSFCI_API_KEY;
  
  if (!apiKey) {
    return c.json({ error: "TSFCI_API_KEY not configured" }, 500);
  }

  const result = await syncProducts(c.env.DB, apiKey);
  
  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json({
    success: true,
    done: result.done,
    batchSynced: result.batchSynced,
    totalSynced: result.totalSynced,
    lastId: result.lastId,
  });
});

app.post("/api/sync/locations", authMiddleware, async (c) => {
  const apiKey = c.env.TSFCI_API_KEY;
  
  if (!apiKey) {
    return c.json({ error: "TSFCI_API_KEY not configured" }, 500);
  }

  const result = await syncLocations(c.env.DB, apiKey);
  
  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json({
    message: `Synced ${result.totalSynced} locations`,
    totalSynced: result.totalSynced,
  });
});

app.get("/api/sync/status", authMiddleware, async (c) => {
  const syncState = await c.env.DB
    .prepare("SELECT * FROM sync_state WHERE sync_type = ?")
    .bind("products")
    .first<SyncState>();

  return c.json(syncState);
});

// Reset stuck sync state
app.post("/api/sync/reset", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const syncType = body.sync_type || "products";
  
  const result = await c.env.DB
    .prepare("UPDATE sync_state SET is_syncing = 0, last_id = 0, updated_at = CURRENT_TIMESTAMP WHERE sync_type = ?")
    .bind(syncType)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to reset sync state" }, 500);
  }

  return c.json({ success: true, message: `${syncType} sync state has been reset` });
});

// Location endpoints - protected
app.get("/api/locations", authMiddleware, async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT * FROM locations ORDER BY name ASC")
    .all();

  return c.json(results);
});

// Supplier endpoints - protected
app.get("/api/suppliers", authMiddleware, async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT * FROM suppliers ORDER BY name ASC")
    .all();

  return c.json(results);
});

// Category endpoints - protected
app.get("/api/categories", authMiddleware, async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC")
    .all();

  return c.json(results);
});

// Product endpoints - protected
app.get("/api/products/count", authMiddleware, async (c) => {
  const supplierId = c.req.query("supplier_id");
  const category = c.req.query("category");
  const qtyFilter = c.req.query("qty_filter"); // "zero", "non_zero", "custom"
  const qtyMin = c.req.query("qty_min") ? parseInt(c.req.query("qty_min")!) : null;
  const qtyMax = c.req.query("qty_max") ? parseInt(c.req.query("qty_max")!) : null;

  let query = "SELECT COUNT(DISTINCT p.id) as total FROM products p";
  let params: any[] = [];
  const conditions: string[] = [];

  if (supplierId) {
    query += " JOIN product_suppliers ps ON p.id = ps.product_id";
    conditions.push("ps.supplier_id = ?");
    params.push(supplierId);
  }

  if (category) {
    conditions.push("p.category = ?");
    params.push(category);
  }

  // Apply quantity filters
  if (qtyFilter === 'zero') {
    conditions.push('COALESCE(p.total_qty, 0) = 0');
  } else if (qtyFilter === 'non_zero') {
    conditions.push('COALESCE(p.total_qty, 0) > 0');
  } else if (qtyFilter === 'custom') {
    if (qtyMin !== null) {
      conditions.push('COALESCE(p.total_qty, 0) >= ?');
      params.push(qtyMin);
    }
    if (qtyMax !== null) {
      conditions.push('COALESCE(p.total_qty, 0) <= ?');
      params.push(qtyMax);
    }
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  const result = await c.env.DB
    .prepare(query)
    .bind(...params)
    .first<{ total: number }>();

  return c.json({ total: result?.total || 0 });
});

app.get("/api/products", authMiddleware, async (c) => {
  const search = c.req.query("search") || "";
  const supplierId = c.req.query("supplier_id");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  let query = "SELECT DISTINCT p.* FROM products p";
  let params: any[] = [];
  const conditions: string[] = [];

  // Join with suppliers if filtering by supplier
  if (supplierId) {
    query += " JOIN product_suppliers ps ON p.id = ps.product_id";
    conditions.push("ps.supplier_id = ?");
    params.push(supplierId);
  }

  if (search) {
    conditions.push("(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)");
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.name ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const { results } = await c.env.DB
    .prepare(query)
    .bind(...params)
    .all<Product>();

  return c.json(results);
});

app.get("/api/products/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const product = await c.env.DB
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(id)
    .first<Product>();

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // Get suppliers for this product
  const { results: suppliers } = await c.env.DB
    .prepare(`
      SELECT s.* FROM suppliers s
      JOIN product_suppliers ps ON s.id = ps.supplier_id
      WHERE ps.product_id = ?
    `)
    .bind(id)
    .all();

  return c.json({ ...product, suppliers });
});

// Sync live quantity data from TSFCI API for a product in a session
app.get("/api/inventory-sessions/:sessionId/products/:productId/sync-live-qty", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");
  const productId = c.req.param("productId");
  const apiKey = c.env.TSFCI_API_KEY;

  if (!apiKey) {
    return c.json({ error: "TSFCI_API_KEY not configured" }, 500);
  }

  // Get session to find location
  const session = await c.env.DB
    .prepare("SELECT * FROM inventory_sessions WHERE id = ?")
    .bind(sessionId)
    .first<any>();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Get product to find barcode/SKU and location_id
  const product = await c.env.DB
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(productId)
    .first<any>();

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // Get location external_id
  const location = await c.env.DB
    .prepare("SELECT * FROM locations WHERE name = ?")
    .bind(session.location)
    .first<any>();

  if (!location || !location.external_location_id) {
    return c.json({ error: "Location not found or missing external_location_id" }, 404);
  }

  try {
    // Call TSFCI API with barcode and location_id
    const url = `https://www.tsfci.com/API/newInventoryMode/get_products.php?api_key=${apiKey}&barcode=${product.sku}&location_id=${location.external_location_id}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return c.json({ error: "Failed to fetch live data from TSFCI API" }, 500);
    }

    const data: any = await response.json();
    
    if (data.count === 0 || !data.data || data.data.length === 0) {
      return c.json({ error: "Product not found in TSFCI API" }, 404);
    }

    const liveProduct = data.data[0];
    
    return c.json({
      qty_in_location: liveProduct.qty_in_location,
      total_qty: liveProduct.total_qty,
      name: liveProduct.name,
      margin: liveProduct.margin,
      unit_cost: liveProduct.unit_cost,
      selling_price: liveProduct.selling_price
    });
  } catch (error) {
    console.error('Failed to sync live qty:', error);
    return c.json({ error: "Failed to sync live quantity data" }, 500);
  }
});

// Inventory session endpoints - moved to /api/inventory-sessions
app.get("/api/inventory-sessions", authMiddleware, async (c) => {
  const status = c.req.query("status");
  
  let query = "SELECT * FROM inventory_sessions";
  const params: any[] = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const { results } = await c.env.DB
    .prepare(query)
    .bind(...params)
    .all<InventorySession>();

  return c.json(results);
});

app.get("/api/inventory-sessions/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const session = await c.env.DB
    .prepare("SELECT * FROM inventory_sessions WHERE id = ?")
    .bind(id)
    .first<InventorySession>();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Get assigned users
  const { results: assignments } = await c.env.DB
    .prepare("SELECT * FROM session_assignments WHERE session_id = ?")
    .bind(id)
    .all();

  // Get line counts
  const lineCount = await c.env.DB
    .prepare("SELECT COUNT(*) as total FROM inventory_lines WHERE session_id = ?")
    .bind(id)
    .first<{ total: number }>();

  return c.json({ ...session, assigned_users: assignments, products_count: lineCount?.total || 0 });
});

// Get session assignments
app.get("/api/inventory-sessions/:id/assignments", authMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const { results } = await c.env.DB
    .prepare("SELECT * FROM session_assignments WHERE session_id = ?")
    .bind(id)
    .all();

  return c.json(results);
});

app.post("/api/inventory-sessions", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { location, section, assigned_users, session_date, supplier_id, category } = body;

  // assigned_users is an array of { user_id, user_name }
  if (!location || !section || !assigned_users || assigned_users.length === 0 || !session_date) {
    return c.json({ error: "Missing required fields. Need location, section, at least one assigned user, and date." }, 400);
  }

  // Check for duplicate users
  const userIds = assigned_users.map((u: any) => u.user_id);
  const uniqueUserIds = new Set(userIds);
  if (uniqueUserIds.size !== userIds.length) {
    return c.json({ error: "Cannot assign the same person multiple times" }, 400);
  }

  // Create session with first two users for backward compatibility
  const person1 = assigned_users[0];
  const person2 = assigned_users[1] || assigned_users[0]; // Use first person if only one assigned

  const result = await c.env.DB
    .prepare(`
      INSERT INTO inventory_sessions (location, section, person1_name, person2_name, session_date, status)
      VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS')
    `)
    .bind(location, section, person1.user_name, person2.user_name, session_date)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to create session" }, 500);
  }

  const sessionId = result.meta.last_row_id;

  // Create session assignments for all users
  for (const user of assigned_users) {
    await c.env.DB
      .prepare(`
        INSERT INTO session_assignments (session_id, user_id, user_name)
        VALUES (?, ?, ?)
      `)
      .bind(sessionId, user.user_id, user.user_name)
      .run();
  }

  // Add products to session based on filters
  const { qty_filter, qty_min, qty_max } = body;
  
  let productsQuery = "SELECT DISTINCT p.id, p.total_qty FROM products p";
  const productsParams: any[] = [];
  const productConditions: string[] = [];

  if (supplier_id) {
    productsQuery = "SELECT DISTINCT p.id, p.total_qty FROM products p JOIN product_suppliers ps ON p.id = ps.product_id";
    productConditions.push("ps.supplier_id = ?");
    productsParams.push(supplier_id);
  }

  if (category) {
    productConditions.push("p.category = ?");
    productsParams.push(category);
  }

  // Apply quantity filters
  if (qty_filter === 'zero') {
    productConditions.push('COALESCE(p.total_qty, 0) = 0');
  } else if (qty_filter === 'non_zero') {
    productConditions.push('COALESCE(p.total_qty, 0) > 0');
  } else if (qty_filter === 'custom') {
    if (qty_min !== null && qty_min !== undefined) {
      productConditions.push('COALESCE(p.total_qty, 0) >= ?');
      productsParams.push(qty_min);
    }
    if (qty_max !== null && qty_max !== undefined) {
      productConditions.push('COALESCE(p.total_qty, 0) <= ?');
      productsParams.push(qty_max);
    }
  }

  if (productConditions.length > 0) {
    productsQuery += " WHERE " + productConditions.join(" AND ");
  }

  const { results: products } = await c.env.DB
    .prepare(productsQuery)
    .bind(...productsParams)
    .all<{ id: number; total_qty: number }>();

  // Create inventory lines in batches for better performance
  // D1 has much stricter limits than standard SQLite on SQL variables.
  // With 3 params per row (session_id, product_id, system_qty), we use a very small batch size.
  const BATCH_SIZE = 10;
  let totalAdded = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    // Build a single INSERT statement for the batch
    const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
    const values: any[] = [];
    
    for (const product of batch) {
      values.push(sessionId, product.id, product.total_qty || 0);
    }
    
    try {
      await c.env.DB
        .prepare(`INSERT INTO inventory_lines (session_id, product_id, system_qty) VALUES ${placeholders}`)
        .bind(...values)
        .run();
      
      totalAdded += batch.length;
    } catch (error) {
      console.error(`Failed to insert batch ${i}-${i + batch.length}:`, error);
      // Continue with next batch instead of failing completely
    }
  }

  const session = await c.env.DB
    .prepare("SELECT * FROM inventory_sessions WHERE id = ?")
    .bind(sessionId)
    .first<InventorySession>();

  return c.json({ ...session, products_added: totalAdded }, 201);
});

app.patch("/api/inventory-sessions/:id/status", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { status } = body;

  const validStatuses = ['IN_PROGRESS', 'WAITING_VERIFICATION', 'VERIFIED', 'ADJUSTED'];
  if (!validStatuses.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const result = await c.env.DB
    .prepare("UPDATE inventory_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to update session" }, 500);
  }

  const session = await c.env.DB
    .prepare("SELECT * FROM inventory_sessions WHERE id = ?")
    .bind(id)
    .first<InventorySession>();

  return c.json(session);
});

app.delete("/api/inventory-sessions/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { admin_code } = body;

  // Verify admin code
  if (!admin_code || admin_code !== c.env.ADMIN_CODE) {
    return c.json({ error: "Invalid admin code" }, 403);
  }

  // Delete in order: micro_section_assignments, micro_sections, inventory_lines, session_assignments, session
  await c.env.DB
    .prepare("DELETE FROM micro_section_assignments WHERE micro_section_id IN (SELECT id FROM micro_sections WHERE session_id = ?)")
    .bind(id)
    .run();

  await c.env.DB
    .prepare("DELETE FROM micro_sections WHERE session_id = ?")
    .bind(id)
    .run();

  await c.env.DB
    .prepare("DELETE FROM inventory_lines WHERE session_id = ?")
    .bind(id)
    .run();

  await c.env.DB
    .prepare("DELETE FROM session_assignments WHERE session_id = ?")
    .bind(id)
    .run();

  const result = await c.env.DB
    .prepare("DELETE FROM inventory_sessions WHERE id = ?")
    .bind(id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to delete session" }, 500);
  }

  return c.json({ success: true });
});

// Micro-section endpoints
app.get("/api/inventory-sessions/:sessionId/micro-sections", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");

  const { results: microSections } = await c.env.DB
    .prepare("SELECT * FROM micro_sections WHERE session_id = ? ORDER BY name ASC")
    .bind(sessionId)
    .all();

  if (microSections.length === 0) {
    return c.json([]);
  }

  // Get all assignments for all sections in one query
  const sectionIds = microSections.map((s: any) => s.id);
  const placeholders = sectionIds.map(() => '?').join(',');
  const { results: allAssignments } = await c.env.DB
    .prepare(`SELECT * FROM micro_section_assignments WHERE micro_section_id IN (${placeholders})`)
    .bind(...sectionIds)
    .all();

  // Group assignments by section
  const assignmentsBySection = new Map<number, any[]>();
  for (const assignment of allAssignments) {
    const sectionId = (assignment as any).micro_section_id;
    if (!assignmentsBySection.has(sectionId)) {
      assignmentsBySection.set(sectionId, []);
    }
    assignmentsBySection.get(sectionId)!.push(assignment);
  }

  // For product counts, we still need per-section queries due to complex filters
  // but we can optimize by only running them when needed
  const sectionsWithDetails = await Promise.all(
    microSections.map(async (section: any) => {
      const assignments = assignmentsBySection.get(section.id) || [];
      
      // Build query to count products matching this section's filters
      let baseQuery = `FROM inventory_lines il JOIN products p ON il.product_id = p.id`;
      const params: any[] = [sessionId];
      const conditions: string[] = ['il.session_id = ?'];
      
      if (section.filter_supplier_id) {
        baseQuery += ` JOIN product_suppliers ps ON p.id = ps.product_id`;
        conditions.push('ps.supplier_id = ?');
        params.push(section.filter_supplier_id);
      }
      
      if (section.filter_category) {
        conditions.push('p.category = ?');
        params.push(section.filter_category);
      }
      if (section.filter_brand) {
        conditions.push('p.brand = ?');
        params.push(section.filter_brand);
      }
      if (section.filter_unit) {
        conditions.push('p.unit = ?');
        params.push(section.filter_unit);
      }
      if (section.filter_qty_type === 'zero') {
        conditions.push('COALESCE(il.system_qty, 0) = 0');
      } else if (section.filter_qty_type === 'non_zero') {
        conditions.push('COALESCE(il.system_qty, 0) > 0');
      } else if (section.filter_qty_type === 'custom') {
        if (section.filter_qty_min !== null) {
          conditions.push('COALESCE(il.system_qty, 0) >= ?');
          params.push(section.filter_qty_min);
        }
        if (section.filter_qty_max !== null) {
          conditions.push('COALESCE(il.system_qty, 0) <= ?');
          params.push(section.filter_qty_max);
        }
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const productCount = await c.env.DB
        .prepare(`SELECT COUNT(DISTINCT il.id) as total ${baseQuery} ${whereClause}`)
        .bind(...params)
        .first<{ total: number }>();

      // Count how many are counted (by either person)
      const countedConditions = [...conditions, '(il.physical_qty_person1 IS NOT NULL OR il.physical_qty_person2 IS NOT NULL)'];
      const countedCount = await c.env.DB
        .prepare(`SELECT COUNT(DISTINCT il.id) as total ${baseQuery} WHERE ${countedConditions.join(' AND ')}`)
        .bind(...params)
        .first<{ total: number }>();

      return {
        ...section,
        assigned_users: assignments,
        products_count: productCount?.total || 0,
        counted_count: countedCount?.total || 0
      };
    })
  );

  return c.json(sectionsWithDetails);
});

app.post("/api/inventory-sessions/:sessionId/micro-sections", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { 
    name, 
    assigned_users,
    filter_supplier_id,
    filter_category,
    filter_brand,
    filter_unit,
    filter_qty_type,
    filter_qty_min,
    filter_qty_max,
    filter_uncounted_only
  } = body;

  if (!name) {
    return c.json({ error: "Micro-section name is required" }, 400);
  }

  const result = await c.env.DB
    .prepare(`
      INSERT INTO micro_sections (
        session_id, name, status,
        filter_supplier_id, filter_category, filter_brand, filter_unit,
        filter_qty_type, filter_qty_min, filter_qty_max, filter_uncounted_only
      ) VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      sessionId, 
      name,
      filter_supplier_id || null,
      filter_category || null,
      filter_brand || null,
      filter_unit || null,
      filter_qty_type || null,
      filter_qty_min || null,
      filter_qty_max || null,
      filter_uncounted_only ? 1 : 0
    )
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to create micro-section" }, 500);
  }

  const microSectionId = result.meta.last_row_id;

  // Create assignments if provided
  if (assigned_users && assigned_users.length > 0) {
    for (const user of assigned_users) {
      await c.env.DB
        .prepare("INSERT INTO micro_section_assignments (micro_section_id, user_id, user_name) VALUES (?, ?, ?)")
        .bind(microSectionId, user.user_id, user.user_name)
        .run();
    }
  }

  const microSection = await c.env.DB
    .prepare("SELECT * FROM micro_sections WHERE id = ?")
    .bind(microSectionId)
    .first();

  return c.json(microSection, 201);
});

app.patch("/api/micro-sections/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { name, status, assigned_users } = body;

  const updates: string[] = [];
  const params: any[] = [];

  if (name) {
    updates.push("name = ?");
    params.push(name);
  }
  if (status) {
    updates.push("status = ?");
    params.push(status);
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await c.env.DB
      .prepare(`UPDATE micro_sections SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  }

  // Update assignments if provided
  if (assigned_users !== undefined) {
    // Remove existing assignments
    await c.env.DB
      .prepare("DELETE FROM micro_section_assignments WHERE micro_section_id = ?")
      .bind(id)
      .run();

    // Add new assignments
    for (const user of assigned_users) {
      await c.env.DB
        .prepare("INSERT INTO micro_section_assignments (micro_section_id, user_id, user_name) VALUES (?, ?, ?)")
        .bind(id, user.user_id, user.user_name)
        .run();
    }
  }

  const microSection = await c.env.DB
    .prepare("SELECT * FROM micro_sections WHERE id = ?")
    .bind(id)
    .first();

  return c.json(microSection);
});

app.delete("/api/micro-sections/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  // Unassign products from this micro-section
  await c.env.DB
    .prepare("UPDATE inventory_lines SET micro_section_id = NULL WHERE micro_section_id = ?")
    .bind(id)
    .run();

  // Delete assignments
  await c.env.DB
    .prepare("DELETE FROM micro_section_assignments WHERE micro_section_id = ?")
    .bind(id)
    .run();

  // Delete micro-section
  await c.env.DB
    .prepare("DELETE FROM micro_sections WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});

// Assign products to micro-section
app.post("/api/micro-sections/:id/assign-products", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { product_ids } = body;

  if (!product_ids || !Array.isArray(product_ids)) {
    return c.json({ error: "product_ids array is required" }, 400);
  }

  // Get the micro-section to find its session
  const microSection = await c.env.DB
    .prepare("SELECT * FROM micro_sections WHERE id = ?")
    .bind(id)
    .first<{ session_id: number }>();

  if (!microSection) {
    return c.json({ error: "Micro-section not found" }, 404);
  }

  // Update inventory lines to assign them to this micro-section
  for (const lineId of product_ids) {
    await c.env.DB
      .prepare("UPDATE inventory_lines SET micro_section_id = ? WHERE id = ? AND session_id = ?")
      .bind(id, lineId, microSection.session_id)
      .run();
  }

  return c.json({ success: true, assigned: product_ids.length });
});

// Auto-distribute products across micro-sections
app.post("/api/inventory-sessions/:sessionId/auto-distribute", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");

  // Get all micro-sections for this session
  const { results: microSections } = await c.env.DB
    .prepare("SELECT id FROM micro_sections WHERE session_id = ? ORDER BY name ASC")
    .bind(sessionId)
    .all<{ id: number }>();

  if (microSections.length === 0) {
    return c.json({ error: "No micro-sections to distribute to" }, 400);
  }

  // Get all unassigned inventory lines
  const { results: lines } = await c.env.DB
    .prepare("SELECT id FROM inventory_lines WHERE session_id = ? AND micro_section_id IS NULL ORDER BY id ASC")
    .bind(sessionId)
    .all<{ id: number }>();

  // Distribute lines evenly across micro-sections
  for (let i = 0; i < lines.length; i++) {
    const microSectionIndex = i % microSections.length;
    const microSectionId = microSections[microSectionIndex].id;

    await c.env.DB
      .prepare("UPDATE inventory_lines SET micro_section_id = ? WHERE id = ?")
      .bind(microSectionId, lines[i].id)
      .run();
  }

  return c.json({ 
    success: true, 
    distributed: lines.length,
    sections: microSections.length 
  });
});

// Inventory line endpoints - protected (Manager view with all data)
app.get("/api/inventory-sessions/:sessionId/lines", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");
  const microSectionId = c.req.query("micro_section_id");
  const unassigned = c.req.query("unassigned");
  
  // Pagination
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  
  // Product filters
  const category = c.req.query("category");
  const brand = c.req.query("brand");
  const supplierId = c.req.query("supplier_id");
  const unit = c.req.query("unit");
  const search = c.req.query("search");
  
  // Status filters
  const statusFilter = c.req.query("status"); // closed_by_person1, closed_by_person2, closed_by_both, different_counts, finish, verified
  // const closedByUserId = c.req.query("closed_by_user_id"); // Filter by specific user - future feature
  const adjustmentFilter = c.req.query("adjustment"); // needs_adjustment, no_adjustment, order_created, done

  let baseQuery = `
    FROM inventory_lines il
    JOIN products p ON il.product_id = p.id
  `;
  
  // Join with product_suppliers if filtering by supplier
  if (supplierId) {
    baseQuery += " JOIN product_suppliers ps ON p.id = ps.product_id";
  }
  
  baseQuery += " WHERE il.session_id = ?";
  const params: any[] = [sessionId];

  if (microSectionId) {
    baseQuery += " AND il.micro_section_id = ?";
    params.push(microSectionId);
  } else if (unassigned === "true") {
    baseQuery += " AND il.micro_section_id IS NULL";
  }
  
  // Apply product filters
  if (category) {
    baseQuery += " AND p.category = ?";
    params.push(category);
  }
  if (brand) {
    baseQuery += " AND p.brand = ?";
    params.push(brand);
  }
  if (supplierId) {
    baseQuery += " AND ps.supplier_id = ?";
    params.push(supplierId);
  }
  if (unit) {
    baseQuery += " AND p.unit = ?";
    params.push(unit);
  }
  if (search) {
    baseQuery += " AND (p.name LIKE ? OR p.sku LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  
  // Apply status filters
  if (statusFilter === 'closed_by_person1') {
    baseQuery += " AND il.physical_qty_person1 IS NOT NULL";
  } else if (statusFilter === 'closed_by_person2') {
    baseQuery += " AND il.physical_qty_person2 IS NOT NULL";
  } else if (statusFilter === 'closed_by_both') {
    baseQuery += " AND il.physical_qty_person1 IS NOT NULL AND il.physical_qty_person2 IS NOT NULL";
  } else if (statusFilter === 'not_closed_by_both') {
    baseQuery += " AND (il.physical_qty_person1 IS NULL OR il.physical_qty_person2 IS NULL)";
  } else if (statusFilter === 'different_counts') {
    baseQuery += " AND il.physical_qty_person1 IS NOT NULL AND il.physical_qty_person2 IS NOT NULL AND il.difference_person1 != il.difference_person2";
  } else if (statusFilter === 'finish') {
    // Both counted, differences match and are 0
    baseQuery += " AND il.physical_qty_person1 IS NOT NULL AND il.physical_qty_person2 IS NOT NULL AND il.is_same_difference = 1 AND il.difference_person1 = 0";
  } else if (statusFilter === 'verified') {
    baseQuery += " AND il.is_verified = 1";
  } else if (statusFilter === 'not_verified') {
    baseQuery += " AND il.is_verified = 0";
  }
  
  // Apply adjustment filters
  if (adjustmentFilter === 'needs_adjustment') {
    // Show items where any counted difference is not 0
    baseQuery += " AND ((il.difference_person1 IS NOT NULL AND il.difference_person1 != 0) OR (il.difference_person2 IS NOT NULL AND il.difference_person2 != 0))";
  } else if (adjustmentFilter === 'no_adjustment') {
    // Show items where all counted differences are 0
    baseQuery += " AND ((il.difference_person1 IS NOT NULL AND il.difference_person1 = 0) OR (il.difference_person2 IS NOT NULL AND il.difference_person2 = 0)) AND NOT ((il.difference_person1 IS NOT NULL AND il.difference_person1 != 0) OR (il.difference_person2 IS NOT NULL AND il.difference_person2 != 0))";
  } else if (adjustmentFilter === 'order_created') {
    baseQuery += " AND il.adjustment_status = 'ORDER_CREATED'";
  } else if (adjustmentFilter === 'done') {
    baseQuery += " AND il.adjustment_status = 'DONE'";
  } else if (adjustmentFilter === 'pending') {
    baseQuery += " AND il.needs_adjustment = 1 AND (il.adjustment_status = 'PENDING' OR il.adjustment_status IS NULL)";
  }

  // Get total count for pagination
  const countResult = await c.env.DB
    .prepare(`SELECT COUNT(DISTINCT il.id) as total ${baseQuery}`)
    .bind(...params)
    .first<{ total: number }>();

  // Get paginated results
  const selectQuery = `
    SELECT DISTINCT il.*, p.name as product_name, p.sku, p.unit as product_unit_live, 
           p.category as product_category_live, p.brand as product_brand_live,
           p.margin as product_margin_live, p.total_qty as current_system_qty
    ${baseQuery}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `;
  
  const { results } = await c.env.DB
    .prepare(selectQuery)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    lines: results,
    total: countResult?.total || 0,
    limit,
    offset
  });
});

// Get filter options for a session
app.get("/api/inventory-sessions/:sessionId/filter-options", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");

  const { results: categories } = await c.env.DB
    .prepare(`
      SELECT DISTINCT p.category 
      FROM inventory_lines il 
      JOIN products p ON il.product_id = p.id 
      WHERE il.session_id = ? AND p.category IS NOT NULL AND p.category != ''
      ORDER BY p.category ASC
    `)
    .bind(sessionId)
    .all();

  const { results: brands } = await c.env.DB
    .prepare(`
      SELECT DISTINCT p.brand 
      FROM inventory_lines il 
      JOIN products p ON il.product_id = p.id 
      WHERE il.session_id = ? AND p.brand IS NOT NULL AND p.brand != ''
      ORDER BY p.brand ASC
    `)
    .bind(sessionId)
    .all();

  const { results: units } = await c.env.DB
    .prepare(`
      SELECT DISTINCT p.unit 
      FROM inventory_lines il 
      JOIN products p ON il.product_id = p.id 
      WHERE il.session_id = ? AND p.unit IS NOT NULL AND p.unit != ''
      ORDER BY p.unit ASC
    `)
    .bind(sessionId)
    .all();

  const { results: suppliers } = await c.env.DB
    .prepare(`
      SELECT DISTINCT s.id, s.name 
      FROM inventory_lines il 
      JOIN products p ON il.product_id = p.id 
      JOIN product_suppliers ps ON p.id = ps.product_id
      JOIN suppliers s ON ps.supplier_id = s.id
      WHERE il.session_id = ?
      ORDER BY s.name ASC
    `)
    .bind(sessionId)
    .all();

  return c.json({
    categories: categories.map((r: any) => r.category),
    brands: brands.map((r: any) => r.brand),
    units: units.map((r: any) => r.unit),
    suppliers
  });
});

// Get lines for a specific person (privacy-aware - only shows their data)
app.get("/api/inventory-sessions/:sessionId/my-lines", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");
  const personNumber = parseInt(c.req.query("person_number") || "0");
  
  if (personNumber !== 1 && personNumber !== 2) {
    return c.json({ error: "person_number query param (1 or 2) is required" }, 400);
  }
  
  // Pagination
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  
  // Filters
  const microSectionId = c.req.query("micro_section_id");
  const category = c.req.query("category");
  const brand = c.req.query("brand");
  const supplierId = c.req.query("supplier_id");
  const unit = c.req.query("unit");
  const search = c.req.query("search");
  const uncountedOnly = c.req.query("uncounted_only") === "true";
  const qtyFilter = c.req.query("qty_filter"); // "zero", "non_zero", "custom"
  const qtyMin = c.req.query("qty_min") ? parseInt(c.req.query("qty_min")!) : null;
  const qtyMax = c.req.query("qty_max") ? parseInt(c.req.query("qty_max")!) : null;

  const isPerson1 = personNumber === 1;
  const systemQtyField = isPerson1 ? 'il.system_qty_person1' : 'il.system_qty_person2';
  const physicalQtyField = isPerson1 ? 'il.physical_qty_person1' : 'il.physical_qty_person2';
  const differenceField = isPerson1 ? 'il.difference_person1' : 'il.difference_person2';
  const countedAtField = isPerson1 ? 'il.counted_at_person1' : 'il.counted_at_person2';

  // For qty filter, use the same value that's displayed:
  // - Person's snapshot if they've counted (system_qty_person1/2)
  // - Otherwise fall back to original system_qty or current product qty
  const qtyFieldForFilter = `COALESCE(${systemQtyField}, il.system_qty, p.total_qty, 0)`;

  let baseQuery = `
    FROM inventory_lines il
    JOIN products p ON il.product_id = p.id
  `;
  
  if (supplierId) {
    baseQuery += " JOIN product_suppliers ps ON p.id = ps.product_id";
  }
  
  baseQuery += " WHERE il.session_id = ?";
  const params: any[] = [sessionId];

  if (microSectionId) {
    baseQuery += " AND il.micro_section_id = ?";
    params.push(microSectionId);
  }
  
  if (category) {
    baseQuery += " AND p.category = ?";
    params.push(category);
  }
  if (brand) {
    baseQuery += " AND p.brand = ?";
    params.push(brand);
  }
  if (supplierId) {
    baseQuery += " AND ps.supplier_id = ?";
    params.push(supplierId);
  }
  if (unit) {
    baseQuery += " AND p.unit = ?";
    params.push(unit);
  }
  if (search) {
    baseQuery += " AND (p.name LIKE ? OR p.sku LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (uncountedOnly) {
    baseQuery += ` AND ${physicalQtyField} IS NULL`;
  }
  
  // Apply quantity filters - uses the displayed qty value
  // (person's snapshot if counted, otherwise original system qty or product total qty)
  if (qtyFilter === 'zero') {
    baseQuery += ` AND ${qtyFieldForFilter} = 0`;
  } else if (qtyFilter === 'non_zero') {
    baseQuery += ` AND ${qtyFieldForFilter} > 0`;
  } else if (qtyFilter === 'custom') {
    if (qtyMin !== null) {
      baseQuery += ` AND ${qtyFieldForFilter} >= ?`;
      params.push(qtyMin);
    }
    if (qtyMax !== null) {
      baseQuery += ` AND ${qtyFieldForFilter} <= ?`;
      params.push(qtyMax);
    }
  }

  // Get total count
  const countResult = await c.env.DB
    .prepare(`SELECT COUNT(DISTINCT il.id) as total ${baseQuery}`)
    .bind(...params)
    .first<{ total: number }>();

  // Get counted count for progress
  const countedResult = await c.env.DB
    .prepare(`SELECT COUNT(DISTINCT il.id) as counted ${baseQuery} AND ${physicalQtyField} IS NOT NULL`)
    .bind(...params)
    .first<{ counted: number }>();

  // Select only this person's data - never expose the other person's counts
  const selectQuery = `
    SELECT DISTINCT 
      il.id, il.session_id, il.product_id, il.micro_section_id,
      ${systemQtyField} as system_qty,
      ${physicalQtyField} as physical_qty,
      ${differenceField} as difference,
      ${countedAtField} as counted_at,
      p.total_qty as current_system_qty,
      p.name as product_name, p.sku, p.unit, p.category, p.brand, p.margin
    ${baseQuery}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `;
  
  const { results } = await c.env.DB
    .prepare(selectQuery)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    lines: results,
    total: countResult?.total || 0,
    counted: countedResult?.counted || 0,
    limit,
    offset
  });
});

app.post("/api/inventory-sessions/:sessionId/lines", authMiddleware, async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { product_id, system_qty } = body;

  if (!product_id || system_qty === undefined) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const result = await c.env.DB
    .prepare(`
      INSERT INTO inventory_lines (session_id, product_id, system_qty)
      VALUES (?, ?, ?)
    `)
    .bind(sessionId, product_id, system_qty)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to create inventory line" }, 500);
  }

  const line = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first<InventoryLine>();

  return c.json(line, 201);
});

app.patch("/api/lines/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const {
    physical_qty,
    person_number, // 1 or 2 - which person is counting
    system_qty_override, // Optional: use live qty from API instead of snapshot
  } = body;

  if (!person_number || (person_number !== 1 && person_number !== 2)) {
    return c.json({ error: "person_number (1 or 2) is required" }, 400);
  }

  // Get the line with current product data
  const line = await c.env.DB
    .prepare(`
      SELECT il.*, p.total_qty as current_system_qty 
      FROM inventory_lines il 
      JOIN products p ON il.product_id = p.id 
      WHERE il.id = ?
    `)
    .bind(id)
    .first<any>();

  if (!line) {
    return c.json({ error: "Line not found" }, 404);
  }

  // Determine which fields to update based on person_number
  const isPerson1 = person_number === 1;
  const systemQtyField = isPerson1 ? 'system_qty_person1' : 'system_qty_person2';
  const physicalQtyField = isPerson1 ? 'physical_qty_person1' : 'physical_qty_person2';
  const differenceField = isPerson1 ? 'difference_person1' : 'difference_person2';
  const countedAtField = isPerson1 ? 'counted_at_person1' : 'counted_at_person2';

  // Get the current system qty snapshot for this person, or create one if first count
  let systemQtySnapshot = isPerson1 ? line.system_qty_person1 : line.system_qty_person2;
  const isFirstCount = systemQtySnapshot === null;
  
  if (isFirstCount) {
    // Use override from live API data if provided, otherwise use current system qty
    systemQtySnapshot = system_qty_override !== undefined ? system_qty_override : (line.current_system_qty || 0);
  }

  // Calculate difference based on this person's snapshot
  const difference = physical_qty !== null && physical_qty !== undefined
    ? physical_qty - systemQtySnapshot
    : null;

  // Build the update - only update this person's fields
  let updateFields = `
    ${physicalQtyField} = ?,
    ${differenceField} = ?,
    updated_at = CURRENT_TIMESTAMP
  `;
  let updateParams: any[] = [physical_qty, difference];

  // If first count, also save the system qty snapshot and timestamp
  if (isFirstCount) {
    updateFields = `
      ${systemQtyField} = ?,
      ${physicalQtyField} = ?,
      ${differenceField} = ?,
      ${countedAtField} = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    `;
    updateParams = [systemQtySnapshot, physical_qty, difference];
  }

  const result = await c.env.DB
    .prepare(`UPDATE inventory_lines SET ${updateFields} WHERE id = ?`)
    .bind(...updateParams, id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to update line" }, 500);
  }

  // After update, recalculate is_same_difference and needs_adjustment
  const updatedLine = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first<any>();

  const diff1 = updatedLine.difference_person1;
  const diff2 = updatedLine.difference_person2;
  const isSameDifference = diff1 !== null && diff2 !== null && diff1 === diff2;
  const needsAdjustment = isSameDifference && diff1 !== 0;

  await c.env.DB
    .prepare(`
      UPDATE inventory_lines SET
        is_same_difference = ?,
        needs_adjustment = ?
      WHERE id = ?
    `)
    .bind(isSameDifference ? 1 : 0, needsAdjustment ? 1 : 0, id)
    .run();

  // Return only this person's data for privacy
  const finalLine = await c.env.DB
    .prepare(`
      SELECT il.id, il.session_id, il.product_id, il.micro_section_id,
             il.${systemQtyField} as system_qty,
             il.${physicalQtyField} as physical_qty,
             il.${differenceField} as difference,
             il.${countedAtField} as counted_at,
             il.is_same_difference, il.is_verified, il.is_adjusted,
             p.name as product_name, p.sku, p.unit, p.category, p.brand, p.margin
      FROM inventory_lines il
      JOIN products p ON il.product_id = p.id
      WHERE il.id = ?
    `)
    .bind(id)
    .first();

  return c.json(finalLine);
});

// Manager: unlock a line for recount
app.patch("/api/lines/:id/unlock", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { person_number } = body;

  if (!person_number || (person_number !== 1 && person_number !== 2)) {
    return c.json({ error: "person_number (1 or 2) is required" }, 400);
  }

  const isPerson1 = person_number === 1;
  const unlockField = isPerson1 ? 'unlocked_for_recount_person1' : 'unlocked_for_recount_person2';
  const physicalQtyField = isPerson1 ? 'physical_qty_person1' : 'physical_qty_person2';
  const systemQtyField = isPerson1 ? 'system_qty_person1' : 'system_qty_person2';
  const differenceField = isPerson1 ? 'difference_person1' : 'difference_person2';
  const countedAtField = isPerson1 ? 'counted_at_person1' : 'counted_at_person2';

  // Clear the person's count data and set unlock flag
  const result = await c.env.DB
    .prepare(`
      UPDATE inventory_lines SET 
        ${unlockField} = 1,
        ${physicalQtyField} = NULL,
        ${systemQtyField} = NULL,
        ${differenceField} = NULL,
        ${countedAtField} = NULL,
        is_same_difference = 0,
        needs_adjustment = 0,
        is_verified = 0,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    .bind(id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to unlock line" }, 500);
  }

  const line = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first();

  return c.json(line);
});

// Manager: update adjustment status
app.patch("/api/lines/:id/adjustment-status", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { adjustment_status } = body;

  const validStatuses = ['PENDING', 'ORDER_CREATED', 'DONE'];
  if (!validStatuses.includes(adjustment_status)) {
    return c.json({ error: "Invalid adjustment_status. Use PENDING, ORDER_CREATED, or DONE" }, 400);
  }

  const result = await c.env.DB
    .prepare("UPDATE inventory_lines SET adjustment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(adjustment_status, id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to update adjustment status" }, 500);
  }

  const line = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first();

  return c.json(line);
});

app.patch("/api/lines/:id/verify", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const result = await c.env.DB
    .prepare("UPDATE inventory_lines SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to verify line" }, 500);
  }

  const line = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first<InventoryLine>();

  return c.json(line);
});

app.patch("/api/lines/:id/unverify", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const result = await c.env.DB
    .prepare("UPDATE inventory_lines SET is_verified = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to unverify line" }, 500);
  }

  const line = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first<InventoryLine>();

  return c.json(line);
});

app.post("/api/lines/:id/adjust", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { location } = body;

  if (!location) {
    return c.json({ error: "Location required" }, 400);
  }

  // Get the line
  const line = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first<InventoryLine>();

  if (!line) {
    return c.json({ error: "Line not found" }, 404);
  }

  if (!line.is_verified) {
    return c.json({ error: "Line must be verified before adjustment" }, 400);
  }

  if (!line.needs_adjustment) {
    return c.json({ error: "Line does not need adjustment" }, 400);
  }

  // Calculate adjustment quantity (use person 1's difference since they match)
  const adjustmentQty = line.difference_person1 || 0;

  // Create stock movement
  await c.env.DB
    .prepare(`
      INSERT INTO stock_movements (
        product_id, location, movement_type, quantity, 
        reference_type, reference_id, notes
      ) VALUES (?, ?, 'INVENTORY_ADJUSTMENT', ?, 'inventory_line', ?, ?)
    `)
    .bind(
      line.product_id,
      location,
      adjustmentQty,
      id,
      `Inventory adjustment from session ${line.session_id}`
    )
    .run();

  // Mark line as adjusted
  const result = await c.env.DB
    .prepare("UPDATE inventory_lines SET is_adjusted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();

  if (!result.success) {
    return c.json({ error: "Failed to mark line as adjusted" }, 500);
  }

  const updatedLine = await c.env.DB
    .prepare("SELECT * FROM inventory_lines WHERE id = ?")
    .bind(id)
    .first<InventoryLine>();

  return c.json(updatedLine);
});

// Adjustment Order endpoints
app.post("/api/inventory-sessions/:sessionId/adjustment-orders", authMiddleware, async (c) => {
  const sessionId = parseInt(c.req.param("sessionId"));
  const body = await c.req.json();
  const { line_ids } = body;

  if (!line_ids || !Array.isArray(line_ids) || line_ids.length === 0) {
    return c.json({ error: "line_ids array is required" }, 400);
  }

  const mochaUser = c.get("user");
  const result = await createAdjustmentOrder(
    c.env.DB, 
    sessionId, 
    line_ids,
    mochaUser?.id ?? undefined,
    mochaUser?.google_user_data?.name ?? undefined
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ 
    success: true, 
    order_id: result.orderId,
    item_count: result.itemCount 
  }, 201);
});

app.get("/api/inventory-sessions/:sessionId/adjustment-orders", authMiddleware, async (c) => {
  const sessionId = parseInt(c.req.param("sessionId"));
  const orders = await getAdjustmentOrders(c.env.DB, sessionId);
  return c.json(orders);
});

app.patch("/api/adjustment-orders/:id/status", authMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const { status, admin_code } = body;

  // Require admin code for completing orders
  if (status === 'COMPLETED') {
    if (!admin_code || admin_code !== c.env.ADMIN_CODE) {
      return c.json({ error: "Invalid admin code" }, 403);
    }
  }

  const result = await updateAdjustmentOrderStatus(c.env.DB, id, status);
  
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true });
});

app.get("/api/adjustment-orders/:id/lines", authMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  
  const { results } = await c.env.DB
    .prepare(`
      SELECT il.*, p.name as product_name, p.sku, p.unit as product_unit_live,
             p.category as product_category_live, p.brand as product_brand_live,
             p.total_qty as current_system_qty
      FROM inventory_lines il
      JOIN products p ON il.product_id = p.id
      WHERE il.adjustment_order_id = ?
      ORDER BY p.name ASC
    `)
    .bind(id)
    .all();

  return c.json(results);
});

// Stock movement endpoints - protected
app.get("/api/movements", authMiddleware, async (c) => {
  const productId = c.req.query("product_id");
  const location = c.req.query("location");
  const limit = parseInt(c.req.query("limit") || "50");

  let query = "SELECT * FROM stock_movements WHERE 1=1";
  const params: any[] = [];

  if (productId) {
    query += " AND product_id = ?";
    params.push(productId);
  }

  if (location) {
    query += " AND location = ?";
    params.push(location);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const { results } = await c.env.DB
    .prepare(query)
    .bind(...params)
    .all();

  return c.json(results);
});

export default app;
