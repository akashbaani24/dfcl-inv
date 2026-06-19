import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { bdDate, bdNow } from '@/lib/bd-time';

// GET /api/deliveries/[id]/challan — returns printable HTML delivery challan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return new NextResponse('Not authenticated', { status: 401 });

    const { id } = await params;
    const delivery = await db.delivery.findUnique({
      where: { id },
      include: {
        items: true,
        salesOrder: {
          select: {
            id: true, salesNo: true, orderDate: true,
            customer: { select: { name: true, phone: true, address: true } },
            entity: { select: { name: true, description: true } },
            items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } } },
          },
        },
        entity: { select: { name: true } },
      },
    });

    if (!delivery) return new NextResponse('Delivery not found', { status: 404 });

    // Build item rows
    const itemRows = delivery.items.map((di, i) => {
      const soItem = delivery.salesOrder.items.find((si: any) => si.id === di.salesOrderItemId);
      const item = soItem?.item;
      return `
        <tr>
          <td class="sl">${i + 1}</td>
          <td><strong>${item?.itemName || '—'}</strong></td>
          <td class="barcode-cell">${item?.barcode || '—'}</td>
          <td class="item-code-cell">${item?.itemCode || '—'}</td>
          <td class="qty">${di.quantity}</td>
          <td class="uom-cell">${di.uom || item?.uom || 'PCS'}</td>
        </tr>
      `;
    }).join('');

    const dateStr = bdDate(new Date(delivery.deliveryDate));
    const soDateStr = bdDate(new Date(delivery.salesOrder.orderDate));
    const customerName = delivery.salesOrder.customer?.name || '—';
    const customerPhone = delivery.salesOrder.customer?.phone || '';
    const customerAddress = delivery.salesOrder.customer?.address || '';
    const entityName = delivery.salesOrder.entity?.name || delivery.entity?.name || '—';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Delivery Challan — ${delivery.deliveryNo}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 32px; color: #1f2937; background: #fff; font-size: 14px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo { width: 56px; height: 56px; background: linear-gradient(135deg, #1e3a8a, #1e40af); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 22px; }
    .brand-name { font-size: 22px; font-weight: bold; color: #1e3a8a; }
    .brand-subtitle { font-size: 11px; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; }
    .challan-meta { text-align: right; }
    .challan-title { font-size: 20px; font-weight: bold; color: #1e3a8a; }
    .challan-no { font-family: monospace; font-size: 13px; color: #374151; }
    .challan-date { font-size: 12px; color: #6b7280; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .party-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 6px; }
    .party-name { font-size: 18px; font-weight: bold; color: #111827; }
    .party-meta { font-size: 12px; color: #4b5563; margin-top: 2px; }
    .so-ref { background: #f0f9ff; border-left: 4px solid #1e3a8a; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px; }
    .so-ref-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 4px; }
    .so-ref-content { font-size: 14px; color: #111827; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table.items th { background: #1e3a8a; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    table.items td { padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    table.items tr:last-child td { border-bottom: 2px solid #1e3a8a; }
    .sl { width: 40px; text-align: center; color: #6b7280; }
    .qty { text-align: right; font-weight: bold; width: 100px; }
    .uom-cell { width: 80px; }
    .barcode-cell { font-family: monospace; font-size: 12px; width: 150px; }
    .item-code-cell { font-family: monospace; font-size: 12px; width: 130px; }
    .notes-section { background: #f9fafb; border-left: 4px solid #1e3a8a; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px; }
    .notes-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 4px; }
    .notes-content { font-size: 13px; color: #111827; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 60px; }
    .signature-block { text-align: center; }
    .signature-line { border-top: 1px solid #111827; padding-top: 6px; margin-top: 48px; }
    .signature-label { font-size: 12px; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
    @media print { body { padding: 16px; } .no-print { display: none !important; } .toolbar { display: none !important; } @page { margin: 1cm; } }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 0; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .print-btn { background: #1e3a8a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3); }
    .print-btn:hover { background: #1e40af; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="brand">
      <div class="brand-logo">A</div>
      <div>
        <div class="brand-name">Akash Inventory System</div>
        <div class="brand-subtitle">Delivery Challan</div>
      </div>
    </div>
    <div class="challan-meta">
      <div class="challan-title">Delivery Challan</div>
      <div class="challan-no">${delivery.deliveryNo}</div>
      <div class="challan-date">${dateStr}</div>
    </div>
  </div>
  <div class="parties">
    <div class="party-card">
      <div class="party-label">From Entity</div>
      <div class="party-name">${entityName}</div>
    </div>
    <div class="party-card">
      <div class="party-label">Deliver To (Customer)</div>
      <div class="party-name">${customerName}</div>
      ${customerPhone ? `<div class="party-meta">Phone: ${customerPhone}</div>` : ''}
      ${customerAddress ? `<div class="party-meta">${customerAddress}</div>` : ''}
    </div>
  </div>
  <div class="so-ref">
    <div class="so-ref-label">Against Sales Order</div>
    <div class="so-ref-content"><strong>${delivery.salesOrder.salesNo}</strong> — Order Date: ${soDateStr}</div>
  </div>
  <table class="items">
    <thead>
      <tr>
        <th class="sl">SL</th>
        <th>Item Name</th>
        <th class="barcode-cell">Barcode</th>
        <th class="item-code-cell">Item Code</th>
        <th class="qty">Delivered Qty</th>
        <th class="uom-cell">UoM</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  ${delivery.deliveryPerson ? `<div class="notes-section"><div class="notes-label">Delivery Person</div><div class="notes-content">${delivery.deliveryPerson}</div></div>` : ''}
  ${delivery.deliveryNotes ? `<div class="notes-section"><div class="notes-label">Notes</div><div class="notes-content">${delivery.deliveryNotes}</div></div>` : ''}
  <div class="signatures">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Prepared By</div></div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Authorized By</div></div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Received By</div></div>
  </div>
  <div class="footer">Generated on ${bdNow()} • Akash Inventory System • Developed by Abdur Rahman Akash</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Delivery challan error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
