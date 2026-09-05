const { getDatabase } = require('../database/database');

function getAllCustomers(search = '') {
  const db = getDatabase();
  if (search) {
    return db.prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name').all(`%${search}%`, `%${search}%`);
  }
  return db.prepare('SELECT * FROM customers ORDER BY name').all();
}

function getCustomerById(id) {
  return getDatabase().prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function createCustomer({ name, phone, address, notes }) {
  if (!name || !name.trim()) throw new Error('اسم العميل مطلوب');
  const r = getDatabase().prepare('INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)')
    .run(name.trim(), phone || null, address || null, notes || null);
  return getCustomerById(r.lastInsertRowid);
}

function updateCustomer(id, data) {
  const existing = getCustomerById(id);
  if (!existing) throw new Error('العميل غير موجود');
  getDatabase().prepare(`
    UPDATE customers SET name = COALESCE(?, name), phone = ?, address = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
  `).run(data.name?.trim() || null, data.phone !== undefined ? data.phone : existing.phone,
    data.address !== undefined ? data.address : existing.address,
    data.notes !== undefined ? data.notes : existing.notes, id);
  return getCustomerById(id);
}

function deleteCustomer(id) {
  getDatabase().prepare('DELETE FROM customers WHERE id = ?').run(id);
  return { deleted: true };
}

function getCustomerSales(customerId) {
  return getDatabase().prepare(`
    SELECT * FROM sales_invoices WHERE customer_id = ? ORDER BY created_at DESC
  `).all(customerId);
}

module.exports = { getAllCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, getCustomerSales };
