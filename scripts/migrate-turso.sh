#!/usr/bin/env bash
# ★ Run this script locally whenever prisma/schema.prisma changes.
# It applies the schema to the production Turso DB so Vercel builds don't need to.
#
# Prerequisites:
#   - TURSO_DATABASE_URL and TURSO_AUTH_TOKEN set in your shell environment
#     (use the same values you set on Vercel)
#   - prisma installed (npm install)
#
# Usage:
#   bash scripts/migrate-turso.sh
#
# After running this, commit the schema + push to GitHub. Vercel will auto-deploy
# and the new schema will already be in place — no in-build prisma db push needed.

set -e

cd "$(dirname "$0")/.."

if [ -z "$TURSO_DATABASE_URL" ] || [ -z "$TURSO_AUTH_TOKEN" ]; then
  echo "❌ Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in your environment."
  echo ""
  echo "Example:"
  echo "  export TURSO_DATABASE_URL='libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io'"
  echo "  export TURSO_AUTH_TOKEN='eyJhbGciOi...'"
  echo "  bash scripts/migrate-turso.sh"
  exit 1
fi

echo "📦 Generating Prisma client..."
PRISMA_DATABASE_URL=file:db.sqlite npx prisma generate

echo ""
echo "🚀 Pushing schema to Turso production DB..."
echo "   URL: $TURSO_DATABASE_URL"
echo ""

# prisma db push against Turso — accepts data loss warning for new nullable fields
PRISMA_DATABASE_URL="${TURSO_DATABASE_URL}?authToken=${TURSO_AUTH_TOKEN}" npx prisma db push --accept-data-loss

echo ""
echo "✅ Done! Schema is now in sync with the production Turso DB."
echo "   Commit any pending schema changes and push to GitHub — Vercel will auto-deploy."
