const { getDatabase } = require('../database/database');

/**
 * Adjust inventory with full audit trail.
 * quantity is always in BASE UNIT.
 * Positive quantity = increase, negative = decrease.
 */
function adjustInventory(productId, quantity, movementType, referenceType = null, referenceId = null, notes = null, costPrice = null) {
  const db = getDatabase();
  const product = db.prepare('SELECT id, current_stock, average_cost, name FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('المنتج غير موجود');

  const previous = product.current_stock;
  const newQty = previous + quantity;

  if (newQty < -0.0001) { // allow tiny floating error
    throw new Error(`المخزون غير كافٍ للمنتج: ${product.name}. المتاح: ${previous}`);
  }

  // Update weighted average cost on purchase increase
  let newAvgCost = product.average_cost;
  if (quantity > 0 && costPrice != null && costPrice >= 0 && (movementType === 'PURCHASE' || movementType === 'ADJUSTMENT_ADD')) {
    const totalValue = (previous * product.average_cost) + (quantity * costPrice);
    const totalQty = previous + quantity;
    newAvgCost = totalQty > 0 ? totalValue / totalQty : costPrice;
  }

  const update = db.prepare(`
    UPDATE products SET current_stock = ?, average_cost = ?, updated_at = datetime('now') WHERE id = ?
  `);
  const insertMovement = db.prepare(`
    INSERT INTO inventory_movements (product_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  update.run(Math.max(0, newQty), newAvgCost, productId);
  insertMovement.run(productId, movementType, quantity, previous, Math.max(0, newQty), referenceType, referenceId, notes);

  return { previous, new: Math.max(0, newQty), average_cost: newAvgCost };
}

function getInventoryMovements({ productId = null, fromDate = null, toDate = null, limit = 100 } = {}) {
  const db = getDatabase();
  let where = [];
  let params = [];
  if (productId) {
    where.push('im.product_id = ?');
    params.push(productId);
  }
  if (fromDate) {
    where.push('im.created_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    where.push('im.created_at <= ?');
    params.push(toDate + ' 23:59:59');
  }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  params.push(limit);

  return db.prepare(`
    SELECT im.*, p.name as product_name, p.base_unit
    FROM inventory_movements im
    JOIN products p ON p.id = im.product_id
    ${whereClause}
    ORDER BY im.created_at DESC
    LIMIT ?
  `).all(...params);
}

function manualAdjustment(productId, quantity, notes = '') {
  const db = getDatabase();
  const type = quantity >= 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_REMOVE';
  const run = db.transaction(() => {
    return adjustInventory(productId, quantity, type, 'manual', null, notes || 'تعديل يدوي');
  });
  return run();
}

module.exports = {
  adjustInventory,
  getInventoryMovements,
  manualAdjustment
};
