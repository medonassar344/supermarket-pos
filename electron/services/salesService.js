const { getDatabase } = require('../database/database');
const { adjustInventory } = require('./inventoryService');

function getNextInvoiceNumber() {
  const db = getDatabase();
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get()?.value || 'INV-';
  const last = db.prepare(`
    SELECT invoice_number FROM sales_invoices
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

/**
 * Create a sale with full transaction safety.
 * items: [{ product_id, unit_id or unit_name, quantity, unit_price }]
 * quantity is in the selected unit; conversion handled here.
 */
function createSale({ customer_id = null, items = [], discount = 0, payment_method = 'cash', paid_amount = 0, notes = null }) {
  if (!items || items.length === 0) {
    throw new Error('يجب إضافة منتج واحد على الأقل');
  }
  if (discount < 0) throw new Error('الخصم لا يمكن أن يكون سالباً');

  const db = getDatabase();

  const run = db.transaction(() => {
    // Validate and prepare items
    const preparedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) throw new Error(`المنتج غير موجود: ${item.product_id}`);

      let unit;
      if (item.unit_id) {
        unit = db.prepare('SELECT * FROM product_units WHERE id = ? AND product_id = ?').get(item.unit_id, product.id);
      } else {
        unit = db.prepare('SELECT * FROM product_units WHERE product_id = ? AND unit_name = ?').get(product.id, item.unit_name || product.base_unit);
      }
      if (!unit) {
        // fallback to base
        unit = db.prepare('SELECT * FROM product_units WHERE product_id = ? AND is_base = 1').get(product.id);
      }
      if (!unit) throw new Error(`وحدة المنتج غير موجودة: ${product.name}`);

      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error(`كمية غير صالحة للمنتج: ${product.name}`);

      const conversion = unit.conversion_factor || 1;
      const baseQty = qty * conversion;
      const unitPrice = item.unit_price != null ? parseFloat(item.unit_price) : (unit.selling_price ?? product.selling_price);
      if (unitPrice < 0) throw new Error('سعر الوحدة لا يمكن أن يكون سالباً');

      // Check stock
      if (product.current_stock < baseQty - 0.0001) {
        throw new Error(`المخزون غير كافٍ للمنتج: ${product.name}. المتاح: ${product.current_stock} ${product.base_unit}`);
      }

      const lineTotal = qty * unitPrice;
      subtotal += lineTotal;

      preparedItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_name: unit.unit_name,
        quantity: qty,
        conversion_factor: conversion,
        base_quantity: baseQty,
        unit_price: unitPrice,
        cost_price: product.average_cost,
        total: lineTotal
      });
    }

    const total = Math.max(0, subtotal - (discount || 0));
    const paid = paid_amount != null ? parseFloat(paid_amount) : total;
    const change = Math.max(0, paid - total);

    const invoiceNumber = getNextInvoiceNumber();

    const invResult = db.prepare(`
      INSERT INTO sales_invoices (invoice_number, customer_id, subtotal, discount, total, payment_method, paid_amount, change_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceNumber, customer_id, subtotal, discount || 0, total, payment_method, paid, change, notes);

    const invoiceId = invResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO sales_items (invoice_id, product_id, product_name, unit_name, quantity, conversion_factor, base_quantity, unit_price, cost_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of preparedItems) {
      insertItem.run(invoiceId, it.product_id, it.product_name, it.unit_name, it.quantity, it.conversion_factor, it.base_quantity, it.unit_price, it.cost_price, it.total);
      adjustInventory(it.product_id, -it.base_quantity, 'SALE', 'sales_invoice', invoiceId, `بيع فاتورة ${invoiceNumber}`);
    }

    // Cashbox
    if (payment_method === 'cash' && total > 0) {
      db.prepare(`
        INSERT INTO cashbox_transactions (type, amount, description, reference_type, reference_id)
        VALUES ('sale', ?, ?, 'sales_invoice', ?)
      `).run(total, `مبيعات فاتورة ${invoiceNumber}`, invoiceId);
    }

    return { id: invoiceId, invoice_number: invoiceNumber, total, change_amount: change };
  });

  return run();
}

function getSaleById(id) {
  const db = getDatabase();
  const invoice = db.prepare(`
    SELECT si.*, c.name as customer_name
    FROM sales_invoices si
    LEFT JOIN customers c ON c.id = si.customer_id
    WHERE si.id = ?
  `).get(id);
  if (!invoice) return null;
  invoice.items = db.prepare('SELECT * FROM sales_items WHERE invoice_id = ?').all(id);
  return invoice;
}

function getSales({ fromDate = null, toDate = null, search = '', page = 1, limit = 50 } = {}) {
  const db = getDatabase();
  let where = [];
  let params = [];
  if (fromDate) {
    where.push('si.created_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    where.push('si.created_at <= ?');
    params.push(toDate + ' 23:59:59');
  }
  if (search) {
    where.push('(si.invoice_number LIKE ? OR c.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const invoices = db.prepare(`
    SELECT si.*, c.name as customer_name
    FROM sales_invoices si
    LEFT JOIN customers c ON c.id = si.customer_id
    ${whereClause}
    ORDER BY si.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM sales_invoices si
    LEFT JOIN customers c ON c.id = si.customer_id
    ${whereClause}
  `).get(...params);

  return { invoices, total, page, limit };
}

function getTodayStats() {
  const db = getDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const sales = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
    FROM sales_invoices
    WHERE date(created_at) = ?
  `).get(today);

  const profitRow = db.prepare(`
    SELECT COALESCE(SUM(si.total - (si.cost_price * si.base_quantity)), 0) as gross_profit
    FROM sales_items si
    JOIN sales_invoices inv ON inv.id = si.invoice_id
    WHERE date(inv.created_at) = ?
  `).get(today);

  const expenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = ?
  `).get(today);

  return {
    sales_count: sales.count,
    sales_total: sales.total,
    profit: (profitRow.gross_profit || 0) - (expenses.total || 0),
    gross_profit: profitRow.gross_profit || 0,
    expenses: expenses.total || 0
  };
}

module.exports = {
  createSale,
  getSaleById,
  getSales,
  getTodayStats,
  getNextInvoiceNumber
};
