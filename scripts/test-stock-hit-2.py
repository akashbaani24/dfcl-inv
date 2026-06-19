#!/usr/bin/env python3
"""Additional stock-hit tests:
- Sales Return (approved) should +qty
- Sales Return (pending) should NOT hit stock
- Multi-item sales order (mixed: one has stock, one doesn't) should be blocked
- Delivery status change should NOT hit stock
- Purchase approval should +qty (auto-creates receive)
"""

import json
import urllib.request
import urllib.parse
import time

BASE_URL = 'https://dfcl-inv.vercel.app'
TOKEN = None

def api(method, path, body=None):
    url = BASE_URL + path
    data = None
    headers = {'Authorization': f'Bearer {TOKEN}'}
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(body_text)
        except:
            return e.code, {'_raw': body_text[:500]}
    except Exception as e:
        return 0, {'_error': str(e)}

def login():
    global TOKEN
    status, data = api('POST', '/api/auth/login', {'username': 'admin', 'password': 'admin123'})
    if status == 200 and 'token' in data:
        TOKEN = data['token']
        return True
    return False

def get_entities():
    status, data = api('GET', '/api/entities')
    return data.get('entities', []) if status == 200 else []

def get_stock(entity_id):
    qs = urllib.parse.urlencode({'entityId': entity_id})
    status, data = api('GET', f'/api/stock/by-entity?{qs}')
    if status != 200:
        return {}
    return {s['itemId']: s['quantity'] for s in data.get('stocks', [])}

def get_items(n=2):
    status, data = api('GET', f'/api/items?pageSize={n}')
    return data.get('items', []) if status == 200 else []

def ensure_stock(entity_id, item_id, min_qty):
    current = get_stock(entity_id).get(item_id, 0)
    if current < min_qty:
        delta = min_qty - current
        api('POST', '/api/item-adjustments', {
            'itemId': item_id, 'entityId': entity_id,
            'adjustmentType': 'increase', 'quantity': delta, 'reason': 'Test setup'
        })

def create_customer(name=None):
    name = name or f'TestCust{int(time.time())}'
    status, data = api('POST', '/api/customers', {
        'name': name, 'phone': '01700000000', 'type': 'regular', 'status': 'active'
    })
    return data.get('customer', {}).get('id') if status == 200 else None

def test_sales_return_approved():
    print('\n[TEST 8] Sales Return APPROVED — should +qty to entity')
    entities = get_entities()
    entity = entities[0]
    items = get_items(1)
    if not items:
        print('  SKIP: no items')
        return
    item = items[0]
    ensure_stock(entity['id'], item['id'], 3)
    cust_id = create_customer()
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {item["itemName"]} at {entity["name"]} = {before}')
    print(f'  Creating sales return (status=approved) for 2 units...')
    status, data = api('POST', '/api/sales-returns', {
        'itemId': item['id'],
        'entityId': entity['id'],
        'customerId': cust_id,
        'quantity': 2,
        'price': 100,
        'reason': 'Test return',
        'status': 'approved',
        'notes': 'Test'
    })
    if status != 200:
        print(f'  FAIL: {status}: {data}')
        return
    after = get_stock(entity['id']).get(item['id'], 0)
    expected = before + 2
    print(f'  After: {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock +2 on approved return')
    else:
        print(f'  ✗ FAIL')

def test_sales_return_pending():
    print('\n[TEST 9] Sales Return PENDING — should NOT hit stock')
    entities = get_entities()
    entity = entities[0]
    items = get_items(1)
    if not items:
        print('  SKIP')
        return
    item = items[0]
    ensure_stock(entity['id'], item['id'], 5)
    cust_id = create_customer()
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {before} — creating pending return for 2 units')
    status, data = api('POST', '/api/sales-returns', {
        'itemId': item['id'],
        'entityId': entity['id'],
        'customerId': cust_id,
        'quantity': 2,
        'price': 100,
        'reason': 'Test pending return',
        'status': 'pending',
        'notes': 'Test'
    })
    if status != 200:
        print(f'  FAIL: {status}: {data}')
        return
    after = get_stock(entity['id']).get(item['id'], 0)
    print(f'  After: {after} (expected {before} — UNCHANGED)')
    if after == before:
        print('  ✓ PASS — stock NOT hit for pending return (correct — only approved returns hit stock)')
    else:
        print(f'  ✗ FAIL — stock changed')

