/**
 * Direct upload of 123.xlsx to Turso — streaming version
 * Processes data in chunks to avoid memory issues.
 * Writes progress to /tmp/upload-status.txt
 */
import * as XLSX from 'xlsx'
import { createClient } from '@libsql/client'
import { writeFileSync, appendFileSync } from 'fs'

const XLSX_FILE = '/home/z/my-project/upload/123.xlsx'
const TURSO_URL = 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4NDU0NTMwNzgsImlhdCI6MTc4MTY4OTg3OCwiaWQiOiIwMTllZDRmYy1mNTAxLTcxYjEtOGM0My0wNjFkNzAxMzZiYTMiLCJyaWQiOiJiNTZlOWRjOC1mNmYwLTRmMWQtYjcyMC1kZWU5YWI1YTQ4MGQifQ.54Zz7H5EDY-QIVM-XOTfZlMyYOLSMOdIxG6pmzSsxtcrgVpM2oyJej_5lI-EiuMT1r3uSw6B8hO_8OJsX39lCg'
const STATUS_FILE = '/tmp/upload-status.txt'

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  appendFileSync(STATUS_FILE, line + '\n')
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const timestamp = Date.now().toString(36)
  let random = ''
  for (let i = 0; i < 20; i++) random += chars[Math.floor(Math.random() * chars.length)]
  return `c${timestamp}${random}`.slice(0, 24)
}

