# نظام إدارة السوبرماركت - Supermarket POS

تطبيق سطح مكتب كامل لإدارة سوبرماركت واحد يعمل بالكامل دون اتصال بالإنترنت.

## التقنيات

- **Electron** - تطبيق سطح المكتب
- **React + Vite** - واجهة المستخدم
- **SQLite + better-sqlite3** - قاعدة بيانات محلية
- **JavaScript**

## المميزات

- لوحة تحكم مع إحصائيات ورسوم بيانية
- نقطة بيع (POS) سريعة مع دعم الباركود
- إدارة المنتجات مع وحدات متعددة وتحويل تلقائي
- منتجات بالوزن (كميات عشرية)
- المشتريات ومرتجع المشتريات والمبيعات
- الموردين والعملاء والمصروفات والصندوق
- تقارير شاملة ومتوسط تكلفة مرجح
- نسخ احتياطي واستعادة
- واجهة عربية RTL

## التثبيت

```bash
git clone https://github.com/medonassar344/supermarket-pos.git
cd supermarket-pos
npm install
cd frontend && npm install && cd ..
npm run dev
```

## البناء لـ Windows

```bash
npm run build
```

## هيكل المشروع

```
supermarket-pos/
├── electron/
│   ├── main.js
│   ├── preload.js
│   ├── database/database.js
│   └── services/
├── frontend/
│   └── src/
└── package.json
```

الكود الكامل متوفر في المستودع. للمزيد من التفاصيل راجع ملفات المشروع.
