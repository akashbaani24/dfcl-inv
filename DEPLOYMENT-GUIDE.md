# 🚀 Vercel + Turso Auto-Deploy Setup Guide

এই গাইড অনুসরণ করে আপনার অ্যাপ Vercel-এ হোস্ট করুন, যেখানে প্রতিটা `git push`-এ অটোমেটিক production-এ deploy হবে।

---

## 📋 Architecture Overview

```
GitHub Repository
       │
       │ (git push to main)
       ▼
GitHub Actions Workflow (.github/workflows/deploy.yml)
       │
       ├─→ Install deps (bun install)
       ├─→ Generate Prisma client
       ├─→ Build Next.js
       └─→ Deploy to Vercel (production)
                  │
                  ▼
            Vercel Serverless
                  │
                  ├─→ Frontend (Next.js SSR)
                  └─→ API Routes (39 endpoints)
                          │
                          ▼
                    Turso Database (libSQL)
                          │
                          └─→ Cloud-hosted SQLite (replicated, multi-region)
```

---

## 🗂️ Step 1: Create Turso Database (free, 2 minutes)

Turso হলো cloud-hosted SQLite — Vercel-এর সাথে দারুণ কাজ করে, ফ্রি tier-এ 500 databases, 9GB storage পাবেন।

### 1.1 Sign up at Turso

1. যান: **https://turso.tech/app/signup**
2. GitHub দিয়ে sign up করুন (সবচেয়ে সহজ)

### 1.2 Create Database

1. Sign in করে dashboard এ যান
2. **"New Database"** button ক্লিক করুন
3. Name দিন: **`dfcl-inv`**
4. Group/Location: **Singapore** (APAC)
5. **Create** ক্লিক করুন

### 1.3 Get Database URL

1. Database list থেকে `dfcl-inv` এ ক্লিক করুন
2. **"Settings"** বা **"Info"** tab এ যান
3. **Database URL** কপি করুন — দেখতে এমন:
   ```
   libsql://dfcl-inv-<your-username>.turso.io
   ```

### 1.4 Create Auth Token

1. একই dashboard-এ, **"Tokens"** tab এ যান
2. **"New Token"** ক্লিক করুন
3. Name: `vercel-prod`
4. Expiration: 1 year
5. Database access: **All databases** বা শুধু `dfcl-inv`
6. **Create** ক্লিক করুন
7. Token কপি করুন: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ...`

⚠️ **Token শুধু একবার দেখাবে — সেভ করে রাখুন!**

### 1.5 সংগৃহীত তথ্য

আপনার কাছে এখন:
- `TURSO_DATABASE_URL` = `libsql://dfcl-inv-xxx.turso.io`
- `TURSO_AUTH_TOKEN` = `eyJhbGciOi...`

---

## 🗃️ Step 2: Apply Schema to Turso

আমাকে দুটো জিনিস দিন:
```
TURSO_DATABASE_URL: libsql://dfcl-inv-xxx.turso.io
TURSO_AUTH_TOKEN: eyJhbGciOi...
```

আমি schema apply করে seed data (admin user + 7 entities + 500 items + master data) সব করে দেব।

---

## ▲ Step 3: Create Vercel Project (free)

### 3.1 Sign up at Vercel

1. যান: **https://vercel.com/signup**
2. **"Continue with GitHub"** ক্লিক করুন

### 3.2 Import Repository

1. Vercel dashboard এ **"Add New..." → "Project"**
2. `akashbaani24/dfcl-inv` খুঁজুন
3. **"Import"** ক্লিক করুন

### 3.3 Configure Project

| Field | Value |
|-------|-------|
| Framework Preset | Next.js |
| Build Command | `prisma generate && next build` |
| Output Directory | `.next` |
| Install Command | `bun install` |

### 3.4 Add Environment Variables (CRITICAL)

| Name | Value | Environments |
|------|-------|--------------|
| `TURSO_DATABASE_URL` | `libsql://dfcl-inv-xxx.turso.io` | Production, Preview, Development |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` | Production, Preview, Development |
| `DATABASE_URL` | `libsql://dfcl-inv-xxx.turso.io` (same) | Production, Preview, Development |

### 3.5 Deploy

**"Deploy"** ক্লিক করুন — ২-৩ মিনিট সময় লাগবে।

---

## 🔑 Step 4: Get Vercel Secrets for GitHub Actions

### 4.1 Create Vercel Token

1. যান: **https://vercel.com/account/tokens**
2. **"Create Token"** ক্লিক করুন
3. Name: `github-actions-deploy`
4. Expiration: 1 year
5. Token কপি করুন: `vercel_xxxxxxxx...`

### 4.2 Get Org ID ও Project ID

1. Vercel project এ যান → **Settings** → **General**
2. "Project ID" ও "Org ID" কপি করুন

---

## 🔐 Step 5: Add Secrets to GitHub

1. যান: **https://github.com/akashbaani24/dfcl-inv/settings/secrets/actions**
2. **"New repository secret"** ক্লিক করে ৫টা যোগ করুন:

| Secret Name | Value |
|-------------|-------|
| `VERCEL_TOKEN` | `vercel_xxxxxxxx...` |
| `VERCEL_ORG_ID` | `team_xxxxxxxx` |
| `VERCEL_PROJECT_ID` | `prj_xxxxxxxx` |
| `TURSO_DATABASE_URL` | `libsql://dfcl-inv-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` |

---

## 🎉 Step 6: Test Auto-Deploy

1. কোনো ছোট পরিবর্তন করুন
2. `git commit -am "test"`
3. `git push origin main`
4. **https://github.com/akashbaani24/dfcl-inv/actions** এ গিয়ে workflow চলতে দেখুন
5. সবুজ ✓ দেখলে আপনার Vercel URL-এ fresh version live!

---

## ✅ Verification Checklist

- [ ] Turso database তৈরি
- [ ] Schema apply (admin + entities + items)
- [ ] Vercel project import
- [ ] ৩টা env var Vercel-এ যোগ
- [ ] ৫টা secret GitHub-এ যোগ
- [ ] First push এ workflow সফল
- [ ] Vercel URL-এ অ্যাপ দেখা যাচ্ছে
- [ ] Login কাজ করছে: `admin` / `admin123`

---

## 📞 Quick Path

**সবচেয়ে সহজ পথ:** আমাকে দিন:
1. **Turso Database URL**: `libsql://dfcl-inv-xxx.turso.io`
2. **Turso Auth Token**: `eyJhbGciOi...`

আমি:
- ✅ Schema apply করব
- ✅ Seed data insert করব
- ✅ Production build test করব
- ✅ GitHub-এ push করব
- ✅ বলব কোন Vercel secrets যোগ করতে হবে
