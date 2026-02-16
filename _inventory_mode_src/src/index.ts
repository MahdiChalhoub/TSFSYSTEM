import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Get all inventory sessions
app.get('/api/sessions', async (c) => {
  const db = c.env.DB;
  
  const sessions = await db.prepare(`
    SELECT 
      s.*,
      COUNT(DISTINCT il.id) as items_count,
      COUNT(DISTINCT CASE WHEN il.physical_qty_person1 IS NOT NULL AND il.physical_qty_person2 IS NOT NULL THEN il.id END) as completed_items
    FROM inventory_sessions s
    LEFT JOIN inventory_lines il ON il.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();
  
  return c.json(sessions.results);
});

// Get a specific session with its inventory lines
app.get('/api/sessions/:id', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  
  const session = await db.prepare(`
    SELECT * FROM inventory_sessions WHERE id = ?
  `).bind(sessionId).first();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  const lines = await db.prepare(`
    SELECT 
      il.*,
      p.name as product_name,
      p.category as product_category,
      p.brand as product_brand,
      p.unit as product_unit,
      p.image_url as product_image_url
    FROM inventory_lines il
    JOIN products p ON p.id = il.product_id
    WHERE il.session_id = ?
    ORDER BY p.name
  `).bind(sessionId).all();
  
  return c.json({
    session,
    lines: lines.results
  });
});

// Create a new inventory session
app.post('/api/sessions', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  
  const { location, section, person1_name, person2_name } = body;
  
  if (!location || !section || !person1_name || !person2_name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  // Create session
  const sessionResult = await db.prepare(`
    INSERT INTO inventory_sessions (location, section, person1_name, person2_name, session_date, status)
    VALUES (?, ?, ?, ?, date('now'), 'IN_PROGRESS')
  `).bind(location, section, person1_name, person2_name).run();
  
  const sessionId = sessionResult.meta.last_row_id;
  
  // Get all products and create inventory lines with system quantities
  // For now, we'll use a placeholder system quantity. In production, this would come from the external API
  const products = await db.prepare(`SELECT id FROM products`).all();
  
  for (const product of products.results) {
    // In production, you would fetch the current quantity from the external API here
    const systemQty = Math.floor(Math.random() * 100) + 20; // Placeholder
    
    await db.prepare(`
      INSERT INTO inventory_lines (session_id, product_id, system_qty)
      VALUES (?, ?, ?)
    `).bind(sessionId, product.id, systemQty).run();
  }
  
  return c.json({ id: sessionId, success: true });
});

// Update inventory line quantities
app.patch('/api/inventory-lines/:id', async (c) => {
  const db = c.env.DB;
  const lineId = c.req.param('id');
  const body = await c.req.json();
  
  const { physical_qty_person1, physical_qty_person2 } = body;
  
  // Get current line data
  const line = await db.prepare(`
    SELECT * FROM inventory_lines WHERE id = ?
  `).bind(lineId).first();
  
  if (!line) {
    return c.json({ error: 'Inventory line not found' }, 404);
  }
  
  // Calculate differences
  const qty1 = physical_qty_person1 !== undefined ? physical_qty_person1 : line.physical_qty_person1;
  const qty2 = physical_qty_person2 !== undefined ? physical_qty_person2 : line.physical_qty_person2;
  
  const diff1 = qty1 !== null ? qty1 - line.system_qty : null;
  const diff2 = qty2 !== null ? qty2 - line.system_qty : null;
  
  const isSameDifference = diff1 !== null && diff2 !== null && diff1 === diff2 ? 1 : 0;
  const needsAdjustment = isSameDifference && diff1 !== 0 ? 1 : 0;
  
  // Update line
  await db.prepare(`
    UPDATE inventory_lines 
    SET 
      physical_qty_person1 = ?,
      physical_qty_person2 = ?,
      difference_person1 = ?,
      difference_person2 = ?,
      is_same_difference = ?,
      needs_adjustment = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(qty1, qty2, diff1, diff2, isSameDifference, needsAdjustment, lineId).run();
  
  return c.json({ success: true });
});

// Complete counting (change session status to WAITING_VERIFICATION)
app.post('/api/sessions/:id/complete', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  
  // Check if all items are counted
  const incomplete = await db.prepare(`
    SELECT COUNT(*) as count 
    FROM inventory_lines 
    WHERE session_id = ? 
    AND (physical_qty_person1 IS NULL OR physical_qty_person2 IS NULL)
  `).bind(sessionId).first();
  
  if (incomplete && incomplete.count > 0) {
    return c.json({ error: 'Not all items have been counted by both persons' }, 400);
  }
  
  await db.prepare(`
    UPDATE inventory_sessions 
    SET status = 'WAITING_VERIFICATION', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(sessionId).run();
  
  return c.json({ success: true });
});

// Verify session (manager approval)
app.post('/api/sessions/:id/verify', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  
  const session = await db.prepare(`
    SELECT status FROM inventory_sessions WHERE id = ?
  `).bind(sessionId).first();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  if (session.status !== 'WAITING_VERIFICATION') {
    return c.json({ error: 'Session is not ready for verification' }, 400);
  }
  
  // Mark all lines as verified
  await db.prepare(`
    UPDATE inventory_lines 
    SET is_verified = 1, updated_at = CURRENT_TIMESTAMP
    WHERE session_id = ?
  `).bind(sessionId).run();
  
  await db.prepare(`
    UPDATE inventory_sessions 
    SET status = 'VERIFIED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(sessionId).run();
  
  return c.json({ success: true });
});

// Create stock adjustments for a verified session
app.post('/api/sessions/:id/adjust', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  
  const session = await db.prepare(`
    SELECT * FROM inventory_sessions WHERE id = ?
  `).bind(sessionId).first();
  
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  
  if (session.status !== 'VERIFIED') {
    return c.json({ error: 'Session must be verified before adjustments can be made' }, 400);
  }
  
  // Get all lines that need adjustment
  const linesToAdjust = await db.prepare(`
    SELECT il.*, p.external_product_id
    FROM inventory_lines il
    JOIN products p ON p.id = il.product_id
    WHERE il.session_id = ? 
    AND il.needs_adjustment = 1
    AND il.is_adjusted = 0
  `).bind(sessionId).all();
  
  let adjustmentCount = 0;
  
  for (const line of linesToAdjust.results) {
    // Create stock movement record for audit trail
    await db.prepare(`
      INSERT INTO stock_movements (
        product_id, 
        location, 
        movement_type, 
        quantity, 
        reference_type, 
        reference_id,
        notes
      )
      VALUES (?, ?, 'INVENTORY_ADJUSTMENT', ?, 'inventory_line', ?, ?)
    `).bind(
      line.product_id,
      session.location,
      line.difference_person1, // Use person1's difference since they match
      line.id,
      `Inventory adjustment from session ${sessionId}`
    ).run();
    
    // Mark line as adjusted
    await db.prepare(`
      UPDATE inventory_lines 
      SET is_adjusted = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(line.id).run();
    
    adjustmentCount++;
  }
  
  // Update session status
  await db.prepare(`
    UPDATE inventory_sessions 
    SET status = 'ADJUSTED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(sessionId).run();
  
  return c.json({ 
    success: true, 
    adjustments_created: adjustmentCount 
  });
});

// Get all products
app.get('/api/products', async (c) => {
  const db = c.env.DB;
  
  const products = await db.prepare(`
    SELECT * FROM products ORDER BY name
  `).all();
  
  return c.json(products.results);
});

// Get stock movements (audit trail)
app.get('/api/stock-movements', async (c) => {
  const db = c.env.DB;
  const productId = c.req.query('product_id');
  
  let query = `
    SELECT 
      sm.*,
      p.name as product_name,
      p.external_product_id
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
  `;
  
  const params: any[] = [];
  
  if (productId) {
    query += ' WHERE sm.product_id = ?';
    params.push(productId);
  }
  
  query += ' ORDER BY sm.created_at DESC LIMIT 100';
  
  const movements = await db.prepare(query).bind(...params).all();
  
  return c.json(movements.results);
});

export default app;
