#!/usr/bin/env bash
# Add `export const runtime = 'edge';` to all API route files
# Only adds if not already present, and inserts after the first import block

set -e
cd /home/z/my-project

count=0
skipped=0

for file in $(find src/app/api -name "route.ts" | sort); do
  if grep -q "export const runtime" "$file"; then
    skipped=$((skipped + 1))
    continue
  fi

  # Find the line number of the LAST import statement (end of imports)
  last_import=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)

  if [ -z "$last_import" ]; then
    # No imports, prepend at top
    {
      echo "export const runtime = 'edge';"
      echo ""
      cat "$file"
    } > "$file.tmp" && mv "$file.tmp" "$file"
  else
    # Insert after the last import line
    {
      head -n "$last_import" "$file"
      echo ""
      echo "export const runtime = 'edge';"
      tail -n +$((last_import + 1)) "$file"
    } > "$file.tmp" && mv "$file.tmp" "$file"
  fi

  count=$((count + 1))
  echo "  ✓ $file"
done

echo ""
echo "Added Edge runtime to $count files, skipped $skipped (already had it)"
