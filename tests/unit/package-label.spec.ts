import { describe, it, expect, vi } from 'vitest';

vi.mock('qrcode', () => ({
  default: { toString: vi.fn(async (text: string) => `<svg data-for="${text}"></svg>`) },
}));

import { expandLabels, totalLabelCount, buildLabelsHtml, renderLabelQr } from '@/utils/label/packageLabel';
import type { SalesOrderLabelVO } from '@/types/sales';
import QRCode from 'qrcode';

const order = (over: Partial<SalesOrderLabelVO> = {}): SalesOrderLabelVO => ({
  id: 1, orderNo: 'SO001', customerName: 'Kwame', customerPhone: '024',
  customerAddress: 'Accra', totalQty: 3, totalAmount: 450, ...over,
});

/** A×1 + B×2 的多商品订单：3 张贴纸，第 1 张是 A，第 2/3 张是 B。 */
const multiItemOrder = (over: Partial<SalesOrderLabelVO> = {}): SalesOrderLabelVO =>
  order({
    totalQty: 3,
    items: [
      { productCode: 'MRG-4521', productName: 'Morgan Blender 1.5L', qty: 1 },
      { productCode: 'MRG-8890', productName: 'Morgan Kettle', qty: 2 },
    ],
    ...over,
  });

describe('expandLabels', () => {
  it('每件展开一张，seq 从 1 到 totalQty，total=totalQty', () => {
    const units = expandLabels([order({ totalQty: 3 })]);
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.seq)).toEqual([1, 2, 3]);
    expect(units.every((u) => u.total === 3)).toBe(true);
  });
  it('totalQty 为 0/null 时兜底 1 张', () => {
    expect(expandLabels([order({ totalQty: 0 })])).toHaveLength(1);
    expect(expandLabels([order({ totalQty: null })])).toHaveLength(1);
    expect(expandLabels([order({ totalQty: -5 })])).toHaveLength(1);
  });
  it('多订单累加', () => {
    const units = expandLabels([order({ id: 1, totalQty: 2 }), order({ id: 2, totalQty: 1 })]);
    expect(units).toHaveLength(3);
  });

  it('有明细时按明细逐件展开，每张贴纸带对应商品的 code/品名', () => {
    const units = expandLabels([multiItemOrder()]);
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.productCode)).toEqual(['MRG-4521', 'MRG-8890', 'MRG-8890']);
    expect(units.map((u) => u.productName)).toEqual([
      'Morgan Blender 1.5L', 'Morgan Kettle', 'Morgan Kettle',
    ]);
    expect(units.map((u) => u.seq)).toEqual([1, 2, 3]);
    expect(units.every((u) => u.total === 3)).toBe(true);
  });

  it('明细缺失/为空时回退到 totalQty 展开，code 与品名留空', () => {
    for (const o of [order({ totalQty: 2 }), order({ totalQty: 2, items: [] }), order({ totalQty: 2, items: null })]) {
      const units = expandLabels([o]);
      expect(units).toHaveLength(2);
      expect(units.every((u) => !u.productCode && !u.productName)).toBe(true);
    }
  });

  it('明细 qty 之和与 totalQty 不一致时以明细为准，序号自洽', () => {
    // totalQty 说 99，明细只有 1+2=3 件 → 贴纸必须对应实物，出 3 张
    const units = expandLabels([multiItemOrder({ totalQty: 99 })]);
    expect(units).toHaveLength(3);
    expect(units.map((u) => `${u.seq}/${u.total}`)).toEqual(['1/3', '2/3', '3/3']);
  });

  it('明细里 qty<=0 的行跳过；全跳过时视同无明细，回退 totalQty', () => {
    const partial = expandLabels([
      order({ items: [
        { productCode: 'A', productName: 'a', qty: 0 },
        { productCode: 'B', productName: 'b', qty: 2 },
      ] }),
    ]);
    expect(partial.map((u) => u.productCode)).toEqual(['B', 'B']);

    // 明细全是 qty<=0 的脏数据，和「没有明细」一样无法逐件对应 → 按 totalQty 兜底。
    // 宁可多印空白 code 的贴纸，也不能少印：没贴纸的箱子发不出去。
    const allZero = expandLabels([
      order({ totalQty: 5, items: [{ productCode: 'A', productName: 'a', qty: 0 }] }),
    ]);
    expect(allZero).toHaveLength(5);
    expect(allZero.every((u) => !u.productCode)).toBe(true);
  });
});

describe('totalLabelCount', () => {
  it('= 各订单 totalQty 之和（兜底 1）', () => {
    expect(totalLabelCount([order({ totalQty: 2 }), order({ totalQty: 0 })])).toBe(3);
  });
  it('有明细时按明细 qty 之和，与 expandLabels 的张数一致', () => {
    const orders = [multiItemOrder({ totalQty: 99 }), order({ totalQty: 2 })];
    expect(totalLabelCount(orders)).toBe(5);
    expect(totalLabelCount(orders)).toBe(expandLabels(orders).length);
  });
});

describe('buildLabelsHtml', () => {
  const qr = new Map<string, string>([['SO001', '<svg></svg>']]);
  it('生成与张数相等的 .label，且含 @page 100mm', () => {
    const html = buildLabelsHtml(expandLabels([order({ totalQty: 2 })]), qr);
    expect((html.match(/class="label"/g) || []).length).toBe(2);
    expect(html).toContain('size: 100mm 100mm');
  });
  it('金额按 GHS x.xx，含序号与订单号', () => {
    const html = buildLabelsHtml(expandLabels([order({ totalQty: 1, totalAmount: 7 })]), qr);
    expect(html).toContain('GHS 7.00');
    expect(html).toContain('Item 1 / 1');
    expect(html).toContain('SO001');
  });
  it('每张贴纸印各自的 product code 与品名', () => {
    const html = buildLabelsHtml(expandLabels([multiItemOrder()]), qr);
    const labels = html.split('class="label"').slice(1);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain('MRG-4521');
    expect(labels[0]).toContain('Morgan Blender 1.5L');
    expect(labels[1]).toContain('MRG-8890');
    expect(labels[2]).toContain('MRG-8890');
    expect(labels[1]).not.toContain('MRG-4521');
  });

  it('对 product code 与品名做 HTML 转义', () => {
    const html = buildLabelsHtml(
      expandLabels([order({ items: [{ productCode: 'A&B', productName: '<img src=x>', qty: 1 }] })]), qr);
    expect(html).toContain('A&amp;B');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('对姓名/地址做 HTML 转义', () => {
    const html = buildLabelsHtml(
      expandLabels([order({ totalQty: 1, customerName: 'A & B', customerAddress: '<x>', customerPhone: '024 & 025' })]), qr);
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;x&gt;');
    expect(html).not.toContain('<x>');
    expect(html).toContain('024 &amp; 025');
  });
});

describe('renderLabelQr', () => {
  it('以 orderNo 调 qrcode 生成 svg，且参数为 svg/margin0/width120', async () => {
    const svg = await renderLabelQr('SO001');
    expect(svg).toContain('data-for="SO001"');
    expect(QRCode.toString).toHaveBeenCalledWith('SO001', { type: 'svg', margin: 0, width: 120 });
  });
});
