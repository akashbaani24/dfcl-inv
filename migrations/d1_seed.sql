-- Seed data for Cloudflare D1
-- Admin user with bcrypt-hashed password (admin123)
-- Generated hash via bcryptjs v3 with 10 salt rounds

-- Admin user
INSERT INTO "User" ("id", "username", "password", "displayName", "role", "canCreateItem", "canModifyItem", "createdAt", "updatedAt")
VALUES ('cmqfmlzfj0000m3vh9rjb37fe', 'admin', '$2b$10$U1xxFNHNozxF7u6Di3ifi.jGZDVFNRNu8pOX5PcViY5InQHTB28qO', 'Administrator', 'admin', 1, 1, '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z');

-- Column access for admin (all 8 columns visible)
INSERT INTO "UserColumnAccess" ("id", "userId", "columnName", "canView") VALUES
('cmqfmlzfk0001m3vh0000000001', 'cmqfmlzfj0000m3vh9rjb37fe', 'year', 1),
('cmqfmlzfk0001m3vh0000000002', 'cmqfmlzfj0000m3vh9rjb37fe', 'lcNo', 1),
('cmqfmlzfk0001m3vh0000000003', 'cmqfmlzfj0000m3vh9rjb37fe', 'group', 1),
('cmqfmlzfk0001m3vh0000000004', 'cmqfmlzfj0000m3vh9rjb37fe', 'subGroup', 1),
('cmqfmlzfk0001m3vh0000000005', 'cmqfmlzfj0000m3vh9rjb37fe', 'itemName', 1),
('cmqfmlzfk0001m3vh0000000006', 'cmqfmlzfj0000m3vh9rjb37fe', 'price', 1),
('cmqfmlzfk0001m3vh0000000007', 'cmqfmlzfj0000m3vh9rjb37fe', 'uom', 1),
('cmqfmlzfk0001m3vh0000000008', 'cmqfmlzfj0000m3vh9rjb37fe', 'stockQty', 1);

-- Menu access for admin (all 10 menus visible)
INSERT INTO "UserMenuAccess" ("id", "userId", "menuKey", "visible") VALUES
('cmqfmlzfk0002m3vh0000000001', 'cmqfmlzfj0000m3vh9rjb37fe', 'itemPrice', 1),
('cmqfmlzfk0002m3vh0000000002', 'cmqfmlzfj0000m3vh9rjb37fe', 'myEntityStock', 1),
('cmqfmlzfk0002m3vh0000000003', 'cmqfmlzfj0000m3vh9rjb37fe', 'allEntityStock', 1),
('cmqfmlzfk0002m3vh0000000004', 'cmqfmlzfj0000m3vh9rjb37fe', 'itemAdjustment', 1),
('cmqfmlzfk0002m3vh0000000005', 'cmqfmlzfj0000m3vh9rjb37fe', 'transfer', 1),
('cmqfmlzfk0002m3vh0000000006', 'cmqfmlzfj0000m3vh9rjb37fe', 'receive', 1),
('cmqfmlzfk0002m3vh0000000007', 'cmqfmlzfj0000m3vh9rjb37fe', 'salesOrder', 1),
('cmqfmlzfk0002m3vh0000000008', 'cmqfmlzfj0000m3vh9rjb37fe', 'salesReturn', 1),
('cmqfmlzfk0002m3vh0000000009', 'cmqfmlzfj0000m3vh9rjb37fe', 'incentive', 1),
('cmqfmlzfk0002m3vh0000000010', 'cmqfmlzfj0000m3vh9rjb37fe', 'reports', 1);

-- Entities (5 branches)
INSERT INTO "Entity" ("id", "name", "description", "createdAt", "updatedAt") VALUES
('cmqfmlzfl0009m3vhlvdqw39j', 'Dhaka Main Warehouse', 'Dhaka Main Warehouse - Entity', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfl000am3vhlvdqw3a0', 'Chittagong Branch', 'Chittagong Branch - Entity', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfl000bm3vhlvdqw3a1', 'Sylhet Store', 'Sylhet Store - Entity', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfl000cm3vhlvdqw3a2', 'Rajshahi Depot', 'Rajshahi Depot - Entity', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfl000dm3vhlvdqw3a3', 'Khulna Distribution', 'Khulna Distribution - Entity', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z');

-- Sample UoM entries
INSERT INTO "UoM" ("id", "name", "description", "createdAt", "updatedAt") VALUES
('cmqfmlzfn0001m3vh000000001', 'PCS', 'Pieces', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0002m3vh000000002', 'KG', 'Kilogram', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0003m3vh000000003', 'LTR', 'Liter', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0004m3vh000000004', 'MTR', 'Meter', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0005m3vh000000005', 'BOX', 'Box', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0006m3vh000000006', 'SET', 'Set', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0007m3vh000000007', 'DOZ', 'Dozen', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
('cmqfmlzfn0008m3vh000000008', 'PACK', 'Pack', '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z');
