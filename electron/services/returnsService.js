const { getDatabase } = require('../database/database');
const { adjustInventory } = require('./inventoryService');

function getNextReturnNumber() {
  const db = getDatabase();
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'return_prefix'").get()?.value || 'RET-';
  const last = db.prepare(`
    SELECT return_number FROM sales_returns
    WHERE return_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(prefix + '%');
  let num = 1;
  if (last) {
    const match = last.return_number.match(/(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  // also check purchase returns
  const lastP = db.prepare(`
    SELECT return_number FROM purchase_returns
    WHERE return_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(prefix + '%');
  if (lastP) {
    const match = lastP.return_number.match(/(\d+)$/);
    if (match) num = Math.max(num, parseInt(match[1], 10) + 1);
  }
  return prefix + String(num).padStart(6, '0');
}

function createSalesReturn({ sales_invoice_id, items = [], notes = null }) {
  if (!sales_invoice_id) throw new Error('فاتورة البيع مطلوبة');
  if (!items || items.length === 0) throw new Error('يجب إضافة منتج واحد على الأقل');

  const db = getDatabase();

  const run = db.transaction(() => {
    const invoice = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(sales_invoice_id);
    if (!invoice) throw new Error('فاتورة البيع غير موجودة');

    let total = 0;
    const prepared = [];

    for (const item of items) {
      const saleItem = db.prepare('SELECT * FROM sales_items WHERE id = ? AND invoice_id = ?').get(item.sales_item_id, sales_invoice_id);
      if (!saleItem) throw new Error('بند الفاتورة غير موجود');

      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error('كمية غير صالحة');

      const alreadyReturned = saleItem.returned_quantity || 0;
      if (alreadyReturned + qty > saleItem.quantity + 0.0001) {
        throw new Error(`الكمية المرتجعة تتجاوز الكمية المباعة للمنتج: ${saleItem.product_name}`);
      }

      const conversion = saleItem.conversion_factor || 1;
      const baseQty = qty * conversion;
      const lineTotal = qty * saleItem.unit_price;
      total += lineTotal;

      prepared.push({
        product_id: saleItem.product_id,
        product_name: saleItem.product_name,
        unit_name: saleItem.unit_name,
        quantity: qty,
        conversion_factor: conversion,
        base_quantity: baseQty,
        unit_price: saleItem.unit_price,
        total: lineTotal,
        sales_item_id: saleItem.id
      });
    }

    const returnNumber = getNextReturnNumber();
    const retResult = db.prepare(`
      INSERT INTO sales_returns (return_number, sales_invoice_id, customer_id, total, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(returnNumber, sales_invoice_id, invoice.customer_id, total, notes);

    const returnId = retResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO sales_return_items (return_id, product_id, product_name, unit_name, quantity, conversion_factor, base_quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of prepared) {
      insertItem.run(returnId, it.product_id, it.product_name, it.unit_name, it.quantity, it.conversion_factor, it.base_quantity, it.unit_price, it.total);
      // Restore stock
      adjustInventory(it.product_id, it.base_quantity, 'SALES_RETURN', 'sales_return', returnId, `مرتجع بيع ${returnNumber}`);
      // Update returned_quantity
      db.prepare('UPDATE sales_items SET returned_quantity = returned_quantity + ? WHERE id = ?').run(it.quantity, it.sales_item_id);
    }

    // Cashbox refund
    if (total > 0) {
      db.prepare(`
        INSERT INTO cashbox_transactions (type, amount, description, reference_type, reference_id)
        VALUES ('sales_return', ?, ?, 'sales_return', ?)
      `).run(-total, `مرتجع بيع ${returnNumber}`, returnId);
    }

    return { id: returnId, return_number: returnNumber, total };
  });

  return run();
}

function createPurchaseReturn({ purchase_invoice_id, items = [], notes = null }) {
  if (!purchase_invoice_id) throw new Error('فاتورة الشراء مطلوبة');
  if (!items || items.length === 0) throw new Error('يجب إضافة منتج واحد على الأقل');

  const db = getDatabase();

  const run = db.transaction(() => {
    const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(purchase_invoice_id);
    if (!invoice) throw new Error('فاتورة الشراء غير موجودة');

    let total = 0;
    const prepared = [];

    for (const item of items) {
      const purItem = db.prepare('SELECT * FROM purchase_items WHERE id = ? AND invoice_id = ?').get(item.purchase_item_id, purchase_invoice_id);
      if (!purItem) throw new Error('بند الفاتورة غير موجود');

      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error('كمية غير صالحة');

      const alreadyReturned = purItem.returned_quantity || 0;
      if (alreadyReturned + qty > purItem.quantity + 0.0001) {
        throw new Error(`الكمية المرتجعة تتجاوز الكمية المشتراة للمنتج: ${purItem.product_name}`);
      }

      const conversion = purItem.conversion_factor || 1;
      const baseQty = qty * conversion;
      const lineTotal = qty * purItem.purchase_price;
      total += lineTotal;

      prepared.push({
        product_id: purItem.product_id,
        product_name: purItem.product_name,
        unit_name: purItem.unit_name,
        quantity: qty,
        conversion_factor: conversion,
        base_quantity: baseQty,
        purchase_price: purItem.purchase_price,
        total: lineTotal,
        purchase_item_id: purItem.id
      });
    }

    const returnNumber = getNextReturnNumber();
    const retResult = db.prepare(`
      INSERT INTO purchase_returns (return_number, purchase_invoice_id, supplier_id, total, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(returnNumber, purchase_invoice_id, invoice.supplier_id, total, notes);

    const returnId = retResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO purchase_return_items (return_id, product_id, product_name, unit_name, quantity, conversion_factor, base_quantity, purchase_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of prepared) {
      insertItem.run(returnId, it.product_id, it.product_name, it.unit_name, it.quantity, it.conversion_factor, it.base_quantity, it.purchase_price, it.total);
      // Decrease stock
      adjustInventory(it.product_id, -it.base_quantity, 'PURCHASE_RETURN', 'purchase_return', returnId, `مرتجع شراء ${returnNumber}`);
      db.prepare('UPDATE purchase_items SET returned_quantity = returned_quantity + ? WHERE id = ?').run(it.quantity, it.purchase_item_id);
    }

    if (total > 0) {
      db.prepare(`
        INSERT INTO cashbox_transactions (type, amount, description, reference_type, reference_id)
        VALUES ('purchase_return', ?, ?, 'purchase_return', ?)
      `).run(total, `مرتجع شراء ${returnNumber}`, returnId);
    }

    return { id: returnId, return_number: returnNumber, total };
  });

  return run();
}

function getSalesReturns({ fromDate = null, toDate = null, page = 1, limit = 50 } = {}) {
  const db = getDatabase();
  let where = [];
  let params = [];
  if (fromDate) { where.push('created_at >= ?'); params.push(fromDate); }
  if (toDate) { where.push('created_at <= ?'); params.push(toDate + ' 23:59:59'); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;
  const rows = db.prepare(`SELECT * FROM sales_returns ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM sales_returns ${whereClause}`).get(...params);
  return { returns: rows, total, page, limit };
}

function getPurchaseReturns({ fromDate = null, toDate = null, page = 1, limit = 50 } = {}) {
  const db = getDatabase();
  let where = [];
  let params = [];
  if (fromDate) { where.push('created_at >= ?'); params.push(fromDate); }
  if (toDate) { where.push('created_at <= ?'); params.push(toDate + ' 23:59:59'); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;
  const rows = db.prepare(`SELECT * FROM purchase_returns ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM purchase_returns ${whereClause}`).get(...params);
  return { returns: rows, total, page, limit };
}

module.exports = {
  createSalesReturn,
  createPurchaseReturn,
  getSalesReturns,
  getPurchaseReturns,
  getNextReturnNumber
};
