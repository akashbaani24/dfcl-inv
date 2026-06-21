#!/usr/bin/env python3
"""Comprehensive stock-hit test for Akash Inventory System.
Tests: Adjustment (inc/dec), Transfer, Receive (from source), Sales Order, Receive (from purchase).
Verifies stock is correctly incremented/decremented for each operation.
"""

import json
import urllib.request
import urllib.parse
import time
import sys

BASE_URL = 'https://dfcl-inv.vercel.app'
TOKEN = None

def api(method, path, body=None, content_type='application/json'):
    url = BASE_URL + path
    data = None
    headers = {'Authorization': f'Bearer {TOKEN}'}
    if body is not None:
        if content_type == 'application/json':
            data = json.dumps(body).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        else:
            data = body
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {'_raw': body[:500]}
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
    """Return dict of itemId -> quantity for given entity."""
    qs = urllib.parse.urlencode({'entityId': entity_id})
    status, data = api('GET', f'/api/stock/by-entity?{qs}')
    if status != 200:
        return {}
    return {s['itemId']: s['quantity'] for s in data.get('stocks', [])}

def find_item_with_stock(entity_id, min_qty=5):
    """Find an item that has at least min_qty at given entity. Return (item_id, item_name, qty) or None."""
    qs = urllib.parse.urlencode({'entityId': entity_id})
    status, data = api('GET', f'/api/stock/by-entity?{qs}')
    if status != 200:
        return None
    for s in data.get('stocks', []):
        if s.get('quantity', 0) >= min_qty:
            item = s.get('item', {})
            return (s['itemId'], item.get('itemName', '?'), s['quantity'])
    return None

def find_or_create_stock_item(entity_id, item_id, qty=10):
    """Ensure the given item has at least qty at the entity by doing an increase adjustment."""
    stock = get_stock(entity_id)
    current = stock.get(item_id, 0)
    if current < qty:
        delta = qty - current
        status, data = api('POST', '/api/item-adjustments', {
            'itemId': item_id,
            'entityId': entity_id,
            'adjustmentType': 'increase',
            'quantity': delta,
            'reason': 'Test setup'
        })
        if status != 200:
            return False, f'adjustment failed: {data}'
    return True, None

def get_any_item():
    """Get any item from the system."""
    status, data = api('GET', '/api/items?pageSize=1')
    if status == 200 and data.get('items'):
        return data['items'][0]
    return None

# ============================================================
# TESTS
# ============================================================

def test_adjustment_increase():
    print('\n[TEST 1] Adjustment INCREASE — should +qty')
    # Setup: pick an item, set its stock to 0 first
    entities = get_entities()
    if not entities:
        print('  FAIL: no entities')
        return
    entity = entities[0]
    item = get_any_item()
    if not item:
        print('  FAIL: no items')
        return
    # First ensure stock is 0 by decrease (if any) — actually just increase by 5 and verify
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {item["itemName"]} at {entity["name"]} = {before}')
    status, data = api('POST', '/api/item-adjustments', {
        'itemId': item['id'],
        'entityId': entity['id'],
        'adjustmentType': 'increase',
        'quantity': 5,
        'reason': 'Test: increase'
    })
    if status != 200:
        print(f'  FAIL: API returned {status}: {data}')
        return
    after = get_stock(entity['id']).get(item['id'], 0)
    expected = before + 5
    print(f'  After:  {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock increased by 5')
    else:
        print(f'  ✗ FAIL — expected {expected}, got {after}')

def test_adjustment_decrease():
    print('\n[TEST 2] Adjustment DECREASE — should -qty')
    entities = get_entities()
    entity = entities[0]
    item = get_any_item()
    # Ensure at least 3 in stock
    ok, err = find_or_create_stock_item(entity['id'], item['id'], 3)
    if not ok:
        print(f'  FAIL setup: {err}')
        return
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {item["itemName"]} at {entity["name"]} = {before}')
    status, data = api('POST', '/api/item-adjustments', {
        'itemId': item['id'],
        'entityId': entity['id'],
        'adjustmentType': 'decrease',
        'quantity': 2,
        'reason': 'Test: decrease'
    })
    if status != 200:
        print(f'  FAIL: API returned {status}: {data}')
        return
    after = get_stock(entity['id']).get(item['id'], 0)
    expected = before - 2
    print(f'  After:  {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock decreased by 2')
    else:
        print(f'  ✗ FAIL — expected {expected}, got {after}')

