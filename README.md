# 📦 DFCL Inventory Management System

A complete multi-entity inventory & sales management system for garment/tailoring businesses. Built with Next.js 16, React 19, Prisma, and SQLite.

![Tech Stack](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-blue) ![Prisma](https://img.shields.io/badge/Prisma-6-green) ![SQLite](https://img.shields.io/badge/SQLite-local-orange) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## 🚀 Quick Start

### Option 1: Use the start scripts (recommended)

**Linux / macOS:**
```bash
./start-dev.sh
```

**Windows:**
```cmd
start-dev.bat
```

The script will:
1. Install dependencies (if missing)
2. Generate Prisma client
3. Sync database schema
4. Start the dev server on http://localhost:3000

### Option 2: Manual setup

```bash
# 1. Clone & install
git clone <your-repo-url>
cd dfcl-app
bun install        # or: npm install

# 2. Set up environment
cp .env.example .env

# 3. Sync database
bun run db:push
bun run db:generate

# 4. Run dev server
bun run dev
```

Open **http://localhost:3000** in your browser.

---

## 🔑 Login Credentials

| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| `admin` | `admin123` | Admin | Full access (everything) |
| `manager` | `manager123` | Manager | All except user management |
| `user1` | `user123` | User | Limited (Item Price + My Stock + Sales Order) |

---

## 📊 Features

### Core Modules
- **Authentication** — Login/logout with bcrypt-hashed passwords, session tokens, 3-tier role system
- **Entity Selection** — Multi-branch/multi-store support, pick entity after login
- **Item Management** — 500 seeded items, search, pagination, CRUD, CSV bulk upload
- **Stock Management** — Per-entity stock levels, view detail, manual entry, CSV upload

### Transactions
- **Item Adjustment** — Increase/decrease stock with reason tracking
- **Transfer** — Move stock between entities (with status workflow)
- **Receive** — Receive stock from external sources or transfers
- **Sales Order** — Create orders for customers (auto-deducts stock)
- **Sales Return** — Process returns (with link to original order)
- **Incentive** — Track tailor/sales/bonus incentives

### Master Data
- **Tailors** — With specialization, status, contact info
- **Making Info** — Stitching, Cutting, Finishing, Ironing, Embroidery
- **UoM** — Units of Measure (PCS, KG, LTR, MTR, BOX, SET, DOZ, PACK)
- **Suppliers** — Vendor management
- **Customers** — Corporate, wholesale, regular customer types

### Reports Dashboard
6 tabs with real-time charts and KPIs:
- **Overview** — High-level KPIs + trend charts + low-stock alerts
- **Stock** — Top items by value, per-entity breakdown, distribution
- **Sales** — Revenue/returns trend, by customer/item/status
- **Transfer** — Trends, by status, top source/destination entities
- **Adjustment** — Increase/decrease trends, by entity
- **Incentive** — Payment status, by tailor, trends

Filter by entity and date range (7d / 30d / 90d / 12mo / All time).

### Administration
- **User Management** (admin only) — Create/edit users, column-level access control, menu access, entity access
- **Settings** — Backup, Restore, Reset database

---

## 🗄️ Database

- **Type:** SQLite (file-based, no server needed)
- **Location:** `db/custom.db`
- **Schema:** `prisma/schema.prisma` (19 tables)
- **Seed data:** 500 items, 7 entities, 4 users, 5 tailors, 5 suppliers, 7 customers

### Reset / re-seed database

```bash
bun run scripts/seed-master-data.ts
```

---

## 📂 Project Structure

```
.
├── start-dev.sh / .bat        # Dev startup scripts
├── start-prod.sh / .bat       # Production startup scripts
├── LOCAL-SETUP.md             # Detailed local setup guide (Bangla)
├── CLOUDFLARE-DEPLOY.md       # Optional Cloudflare D1 deployment guide
│
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main frontend (all UI in one file)
│   │   ├── layout.tsx
│   │   └── api/               # 39 API routes (auth, items, reports, etc.)
│   ├── lib/
│   │   ├── db.ts              # Prisma client (env-aware: D1 or SQLite)
│   │   └── auth.ts            # bcrypt + session logic
│   └── components/ui/         # shadcn/ui component library
│
├── prisma/
│   └── schema.prisma          # Database schema (19 models)
│
├── db/
│   └── custom.db              # SQLite database (with seed data)
│
├── scripts/
│   ├── seed-master-data.ts    # Re-seed master data
│   └── test-reports.mjs       # Reports API smoke test
│
├── migrations/                # SQL migrations (for Cloudflare D1)
├── wrangler.toml              # Cloudflare config (optional)
├── .env.example               # Environment template
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Lucide icons |
| Charts | Recharts 2 |
| Database | SQLite (local) / Cloudflare D1 (optional) |
| ORM | Prisma 6 |
| Auth | bcryptjs + session tokens |
| Package Manager | Bun (recommended) or npm |

---

## 📋 Requirements

- **Node.js** 20+ — https://nodejs.org
- **Bun** (optional, faster) — https://bun.sh

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `./start-dev.sh` | Start dev server (hot reload) |
| `./start-prod.sh` | Build & start production server |
| `bun run dev` | Start dev server directly |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Sync schema to database |
| `bun run db:generate` | Generate Prisma client |

---

## 🌐 Deployment Options

### Local (default)
- SQLite database at `db/custom.db`
- No external services needed
- See `LOCAL-SETUP.md` for details

### Cloudflare Pages + D1 (optional)
- Cloud-hosted D1 database
- See `CLOUDFLARE-DEPLOY.md` for full guide
- `wrangler.toml` and `migrations/` already configured

---

## 📝 License

This project is private/proprietary. All rights reserved.

---

## 🤝 Support

For issues, check the troubleshooting section in `LOCAL-SETUP.md` or open a GitHub issue.
