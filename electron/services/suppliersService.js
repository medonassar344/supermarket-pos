const { getDatabase } = require('../database/database');

function getAllSuppliers(search = '') {
  const db = getDatabase();
  if (search) {
    return db.prepare('SELECT * FROM suppliers WHERE name LIKE ? OR phone LIKE ? ORDER BY name').all(`%${search}%`, `%${search}%`);
  }
  return db.prepare('SELECT * FROM suppliers ORDER BY name').all();
}

function getSupplierById(id) {
  return getDatabase().prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
}

function createSupplier({ name, phone, address, notes }) {
  if (!name || !name.trim()) throw new Error('اسم المورد مطلوب');
  const r = getDatabase().prepare('INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)')
    .run(name.trim(), phone || null, address || null, notes || null);
  return getSupplierById(r.lastInsertRowid);
}

function updateSupplier(id, data) {
  const existing = getSupplierById(id);
  if (!existing) throw new Error('المورد غير موجود');
  getDatabase().prepare(`
    UPDATE suppliers SET name = COALESCE(?, name), phone = ?, address = ?, notes = ?, updated_at = datetime('now') WHERE id = ?
  `).run(data.name?.trim() || null, data.phone !== undefined ? data.phone : existing.phone,
    data.address !== undefined ? data.address : existing.address,
    data.notes !== undefined ? data.notes : existing.notes, id);
  return getSupplierById(id);
}

function deleteSupplier(id) {
  const count = getDatabase().prepare('SELECT COUNT(*) as c FROM purchase_invoices WHERE supplier_id = ?').get(id).c;
  if (count > 0) throw new Error('لا يمكن حذف المورد لأنه مرتبط بفواتير شراء');
  getDatabase().prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  return { deleted: true };
}

function getSupplierPurchases(supplierId) {
  return getDatabase().prepare(`
    SELECT * FROM purchase_invoices WHERE supplier_id = ? ORDER BY created_at DESC
  `).all(supplierId);
}

module.exports = { getAllSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier, getSupplierPurchases };
