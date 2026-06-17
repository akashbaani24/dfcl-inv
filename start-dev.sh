#!/usr/bin/env bash
# ============================================================
#  DFCL Inventory App — Local Dev Startup Script
#  Run this script to start the development server.
# ============================================================
#  Usage:   ./start-dev.sh
#  URL:     http://localhost:3000
#  Login:   admin / admin123
# ============================================================

set -e
cd "$(dirname "$0")"

echo "=============================================="
echo "  DFCL Inventory App — Local Dev Server"
echo "=============================================="
echo ""

# 1. Check Node/Bun
if command -v bun >/dev/null 2>&1; then
  PM="bun"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  echo "❌ Neither bun nor npm found. Install Node.js 20+ from https://nodejs.org"
  exit 1
fi
echo "📦 Package manager: $PM"

# 2. Install dependencies if missing
if [ ! -d "node_modules" ]; then
  echo "📥 Installing dependencies (first run, may take 1-2 minutes)..."
  if [ "$PM" = "bun" ]; then
    bun install
  else
    npm install
  fi
  echo "✅ Dependencies installed"
fi

# 3. Generate Prisma client if missing
if [ ! -f "node_modules/.prisma/client/client.js" ]; then
  echo "🔧 Generating Prisma client..."
  $PM run db:generate
fi

# 4. Push schema to local SQLite (idempotent)
echo "🗄️  Syncing database schema..."
$PM run db:push 2>&1 | tail -3

# 5. Start dev server
echo ""
echo "🚀 Starting dev server..."
echo "   URL:   http://localhost:3000"
echo "   Login: admin / admin123"
echo ""
echo "   Press Ctrl+C to stop"
echo "=============================================="
echo ""

if [ "$PM" = "bun" ]; then
  exec bun run dev
else
  exec npm run dev
fi
