const { getDatabase } = require('../database/database');

function getAllCategories(search = '') {
  const db = getDatabase();
  if (search) {
    return db.prepare('SELECT * FROM categories WHERE name LIKE ? ORDER BY name').all(`%${search}%`);
  }
  return db.prepare('SELECT * FROM categories ORDER BY name').all();
}

function getCategoryById(id) {
  return getDatabase().prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function createCategory({ name, description }) {
  if (!name || !name.trim()) throw new Error('اسم التصنيف مطلوب');
  const db = getDatabase();
  try {
    const r = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name.trim(), description || null);
    return getCategoryById(r.lastInsertRowid);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('اسم التصنيف موجود مسبقاً');
    throw e;
  }
}

function updateCategory(id, { name, description }) {
  const db = getDatabase();
  const existing = getCategoryById(id);
  if (!existing) throw new Error('التصنيف غير موجود');
  db.prepare(`
    UPDATE categories SET name = COALESCE(?, name), description = ?, updated_at = datetime('now') WHERE id = ?
  `).run(name?.trim() || null, description !== undefined ? description : existing.description, id);
  return getCategoryById(id);
}

function deleteCategory(id) {
  const db = getDatabase();
  const count = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ? AND active = 1').get(id).c;
  if (count > 0) throw new Error('لا يمكن حذف التصنيف لأنه مرتبط بمنتجات. قم بنقل أو حذف المنتجات أولاً');
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = { getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
