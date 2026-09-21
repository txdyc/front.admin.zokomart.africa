import QRCode from 'qrcode';
import type { SalesOrderLabelVO } from '@/types/sales';

export interface LabelUnit {
  order: SalesOrderLabelVO;
  seq: number; // 1-based
  total: number; // 该订单的贴纸总数
  productCode: string; // 该件对应的商品编码；明细缺失时为空串
  productName: string;
}

/** 明细缺失时的兜底张数：退回订单级 totalQty（最少 1）。 */
function fallbackCount(o: SalesOrderLabelVO): number {
  const n = Math.floor(o.totalQty ?? 1);
  return n >= 1 ? n : 1;
}

/**
 * 逐件展开的商品序列：明细里 qty<=0 的行跳过，A×1+B×2 → [A, B, B]。
 * 返回空数组表示「没有可用明细」，调用方须走 totalQty 兜底。
 */
function itemSequence(o: SalesOrderLabelVO): Array<{ code: string; name: string }> {
  const seq: Array<{ code: string; name: string }> = [];
  for (const it of o.items ?? []) {
    const qty = Math.floor(it?.qty ?? 0);
    if (qty < 1) continue;
    const entry = { code: it.productCode ?? '', name: it.productName ?? '' };
    for (let i = 0; i < qty; i++) seq.push(entry);
  }
  return seq;
}

/**
 * 一张贴纸对应一件实物。有明细就按明细逐件展开，每张带上该件自己的 product code；
 * 明细缺失（历史数据/旧接口）则退回按 totalQty 展开，商品字段留空。
 *
 * 明细 qty 之和与 totalQty 不一致时**以明细为准** —— 贴纸要贴在箱子上，必须跟实物件数
 * 对得上，订单级 totalQty 只是汇总值。
 */
export function expandLabels(orders: SalesOrderLabelVO[]): LabelUnit[] {
  const units: LabelUnit[] = [];
  for (const order of orders) {
    const items = itemSequence(order);
    const total = items.length > 0 ? items.length : fallbackCount(order);
    for (let seq = 1; seq <= total; seq++) {
      const item = items[seq - 1];
      units.push({
        order,
        seq,
        total,
        productCode: item?.code ?? '',
        productName: item?.name ?? '',
      });
    }
  }
  return units;
}

export function totalLabelCount(orders: SalesOrderLabelVO[]): number {
  return orders.reduce((s, o) => {
    const n = itemSequence(o).length;
    return s + (n > 0 ? n : fallbackCount(o));
  }, 0);
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

/**
 * 把展开后的面单单元渲染成自包含的 100mm×100mm 打印文档（English Version B）。
 * 安全约定：客户字段（姓名/电话/地址/订单号）一律经 esc() 转义；
 * qrByOrderNo 的值被当作**可信 SVG** 原样内联，调用方必须用 renderLabelQr() 生成，
 * 不得传入任何不可信来源的字符串。seq/total 均为 unitCount() 产出的整数，无需转义。
 */
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
      <div class="prod">
        <div class="code">${esc(u.productCode)}</div>
        <div class="pname">${esc(u.productName)}</div>
      </div>
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
  /* 商品行：code 顶格、等宽大号，仓库拣货一眼可读；品名占剩余宽度，过长用省略号，
     靠 CSS 截断而不在 JS 里按字符数切，避免把多字节字符切成半个。 */
  .prod { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 2mm; min-height: 6mm; }
  .code { font-size: 15pt; font-weight: 800; font-family: monospace; white-space: nowrap; }
  .pname { font-size: 11pt; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
