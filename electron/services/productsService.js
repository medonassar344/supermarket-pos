const { getDatabase } = require('../database/database');

function getAllProducts({ search = '', categoryId = null, activeOnly = true, page = 1, limit = 50 } = {}) {
  const db = getDatabase();
  let where = [];
  let params = [];

  if (activeOnly) {
    where.push('p.active = 1');
  }
  if (search) {
    where.push('(p.name LIKE ? OR p.barcode LIKE ? OR pu.barcode LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (categoryId) {
    where.push('p.category_id = ?');
    params.push(categoryId);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const sql = `
    SELECT DISTINCT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_units pu ON pu.product_id = p.id
    ${whereClause}
    ORDER BY p.name
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const products = db.prepare(sql).all(...params);

  // Attach units
  const unitsStmt = db.prepare('SELECT * FROM product_units WHERE product_id = ? ORDER BY is_base DESC, unit_name');
  for (const p of products) {
    p.units = unitsStmt.all(p.id);
  }

  const countSql = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM products p
    LEFT JOIN product_units pu ON pu.product_id = p.id
    ${whereClause}
  `;
  const countParams = params.slice(0, -2);
  const { total } = db.prepare(countSql).get(...countParams);

  return { products, total, page, limit };
}

function getProductById(id) {
  const db = getDatabase();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id);
  if (!product) return null;
  product.units = db.prepare('SELECT * FROM product_units WHERE product_id = ? ORDER BY is_base DESC').all(id);
  return product;
}

function getProductByBarcode(barcode) {
  const db = getDatabase();
  let product = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.barcode = ? AND p.active = 1
  `).get(barcode);

  let unit = null;
  if (product) {
    unit = db.prepare('SELECT * FROM product_units WHERE product_id = ? AND is_base = 1').get(product.id);
  } else {
    unit = db.prepare('SELECT * FROM product_units WHERE barcode = ?').get(barcode);
    if (unit) {
      product = db.prepare(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ? AND p.active = 1
      `).get(unit.product_id);
    }
  }
  if (!product) return null;
  product.units = db.prepare('SELECT * FROM product_units WHERE product_id = ? ORDER BY is_base DESC').all(product.id);
  product.matched_unit = unit;
  return product;
}

function createProduct(data) {
  const db = getDatabase();
  const {
    name, barcode, category_id, description,
    purchase_price = 0, selling_price = 0, minimum_stock = 0,
    base_unit = 'قطعة', image_path = null,
    units = []
  } = data;

  if (!name || !name.trim()) {
    throw new Error('اسم المنتج مطلوب');
  }
  if (selling_price < 0 || purchase_price < 0) {
    throw new Error('السعر لا يمكن أن يكون سالباً');
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (name, barcode, category_id, description, purchase_price, selling_price, minimum_stock, base_unit, image_path, average_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertUnit = db.prepare(`
    INSERT INTO product_units (product_id, unit_name, conversion_factor, purchase_price, selling_price, barcode, is_base)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    const result = insertProduct.run(
      name.trim(),
      barcode || null,
      category_id || null,
      description || null,
      purchase_price,
      selling_price,
      minimum_stock,
      base_unit,
      image_path,
      purchase_price
    );
    const productId = result.lastInsertRowid;

    insertUnit.run(productId, base_unit, 1, purchase_price, selling_price, barcode || null, 1);

    for (const u of units) {
      if (u.unit_name && u.unit_name !== base_unit && u.conversion_factor > 0) {
        insertUnit.run(
          productId,
          u.unit_name,
          u.conversion_factor,
          u.purchase_price ?? null,
          u.selling_price ?? null,
          u.barcode || null,
          0
        );
      }
    }

    return productId;
  });

  const id = run();
  return getProductById(id);
}

function updateProduct(id, data) {
  const db = getDatabase();
  const existing = getProductById(id);
  if (!existing) throw new Error('المنتج غير موجود');

  const {
    name, barcode, category_id, description,
    purchase_price, selling_price, minimum_stock,
    base_unit, image_path, active, units
  } = data;

  const update = db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      barcode = ?,
      category_id = ?,
      description = ?,
      purchase_price = COALESCE(?, purchase_price),
      selling_price = COALESCE(?, selling_price),
      minimum_stock = COALESCE(?, minimum_stock),
      base_unit = COALESCE(?, base_unit),
      image_path = ?,
      active = COALESCE(?, active),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const run = db.transaction(() => {
    update.run(
      name?.trim() || null,
      barcode !== undefined ? (barcode || null) : existing.barcode,
      category_id !== undefined ? category_id : existing.category_id,
      description !== undefined ? description : existing.description,
      purchase_price,
      selling_price,
      minimum_stock,
      base_unit,
      image_path !== undefined ? image_path : existing.image_path,
      active,
      id
    );

    if (Array.isArray(units)) {
      db.prepare('DELETE FROM product_units WHERE product_id = ? AND is_base = 0').run(id);
      db.prepare(`
        UPDATE product_units SET purchase_price = ?, selling_price = ?, barcode = ?
        WHERE product_id = ? AND is_base = 1
      `).run(
        purchase_price ?? existing.purchase_price,
        selling_price ?? existing.selling_price,
        barcode !== undefined ? barcode : existing.barcode,
        id
      );

      for (const u of units) {
        if (u.unit_name && u.conversion_factor > 0 && !u.is_base) {
          db.prepare(`
            INSERT INTO product_units (product_id, unit_name, conversion_factor, purchase_price, selling_price, barcode, is_base)
            VALUES (?, ?, ?, ?, ?, ?, 0)
          `).run(
            id, u.unit_name, u.conversion_factor,
            u.purchase_price ?? null, u.selling_price ?? null, u.barcode || null
          );
        }
      }
    }
  });

  run();
  return getProductById(id);
}

function deleteProduct(id) {
  const db = getDatabase();
  const usedInSales = db.prepare('SELECT COUNT(*) as c FROM sales_items WHERE product_id = ?').get(id).c;
  const usedInPurchases = db.prepare('SELECT COUNT(*) as c FROM purchase_items WHERE product_id = ?').get(id).c;
  if (usedInSales > 0 || usedInPurchases > 0) {
    db.prepare("UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    return { softDeleted: true };
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return { deleted: true };
}

function getLowStockProducts() {
  const db = getDatabase();
  return db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.current_stock <= p.minimum_stock AND p.minimum_stock > 0
    ORDER BY p.current_stock ASC
  `).all();
}

function getOutOfStockProducts() {
  const db = getDatabase();
  return db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.current_stock <= 0
    ORDER BY p.name
  `).all();
}

function searchProductsForPOS(query) {
  const db = getDatabase();
  if (!query || !query.trim()) return [];
  const s = `%${query.trim()}%`;
  const products = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.barcode, p.current_stock, p.base_unit, p.selling_price, p.purchase_price, p.average_cost
    FROM products p
    LEFT JOIN product_units pu ON pu.product_id = p.id
    WHERE p.active = 1 AND (p.name LIKE ? OR p.barcode LIKE ? OR pu.barcode LIKE ?)
    ORDER BY p.name
    LIMIT 20
  `).all(s, s, s);

  const unitsStmt = db.prepare('SELECT * FROM product_units WHERE product_id = ? ORDER BY is_base DESC');
  for (const p of products) {
    p.units = unitsStmt.all(p.id);
  }
  return products;
}

module.exports = {
  getAllProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getOutOfStockProducts,
  searchProductsForPOS
};
