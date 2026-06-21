#!/usr/bin/env python3
"""
Upload DEWS stock data from Excel to the local SQLite database.

Steps:
1. Create "Dynasty Furnishings Centre Ltd (DEWS)" entity
2. Read Stock sheet from Excel — 699 rows with Barcode, Item Code, Current
3. For each row:
   a. Check if an Item with that barcode exists in DB
   b. If not, check by itemCode
   c. If still not found, create a new Item record
   d. Create/update Stock entry linking item → DEWS entity with quantity
4. Report results
"""

import sqlite3
import openpyxl
import uuid
import time
from datetime import datetime

DB_PATH = '/home/z/my-project/db/custom.db'
XLSX_PATH = '/home/z/my-project/upload/DEWS (1).xlsx'
ENTITY_NAME = 'Dynasty Furnishings Centre Ltd (DEWS)'

def generate_cuid():
    """Generate a CUID-like ID compatible with the existing database."""
    return 'c' + uuid.uuid4().hex[:23]

def main():
    # 1. Open database
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 2. Create or find DEWS entity
    c.execute("SELECT id FROM Entity WHERE name = ?", (ENTITY_NAME,))
    entity_row = c.fetchone()
    if entity_row:
        entity_id = entity_row[0]
        print(f"Entity already exists: {ENTITY_NAME} ({entity_id})")
    else:
        entity_id = generate_cuid()
        now = datetime.now().isoformat()
        c.execute(
            "INSERT INTO Entity (id, name, description, entityType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
            (entity_id, ENTITY_NAME, 'Dynasty Furnishings Centre Ltd', 'outlet', now, now)
        )
        conn.commit()
        print(f"Created new entity: {ENTITY_NAME} ({entity_id})")

    # 3. Read Excel
    print(f"\nReading Excel: {XLSX_PATH}")
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb['Stock']

    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        barcode = str(row[0]) if row[0] else None
        item_code = str(row[1]).strip() if row[1] else None
        qty = row[2] if row[2] is not None else 0
        if barcode and qty:
            # Barcode can be int (1906190065406) or string (OFF-DEWS-26061203)
            if isinstance(barcode, (int, float)):
                barcode = str(int(barcode))
            else:
                barcode = str(barcode).strip()
            # Round quantity to int (schema uses INTEGER)
            qty_int = int(round(float(qty)))
            if qty_int > 0:  # Skip zero-quantity items
                rows.append((barcode, item_code, qty_int))

    print(f"Read {len(rows)} stock entries from Excel")

    # 4. Process each row
    items_created = 0
    items_matched = 0
    stock_created = 0
    stock_updated = 0
    skipped = 0

    for i, (barcode, item_code, qty) in enumerate(rows):
        if i % 100 == 0:
            print(f"  Processing row {i+1}/{len(rows)}...")
            conn.commit()

        # a. Check if Item exists by barcode
        c.execute("SELECT id FROM Item WHERE barcode = ?", (barcode,))
        item_row = c.fetchone()

        if not item_row and item_code:
            # b. Check by itemCode
            c.execute("SELECT id FROM Item WHERE itemCode = ?", (item_code,))
            item_row = c.fetchone()

        if item_row:
            item_id = item_row[0]
            items_matched += 1
            # Update barcode if it was missing
            c.execute("UPDATE Item SET barcode = ? WHERE id = ? AND (barcode IS NULL OR barcode = '')", (barcode, item_id))
        else:
            # c. Create new Item
            item_id = generate_cuid()
            now = datetime.now().isoformat()
            # Use itemCode as itemName if no better name available
            item_name = item_code or barcode
            c.execute(
                """INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (item_id, 'N/A', 'N/A', 'N/A', 'N/A', item_name, 0, 'PCS', barcode, item_code, now, now)
            )
            items_created += 1

        # d. Create or update Stock
        c.execute("SELECT id, quantity FROM Stock WHERE itemId = ? AND entityId = ?", (item_id, entity_id))
        stock_row = c.fetchone()
        now = datetime.now().isoformat()

        if stock_row:
            c.execute("UPDATE Stock SET quantity = ? WHERE id = ?", (qty, stock_row[0]))
            stock_updated += 1
        else:
            stock_id = generate_cuid()
            c.execute(
                "INSERT INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)",
                (stock_id, item_id, entity_id, qty)
            )
            stock_created += 1

    conn.commit()

    # 5. Report
    print(f"\n{'='*60}")
    print(f"UPLOAD COMPLETE")
    print(f"{'='*60}")
    print(f"Entity: {ENTITY_NAME} ({entity_id})")
    print(f"Total rows in Excel: {len(rows)}")
    print(f"Items matched (existing): {items_matched}")
    print(f"Items created (new): {items_created}")
    print(f"Stock entries created: {stock_created}")
    print(f"Stock entries updated: {stock_updated}")
    print(f"Skipped: {skipped}")

    # Verify
    c.execute("SELECT COUNT(*) FROM Stock WHERE entityId = ?", (entity_id,))
    total_stock = c.fetchone()[0]
    c.execute("SELECT SUM(quantity) FROM Stock WHERE entityId = ?", (entity_id,))
    total_qty = c.fetchone()[0]
    print(f"\nVerification:")
    print(f"  Total stock entries for DEWS: {total_stock}")
    print(f"  Total quantity: {total_qty}")

    wb.close()
    conn.close()

if __name__ == '__main__':
    main()
