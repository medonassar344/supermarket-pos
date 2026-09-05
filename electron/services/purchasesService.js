const { getDatabase } = require('../database/database');
const { adjustInventory } = require('./inventoryService');

function getNextPurchaseNumber() {
  const db = getDatabase();
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'purchase_prefix'").get()?.value || 'PUR-';
  const last = db.prepare(`
    SELECT invoice_number FROM purchase_invoices
    WHERE invoice_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(prefix + '%');
  let num = 1;
  if (last) {
    const match = last.invoice_number.match(/(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return prefix + String(num).padStart(6, '0');
}

function createPurchase({ supplier_id = null, items = [], discount = 0, paid_amount = 0, notes = null }) {
  if (!items || items.length === 0) throw new Error('يجب إضافة منتج واحد على الأقل');
  if (discount < 0) throw new Error('الخصم لا يمكن أن يكون سالباً');

  const db = getDatabase();

  const run = db.transaction(() => {
    const preparedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw new Error(`المنتج غير موجود: ${item.product_id}`);

      let unit;
      if (item.unit_id) {
        unit = db.prepare('SELECT * FROM product_units WHERE id = ? AND product_id = ?').get(item.unit_id, product.id);
      } else {
        unit = db.prepare('SELECT * FROM product_units WHERE product_id = ? AND unit_name = ?').get(product.id, item.unit_name || product.base_unit);
      }
      if (!unit) {
        unit = db.prepare('SELECT * FROM product_units WHERE product_id = ? AND is_base = 1').get(product.id);
      }
      if (!unit) throw new Error(`وحدة المنتج غير موجودة: ${product.name}`);

      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error(`كمية غير صالحة: ${product.name}`);

      const conversion = unit.conversion_factor || 1;
      const baseQty = qty * conversion;
      const purchasePrice = item.purchase_price != null ? parseFloat(item.purchase_price) : (unit.purchase_price ?? product.purchase_price);
      if (purchasePrice < 0) throw new Error('سعر الشراء لا يمكن أن يكون سالباً');

      const lineTotal = qty * purchasePrice;
      subtotal += lineTotal;

      preparedItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_name: unit.unit_name,
        quantity: qty,
        conversion_factor: conversion,
        base_quantity: baseQty,
        purchase_price: purchasePrice,
        total: lineTotal
      });
    }

    const total = Math.max(0, subtotal - (discount || 0));
    const paid = paid_amount != null ? parseFloat(paid_amount) : 0;
    const remaining = Math.max(0, total - paid);
    const invoiceNumber = getNextPurchaseNumber();

    const invResult = db.prepare(`
      INSERT INTO purchase_invoices (invoice_number, supplier_id, subtotal, discount, total, paid_amount, remaining_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceNumber, supplier_id, subtotal, discount || 0, total, paid, remaining, notes);

    const invoiceId = invResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO purchase_items (invoice_id, product_id, product_name, unit_name, quantity, conversion_factor, base_quantity, purchase_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of preparedItems) {
      insertItem.run(invoiceId, it.product_id, it.product_name, it.unit_name, it.quantity, it.conversion_factor, it.base_quantity, it.purchase_price, it.total);
      // Increase stock with weighted average cost
      adjustInventory(it.product_id, it.base_quantity, 'PURCHASE', 'purchase_invoice', invoiceId, `شراء فاتورة ${invoiceNumber}`, it.purchase_price / it.conversion_factor);
    }

    if (paid > 0) {
      db.prepare(`
        INSERT INTO cashbox_transactions (type, amount, description, reference_type, reference_id)
        VALUES ('purchase', ?, ?, 'purchase_invoice', ?)
      `).run(-paid, `مشتريات فاتورة ${invoiceNumber}`, invoiceId);
    }

    return { id: invoiceId, invoice_number: invoiceNumber, total, remaining_amount: remaining };
  });

  return run();
}

function getPurchaseById(id) {
  const db = getDatabase();
  const invoice = db.prepare(`
    SELECT pi.*, s.name as supplier_name
    FROM purchase_invoices pi
    LEFT JOIN suppliers s ON s.id = pi.supplier_id
    WHERE pi.id = ?
  `).get(id);
  if (!invoice) return null;
  invoice.items = db.prepare('SELECT * FROM purchase_items WHERE invoice_id = ?').all(id);
  return invoice;
}

function getPurchases({ fromDate = null, toDate = null, search = '', page = 1, limit = 50 } = {}) {
  const db = getDatabase();
  let where = [];
  let params = [];
  if (fromDate) { where.push('pi.created_at >= ?'); params.push(fromDate); }
  if (toDate) { where.push('pi.created_at <= ?'); params.push(toDate + ' 23:59:59'); }
  if (search) { where.push('(pi.invoice_number LIKE ? OR s.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const invoices = db.prepare(`
    SELECT pi.*, s.name as supplier_name
    FROM purchase_invoices pi
    LEFT JOIN suppliers s ON s.id = pi.supplier_id
    ${whereClause}
    ORDER BY pi.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM purchase_invoices pi
    LEFT JOIN suppliers s ON s.id = pi.supplier_id
    ${whereClause}
  `).get(...params);

  return { invoices, total, page, limit };
}

module.exports = {
  createPurchase,
  getPurchaseById,
  getPurchases,
  getNextPurchaseNumber
};