async function main() {
  writeFileSync(STATUS_FILE, '')
  log('📖 Reading xlsx file...')
  const wb = XLSX.readFile(XLSX_FILE, { cellDates: false, raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })
  log(`   Total rows: ${rows.length}`)

  const header = rows[0].map((h: string) => String(h).toLowerCase().trim())
  log(`   Header: ${JSON.stringify(header)}`)

  const idx = {
    year: header.indexOf('year'),
    lcNo: header.indexOf('lcno'),
    group: header.indexOf('group'),
    subGroup: header.indexOf('subgroup'),
    itemName: header.indexOf('itemname'),
    price: header.indexOf('price'),
    uom: header.indexOf('uom'),
  }

  const c = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

  log('🔍 Loading existing itemNames...')
  const existing = await c.execute('SELECT itemName FROM Item')
  const existingNames = new Set<string>()
  for (const row of existing.rows) {
    if (row.itemName) existingNames.add(String(row.itemName).toLowerCase())
  }
  log(`   Existing items: ${existingNames.size}`)

  // Process in chunks of 1000 rows
  const CHUNK_SIZE = 1000
  let totalInserted = 0
  let totalDuplicates = 0
  let totalMissing = 0
  let totalProcessed = 0
  const seenInThisUpload = new Set<string>()
  const startTime = Date.now()

  for (let chunkStart = 1; chunkStart < rows.length; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, rows.length)
    const chunkRows = rows.slice(chunkStart, chunkEnd)
    
    // Parse this chunk
    const rowsToInsert: Array<any[]> = []
    for (let i = 0; i < chunkRows.length; i++) {
      const row = chunkRows[i]
      if (!row || row.length === 0) { totalMissing++; continue }

      const getCell = (colIdx: number, fallback = 'N/A'): string => {
        if (colIdx < 0 || colIdx >= row.length) return fallback
        const v = row[colIdx]
        if (v === null || v === undefined) return fallback
        const s = String(v).trim()
        return s === '' ? fallback : s
      }

      const itemName = getCell(idx.itemName, 'N/A')
      if (itemName === 'N/A' || !itemName) {
        totalMissing++
        continue
      }

      const key = itemName.toLowerCase()
      if (existingNames.has(key) || seenInThisUpload.has(key)) {
        totalDuplicates++
        continue
      }
      seenInThisUpload.add(key)

      const year = getCell(idx.year, 'N/A')
      const lcNo = getCell(idx.lcNo, 'N/A')
      const group = getCell(idx.group, 'N/A')
      const subGroup = getCell(idx.subGroup, 'N/A')
      const uom = getCell(idx.uom, 'PCS')

      let price = 0
      const priceRaw = idx.price >= 0 && idx.price < row.length ? String(row[idx.price] ?? '').trim() : ''
      if (priceRaw && priceRaw !== 'N/A') {
        const normalized = priceRaw.replace(',', '.').replace(/[^0-9.-]/g, '')
        const parsed = parseFloat(normalized)
        if (!isNaN(parsed)) price = parsed
      }

      rowsToInsert.push([generateId(), year, lcNo, group, subGroup, itemName, price, uom, 'script-direct-upload'])
    }

    // Insert this chunk (70 rows per statement, send all in one batch)
    if (rowsToInsert.length > 0) {
      const ROWS_PER_STMT = 70
      const stmts: Array<{ sql: string; args: (string | number)[] }> = []
      for (let i = 0; i < rowsToInsert.length; i += ROWS_PER_STMT) {
        const batch = rowsToInsert.slice(i, i + ROWS_PER_STMT)
        // 10 placeholders per row (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))
        // NULL and datetime() are literals — only 10 ? placeholders
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime(\'now\'), datetime(\'now\'))').join(', ')
        const args: (string | number)[] = []
        for (const r of batch) {
          // r = [id, year, lcNo, group, subGroup, itemName, price, uom, createdBy] = 9 elements
          // But SQL needs: id, year, lcNo, group, subGroup, itemName, price, uom, [NULL supplierId], createdBy, [updatedAt], [createdAt], [updatedAt]
          // Placeholders map: id=1, year=2, lcNo=3, group=4, subGroup=5, itemName=6, price=7, uom=8, supplierId=NULL(literal), createdBy=9, updatedBy=10, createdAt=now, updatedAt=now
          // Wait — we have 10 ? in SQL: id, year, lcNo, group, subGroup, itemName, price, uom, createdBy, updatedBy
          // r has 9 elements (no updatedBy). Add updatedBy = createdBy
          args.push(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[8])
        }
        stmts.push({
          sql: `INSERT OR IGNORE INTO "Item" ("id", "year", "lcNo", "group", "subGroup", "itemName", "price", "uom", "supplierId", "createdBy", "updatedBy", "createdAt", "updatedAt") VALUES ${placeholders}`,
          args,
        })
      }
      
      // Send 30 statements per batch (30 × 70 = 2100 rows max per HTTP request)
      const STMTS_PER_BATCH = 30
      for (let i = 0; i < stmts.length; i += STMTS_PER_BATCH) {
        const stmtBatch = stmts.slice(i, i + STMTS_PER_BATCH)
        try {
          const results = await c.batch(stmtBatch, 'write')
          for (const r of results) totalInserted += (r.rows_affected as number) || 0
        } catch (e) {
          log(`   ⚠ Batch failed at chunk ${chunkStart}, stmt ${i}: ${String(e).slice(0, 100)}`)
          // Try one-by-one
          for (const stmt of stmtBatch) {
            try {
              const r = await c.execute(stmt)
              totalInserted += (r.rows_affected as number) || 0
            } catch {}
          }
        }
      }
    }

    totalProcessed += chunkRows.length
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    log(`   Progress: ${totalProcessed}/${rows.length - 1} rows processed | Inserted: ${totalInserted} | Dups: ${totalDuplicates} | Missing: ${totalMissing} | ${elapsed}s`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  log(`\n✅ DONE in ${elapsed}s`)
  log(`   Total processed: ${totalProcessed}`)
  log(`   Inserted: ${totalInserted}`)
  log(`   Duplicates skipped: ${totalDuplicates}`)
  log(`   Missing/empty: ${totalMissing}`)

  const final = await c.execute('SELECT COUNT(*) as c FROM Item')
  log(`   Total items in Turso now: ${final.rows[0].c}`)
}

main().catch(e => { log(`ERROR: ${e}`); process.exit(1) })
