# Cloudflare D1 Deployment Guide

This document explains how to deploy the **dfcl-app** (Inventory Management System) to **Cloudflare Pages + D1**.

The app is configured to run in **two modes**:

| Environment | Runtime | Database | Use case |
|-------------|---------|----------|----------|
| Local / space-z.ai preview | Node.js | SQLite (`db/custom.db`) | Development & testing |
| Cloudflare Pages | Edge (V8 isolates) | D1 (`dfcl-inv-db`) | Production |

The same codebase runs in both environments — `src/lib/db.ts` auto-detects the environment.

---

## ✅ Already Done (by the assistant)

1. **D1 database schema applied** to `dfcl-inv-db` (ID: `f85696ac-e6ac-43ca-96cb-6cda76cf7fc5`)
   - 19 tables created (Users, Entities, Items, Stocks, Transactions, Master Data, etc.)
   - All foreign keys, indexes, and constraints from `prisma/schema.prisma`
2. **Seed data applied** to remote D1:
   - Admin user (`admin` / `admin123`)
   - 5 entities (Dhaka Main Warehouse, Chittagong Branch, Sylhet Store, Rajshahi Depot, Khulna Distribution)
   - 8 UoM entries (PCS, KG, LTR, MTR, BOX, SET, DOZ, PACK)
3. **`wrangler.toml`** created in project root with your D1 binding
4. **`@prisma/adapter-d1`** installed — Prisma Client uses D1 when on Cloudflare
5. **`src/lib/db.ts`** rewritten to be environment-aware (D1 binding detection)
6. **`migrations/`** folder contains SQL files for manual re-application
7. **`package.json`** has Cloudflare scripts (`cf:build`, `cf:deploy`, `cf:d1:*`)

---

## 🚀 How to Deploy to Cloudflare Pages

You have **two options**:

### Option A: GitHub Integration (Recommended — automatic deploys)

1. Push this project to a GitHub repo
2. Go to [Cloudflare Pages dashboard](https://dash.cloudflare.com/?to=/:account/pages)
3. Click **"Create a project"** → **"Connect to Git"**
4. Select your repo
5. Configure the build:
   - **Framework preset**: Next.js
   - **Build command**: `npx @cloudflare/next-on-pages`
   - **Build output directory**: `.next`
   - **Environment variables** (add under "Settings"):
     - `NODE_VERSION` = `20`
     - `SKIP_DEPENDENCY_INSTALL` = `0`
6. Under **"Settings" → "Functions" → "D1 database bindings"**, add:
   - Variable name: `DB`
   - D1 database: `dfcl-inv-db`
7. Under **"Settings" → "Functions" → "Compatibility flags"**, add:
   - `nodejs_compat`
8. Click **"Save and Deploy"**

Cloudflare will rebuild & deploy on every push to your main branch.

### Option B: Manual deploy via Wrangler CLI

From your local machine (requires Node 20+ and the project cloned):

```bash
# 1. Install deps
npm install

# 2. Set your Cloudflare API token (already done in our setup, but for your reference)
export CLOUDFLARE_API_TOKEN="your-token-here"

# 3. Build for Cloudflare Pages
npm run cf:build
# This runs: CF_PAGES=1 next-on-pages

# 4. Deploy to Cloudflare Pages
npm run cf:deploy
# This runs: wrangler pages deploy .next --project-name=dfcl-app
# (first run will prompt you to create the project)

# 5. Bind D1 to your Pages project (one-time setup)
#    Go to Cloudflare dashboard → Pages → dfcl-app → Settings → Functions → D1 bindings
#    Add binding: variable name "DB" → database "dfcl-inv-db"
```

---

## 🗄️ D1 Database Management

All commands use `wrangler` and your Cloudflare API token (set as `CLOUDFLARE_API_TOKEN` env var).

### Re-apply schema migration

```bash
npm run cf:d1:migrate:remote
```

### Re-apply seed data

```bash
npm run cf:d1:seed:remote
```

### Run any SQL query on remote D1

```bash
# Example: count users
npm run cf:d1:query "SELECT COUNT(*) as cnt FROM User;"

# Example: list entities
npm run cf:d1:query "SELECT id, name FROM Entity;"
```

### Migrate existing local data to D1 (optional)

If you want to copy your local SQLite data to D1:

```bash
# 1. Export local SQLite to SQL
sqlite3 db/custom.db .dump > migrations/d1_full_dump.sql

# 2. Edit the file to remove SQLite-specific PRAGMA statements
#    (Keep only CREATE TABLE and INSERT statements)

# 3. Apply to D1
npx wrangler d1 execute dfcl-inv-db --remote --file=migrations/d1_full_dump.sql
```

### Local D1 testing (without deploying)

```bash
# Create local D1 copy
npm run cf:d1:migrate:local
npm run cf:d1:seed:local

# Run dev server against local D1
npm run cf:preview
```

---

## 🔑 Authentication & Credentials

- **D1 Database ID**: `f85696ac-e6ac-43ca-96cb-6cda76cf7fc5`
- **D1 Database name**: `dfcl-inv-db` (binding: `DB`)
- **Cloudflare Pages project name**: `dfcl-app`
- **Admin login**: `admin` / `admin123` (already seeded in D1)
- **Cloudflare API Token**: stored in your shell env as `CLOUDFLARE_API_TOKEN`
  - ⚠️ **Revoke and rotate this token** at https://dash.cloudflare.com/profile/api-tokens after deployment, since it was shared in chat.

---

## 🩹 Troubleshooting

### "Cannot find module '@prisma/adapter-d1'"
Run `npm install` — it's a regular dependency in `package.json`.

### Login fails on Cloudflare
Check that the D1 binding is correctly named `DB` in your Pages project settings (case-sensitive).

### Prisma error "edge runtime not supported"
Make sure you ran `CF_PAGES=1 next-on-pages` (not `next build`). The `CF_PAGES` env var signals the build to use the Edge-compatible Prisma adapter.

### Build fails on Cloudflare Pages
Check that:
- `NODE_VERSION=20` is set
- `nodejs_compat` compatibility flag is enabled
- Build command is `npx @cloudflare/next-on-pages` (NOT `next build`)

### "DB binding not available" at runtime
The D1 binding must be attached to the **Pages project**, not just the wrangler.toml. Go to Cloudflare dashboard → Pages → your project → Settings → Functions → D1 database bindings.

---

## 📁 File Structure (Cloudflare-related)

```
.
├── wrangler.toml              # Cloudflare config (D1 binding, project name)
├── next.config.ts             # Next.js config (standalone output for space-z.ai)
├── types/cloudflare-env.d.ts  # TypeScript types for D1 binding
├── migrations/
│   ├── d1_initial.sql         # Full schema (19 tables)
│   └── d1_seed.sql            # Seed data (admin user + entities + UoM)
├── src/lib/
│   ├── db.ts                  # Environment-aware Prisma client
│   └── auth.ts                # bcryptjs (works in both Node & Edge)
└── package.json               # cf:build, cf:deploy, cf:d1:* scripts
```

---

## 🎯 Production URL

After deploying to Cloudflare Pages, your app will be available at:
- `https://dfcl-app.pages.dev` (default)
- Or your custom domain if you configure one in Cloudflare Pages settings

The local/preview version (on space-z.ai) will continue to use SQLite — both environments work independently.