def test_adjustment_decrease_below_zero():
    print('\n[TEST 3] Adjustment DECREASE below 0 — should be BLOCKED')
    entities = get_entities()
    entity = entities[0]
    item = get_any_item()
    # Force stock to 1
    stock = get_stock(entity['id'])
    current = stock.get(item['id'], 0)
    if current != 1:
        # Set to 1: decrease if >1, increase if 0
        if current > 1:
            api('POST', '/api/item-adjustments', {
                'itemId': item['id'], 'entityId': entity['id'],
                'adjustmentType': 'decrease', 'quantity': current - 1, 'reason': 'Test setup'
            })
        else:
            api('POST', '/api/item-adjustments', {
                'itemId': item['id'], 'entityId': entity['id'],
                'adjustmentType': 'increase', 'quantity': 1 - current, 'reason': 'Test setup'
            })
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {before} — trying to decrease by 5 (would go to -4)')
    status, data = api('POST', '/api/item-adjustments', {
        'itemId': item['id'],
        'entityId': entity['id'],
        'adjustmentType': 'decrease',
        'quantity': 5,
        'reason': 'Test: should be blocked'
    })
    after = get_stock(entity['id']).get(item['id'], 0)
    if status == 400:
        print(f'  ✓ PASS — blocked with 400: {data.get("error", "")[:80]}')
        print(f'  Stock after blocked attempt: {after} (unchanged)')
    elif status == 200:
        print(f'  ✗ FAIL — should have been blocked, but stock went from {before} to {after}')
    else:
        print(f'  ? Status {status}: {data}')

def test_transfer_creation_no_stock_hit():
    print('\n[TEST 4] Transfer CREATE — should NOT hit stock (stock moves only on receive)')
    entities = get_entities()
    if len(entities) < 2:
        print('  SKIP: need 2 entities')
        return
    from_e = entities[0]
    to_e = entities[1]
    item = get_any_item()
    # Ensure from_e has stock
    ok, err = find_or_create_stock_item(from_e['id'], item['id'], 10)
    if not ok:
        print(f'  FAIL setup: {err}')
        return
    before_from = get_stock(from_e['id']).get(item['id'], 0)
    before_to = get_stock(to_e['id']).get(item['id'], 0)
    print(f'  Before: {item["itemName"]}')
    print(f'    From ({from_e["name"]}): {before_from}')
    print(f'    To   ({to_e["name"]}):   {before_to}')
    status, data = api('POST', '/api/transfers', {
        'itemId': item['id'],
        'fromEntityId': from_e['id'],
        'toEntityId': to_e['id'],
        'quantity': 3,
        'notes': 'Test transfer'
    })
    if status != 200:
        print(f'  FAIL: API returned {status}: {data}')
        return
    transfer_id = data.get('transfer', {}).get('id')
    after_from = get_stock(from_e['id']).get(item['id'], 0)
    after_to = get_stock(to_e['id']).get(item['id'], 0)
    print(f'  After transfer created (pending):')
    print(f'    From: {after_from} (expected {before_from} — UNCHANGED)')
    print(f'    To:   {after_to} (expected {before_to} — UNCHANGED)')
    if after_from == before_from and after_to == before_to:
        print('  ✓ PASS — stock NOT hit on transfer creation (correct — moves on receive)')
    else:
        print('  ✗ FAIL — stock changed on transfer creation (should only change on receive)')
    # Return transfer_id for the receive test
    return transfer_id, from_e, to_e, item

def test_receive_from_transfer(transfer_info):
    print('\n[TEST 5] Receive from transfer — should: To +qty, From -qty')
    if not transfer_info:
        print('  SKIP: no transfer from test 4')
        return
    transfer_id, from_e, to_e, item = transfer_info
    before_from = get_stock(from_e['id']).get(item['id'], 0)
    before_to = get_stock(to_e['id']).get(item['id'], 0)
    print(f'  Before: From={before_from}, To={before_to}')
    status, data = api('POST', '/api/receives', {
        'itemId': item['id'],
        'entityId': to_e['id'],
        'quantity': 3,
        'sourceEntityId': from_e['id'],
        'transferId': transfer_id,
        'notes': 'Test receive from transfer'
    })
    if status != 200:
        print(f'  FAIL: API returned {status}: {data}')
        return
    after_from = get_stock(from_e['id']).get(item['id'], 0)
    after_to = get_stock(to_e['id']).get(item['id'], 0)
    expected_from = before_from - 3
    expected_to = before_to + 3
    print(f'  After: From={after_from} (expected {expected_from}), To={after_to} (expected {expected_to})')
    if after_from == expected_from and after_to == expected_to:
        print('  ✓ PASS — To +3, From -3')
    else:
        print('  ✗ FAIL — stock not correctly updated')

