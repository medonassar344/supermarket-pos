# نظام إدارة السوبرماركت - Supermarket POS

تطبيق سطح مكتب كامل لإدارة سوبرماركت واحد (فرع واحد، مستخدم واحد) يعمل بالكامل دون اتصال بالإنترنت.

## التقنيات

- **Electron** - تطبيق سطح المكتب
- **React + Vite** - واجهة المستخدم
- **SQLite + better-sqlite3** - قاعدة بيانات محلية
- **JavaScript**

## المميزات

- لوحة تحكم مع إحصائيات ورسوم بيانية
- نقطة بيع (POS) سريعة مع دعم الباركود
- إدارة المنتجات مع وحدات متعددة (قطعة، كرتونة، كيلو، جرام...)
- تحويل وحدات تلقائي وتخزين المخزون بالوحدة الأساسية
- منتجات بالوزن (كميات عشرية)
- المشتريات ومرتجع المشتريات
- المبيعات ومرتجع المبيعات
- الموردين والعملاء
- المصروفات والصندوق
- تقارير شاملة وربح متوسط التكلفة المرجح
- نسخ احتياطي واستعادة
- واجهة عربية RTL

## التثبيت والتشغيل

### المتطلبات
- Node.js 18+
- Windows (أو أي نظام يدعم Electron)

### خطوات التثبيت

```bash
# 1. تثبيت اعتماديات الجذر (Electron)
cd supermarket-pos
npm install --registry https://registry.npmjs.org/

# 2. تثبيت اعتماديات الواجهة
cd frontend
npm install --registry https://registry.npmjs.org/
cd ..

# ملاحظة: better-sqlite3 يحتاج أدوات البناء على Windows:
# npm install --global windows-build-tools
# أو تثبيت Visual Studio Build Tools
```

### التشغيل في وضع التطوير

```bash
# من المجلد الجذر
npm run dev
```

أو يدوياً:
```bash
# طرفية 1
cd frontend && npm run dev

# طرفية 2
npx electron .
```

### البناء للإنتاج (Windows)

```bash
npm run build
```

سيُنشئ ملف تثبيت في مجلد `dist/`.

## هيكل المشروع

```
supermarket-pos/
├── electron/
│   ├── main.js              # عملية Electron الرئيسية + IPC
│   ├── preload.js           # جسر آمن للواجهة
│   ├── database/
│   │   └── database.js      # SQLite + نظام الهجرات
│   └── services/            # منطق الأعمال
│       ├── productsService.js
│       ├── salesService.js
│       ├── purchasesService.js
│       ├── inventoryService.js
│       ├── ...
├── frontend/
│   ├── src/
│   │   ├── pages/           # صفحات التطبيق
│   │   ├── App.jsx
│   │   └── index.css
│   └── vite.config.js
└── package.json
```

## قواعد الأعمال المهمة

1. المخزون يُخزَّن دائماً بالوحدة الأساسية للمنتج
2. كل تغيير في المخزون يُنشئ سجل حركة (inventory_movements)
3. عمليات البيع تتم داخل معاملة قاعدة بيانات واحدة
4. لا يُسمح بمخزون سالب
5. الفواتير التاريخية تحتفظ بأسماء وأسعار المنتجات وقت البيع
6. نظام هجرات تلقائي يحافظ على بيانات المستخدم عند التحديث
7. متوسط تكلفة مرجح للربح

## الأمان

- `contextIsolation: true`
- `nodeIntegration: false`
- التواصل فقط عبر `preload.js` و `contextBridge`

## الرابط

https://github.com/medonassar344/supermarket-pos
