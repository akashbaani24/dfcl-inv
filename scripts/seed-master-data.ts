/**
 * Seed missing master data: Tailors, Suppliers, Customers, MakingInfo
 * Uses findFirst by name (since name isn't unique) then create if not exists.
 */
import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  console.log('🌱 Seeding master data...')

  // ---- Tailors ----
  const tailors = [
    { name: 'Karim Uddin', phone: '01711-123456', address: 'Mirpur, Dhaka', specialization: 'Shirt', status: 'active' },
    { name: 'Rahim Miah', phone: '01711-234567', address: 'Mohammadpur, Dhaka', specialization: 'Pant', status: 'active' },
    { name: 'Jewel Das', phone: '01711-345678', address: 'Old Dhaka', specialization: 'Suit', status: 'active' },
    { name: 'Selim Hossain', phone: '01711-456789', address: 'Gazipur', specialization: 'Shirt', status: 'active' },
    { name: 'Babul Ahmed', phone: '01711-567890', address: 'Narayanganj', specialization: 'Pant', status: 'inactive' },
  ]
  let tailorCount = 0
  for (const t of tailors) {
    const existing = await db.tailor.findFirst({ where: { name: t.name } })
    if (!existing) {
      await db.tailor.create({ data: t })
      tailorCount++
    }
  }
  console.log(`  ✓ ${tailorCount} new tailors added`)

  // ---- Suppliers ----
  const suppliers = [
    { name: 'Square Textiles Ltd.', phone: '02-5551234', email: 'sales@square.com', address: 'Gazipur, Dhaka', status: 'active' },
    { name: 'Beximco Textiles', phone: '02-5552345', email: 'info@beximco.com', address: 'Bhaluka, Mymensingh', status: 'active' },
    { name: 'Ha-Meem Group', phone: '02-5553456', email: 'contact@hameem.com', address: 'Savar, Dhaka', status: 'active' },
    { name: 'DBL Group', phone: '02-5554567', email: 'sales@dbl-group.com', address: 'Kashimpur, Gazipur', status: 'active' },
    { name: 'Mahmud Jeans Ltd.', phone: '02-5555678', email: 'info@mahmudjeans.com', address: 'Comilla', status: 'inactive' },
  ]
  let supplierCount = 0
  for (const s of suppliers) {
    const existing = await db.supplier.findFirst({ where: { name: s.name } })
    if (!existing) {
      await db.supplier.create({ data: s })
      supplierCount++
    }
  }
  console.log(`  ✓ ${supplierCount} new suppliers added`)

  // ---- Customers ----
  const customers = [
    { name: 'Aarong Retail', phone: '01811-111111', email: 'purchase@aarong.com', address: 'Banani, Dhaka', type: 'corporate', status: 'active' },
    { name: 'Yellow Clothing', phone: '01811-222222', email: 'buy@yellow.com', address: 'Gulshan, Dhaka', type: 'wholesale', status: 'active' },
    { name: "Sailor's Fashion", phone: '01811-333333', email: 'info@sailors.com', address: 'Dhanmondi, Dhaka', type: 'wholesale', status: 'active' },
    { name: 'Mohammad Ali', phone: '01811-444444', email: 'mali@gmail.com', address: 'Mirpur-10, Dhaka', type: 'regular', status: 'active' },
    { name: 'Fatima Begum', phone: '01811-555555', email: 'fatima@gmail.com', address: 'Uttara, Dhaka', type: 'regular', status: 'active' },
    { name: 'Rahman Store', phone: '01811-666666', email: 'rahmanstore@gmail.com', address: 'Chittagong', type: 'wholesale', status: 'active' },
    { name: 'City Style Boutique', phone: '01811-777777', email: 'citystyle@gmail.com', address: 'Sylhet', type: 'corporate', status: 'active' },
  ]
  let customerCount = 0
  for (const c of customers) {
    const existing = await db.customer.findFirst({ where: { name: c.name } })
    if (!existing) {
      await db.customer.create({ data: c })
      customerCount++
    }
  }
  console.log(`  ✓ ${customerCount} new customers added`)

  // ---- MakingInfo ----
  const makingInfo = [
    { name: 'Stitching', description: 'Basic stitching work', cost: 50, unit: 'PCS', status: 'active' },
    { name: 'Cutting', description: 'Fabric cutting', cost: 20, unit: 'PCS', status: 'active' },
    { name: 'Finishing', description: 'Final finishing touches', cost: 30, unit: 'PCS', status: 'active' },
    { name: 'Ironing', description: 'Pressing and ironing', cost: 15, unit: 'PCS', status: 'active' },
    { name: 'Embroidery', description: 'Custom embroidery work', cost: 100, unit: 'PCS', status: 'active' },
  ]
  let makingCount = 0
  for (const m of makingInfo) {
    const existing = await db.makingInfo.findFirst({ where: { name: m.name } })
    if (!existing) {
      await db.makingInfo.create({ data: m })
      makingCount++
    }
  }
  console.log(`  ✓ ${makingCount} new making info entries added`)

  // ---- Manager user ----
  const existingManager = await db.user.findUnique({ where: { username: 'manager' } })
  if (!existingManager) {
    const managerPassword = await hashPassword('manager123')
    await db.user.create({
      data: {
        username: 'manager',
        password: managerPassword,
        displayName: 'Store Manager',
        role: 'manager',
        canCreateItem: true,
        canModifyItem: true,
        columnAccess: {
          create: ['year', 'lcNo', 'group', 'subGroup', 'itemName', 'price', 'uom', 'stockQty'].map(c => ({ columnName: c, canView: true })),
        },
        menuAccess: {
          create: ['itemPrice', 'myEntityStock', 'allEntityStock', 'itemAdjustment', 'transfer', 'receive', 'salesOrder', 'salesReturn', 'incentive', 'reports'].map(m => ({ menuKey: m, visible: true })),
        },
      },
    })
    console.log('  ✓ manager created (password: manager123)')
  } else {
    console.log('  ✓ manager already exists')
  }

  // ---- Regular user ----
  const existingUser = await db.user.findUnique({ where: { username: 'user1' } })
  if (!existingUser) {
    const userPassword = await hashPassword('user123')
    const firstEntity = await db.entity.findFirst()
    await db.user.create({
      data: {
        username: 'user1',
        password: userPassword,
        displayName: 'Regular User',
        role: 'user',
        canCreateItem: false,
        canModifyItem: false,
        columnAccess: {
          create: [
            { columnName: 'year', canView: true },
            { columnName: 'itemName', canView: true },
            { columnName: 'price', canView: true },
            { columnName: 'uom', canView: true },
            { columnName: 'stockQty', canView: true },
          ],
        },
        menuAccess: {
          create: [
            { menuKey: 'itemPrice', visible: true },
            { menuKey: 'myEntityStock', visible: true },
            { menuKey: 'salesOrder', visible: true },
          ],
        },
        ...(firstEntity ? {
          entityAccess: { create: [{ entityId: firstEntity.id }] },
        } : {}),
      },
    })
    console.log('  ✓ user1 created (password: user123)')
  } else {
    console.log('  ✓ user1 already exists')
  }

  console.log('')
  console.log('✅ Seed complete!')
  console.log('')
  console.log('Login credentials:')
  console.log('  Admin:    admin / admin123     (full access)')
  console.log('  Manager:  manager / manager123 (no user management)')
  console.log('  User:     user1 / user123      (limited access)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
