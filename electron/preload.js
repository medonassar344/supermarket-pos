const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // Products
  products: {
    getAll: (params) => ipcRenderer.invoke('products:getAll', params),
    getById: (id) => ipcRenderer.invoke('products:getById', id),
    getByBarcode: (barcode) => ipcRenderer.invoke('products:getByBarcode', barcode),
    create: (data) => ipcRenderer.invoke('products:create', data),
    update: (id, data) => ipcRenderer.invoke('products:update', id, data),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    searchPOS: (query) => ipcRenderer.invoke('products:searchPOS', query),
    lowStock: () => ipcRenderer.invoke('products:lowStock'),
    outOfStock: () => ipcRenderer.invoke('products:outOfStock')
  },
  // Categories
  categories: {
    getAll: (search) => ipcRenderer.invoke('categories:getAll', search),
    getById: (id) => ipcRenderer.invoke('categories:getById', id),
    create: (data) => ipcRenderer.invoke('categories:create', data),
    update: (id, data) => ipcRenderer.invoke('categories:update', id, data),
    delete: (id) => ipcRenderer.invoke('categories:delete', id)
  },
  // Sales
  sales: {
    create: (data) => ipcRenderer.invoke('sales:create', data),
    getAll: (params) => ipcRenderer.invoke('sales:getAll', params),
    getById: (id) => ipcRenderer.invoke('sales:getById', id),
    todayStats: () => ipcRenderer.invoke('sales:todayStats')
  },
  // Purchases
  purchases: {
    create: (data) => ipcRenderer.invoke('purchases:create', data),
    getAll: (params) => ipcRenderer.invoke('purchases:getAll', params),
    getById: (id) => ipcRenderer.invoke('purchases:getById', id)
  },
  // Suppliers
  suppliers: {
    getAll: (search) => ipcRenderer.invoke('suppliers:getAll', search),
    getById: (id) => ipcRenderer.invoke('suppliers:getById', id),
    create: (data) => ipcRenderer.invoke('suppliers:create', data),
    update: (id, data) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
    purchases: (id) => ipcRenderer.invoke('suppliers:purchases', id)
  },
  // Customers
  customers: {
    getAll: (search) => ipcRenderer.invoke('customers:getAll', search),
    getById: (id) => ipcRenderer.invoke('customers:getById', id),
    create: (data) => ipcRenderer.invoke('customers:create', data),
    update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
    sales: (id) => ipcRenderer.invoke('customers:sales', id)
  },
  // Returns
  returns: {
    createSalesReturn: (data) => ipcRenderer.invoke('returns:createSalesReturn', data),
    createPurchaseReturn: (data) => ipcRenderer.invoke('returns:createPurchaseReturn', data),
    getSalesReturns: (params) => ipcRenderer.invoke('returns:getSalesReturns', params),
    getPurchaseReturns: (params) => ipcRenderer.invoke('returns:getPurchaseReturns', params)
  },
  // Expenses
  expenses: {
    getAll: (params) => ipcRenderer.invoke('expenses:getAll', params),
    create: (data) => ipcRenderer.invoke('expenses:create', data),
    delete: (id) => ipcRenderer.invoke('expenses:delete', id)
  },
  // Cashbox
  cashbox: {
    getBalance: () => ipcRenderer.invoke('cashbox:getBalance'),
    getTransactions: (params) => ipcRenderer.invoke('cashbox:getTransactions', params),
    deposit: (amount, desc) => ipcRenderer.invoke('cashbox:deposit', amount, desc),
    withdraw: (amount, desc) => ipcRenderer.invoke('cashbox:withdraw', amount, desc),
    setOpening: (amount) => ipcRenderer.invoke('cashbox:setOpening', amount)
  },
  // Inventory
  inventory: {
    movements: (params) => ipcRenderer.invoke('inventory:movements', params),
    adjust: (productId, qty, notes) => ipcRenderer.invoke('inventory:adjust', productId, qty, notes)
  },
  // Reports
  reports: {
    dashboard: () => ipcRenderer.invoke('reports:dashboard'),
    sales: (params) => ipcRenderer.invoke('reports:sales', params),
    products: (params) => ipcRenderer.invoke('reports:products', params),
    inventory: () => ipcRenderer.invoke('reports:inventory'),
    lowStock: () => ipcRenderer.invoke('reports:lowStock'),
    expenses: (params) => ipcRenderer.invoke('reports:expenses', params),
    cashbox: (params) => ipcRenderer.invoke('reports:cashbox', params)
  },
  // Settings
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (data) => ipcRenderer.invoke('settings:update', data),
    backup: () => ipcRenderer.invoke('settings:backup'),
    restore: (path) => ipcRenderer.invoke('settings:restore', path),
    listBackups: () => ipcRenderer.invoke('settings:listBackups')
  },
  // Utils
  selectImage: () => ipcRenderer.invoke('utils:selectImage'),
  printInvoice: (invoiceId) => ipcRenderer.invoke('utils:printInvoice', invoiceId)
};

contextBridge.exposeInMainWorld('api', api);
