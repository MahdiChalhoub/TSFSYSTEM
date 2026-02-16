// Adjustment Order API endpoints

export async function createAdjustmentOrder(
  db: D1Database,
  sessionId: number,
  lineIds: number[],
  userId: string | undefined,
  userName: string | undefined
) {
  if (lineIds.length === 0) {
    return { success: false, error: "No items selected" };
  }

  // Filter to only include lines that need adjustment (difference != 0)
  const placeholders = lineIds.map(() => '?').join(',');
  const { results: eligibleLines } = await db
    .prepare(`
      SELECT id FROM inventory_lines 
      WHERE id IN (${placeholders})
      AND session_id = ?
      AND ((difference_person1 IS NOT NULL AND difference_person1 != 0) 
           OR (difference_person2 IS NOT NULL AND difference_person2 != 0))
    `)
    .bind(...lineIds, sessionId)
    .all<{ id: number }>();

  if (eligibleLines.length === 0) {
    return { 
      success: false, 
      error: "None of the selected items need adjustment (all differences are 0)" 
    };
  }

  // Create the adjustment order
  const orderResult = await db
    .prepare(`
      INSERT INTO adjustment_orders (session_id, created_by_user_id, created_by_user_name, status)
      VALUES (?, ?, ?, 'PENDING')
    `)
    .bind(sessionId, userId || null, userName || null)
    .run();

  if (!orderResult.success) {
    return { success: false, error: "Failed to create adjustment order" };
  }

  const orderId = orderResult.meta.last_row_id;

  // Link the eligible lines to this order and update their status
  for (const line of eligibleLines) {
    await db
      .prepare(`
        UPDATE inventory_lines 
        SET adjustment_order_id = ?, 
            adjustment_status = 'ORDER_CREATED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(orderId, line.id)
      .run();
  }

  return { 
    success: true, 
    orderId,
    itemCount: eligibleLines.length 
  };
}

export async function getAdjustmentOrders(db: D1Database, sessionId: number) {
  const { results } = await db
    .prepare(`
      SELECT 
        ao.*,
        COUNT(il.id) as item_count,
        SUM(CASE WHEN il.adjustment_status = 'DONE' THEN 1 ELSE 0 END) as done_count
      FROM adjustment_orders ao
      LEFT JOIN inventory_lines il ON ao.id = il.adjustment_order_id
      WHERE ao.session_id = ?
      GROUP BY ao.id
      ORDER BY ao.created_at DESC
    `)
    .bind(sessionId)
    .all();

  return results;
}

export async function updateAdjustmentOrderStatus(
  db: D1Database,
  orderId: number,
  status: string
) {
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
  if (!validStatuses.includes(status)) {
    return { success: false, error: "Invalid status" };
  }

  const result = await db
    .prepare("UPDATE adjustment_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, orderId)
    .run();

  if (!result.success) {
    return { success: false, error: "Failed to update order status" };
  }

  // When order is completed, mark all items as DONE
  if (status === 'COMPLETED') {
    await db
      .prepare(`
        UPDATE inventory_lines 
        SET adjustment_status = 'DONE', updated_at = CURRENT_TIMESTAMP 
        WHERE adjustment_order_id = ?
      `)
      .bind(orderId)
      .run();
  }

  return { success: true };
}
