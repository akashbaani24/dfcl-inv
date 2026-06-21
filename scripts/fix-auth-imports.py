#!/usr/bin/env python3
"""
Fix broken auth imports in API routes.

Problem: Many API routes import `getCurrentUserBasic` but actually call
`getCurrentUser(request)`. Since `getCurrentUser` is NOT imported, this
throws a ReferenceError at runtime, causing every affected route to
return 500 Internal Server Error and the frontend to show
"Failed to load reports" / "No items found".

Fix: For each .ts file under src/app/api:
  - If file imports `getCurrentUserBasic` (with or without other named imports)
    AND file calls `getCurrentUser(` somewhere
    AND file does NOT call `getCurrentUserBasic(` anywhere
  => Replace `getCurrentUserBasic` with `getCurrentUser` in the import statement.

Files that legitimately use `getCurrentUserBasic` (i.e. actually call it)
are left untouched. Also leaves the `getCurrentUserBasic as getCurrentUser`
alias pattern (used by /api/users/route.ts) alone.
"""

import re
import sys
from pathlib import Path

API_DIR = Path('/home/z/my-project/src/app/api')

# Recursively find all .ts files
broken_files = []
skipped_files = []
already_ok = []

for ts_file in API_DIR.rglob('*.ts'):
    src = ts_file.read_text(encoding='utf-8')

    # Skip files that don't import getCurrentUserBasic at all
    if 'getCurrentUserBasic' not in src:
        continue

    # Skip files that use the alias pattern
    # `getCurrentUserBasic as getCurrentUser` — this is intentional
    if re.search(r'getCurrentUserBasic\s+as\s+getCurrentUser', src):
        already_ok.append((ts_file, 'alias pattern'))
        continue

    # Does the file call getCurrentUserBasic(...)?
    calls_basic = bool(re.search(r'\bgetCurrentUserBasic\s*\(', src))
    # Does the file call getCurrentUser(...) (but not getCurrentUserBasic)?
    # Use negative lookbehind to avoid matching getCurrentUserBasic(
    calls_full = bool(re.search(r'(?<!Basic\b)getCurrentUser\s*\(', src))

    # Also handle case where re lookbehind needs more chars
    # Simpler: count occurrences
    # Remove all getCurrentUserBasic occurrences, then check for getCurrentUser(
    src_without_basic = re.sub(r'getCurrentUserBasic', '', src)
    calls_full = bool(re.search(r'\bgetCurrentUser\s*\(', src_without_basic))

    if calls_basic:
        # File legitimately uses getCurrentUserBasic — leave alone
        already_ok.append((ts_file, 'uses basic'))
        continue

    if not calls_full:
        # File doesn't call either — import is unused, leave alone (or remove)
        skipped_files.append((ts_file, 'no calls'))
        continue

    # BROKEN: imports getCurrentUserBasic but calls getCurrentUser
    broken_files.append(ts_file)

print(f'Found {len(broken_files)} broken files:\n')
for f in broken_files:
    print(f'  {f.relative_to(API_DIR)}')

print(f'\n{"=" * 60}')
print(f'Patching {len(broken_files)} files...\n')

patched = 0
for ts_file in broken_files:
    src = ts_file.read_text(encoding='utf-8')
    # Replace `getCurrentUserBasic` with `getCurrentUser` ONLY in import statements
    # (we already verified the file doesn't call getCurrentUserBasic anywhere)
    new_src = src.replace('getCurrentUserBasic', 'getCurrentUser')
    if new_src != src:
        ts_file.write_text(new_src, encoding='utf-8')
        patched += 1
        print(f'  PATCHED: {ts_file.relative_to(API_DIR)}')
    else:
        print(f'  NO CHANGE: {ts_file.relative_to(API_DIR)}')

print(f'\n{"=" * 60}')
print(f'Done. Patched {patched}/{len(broken_files)} files.')

print(f'\nFiles left untouched (already OK): {len(already_ok)}')
for f, reason in already_ok:
    print(f'  ({reason}) {f.relative_to(API_DIR)}')

print(f'\nFiles skipped (no auth calls): {len(skipped_files)}')
for f, reason in skipped_files:
    print(f'  ({reason}) {f.relative_to(API_DIR)}')
