#!/usr/bin/env python3
"""Test multi-delivery flow:
1. Create sales order (3 units of item) — stock NOT hit
2. Delivery 1: deliver 1 unit — stock -1, delivery created
3. Delivery 2: deliver 1 unit — stock -1, second delivery created
4. Try to deliver 2 more (only 1 remaining) — should be blocked
5. Delivery 3: deliver 1 unit — stock -1, all delivered
6. Try to mark complete without payment — should be blocked
7. Add payment — should succeed
8. Mark complete — should succeed now
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

def get_items(n=1):
    status, data = api('GET', f'/api/items?pageSize={n}')
    return data.get('items', []) if status == 200 else []

def ensure_stock(entity_id, item_id, min_qty):
    current = get_stock(entity_id).get(item_id, 0)
    if current < min_qty:
        api('POST', '/api/item-adjustments', {
            'itemId': item_id, 'entityId': entity_id,
            'adjustmentType': 'increase', 'quantity': min_qty - current, 'reason': 'Test setup'
        })

def create_customer(name=None):
    name = name or f'TestCust{int(time.time())}'
    status, data = api('POST', '/api/customers', {
        'name': name, 'phone': '01700000000', 'type': 'regular', 'status': 'active'
    })
    return data.get('customer', {}).get('id') if status == 200 else None

def main():
    print('=== Multi-Delivery Flow Test ===\n')
    if not login():
        print('FATAL: login failed'); sys.exit(1)
    print('✓ Logged in')

    entities = get_entities()
    entity = entities[0]
    items = get_items(1)
    item = items[0]
    item_id = item['id']
    item_name = item.get('itemName', '?')
    print(f'Entity: {entity["name"]}')
    print(f'Item:   {item_name}')

    # Ensure 10 in stock
    ensure_stock(entity['id'], item_id, 10)
    print(f'Stock ensured: 10\n')

    # ── TEST 1: Create sales order for 3 units — stock NOT hit
    print('[1] Create sales order (3 units) — stock should NOT change')
    before = get_stock(entity['id']).get(item_id, 0)
    cust_id = create_customer()
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'], 'customerId': cust_id, 'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'), 'status': 'pending',
        'items': [{'itemId': item_id, 'quantity': 3, 'unitPrice': 100, 'makingEntries': []}],
        'payments': []
    })
    if status != 200:
        print(f'  FAIL: {data}'); return
    so_id = data['salesOrder']['id']
    so_item_id = data['salesOrder']['items'][0]['id']
    after = get_stock(entity['id']).get(item_id, 0)
    print(f'  Stock: {before} → {after} (expected {before})')
    print(f'  ✓ PASS' if after == before else f'  ✗ FAIL')

    # ── TEST 2: Delivery 1 — deliver 1 unit
    print('\n[2] Delivery 1: deliver 1 unit — stock -1, delivery created')
    before = get_stock(entity['id']).get(item_id, 0)
    status, data = api('POST', f'/api/sales-orders/{so_id}/deliver', {
        'items': [{'salesOrderItemId': so_item_id, 'itemId': item_id, 'quantity': 1}],
        'deliveryPerson': 'Rider 1', 'deliveryNotes': 'First delivery'
    })
    if status != 200:
        print(f'  FAIL: {data}'); return
    dl1_no = data.get('deliveryNo')
    after = get_stock(entity['id']).get(item_id, 0)
    print(f'  Delivery: {dl1_no}')
    print(f'  Stock: {before} → {after} (expected {before - 1})')
    print(f'  allItemsFullyDelivered: {data.get("allItemsFullyDelivered")} (expected False)')
    print(f'  ✓ PASS' if after == before - 1 else f'  ✗ FAIL')

    # ── TEST 3: Delivery 2 — deliver 1 more unit
    print('\n[3] Delivery 2: deliver 1 more unit — stock -1, second delivery created')
    before = get_stock(entity['id']).get(item_id, 0)
    status, data = api('POST', f'/api/sales-orders/{so_id}/deliver', {
        'items': [{'salesOrderItemId': so_item_id, 'itemId': item_id, 'quantity': 1}],
        'deliveryPerson': 'Rider 2', 'deliveryNotes': 'Second delivery'
    })
    if status != 200:
        print(f'  FAIL: {data}'); return
    dl2_no = data.get('deliveryNo')
    after = get_stock(entity['id']).get(item_id, 0)
    print(f'  Delivery: {dl2_no}')
    print(f'  Stock: {before} → {after} (expected {before - 1})')
    print(f'  ✓ PASS' if after == before - 1 else f'  ✗ FAIL')

    # ── TEST 4: Try to deliver 2 more (only 1 remaining) — should be BLOCKED
    print('\n[4] Try to deliver 2 more (only 1 remaining) — should be BLOCKED')
    status, data = api('POST', f'/api/sales-orders/{so_id}/deliver', {
        'items': [{'salesOrderItemId': so_item_id, 'itemId': item_id, 'quantity': 2}],
    })
    if status == 400:
        print(f'  ✓ PASS — blocked: {data.get("error", "")[:80]}')
    else:
        print(f'  ✗ FAIL — should have been blocked: {data}')

    # ── TEST 5: Delivery 3 — deliver final 1 unit — all delivered
    print('\n[5] Delivery 3: deliver final 1 unit — all delivered')
    before = get_stock(entity['id']).get(item_id, 0)
    status, data = api('POST', f'/api/sales-orders/{so_id}/deliver', {
        'items': [{'salesOrderItemId': so_item_id, 'itemId': item_id, 'quantity': 1}],
    })
    if status != 200:
        print(f'  FAIL: {data}'); return
    dl3_no = data.get('deliveryNo')
    after = get_stock(entity['id']).get(item_id, 0)
    print(f'  Delivery: {dl3_no}')
    print(f'  Stock: {before} → {after} (expected {before - 1})')
    print(f'  allItemsFullyDelivered: {data.get("allItemsFullyDelivered")} (expected True)')
    print(f'  ✓ PASS' if after == before - 1 and data.get('allItemsFullyDelivered') else f'  ✗ FAIL')

    # ── TEST 6: Try to mark complete without payment — should be BLOCKED
    print('\n[6] Try to mark complete without payment — should be BLOCKED')
    status, data = api('PUT', f'/api/sales-orders/{so_id}', {'status': 'delivered'})
    if status == 400:
        print(f'  ✓ PASS — blocked: {data.get("error", "")[:80]}')
    else:
        print(f'  ✗ FAIL — should have been blocked: {data}')

    # ── TEST 7: Add payment (full amount = 3 × 100 = 300)
    print('\n[7] Add payment (300 = 3 × 100) — should succeed')
    status, data = api('PUT', f'/api/sales-orders/{so_id}', {
        'addPayment': {'amount': 300, 'paymentType': 'cash', 'paymentMode': 'collection', 'paymentDate': time.strftime('%Y-%m-%d')}
    })
    if status == 200:
        print(f'  ✓ PASS — payment added')
    else:
        print(f'  ✗ FAIL: {data}')

    # ── TEST 8: Mark complete — should succeed now
    print('\n[8] Mark complete — should succeed (all delivered + payment cleared)')
    status, data = api('PUT', f'/api/sales-orders/{so_id}', {'status': 'delivered'})
    if status == 200:
        print(f'  ✓ PASS — order marked as complete')
    else:
        print(f'  ✗ FAIL: {data}')

    # ── TEST 9: List deliveries for this order
    print('\n[9] List deliveries for this order — should show 3 deliveries')
    status, data = api('GET', f'/api/sales-orders/{so_id}/deliver')
    if status == 200:
        deliveries = data.get('deliveries', [])
        print(f'  Deliveries: {len(deliveries)}')
        for d in deliveries:
            print(f'    - {d["deliveryNo"]} | {d["items"]} item(s) | {d.get("deliveryDate", "?")}')
        print(f'  ✓ PASS' if len(deliveries) == 3 else f'  ✗ FAIL — expected 3')
    else:
        print(f'  ✗ FAIL: {data}')

    print('\n=== Test Complete ===')

if __name__ == '__main__':
    main()
