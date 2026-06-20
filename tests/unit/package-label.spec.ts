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
});

describe('totalLabelCount', () => {
  it('= 各订单 totalQty 之和（兜底 1）', () => {
    expect(totalLabelCount([order({ totalQty: 2 }), order({ totalQty: 0 })])).toBe(3);
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
