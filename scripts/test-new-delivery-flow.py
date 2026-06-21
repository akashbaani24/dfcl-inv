#!/usr/bin/env python3
"""Test the new sales order → delivery flow:
1. Create sales order → verify stock NOT hit
2. Deliver via /api/sales-orders/[id]/deliver → verify stock IS hit
3. Deliver with insufficient stock → verify blocked
"""

import json
import urllib.request
import urllib.parse
import time
import sys

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
    return {s['itemId']: s['quantity'] for s in data.get('stocks', [])} if status == 200 else {}

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

def main():
    print('=== New Flow Test: Sales Order → Delivery ===\n')
    if not login():
        print('FATAL: login failed')
        sys.exit(1)
    print('✓ Logged in')

    entities = get_entities()
    entity = entities[0]
    items = get_items(1)
    if not items:
        print('FATAL: no items')
        sys.exit(1)
    item = items[0]
    item_id = item['id']
    item_name = item.get('itemName', '?')
    print(f'Using entity: {entity["name"]}')
    print(f'Using item:   {item_name} (id={item_id})')

    # Ensure item has 10 in stock
    ensure_stock(entity['id'], item_id, 10)
    print(f'\n--- Setup: ensured {item_name} has at least 10 in stock ---')

    # ─────────────────────────────────────────────────────────
    print('\n[TEST 1] Sales Order CREATE — stock should NOT change')
    before = get_stock(entity['id']).get(item_id, 0)
    print(f'  Stock before: {before}')
    cust_id = create_customer()
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'],
        'customerId': cust_id,
        'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'),
        'status': 'pending',
        'items': [{'itemId': item_id, 'quantity': 3, 'unitPrice': 100, 'makingEntries': []}],
        'payments': []
    })
    if status != 200:
        print(f'  FAIL: sales order creation failed: {status}: {data}')
        return
    sales_order_id = data.get('salesOrder', {}).get('id')
    sales_no = data.get('salesOrder', {}).get('salesNo')
    print(f'  Sales order created: {sales_no} (id={sales_order_id})')
    after = get_stock(entity['id']).get(item_id, 0)
    print(f'  Stock after sales order creation: {after} (expected {before} — UNCHANGED)')
    if after == before:
        print('  ✓ PASS — stock NOT hit on sales order creation')
    else:
        print(f'  ✗ FAIL — stock changed by {after - before}')
        return

    # ─────────────────────────────────────────────────────────
    print('\n[TEST 2] Delivery (partial) — stock should decrement by delivered qty')
    before = get_stock(entity['id']).get(item_id, 0)
    print(f'  Stock before delivery: {before}')
    print(f'  Delivering 2 units (of 3 ordered)...')
    # Find the salesOrderItemId
    so_items = data.get('salesOrder', {}).get('items', [])
    so_item_id = so_items[0]['id'] if so_items else None
    status, data = api('POST', f'/api/sales-orders/{sales_order_id}/deliver', {
        'items': [{'salesOrderItemId': so_item_id, 'itemId': item_id, 'quantity': 2}],
        'deliveryPerson': 'Test Rider',
        'deliveryNotes': 'Test partial delivery'
    })
    if status != 200:
        print(f'  FAIL: delivery failed: {status}: {data}')
        return
    after = get_stock(entity['id']).get(item_id, 0)
    expected = before - 2
    print(f'  Stock after delivery: {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock decreased by 2 on delivery')
        print(f'  allItemsDelivered: {data.get("allItemsDelivered")} (expected False — partial)')
        if not data.get('allItemsDelivered'):
            print('  ✓ PASS — correctly marked as partial')
    else:
        print(f'  ✗ FAIL')

    # ─────────────────────────────────────────────────────────
    print('\n[TEST 3] Delivery (final) — stock should decrement by remaining qty')
    before = get_stock(entity['id']).get(item_id, 0)
    print(f'  Stock before final delivery: {before}')
    print(f'  Delivering remaining 1 unit...')
    status, data = api('POST', f'/api/sales-orders/{sales_order_id}/deliver', {
        'items': [{'salesOrderItemId': so_item_id, 'itemId': item_id, 'quantity': 1}],
    })
    if status != 200:
        print(f'  FAIL: {status}: {data}')
        return
    after = get_stock(entity['id']).get(item_id, 0)
    expected = before - 1
    print(f'  Stock after: {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock decreased by 1')
    else:
        print(f'  ✗ FAIL')

    # ─────────────────────────────────────────────────────────
    print('\n[TEST 4] Delivery with INSUFFICIENT stock — should be BLOCKED')
    # Create a new sales order for 100 units (more than stock)
    cust_id2 = create_customer()
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'],
        'customerId': cust_id2,
        'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'),
        'status': 'pending',
        'items': [{'itemId': item_id, 'quantity': 100, 'unitPrice': 100, 'makingEntries': []}],
        'payments': []
    })
    if status != 200:
        print(f'  FAIL: cannot create sales order for test 4: {data}')
        return
    so2_id = data['salesOrder']['id']
    so2_item_id = data['salesOrder']['items'][0]['id']
    before = get_stock(entity['id']).get(item_id, 0)
    print(f'  Stock: {before} — trying to deliver 100 units')
    status, data = api('POST', f'/api/sales-orders/{so2_id}/deliver', {
        'items': [{'salesOrderItemId': so2_item_id, 'itemId': item_id, 'quantity': 100}],
    })
    after = get_stock(entity['id']).get(item_id, 0)
    if status == 400:
        print(f'  ✓ PASS — blocked: {data.get("error", "")[:80]}')
        print(f'  Stock unchanged: {after}')
    elif status == 200:
        print(f'  ✗ FAIL — should have been blocked. Stock went from {before} to {after}')
    else:
        print(f'  ? Status {status}: {data}')

    print('\n=== Test Complete ===')

if __name__ == '__main__':
    main()
