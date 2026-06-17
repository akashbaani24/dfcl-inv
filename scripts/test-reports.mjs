// Test script: log in, hit /api/reports, and verify response shape
const BASE = 'http://localhost:3000'

async function main() {
  // 1. Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const loginData = await loginRes.json()
  if (!loginRes.ok) {
    console.error('Login failed:', loginData)
    process.exit(1)
  }
  console.log('✓ Login success. User:', loginData.user.username, 'Role:', loginData.user.role)
  const token = loginData.token

  // 2. Hit /api/reports (default = all, last 30 days)
  const r1 = await fetch(`${BASE}/api/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const d1 = await r1.json()
  console.log('✓ /api/reports default status:', r1.status)
  console.log('  from:', d1.from, 'to:', d1.to)
  console.log('  stock:', d1.stock ? `OK (totalItems=${d1.stock.totalItems}, totalQty=${d1.stock.totalQty}, totalValue=${d1.stock.totalValue})` : 'NULL')
  console.log('  sales:', d1.sales ? `OK (orderCount=${d1.sales.orderCount}, netRevenue=${d1.sales.netRevenue})` : 'NULL')
  console.log('  transfer:', d1.transfer ? `OK (totalCount=${d1.transfer.totalCount})` : 'NULL')
  console.log('  adjustment:', d1.adjustment ? `OK (totalCount=${d1.adjustment.totalCount})` : 'NULL')
  console.log('  incentive:', d1.incentive ? `OK (totalCount=${d1.incentive.totalCount})` : 'NULL')

  // 3. Hit /api/reports?type=sales
  const r2 = await fetch(`${BASE}/api/reports?type=sales`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const d2 = await r2.json()
  console.log('✓ /api/reports?type=sales status:', r2.status, 'has sales:', !!d2.sales, 'has stock:', !!d2.stock, '(should be false)')

  // 4. Hit /api/reports?type=stock with all-time
  const r3 = await fetch(`${BASE}/api/reports?type=stock&from=2020-01-01&to=2030-12-31`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const d3 = await r3.json()
  console.log('✓ /api/reports?type=stock status:', r3.status, 'totalValue:', d3.stock?.totalValue, 'entityStockCount:', d3.stock?.entityStock?.length)

  // 5. Logout
  const lr = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log('✓ Logout status:', lr.status)
}

main().catch(e => { console.error('ERR', e); process.exit(1) })
