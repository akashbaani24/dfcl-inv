# 📦 DFCL Inventory App — Local Setup Guide

এই গাইড অনুসরণ করে অ্যাপটি আপনার PC-তে localhost এ চালাতে পারবেন। Cloudflare বা অন্য কোনো external service লাগবে না।

---

## ✅ কী কী আছে এই অ্যাপে

| Module | Features |
|--------|----------|
| **Authentication** | Login/logout, 3 roles (admin/manager/user), session token |
| **Entity Selection** | Multi-entity support, login পরে entity choose করতে হয় |
| **Item Management** | 500 items seeded, search, pagination, CRUD, CSV upload |
| **Stock Management** | Per-entity stock, view stock detail, stock entry, CSV upload |
| **Transactions** | Item Adjustment, Transfer, Receive, Sales Order, Sales Return, Incentive |
| **Master Data** | Tailors, Making Info, UoM, Suppliers, Customers (5+5+12+5+7 entries seeded) |
| **Reports** | Overview, Stock, Sales, Transfer, Adjustment, Incentive — charts + KPI + tables |
| **User Management** | Admin only — create/edit users, column access, menu access, entity access |
| **Settings** | Backup, Restore, Reset (admin only) |

---

## 🚀 দ্রুত শুরু করুন

### Linux / macOS

```bash
# Dev mode (fast reload, hot reload)
./start-dev.sh

# Production mode (faster, optimized build)
./start-prod.sh
```

### Windows

```cmd
:: Double-click করুন অথবা Command Prompt এ রান করুন
start-dev.bat    :: Dev mode
start-prod.bat   :: Production mode
```

---

## 🔑 লগইন তথ্য

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | Admin | সব কিছু (full access) |
| `manager` | `manager123` | Manager | User management ছাড়া সব |
| `user1` | `user123` | User | Limited — শুধু Item Price + My Stock + Sales Order |

---

## 📋 প্রয়োজনীয় সফটওয়্যার

### প্রথমে ইনস্টল করুন (যদি না থাকে):

1. **Node.js 20+** — https://nodejs.org (LTS version নামাবেন)
2. **Bun** (ঐচ্ছিক, দ্রুত) — https://bun.sh
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

---

## 🛠️ ম্যানুয়াল ইনস্টলেশন (স্ক্রিপ্ট ছাড়া)

যদি স্ক্রিপ্ট কাজ না করে, এই কমান্ডগুলো একটা একটা করে রান করুন:

```bash
# 1. Dependencies install
bun install        # বা npm install

# 2. Database schema sync
bun run db:push    # বা npm run db:push

# 3. Prisma client generate
bun run db:generate

# 4. Dev server চালু
bun run dev        # বা npm run dev
```

তারপর ব্রাউজারে যান: **http://localhost:3000**

---

## 📂 ডাটাবেস তথ্য

- **Type:** SQLite (file-based, কোনো server লাগে না)
- **Location:** `db/custom.db` (৫৭২ KB, সব seed data সহ)
- **Schema:** `prisma/schema.prisma` (১৯টি table)

### ডাটাবেস রিসেট করতে চাইলে:

```bash
# সব data মুছে admin + seed data আবার বসাবে
bun run scripts/seed-master-data.ts
```

### ব্যাকআপ:

Settings → "Create Backup" button ক্লিক করুন (admin হিসেবে লগইন করে)
বা manually `db/custom.db` ফাইল copy করে রাখুন।

---

## 🌐 অ্যাক্সেস

একবার সার্ভার চালু হলে:

| URL | কী দেখাবে |
|-----|---------|
| `http://localhost:3000` | অ্যাপ (login page) |
| `http://localhost:3000/api/auth/me` | বর্তমান ইউজার info (JSON) |
| `http://localhost:3000/api/items` | সব items (auth লাগে) |

---

## 🔧 সমস্যা সমাধান

### "Port 3000 already in use"
```bash
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Cannot find module 'bcryptjs'"
```bash
bun install    # বা npm install
```

### "Prisma Client not generated"
```bash
bun run db:generate
```

### "Database schema mismatch"
```bash
bun run db:push
```

### সব কিছু একসাথে রিসেট:
```bash
rm -rf node_modules .next
bun install
bun run db:push
bun run db:generate
bun run dev
```

---

## 📁 প্রজেক্ট স্ট্রাকচার

```
.
├── start-dev.sh / .bat        ← এটা রান করুন dev এর জন্য
├── start-prod.sh / .bat       ← এটা রান করুন production এর জন্য
├── LOCAL-SETUP.md             ← এই ফাইল
│
├── src/
│   ├── app/
│   │   ├── page.tsx           ← পুরো frontend (Reports সহ)
│   │   ├── layout.tsx
│   │   └── api/               ← ৩৯টি API route
│   ├── lib/
│   │   ├── db.ts              ← Prisma client
│   │   └── auth.ts            ← Login logic
│   └── components/ui/         ← shadcn/ui components
│
├── prisma/
│   └── schema.prisma          ← Database schema (১৯ table)
│
├── db/
│   └── custom.db              ← আপনার সব data এখানে
│
├── scripts/
│   ├── seed-master-data.ts    ← Master data seed করার স্ক্রিপ্ট
│   └── test-reports.mjs       ← Reports API test
│
├── package.json               ← Scripts ও dependencies
└── .env                       ← DATABASE_URL এখানে
```

---

## 📊 বর্তমান ডেটা পরিসংখ্যান

- **৪ জন ইউজার** (admin, manager, user1, + 1 more)
- **৭টি Entity** (Dhaka Main, Chittagong, Sylhet, Rajshahi, Khulna, Dhaka Office, Head Office)
- **৫০০টি Item** (Hardware, Electronics, Food, Furniture, Beverage ইত্যাদি category)
- **১,৪৮৭টি Stock entry** (per entity per item)
- **৫ জন Tailor** (active: 4, inactive: 1)
- **৫ জন Supplier** (active: 4)
- **৭ জন Customer** (corporate: 2, wholesale: 3, regular: 2)
- **১২টি UoM** (PCS, KG, LTR, MTR, BOX, SET, DOZ, PACK ইত্যাদি)
- **৫টি Making Info** (Stitching, Cutting, Finishing, Ironing, Embroidery)

---

## 🎯 প্রথমবার ব্যবহার করছেন?

১. `./start-dev.sh` রান করুন
২. ব্রাউজারে http://localhost:3000 খুলুন
৩. `admin` / `admin123` দিয়ে লগইন করুন
৪. একটি Entity select করুন (যেমন "Dhaka Main Warehouse")
৫. বাম পাশের sidebar থেকে বিভিন্ন page explore করুন:
   - **Item Price** — সব items দেখুন, search করুন
   - **Reports** — dashboard দেখুন (charts, KPI, tables)
   - **Master Data → Tailors/Suppliers/Customers** — master data দেখুন
   - **Settings** — backup/restore/reset options

---

**কোনো সমস্যা হলে** dev server এর terminal এ যে error দেখাবে সেটা copy করে আমাকে দেখান।
