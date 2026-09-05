const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'supermarket.db');
}

function getImagesPath() {
  const userDataPath = app.getPath('userData');
  const imagesDir = path.join(userDataPath, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

function initDatabase() {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations();
  return db;
}

function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Migration system
function runMigrations() {
  const database = db;

  // Create migrations table if not exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    {
      name: '001_initial_schema',
      up: function (db) {
        db.exec(`
          -- Categories
          CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          -- Products (inventory stored in base unit)
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            category_id INTEGER,
            description TEXT,
            purchase_price REAL NOT NULL DEFAULT 0,
            selling_price REAL NOT NULL DEFAULT 0,
            minimum_stock REAL NOT NULL DEFAULT 0,
            current_stock REAL NOT NULL DEFAULT 0,
            average_cost REAL NOT NULL DEFAULT 0,
            image_path TEXT,
            base_unit TEXT NOT NULL DEFAULT 'قطعة',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
          );

          -- Product Units (flexible unit conversion)
          CREATE TABLE IF NOT EXISTS product_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            unit_name TEXT NOT NULL,
            conversion_factor REAL NOT NULL DEFAULT 1,
            purchase_price REAL,
            selling_price REAL,
            barcode TEXT UNIQUE,
            is_base INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE(product_id, unit_name)
          );

          -- Suppliers
          CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          -- Customers
          CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          -- Purchase Invoices
          CREATE TABLE IF NOT EXISTS purchase_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL UNIQUE,
            supplier_id INTEGER,
            subtotal REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            paid_amount REAL NOT NULL DEFAULT 0,
            remaining_amount REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
          );

          -- Purchase Items
          CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            conversion_factor REAL NOT NULL DEFAULT 1,
            base_quantity REAL NOT NULL,
            purchase_price REAL NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
          );

          -- Sales Invoices
          CREATE TABLE IF NOT EXISTS sales_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL UNIQUE,
            customer_id INTEGER,
            subtotal REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            payment_method TEXT NOT NULL DEFAULT 'cash',
            paid_amount REAL NOT NULL DEFAULT 0,
            change_amount REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
          );

          -- Sales Items (historical snapshot)
          CREATE TABLE IF NOT EXISTS sales_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            conversion_factor REAL NOT NULL DEFAULT 1,
            base_quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            cost_price REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
          );

          -- Purchase Returns
          CREATE TABLE IF NOT EXISTS purchase_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT NOT NULL UNIQUE,
            purchase_invoice_id INTEGER NOT NULL,
            supplier_id INTEGER,
            total REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE RESTRICT,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
          );

          CREATE TABLE IF NOT EXISTS purchase_return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            conversion_factor REAL NOT NULL DEFAULT 1,
            base_quantity REAL NOT NULL,
            purchase_price REAL NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
          );

          -- Sales Returns
          CREATE TABLE IF NOT EXISTS sales_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT NOT NULL UNIQUE,
            sales_invoice_id INTEGER NOT NULL,
            customer_id INTEGER,
            total REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
          );

          CREATE TABLE IF NOT EXISTS sales_return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            conversion_factor REAL NOT NULL DEFAULT 1,
            base_quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
          );

          -- Inventory Movements (audit trail)
          CREATE TABLE IF NOT EXISTS inventory_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            movement_type TEXT NOT NULL,
            quantity REAL NOT NULL,
            previous_quantity REAL NOT NULL,
            new_quantity REAL NOT NULL,
            reference_type TEXT,
            reference_id INTEGER,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
          );

          -- Expenses
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            notes TEXT,
            date TEXT NOT NULL DEFAULT (date('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          -- Cashbox Transactions
          CREATE TABLE IF NOT EXISTS cashbox_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          -- Settings
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
          CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
          CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
          CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
          CREATE INDEX IF NOT EXISTS idx_product_units_product ON product_units(product_id);
          CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON product_units(barcode);
          CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(created_at);
          CREATE INDEX IF NOT EXISTS idx_sales_invoices_number ON sales_invoices(invoice_number);
          CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(created_at);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at);
          CREATE INDEX IF NOT EXISTS idx_cashbox_date ON cashbox_transactions(created_at);
          CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        `);

        // Default settings
        const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
        insertSetting.run('supermarket_name', 'سوبرماركت النخبة');
        insertSetting.run('supermarket_address', 'القاهرة، مصر');
        insertSetting.run('supermarket_phone', '01000000000');
        insertSetting.run('invoice_prefix', 'INV-');
        insertSetting.run('purchase_prefix', 'PUR-');
        insertSetting.run('return_prefix', 'RET-');
        insertSetting.run('currency', 'EGP');
        insertSetting.run('currency_symbol', 'ج.م');
        insertSetting.run('opening_balance', '0');
      }
    },
    {
      name: '002_add_returned_quantities',
      up: function (db) {
        // Track returned quantities on sales/purchase items for validation
        try {
          db.exec(`ALTER TABLE sales_items ADD COLUMN returned_quantity REAL NOT NULL DEFAULT 0`);
        } catch (e) { /* column may exist */ }
        try {
          db.exec(`ALTER TABLE purchase_items ADD COLUMN returned_quantity REAL NOT NULL DEFAULT 0`);
        } catch (e) { /* column may exist */ }
      }
    }
  ];

  const getExecuted = database.prepare('SELECT name FROM migrations WHERE name = ?');
  const insertMigration = database.prepare('INSERT INTO migrations (name) VALUES (?)');

  for (const migration of migrations) {
    const exists = getExecuted.get(migration.name);
    if (!exists) {
      const run = database.transaction(() => {
        migration.up(database);
        insertMigration.run(migration.name);
      });
      run();
      console.log(`Migration executed: ${migration.name}`);
    }
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  getDbPath,
  getImagesPath
};
