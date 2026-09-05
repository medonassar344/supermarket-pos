const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const { initDatabase, closeDatabase, getImagesPath } = require('./database/database');

// Services
const productsService = require('./services/productsService');
const categoriesService = require('./services/categoriesService');
const salesService = require('./services/salesService');
const purchasesService = require('./services/purchasesService');
const suppliersService = require('./services/suppliersService');
const customersService = require('./services/customersService');
const returnsService = require('./services/returnsService');
const expensesService = require('./services/expensesService');
const cashboxService = require('./services/cashboxService');
const inventoryService = require('./services/inventoryService');
const reportsService = require('./services/reportsService');
const settingsService = require('./services/settingsService');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    title: 'نظام إدارة السوبرماركت',
    show: false
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  // Products
  ipcMain.handle('products:getAll', async (_, params) => {
    try { return { success: true, data: productsService.getAllProducts(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:getById', async (_, id) => {
    try { return { success: true, data: productsService.getProductById(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:getByBarcode', async (_, barcode) => {
    try { return { success: true, data: productsService.getProductByBarcode(barcode) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:create', async (_, data) => {
    try { return { success: true, data: productsService.createProduct(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:update', async (_, id, data) => {
    try { return { success: true, data: productsService.updateProduct(id, data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:delete', async (_, id) => {
    try { return { success: true, data: productsService.deleteProduct(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:searchPOS', async (_, query) => {
    try { return { success: true, data: productsService.searchProductsForPOS(query) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:lowStock', async () => {
    try { return { success: true, data: productsService.getLowStockProducts() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('products:outOfStock', async () => {
    try { return { success: true, data: productsService.getOutOfStockProducts() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Categories
  ipcMain.handle('categories:getAll', async (_, search) => {
    try { return { success: true, data: categoriesService.getAllCategories(search) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('categories:getById', async (_, id) => {
    try { return { success: true, data: categoriesService.getCategoryById(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('categories:create', async (_, data) => {
    try { return { success: true, data: categoriesService.createCategory(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('categories:update', async (_, id, data) => {
    try { return { success: true, data: categoriesService.updateCategory(id, data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('categories:delete', async (_, id) => {
    try { return { success: true, data: categoriesService.deleteCategory(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Sales
  ipcMain.handle('sales:create', async (_, data) => {
    try { return { success: true, data: salesService.createSale(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('sales:getAll', async (_, params) => {
    try { return { success: true, data: salesService.getSales(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('sales:getById', async (_, id) => {
    try { return { success: true, data: salesService.getSaleById(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('sales:todayStats', async () => {
    try { return { success: true, data: salesService.getTodayStats() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Purchases
  ipcMain.handle('purchases:create', async (_, data) => {
    try { return { success: true, data: purchasesService.createPurchase(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('purchases:getAll', async (_, params) => {
    try { return { success: true, data: purchasesService.getPurchases(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('purchases:getById', async (_, id) => {
    try { return { success: true, data: purchasesService.getPurchaseById(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Suppliers
  ipcMain.handle('suppliers:getAll', async (_, search) => {
    try { return { success: true, data: suppliersService.getAllSuppliers(search) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('suppliers:getById', async (_, id) => {
    try { return { success: true, data: suppliersService.getSupplierById(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('suppliers:create', async (_, data) => {
    try { return { success: true, data: suppliersService.createSupplier(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('suppliers:update', async (_, id, data) => {
    try { return { success: true, data: suppliersService.updateSupplier(id, data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('suppliers:delete', async (_, id) => {
    try { return { success: true, data: suppliersService.deleteSupplier(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('suppliers:purchases', async (_, id) => {
    try { return { success: true, data: suppliersService.getSupplierPurchases(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Customers
  ipcMain.handle('customers:getAll', async (_, search) => {
    try { return { success: true, data: customersService.getAllCustomers(search) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('customers:getById', async (_, id) => {
    try { return { success: true, data: customersService.getCustomerById(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('customers:create', async (_, data) => {
    try { return { success: true, data: customersService.createCustomer(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('customers:update', async (_, id, data) => {
    try { return { success: true, data: customersService.updateCustomer(id, data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('customers:delete', async (_, id) => {
    try { return { success: true, data: customersService.deleteCustomer(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('customers:sales', async (_, id) => {
    try { return { success: true, data: customersService.getCustomerSales(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Returns
  ipcMain.handle('returns:createSalesReturn', async (_, data) => {
    try { return { success: true, data: returnsService.createSalesReturn(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('returns:createPurchaseReturn', async (_, data) => {
    try { return { success: true, data: returnsService.createPurchaseReturn(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('returns:getSalesReturns', async (_, params) => {
    try { return { success: true, data: returnsService.getSalesReturns(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('returns:getPurchaseReturns', async (_, params) => {
    try { return { success: true, data: returnsService.getPurchaseReturns(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Expenses
  ipcMain.handle('expenses:getAll', async (_, params) => {
    try { return { success: true, data: expensesService.getAllExpenses(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('expenses:create', async (_, data) => {
    try { return { success: true, data: expensesService.createExpense(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('expenses:delete', async (_, id) => {
    try { return { success: true, data: expensesService.deleteExpense(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Cashbox
  ipcMain.handle('cashbox:getBalance', async () => {
    try { return { success: true, data: cashboxService.getBalance() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('cashbox:getTransactions', async (_, params) => {
    try { return { success: true, data: cashboxService.getTransactions(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('cashbox:deposit', async (_, amount, desc) => {
    try { return { success: true, data: cashboxService.deposit(amount, desc) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('cashbox:withdraw', async (_, amount, desc) => {
    try { return { success: true, data: cashboxService.withdraw(amount, desc) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('cashbox:setOpening', async (_, amount) => {
    try { return { success: true, data: cashboxService.setOpeningBalance(amount) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Inventory
  ipcMain.handle('inventory:movements', async (_, params) => {
    try { return { success: true, data: inventoryService.getInventoryMovements(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('inventory:adjust', async (_, productId, qty, notes) => {
    try { return { success: true, data: inventoryService.manualAdjustment(productId, qty, notes) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Reports
  ipcMain.handle('reports:dashboard', async () => {
    try { return { success: true, data: reportsService.dashboardStats() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('reports:sales', async (_, params) => {
    try { return { success: true, data: reportsService.salesReport(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('reports:products', async (_, params) => {
    try { return { success: true, data: reportsService.productSalesReport(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('reports:inventory', async () => {
    try { return { success: true, data: reportsService.inventoryReport() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('reports:lowStock', async () => {
    try { return { success: true, data: reportsService.lowStockReport() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('reports:expenses', async (_, params) => {
    try { return { success: true, data: reportsService.expenseReport(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('reports:cashbox', async (_, params) => {
    try { return { success: true, data: reportsService.cashboxReport(params || {}) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Settings
  ipcMain.handle('settings:getAll', async () => {
    try { return { success: true, data: settingsService.getAllSettings() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('settings:update', async (_, data) => {
    try { return { success: true, data: settingsService.updateSettings(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('settings:backup', async () => {
    try { return { success: true, data: settingsService.createBackup() }; }
    catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('settings:restore', async (_, backupPath) => {
    try {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['إلغاء', 'استعادة'],
        defaultId: 0,
        title: 'تأكيد الاستعادة',
        message: 'هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية.'
      });
      if (result.response !== 1) return { success: false, error: 'تم الإلغاء' };
      return { success: true, data: settingsService.restoreBackup(backupPath) };
    } catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('settings:listBackups', async () => {
    try { return { success: true, data: settingsService.listBackups() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Utils
  ipcMain.handle('utils:selectImage', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
      });
      if (result.canceled || !result.filePaths[0]) return { success: false };
      const src = result.filePaths[0];
      const imagesDir = getImagesPath();
      const ext = path.extname(src);
      const destName = `product_${Date.now()}${ext}`;
      const dest = path.join(imagesDir, destName);
      fs.copyFileSync(src, dest);
      return { success: true, data: dest };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('utils:printInvoice', async (_, invoiceId) => {
    // Basic print support - load invoice HTML and print
    try {
      const invoice = salesService.getSaleById(invoiceId);
      if (!invoice) return { success: false, error: 'الفاتورة غير موجودة' };
      // In production you would generate a print window
      return { success: true, data: invoice };
    } catch (e) { return { success: false, error: e.message }; }
  });
}

app.whenReady().then(() => {
  try {
    initDatabase();
    console.log('Database initialized');
  } catch (e) {
    console.error('Database init failed:', e);
  }
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDatabase();
});