def test_multi_item_sales_order_mixed_stock():
    print('\n[TEST 10] Multi-item Sales Order — one item insufficient — should be BLOCKED entirely')
    entities = get_entities()
    entity = entities[0]
    items = get_items(2)
    if len(items) < 2:
        print('  SKIP: need 2 items')
        return
    item1, item2 = items[0], items[1]
    # item1: has stock (3), item2: NO stock (0)
    ensure_stock(entity['id'], item1['id'], 3)
    # Force item2 to 0
    stock2 = get_stock(entity['id']).get(item2['id'], 0)
    if stock2 > 0:
        api('POST', '/api/item-adjustments', {
            'itemId': item2['id'], 'entityId': entity['id'],
            'adjustmentType': 'decrease', 'quantity': stock2, 'reason': 'Test setup'
        })
    cust_id = create_customer()
    before1 = get_stock(entity['id']).get(item1['id'], 0)
    before2 = get_stock(entity['id']).get(item2['id'], 0)
    print(f'  Item1 {item1["itemName"]}: {before1} (enough for 2)')
    print(f'  Item2 {item2["itemName"]}: {before2} (NOT enough for 5)')
    print(f'  Creating sales order with both items...')
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'],
        'customerId': cust_id,
        'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'),
        'status': 'pending',
        'items': [
            {'itemId': item1['id'], 'quantity': 2, 'unitPrice': 100, 'makingEntries': []},
            {'itemId': item2['id'], 'quantity': 5, 'unitPrice': 100, 'makingEntries': []},
        ],
        'payments': []
    })
    after1 = get_stock(entity['id']).get(item1['id'], 0)
    after2 = get_stock(entity['id']).get(item2['id'], 0)
    if status == 400:
        print(f'  ✓ PASS — blocked: {data.get("error","")[:80]}')
        print(f'  Stock unchanged: item1={after1} (was {before1}), item2={after2} (was {before2})')
    elif status == 200:
        print(f'  ✗ FAIL — order was created. Stock: item1={after1}, item2={after2}')
        print(f'  Item1 should have stayed at {before1} (or decremented), Item2 should NOT have gone negative')
        if after1 == before1 and after2 == before2:
            print(f'  (But stock was unchanged — partial pass: blocked but for wrong reason?)')
    else:
        print(f'  ? Status {status}: {data}')

def test_purchase_approval_stock_hit():
    print('\n[TEST 11] Purchase APPROVE — should +qty (auto-receives)')
    entities = get_entities()
    entity = entities[0]
    items = get_items(1)
    if not items:
        print('  SKIP')
        return
    item = items[0]
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {item["itemName"]} at {entity["name"]} = {before}')
    print(f'  Creating purchase with 4 units...')
    status, data = api('POST', '/api/purchases', {
        'purchaseDate': time.strftime('%Y-%m-%d'),
        'purchaseType': 'local',
        'entityId': entity['id'],
        'billNo': 'TEST-BILL',
        'notes': 'Test purchase',
        'items': [{'itemId': item['id'], 'quantity': 4, 'unitPrice': 50, 'uom': 'PCS'}]
    })
    if status != 200:
        print(f'  FAIL create purchase: {status}: {data}')
        return
    purchase_id = data.get('purchase', {}).get('id')
    print(f'  Purchase created (pending). Approving...')
    status, data = api('POST', f'/api/purchases/{purchase_id}/approve')
    if status != 200:
        print(f'  FAIL approve: {status}: {data}')
        return
    after = get_stock(entity['id']).get(item['id'], 0)
    expected = before + 4
    print(f'  After: {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock +4 on purchase approval')
    else:
        print(f'  ✗ FAIL')

def test_delivery_status_no_stock_hit():
    print('\n[TEST 12] Delivery status change — should NOT hit stock (delivery is just status tracking)')
    entities = get_entities()
    entity = entities[0]
    items = get_items(1)
    if not items:
        print('  SKIP')
        return
    item = items[0]
    ensure_stock(entity['id'], item['id'], 5)
    cust_id = create_customer()
    # Create a sales order first
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'],
        'customerId': cust_id,
        'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'),
        'status': 'pending',
        'items': [{'itemId': item['id'], 'quantity': 2, 'unitPrice': 100, 'makingEntries': []}],
        'payments': []
    })
    if status != 200:
        print(f'  FAIL setup sales order: {data}')
        return
    sales_order_id = data['salesOrder']['id']
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Stock before delivery status change: {before}')
    print(f'  Updating delivery status to "out_for_delivery"...')
    # The sales order PUT endpoint should update delivery status
    status, data = api('PUT', f'/api/sales-orders/{sales_order_id}', {
        'deliveryStatus': 'out_for_delivery',
        'deliveryPerson': 'Test Rider',
        'deliveryNotes': 'Test'
    })
    if status != 200:
        print(f'  ? PUT returned {status}: {data} (endpoint may not support this — checking stock anyway)')
    after = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Stock after delivery status change: {after}')
    if after == before:
        print('  ✓ PASS — delivery status change did NOT hit stock (correct — stock already decremented at sales order creation)')
    else:
        print(f'  ✗ FAIL — stock changed by {after - before} on delivery status update')

def main():
    print('=== Additional Stock Hit Tests ===')
    if not login():
        print('FATAL: login failed')
        return
    print('✓ Logged in')

    test_sales_return_approved()
    test_sales_return_pending()
    test_multi_item_sales_order_mixed_stock()
    test_purchase_approval_stock_hit()
    test_delivery_status_no_stock_hit()

    print('\n=== Done ===')

if __name__ == '__main__':
    main()