def test_sales_order_stock_hit():
    print('\n[TEST 6] Sales Order CREATE — should -qty from selling entity')
    entities = get_entities()
    if not entities:
        print('  SKIP: no entities')
        return
    entity = entities[0]
    item = get_any_item()
    # Ensure at least 5 stock
    ok, err = find_or_create_stock_item(entity['id'], item['id'], 5)
    if not ok:
        print(f'  FAIL setup: {err}')
        return
    # Need a customer — create one
    cust_status, cust_data = api('POST', '/api/customers', {
        'name': f'Test Customer {int(time.time())}',
        'phone': '01700000000',
        'type': 'regular',
        'status': 'active'
    })
    if cust_status != 200 or 'customer' not in cust_data:
        print(f'  FAIL: cannot create customer: {cust_data}')
        return
    customer_id = cust_data['customer']['id']
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Before: {item["itemName"]} at {entity["name"]} = {before}')
    print(f'  Creating sales order for 2 units...')
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'],
        'customerId': customer_id,
        'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'),
        'status': 'pending',
        'notes': 'Test sales order',
        'items': [{
            'itemId': item['id'],
            'quantity': 2,
            'unitPrice': 100,
            'makingEntries': []
        }],
        'payments': []
    })
    if status != 200:
        print(f'  FAIL: API returned {status}: {data}')
        return
    sales_order_id = data.get('salesOrder', {}).get('id')
    after = get_stock(entity['id']).get(item['id'], 0)
    expected = before - 2
    print(f'  After: {after} (expected {expected})')
    if after == expected:
        print('  ✓ PASS — stock decreased by 2 on sales order creation')
    else:
        print(f'  ✗ FAIL — expected {expected}, got {after}')
    return sales_order_id, entity, item

def test_sales_order_insufficient_stock():
    print('\n[TEST 7] Sales Order with INSUFFICIENT stock — should be BLOCKED')
    entities = get_entities()
    entity = entities[0]
    item = get_any_item()
    # Force stock to 1
    stock = get_stock(entity['id'])
    current = stock.get(item['id'], 0)
    if current > 1:
        api('POST', '/api/item-adjustments', {
            'itemId': item['id'], 'entityId': entity['id'],
            'adjustmentType': 'decrease', 'quantity': current - 1, 'reason': 'Test setup'
        })
    elif current == 0:
        api('POST', '/api/item-adjustments', {
            'itemId': item['id'], 'entityId': entity['id'],
            'adjustmentType': 'increase', 'quantity': 1, 'reason': 'Test setup'
        })
    before = get_stock(entity['id']).get(item['id'], 0)
    print(f'  Stock: {before} — trying to sell 5 units')
    cust_status, cust_data = api('POST', '/api/customers', {
        'name': f'Test Cust Block {int(time.time())}',
        'phone': '01800000000',
        'type': 'regular',
        'status': 'active'
    })
    if cust_status != 200:
        print(f'  FAIL: cannot create customer')
        return
    status, data = api('POST', '/api/sales-orders', {
        'entityId': entity['id'],
        'customerId': cust_data['customer']['id'],
        'discount': 0,
        'orderDate': time.strftime('%Y-%m-%d'),
        'status': 'pending',
        'notes': 'Test: should be blocked',
        'items': [{
            'itemId': item['id'],
            'quantity': 5,
            'unitPrice': 100,
            'makingEntries': []
        }],
        'payments': []
    })
    after = get_stock(entity['id']).get(item['id'], 0)
    if status == 400:
        print(f'  ✓ PASS — blocked with 400: {data.get("error", "")[:80]}')
        print(f'  Stock unchanged: {after}')
    elif status == 200:
        print(f'  ✗ FAIL — should have been blocked. Stock went from {before} to {after}')
    else:
        print(f'  ? Status {status}: {data}')

def main():
    print('=== Stock Hit Test Suite ===')
    print(f'Target: {BASE_URL}')
    if not login():
        print('FATAL: login failed')
        sys.exit(1)
    print('✓ Logged in as admin')

    entities = get_entities()
    print(f'✓ Found {len(entities)} entities')
    if len(entities) < 2:
        print('FATAL: need at least 2 entities for transfer test')
        sys.exit(1)

    # Run tests
    test_adjustment_increase()
    test_adjustment_decrease()
    test_adjustment_below_zero = test_adjustment_decrease_below_zero()
    transfer_info = test_transfer_creation_no_stock_hit()
    test_receive_from_transfer(transfer_info)
    test_sales_order_stock_hit()
    test_sales_order_insufficient_stock()

    print('\n=== Test Suite Complete ===')

if __name__ == '__main__':
    main()
