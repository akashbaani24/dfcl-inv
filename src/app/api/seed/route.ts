import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, ITEM_COLUMNS, MENU_ITEMS } from '@/lib/auth';

export async function POST() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.user.findUnique({ where: { username: 'admin' } });

    if (existingAdmin) {
      return NextResponse.json({ message: 'Database already seeded. Use Reset first.' });
    }

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    await db.user.create({
      data: {
        username: 'admin',
        password: adminPassword,
        displayName: 'Administrator',
        role: 'admin',
        canCreateItem: true,
        canModifyItem: true,
        columnAccess: {
          create: ITEM_COLUMNS.filter(c => !c.alwaysVisible).map(c => ({
            columnName: c.key,
            canView: true,
          })),
        },
        menuAccess: {
          create: MENU_ITEMS.map(m => ({
            menuKey: m.key,
            visible: true,
          })),
        },
      },
    });

    // Create entities
    const entityNames = [
      'Dhaka Main Warehouse',
      'Chittagong Branch',
      'Sylhet Store',
      'Rajshahi Depot',
      'Khulna Distribution',
    ];

    const entities = [];
    for (const name of entityNames) {
      const entity = await db.entity.create({
        data: { name, description: `${name} - Entity` },
      });
      entities.push(entity);
    }

    // Create a regular user with limited access
    const userPassword = await hashPassword('user123');
    await db.user.create({
      data: {
        username: 'user1',
        password: userPassword,
        displayName: 'Regular User',
        role: 'user',
        canCreateItem: false,
        canModifyItem: false,
        columnAccess: {
          create: ITEM_COLUMNS.filter(c => !c.alwaysVisible).map(c => ({
            columnName: c.key,
            canView: c.key !== 'price', // Regular user can't see price by default
          })),
        },
        entityAccess: {
          create: [
            { entityId: entities[0].id }, // Dhaka Main Warehouse
            { entityId: entities[1].id }, // Chittagong Branch
          ],
        },
        menuAccess: {
          create: MENU_ITEMS.map(m => ({
            menuKey: m.key,
            visible: true,
          })),
        },
      },
    });

    // Create a manager user - sees all entities, can create/modify, but no admin settings
    const managerPassword = await hashPassword('manager123');
    await db.user.create({
      data: {
        username: 'manager',
        password: managerPassword,
        displayName: 'Manager',
        role: 'manager',
        canCreateItem: true,
        canModifyItem: true,
        columnAccess: {
          create: ITEM_COLUMNS.filter(c => !c.alwaysVisible).map(c => ({
            columnName: c.key,
            canView: true,
          })),
        },
      },
    });

    // Create a user with create/modify permissions
    const modPassword = await hashPassword('mod123');
    await db.user.create({
      data: {
        username: 'moderator',
        password: modPassword,
        displayName: 'Data Entry User',
        role: 'user',
        canCreateItem: true,
        canModifyItem: true,
        columnAccess: {
          create: ITEM_COLUMNS.filter(c => !c.alwaysVisible).map(c => ({
            columnName: c.key,
            canView: true,
          })),
        },
        entityAccess: {
          create: entities.map(e => ({ entityId: e.id })),
        },
        menuAccess: {
          create: MENU_ITEMS.map(m => ({
            menuKey: m.key,
            visible: true,
          })),
        },
      },
    });

    // Create sample items
    const groups = ['Electronics', 'Furniture', 'Stationery', 'Hardware', 'Textile', 'Chemical', 'Food', 'Beverage'];
    const subGroupsByGroup: Record<string, string[]> = {
      Electronics: ['Mobile', 'Laptop', 'Monitor', 'Keyboard', 'Mouse'],
      Furniture: ['Office Chair', 'Desk', 'Cabinet', 'Shelf', 'Table'],
      Stationery: ['Pen', 'Pencil', 'Notebook', 'Eraser', 'Ruler'],
      Hardware: ['Screw', 'Bolt', 'Nail', 'Hinge', 'Lock'],
      Textile: ['Cotton', 'Silk', 'Wool', 'Linen', 'Polyester'],
      Chemical: ['Acid', 'Base', 'Solvent', 'Catalyst', 'Reagent'],
      Food: ['Rice', 'Wheat', 'Sugar', 'Salt', 'Flour'],
      Beverage: ['Water', 'Juice', 'Tea', 'Coffee', 'Soda'],
    };
    const itemNamesBySubGroup: Record<string, string[]> = {
      Mobile: ['Samsung Galaxy S23', 'iPhone 15', 'OnePlus 12', 'Xiaomi 14', 'Vivo V30'],
      Laptop: ['Dell Inspiron 15', 'HP Pavilion', 'Lenovo ThinkPad', 'MacBook Air', 'Asus VivoBook'],
      Monitor: ['LG UltraWide', 'Samsung Odyssey', 'Dell Ultrasharp', 'BenQ PD', 'ASUS ProArt'],
      Keyboard: ['Logitech MX Keys', 'Razer BlackWidow', 'Corsair K70', 'Keychron K2', 'Ducky One'],
      Mouse: ['Logitech MX Master', 'Razer DeathAdder', 'SteelSeries Rival', 'Corsair Harpoon', 'Zowie EC2'],
      'Office Chair': ['Herman Miller Aeron', 'Steelcase Leap', 'Hag Capisco', 'IKEA Markus', 'DXRacer'],
      Desk: ['IKEA MALM', 'Uplift V2', 'Jarvis Bamboo', 'FlexiSpot E7', 'Autonomous SmartDesk'],
      Cabinet: ['Steel Cabinet', 'Wooden Filing', 'Mobile Pedestal', 'Fireproof Safe', 'Storage Tower'],
      Shelf: ['Wall Shelf', 'Bookshelf', 'Floating Shelf', 'Corner Shelf', 'Storage Rack'],
      Table: ['Dining Table', 'Conference Table', 'Coffee Table', 'Study Table', 'Folding Table'],
      Pen: ['Ballpoint Pen', 'Gel Pen', 'Fountain Pen', 'Marker Pen', 'Highlighter'],
      Pencil: ['HB Pencil', '2B Pencil', 'Colored Pencil', 'Mechanical Pencil', 'Carpenter Pencil'],
      Notebook: ['Spiral Notebook', 'Hardcover Notebook', 'Legal Pad', 'Composition Book', 'Lab Notebook'],
      Eraser: ['Rubber Eraser', 'Kneaded Eraser', 'Electric Eraser', 'Gum Eraser', 'Vinyl Eraser'],
      Ruler: ['12-inch Ruler', 'Meter Stick', 'T-Square', 'Scale Ruler', 'Flexible Ruler'],
      Screw: ['Phillips Screw', 'Flat Head Screw', 'Allen Screw', 'Self-Tapping Screw', 'Wood Screw'],
      Bolt: ['Hex Bolt', 'Carriage Bolt', 'Eye Bolt', 'U-Bolt', 'Anchor Bolt'],
      Nail: ['Common Nail', 'Finishing Nail', 'Roofing Nail', 'Concrete Nail', 'Brad Nail'],
      Hinge: ['Butt Hinge', 'Piano Hinge', 'Concealed Hinge', 'Barrel Hinge', 'Flush Hinge'],
      Lock: ['Padlock', 'Deadbolt', 'Knob Lock', 'Mortise Lock', 'Cam Lock'],
      Cotton: ['Raw Cotton', 'Cotton Yarn', 'Cotton Fabric', 'Cotton Thread', 'Cotton Bale'],
      Silk: ['Raw Silk', 'Silk Fabric', 'Silk Thread', 'Silk Scarf', 'Silk Yarn'],
      Wool: ['Raw Wool', 'Wool Yarn', 'Wool Fabric', 'Wool Blanket', 'Wool Carpet'],
      Linen: ['Linen Fabric', 'Linen Yarn', 'Linen Cloth', 'Linen Sheet', 'Linen Towel'],
      Polyester: ['Polyester Yarn', 'Polyester Fabric', 'Polyester Thread', 'Polyester Fiber', 'Polyester Resin'],
      Acid: ['Hydrochloric Acid', 'Sulfuric Acid', 'Nitric Acid', 'Acetic Acid', 'Citric Acid'],
      Base: ['Sodium Hydroxide', 'Potassium Hydroxide', 'Ammonia', 'Calcium Hydroxide', 'Sodium Bicarbonate'],
      Solvent: ['Acetone', 'Ethanol', 'Methanol', 'Toluene', 'Xylene'],
      Catalyst: ['Platinum Catalyst', 'Palladium Catalyst', 'Nickel Catalyst', 'Iron Catalyst', 'Copper Catalyst'],
      Reagent: ['Silver Nitrate', 'Copper Sulfate', 'Sodium Chloride', 'Potassium Iodide', 'Barium Chloride'],
      Rice: ['Basmati Rice', 'Jasmine Rice', 'Arborio Rice', 'Brown Rice', 'Wild Rice'],
      Wheat: ['Whole Wheat', 'All-Purpose Flour', 'Bread Flour', 'Cake Flour', 'Semolina'],
      Sugar: ['White Sugar', 'Brown Sugar', 'Powdered Sugar', 'Raw Sugar', 'Cane Sugar'],
      Salt: ['Table Salt', 'Sea Salt', 'Kosher Salt', 'Himalayan Salt', 'Rock Salt'],
      Flour: ['All-Purpose Flour', 'Bread Flour', 'Cake Flour', 'Rice Flour', 'Corn Flour'],
      Water: ['Mineral Water', 'Spring Water', 'Distilled Water', 'Purified Water', 'Sparkling Water'],
      Juice: ['Orange Juice', 'Apple Juice', 'Mango Juice', 'Grape Juice', 'Pineapple Juice'],
      Tea: ['Green Tea', 'Black Tea', 'Herbal Tea', 'Oolong Tea', 'White Tea'],
      Coffee: ['Arabica Coffee', 'Robusta Coffee', 'Espresso', 'Decaf Coffee', 'Instant Coffee'],
      Soda: ['Cola', 'Lemon-Lime Soda', 'Orange Soda', 'Root Beer', 'Ginger Ale'],
    };

    const uoms = ['PCS', 'KG', 'LTR', 'MTR', 'BOX', 'SET', 'DOZ', 'PACK'];
    const items = [];

    for (let i = 0; i < 500; i++) {
      const group = groups[Math.floor(Math.random() * groups.length)];
      const subGroups = subGroupsByGroup[group];
      const subGroup = subGroups[Math.floor(Math.random() * subGroups.length)];
      const itemNames = itemNamesBySubGroup[subGroup];
      const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
      const year = (2020 + Math.floor(Math.random() * 5)).toString();
      const lcNo = `LC-${year}-${String(i + 1).padStart(4, '0')}`;
      const price = Math.round((Math.random() * 100000 + 100) * 100) / 100;
      const uom = uoms[Math.floor(Math.random() * uoms.length)];

      items.push({
        year,
        lcNo,
        group,
        subGroup,
        itemName,
        price,
        uom,
        createdBy: 'seed',
      });
    }

    await db.item.createMany({ data: items });

    // Create stock entries for items across entities
    const allItems = await db.item.findMany({ select: { id: true } });
    const stockEntries = [];

    for (const item of allItems) {
      // Each item gets stock in 2-4 random entities
      const entityCount = 2 + Math.floor(Math.random() * 3);
      const selectedEntities = entities.sort(() => Math.random() - 0.5).slice(0, entityCount);

      for (const entity of selectedEntities) {
        stockEntries.push({
          itemId: item.id,
          entityId: entity.id,
          quantity: Math.floor(Math.random() * 1000) + 10,
        });
      }
    }

    await db.stock.createMany({ data: stockEntries });

    return NextResponse.json({
      message: 'Database seeded successfully',
      adminCredentials: { username: 'admin', password: 'admin123' },
      userCredentials: { username: 'user1', password: 'user123' },
      modCredentials: { username: 'moderator', password: 'mod123' },
      managerCredentials: { username: 'manager', password: 'manager123' },
      itemsCreated: items.length,
      entitiesCreated: entities.length,
      stocksCreated: stockEntries.length,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
