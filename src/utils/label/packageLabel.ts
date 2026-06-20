import QRCode from 'qrcode';
import type { SalesOrderLabelVO } from '@/types/sales';

export interface LabelUnit {
  order: SalesOrderLabelVO;
  seq: number; // 1-based
  total: number; // = totalQty（最少 1）
}

function unitCount(o: SalesOrderLabelVO): number {
  const n = Math.floor(o.totalQty ?? 1);
  return n >= 1 ? n : 1;
}

export function expandLabels(orders: SalesOrderLabelVO[]): LabelUnit[] {
  const units: LabelUnit[] = [];
  for (const order of orders) {
    const total = unitCount(order);
    for (let seq = 1; seq <= total; seq++) units.push({ order, seq, total });
  }
  return units;
}

export function totalLabelCount(orders: SalesOrderLabelVO[]): number {
  return orders.reduce((s, o) => s + unitCount(o), 0);
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number | null | undefined): string {
  return (n ?? 0).toFixed(2);
}

/** 用订单号生成 SVG 二维码字符串（SVG 比 PNG dataURL 在热敏机上更清晰）。 */
export async function renderLabelQr(orderNo: string): Promise<string> {
  return QRCode.toString(orderNo, { type: 'svg', margin: 0, width: 120 });
}

/** 把展开后的面单单元渲染成自包含的 100mm×100mm 打印文档（English Version B）。 */
export function buildLabelsHtml(units: LabelUnit[], qrByOrderNo: Map<string, string>): string {
  const body = units
    .map((u) => {
      const o = u.order;
      const qr = qrByOrderNo.get(o.orderNo) ?? '';
      return `
    <div class="label">
      <div class="hdr">
        <div class="who">
          <div class="name">${esc(o.customerName)}</div>
          <div class="phone">${esc(o.customerPhone)}</div>
        </div>
        <div class="qr">${qr}</div>
      </div>
      <div class="addr">${esc(o.customerAddress)}</div>
      <div class="divider"></div>
      <div class="meta">
        <div class="brand">ZokoMart &middot; Cash on Delivery</div>
        <div class="seq">Item ${u.seq} / ${u.total}</div>
      </div>
      <div class="amt">
        <div class="amt-k">AMOUNT<br/>TO COLLECT</div>
        <div class="amt-v">GHS ${money(o.totalAmount)}</div>
      </div>
      <div class="ono">${esc(o.orderNo)} &middot; ${u.total} items total</div>
    </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Labels</title>
<style>
  @page { size: 100mm 100mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  * { box-sizing: border-box; }
  .label {
    width: 100mm; height: 100mm; padding: 5mm; page-break-after: always;
    display: flex; flex-direction: column; color: #000;
    font-family: Arial, Helvetica, sans-serif;
  }
  .label:last-child { page-break-after: auto; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; }
  .name { font-size: 22pt; font-weight: 800; line-height: 1.1; }
  .phone { font-size: 16pt; font-weight: 700; margin-top: 1mm; }
  .qr { width: 20mm; height: 20mm; }
  .qr svg { width: 100%; height: 100%; }
  .addr { font-size: 12pt; line-height: 1.35; margin-top: 3mm; }
  .divider { border-top: 0.5mm solid #000; margin: 3mm 0; }
  .meta { display: flex; justify-content: space-between; align-items: center; }
  .brand { font-size: 11pt; font-weight: 800; }
  .seq { font-size: 12pt; font-weight: 800; border: 0.5mm solid #000; padding: 0.5mm 2mm; }
  .amt {
    margin-top: auto; border: 0.8mm solid #000; padding: 2.5mm 3mm;
    display: flex; justify-content: space-between; align-items: center;
  }
  .amt-k { font-size: 10pt; font-weight: 700; line-height: 1.15; }
  .amt-v { font-size: 26pt; font-weight: 800; }
  .ono { text-align: center; font-size: 9pt; font-weight: 700; font-family: monospace; margin-top: 2mm; }
</style></head>
<body>${body}</body></html>`;
}
