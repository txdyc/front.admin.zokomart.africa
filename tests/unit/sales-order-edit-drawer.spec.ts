import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';

vi.mock('@/components/CascadeFilter.vue', () => ({
  default: defineComponent({ name: 'CascadeFilter', setup: () => () => null }),
}));

const apiSalesOrderGet = vi.fn(async (..._a: any[]): Promise<any> => ({}));
const apiSalesOrderUpdate = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/sales/order', () => ({
  apiSalesOrderGet: (...a: any[]) => apiSalesOrderGet(...a),
  apiSalesOrderUpdate: (...a: any[]) => apiSalesOrderUpdate(...a),
  apiOrderableProductsPage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
}));

import EditDrawer from '@/views/sales/order/SalesOrderEditDrawer.vue';

const order = (over: Record<string, any> = {}) => ({
  id: 5,
  orderNo: 'SO5',
  status: 'PENDING_DISPATCH',
  completed: 0,
  customerName: 'Kofi',
  customerPhone: '024',
  customerAddress: 'Accra',
  city: 'Accra',
  orderDate: '2026-09-01',
  remark: 'r',
  items: [
    { id: 11, supplierProductId: 1, productName: 'P1', productCode: 'C1', unitPrice: 233.33, qty: 3, amount: 700 },
  ],
  ...over,
});

async function openWith(o: any) {
  apiSalesOrderGet.mockResolvedValue(o);
  const wrapper = mount(EditDrawer);
  const vm = wrapper.vm as any;
  await vm.openDrawer(o.id);
  await flushPromises();
  return { wrapper, vm };
}

describe('销售订单编辑抽屉', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().applyUser({
      id: 1, username: 'u', nickname: null, isSuper: 1, roles: [], permissions: [], menus: [],
    });
    vi.clearAllMocks();
  });

  it('未派送：改明细后载荷含 items；未改动行回传原 amount，改过的行 amount=null', async () => {
    const { vm } = await openWith(order());
    expect(vm.itemsEditable).toBe(true);
    vm.addProduct({ supplierProductId: 2, productName: 'P2', productCode: 'C2', quantity: 0, retailPrice: 50 });
    vm.form.customerName = 'Ama';
    await vm.submit();
    await flushPromises();
    expect(apiSalesOrderUpdate).toHaveBeenCalledTimes(1);
    const [id, payload] = apiSalesOrderUpdate.mock.calls[0] as any[];
    expect(id).toBe(5);
    expect(payload).toMatchObject({
      customerName: 'Ama',
      city: 'Accra',
      orderDate: '2026-09-01',
      items: [
        { id: 11, supplierProductId: 1, qty: 3, unitPrice: 233.33, amount: 700 },
        { supplierProductId: 2, qty: 1, unitPrice: 50, amount: null },
      ],
    });

    vm.setQty(vm.rows[0], 2);
    expect(vm.rows[0].amount).toBeNull();
    expect(vm.totalAmount).toBeCloseTo(233.33 * 2 + 50);
  });

  it('已派送：明细锁定，载荷不含 items', async () => {
    const { wrapper, vm } = await openWith(order({ status: 'DISPATCHING' }));
    expect(vm.itemsEditable).toBe(false);
    await vm.submit();
    await flushPromises();
    const payload = apiSalesOrderUpdate.mock.calls[0][1] as any;
    expect(payload.items).toBeUndefined();
    expect(payload.customerName).toBe('Kofi');
  });

  it('明细删空：拦截，不调用更新', async () => {
    const { vm } = await openWith(order());
    vm.removeRow(vm.rows[0]);
    await vm.submit();
    await flushPromises();
    expect(apiSalesOrderUpdate).not.toHaveBeenCalled();
  });

  it('客户信息清空：拦截，不调用更新', async () => {
    const { vm } = await openWith(order());
    vm.form.customerPhone = '  ';
    await vm.submit();
    await flushPromises();
    expect(apiSalesOrderUpdate).not.toHaveBeenCalled();
  });
});
