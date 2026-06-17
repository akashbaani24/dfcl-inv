#!/usr/bin/env bash
# ============================================================
#  DFCL Inventory App — Production Startup Script
#  Builds the app for production and runs the standalone server.
# ============================================================
#  Usage:   ./start-prod.sh
#  URL:     http://localhost:3000
#  Login:   admin / admin123
# ============================================================

set -e
cd "$(dirname "$0")"

echo "=============================================="
echo "  DFCL Inventory App — Production Server"
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
  echo "📥 Installing dependencies..."
  if [ "$PM" = "bun" ]; then
    bun install
  else
    npm install
  fi
fi

# 3. Generate Prisma client
echo "🔧 Generating Prisma client..."
$PM run db:generate

# 4. Sync database schema
echo "🗄️  Syncing database schema..."
$PM run db:push 2>&1 | tail -3

# 5. Build for production (only if build is missing or older than source)
if [ ! -f ".next/standalone/server.js" ] || [ "src/app/page.tsx" -nt ".next/standalone/server.js" ]; then
  echo "🔨 Building production bundle (may take 30-60 seconds)..."
  $PM run build
  echo "✅ Build complete"
else
  echo "✅ Using existing build (run 'rm -rf .next' to force rebuild)"
fi

# 6. Start production server
echo ""
echo "🚀 Starting production server..."
echo "   URL:   http://localhost:3000"
echo "   Login: admin / admin123"
echo ""
echo "   Press Ctrl+C to stop"
echo "=============================================="
echo ""

if [ "$PM" = "bun" ]; then
  exec bun .next/standalone/server.js
else
  exec node .next/standalone/server.js
fi
