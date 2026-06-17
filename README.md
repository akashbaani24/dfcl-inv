# 📦 DFCL Inventory Management System

A complete multi-entity inventory & sales management system for garment/tailoring businesses. Built with Next.js 16, React 19, Prisma, and SQLite.

![Tech Stack](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-blue) ![Prisma](https://img.shields.io/badge/Prisma-6-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## 🚀 Quick Start

### Local development (SQLite)

**Linux / macOS:**
```bash
./start-dev.sh
```

**Windows:**
```cmd
start-dev.bat
```

Open http://localhost:3000 → login with `admin` / `admin123`

### Production (Vercel + Turso)

See **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** for the complete step-by-step guide.

TL;DR:
1. Create Turso database + token
2. Import repo on Vercel, add env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DATABASE_URL`)
3. Add 5 secrets to GitHub for auto-deploy via GitHub Actions
4. Every `git push` to `main` auto-deploys to production

---

## 🔑 Login Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin (full access) |
| `manager` | `manager123` | Manager (no user mgmt) |
| `user1` | `user123` | User (limited) |

---

## 📊 Features

- **Authentication** — Login/logout, 3 roles, session tokens
- **Entity Selection** — Multi-branch support (7 entities seeded)
- **Item Management** — 500 items, search, pagination, CSV upload
- **Stock Management** — Per-entity stock, view detail, CSV upload
- **Transactions** — Item Adjustment, Transfer, Receive, Sales Order, Sales Return, Incentive
- **Master Data** — Tailors (5), Making Info (5), UoM (12), Suppliers (5), Customers (7)
- **Reports Dashboard** — 6 tabs (Overview, Stock, Sales, Transfer, Adjustment, Incentive) with charts + KPIs
- **User Management** (admin only) — Column/menu/entity access per user
- **Settings** — Backup, Restore, Reset

---

## 🗄️ Database

| Environment | Provider | Location |
|-------------|----------|----------|
| Local dev | SQLite | `db/custom.db` |
| Production | Turso (libSQL) | Cloud-hosted, multi-region |

The Prisma client (`src/lib/db.ts`) auto-detects the environment.

---

## 📂 Project Structure

```
.
├── start-dev.sh / .bat        # Local dev startup
├── start-prod.sh / .bat       # Local production startup
├── README.md                  # This file
├── LOCAL-SETUP.md             # Detailed local setup (Bangla)
├── DEPLOYMENT-GUIDE.md        # Vercel + Turso setup guide
├── vercel.json                # Vercel config
├── .github/workflows/deploy.yml  # Auto-deploy workflow
├── wrangler.toml              # Cloudflare config (optional)
├── src/
│   ├── app/                   # Next.js app
│   │   ├── page.tsx           # Main frontend
│   │   └── api/               # 39 API routes
│   ├── lib/
│   │   ├── db.ts              # Env-aware Prisma client
│   │   └── auth.ts            # bcrypt auth
│   └── components/ui/         # shadcn/ui library
├── prisma/schema.prisma       # Database schema (19 tables)
├── db/custom.db               # Local SQLite (with seed data)
├── migrations/                # SQL migrations
└── scripts/                   # Utilities
```

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS 4, shadcn/ui, Recharts, Lucide
- **Database:** SQLite (local) / Turso libSQL (production)
- **ORM:** Prisma 6 (with driver adapters)
- **Auth:** bcryptjs + session tokens
- **Hosting:** Vercel (auto-deploy via GitHub Actions)

---

## 📋 Requirements

- **Node.js** 20+ — https://nodejs.org
- **Bun** (optional, faster) — https://bun.sh

---

## 📝 License

Private/proprietary. All rights reserved.
