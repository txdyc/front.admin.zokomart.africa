import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

vi.mock('@/components/CascadeFilter.vue', () => ({
  default: defineComponent({ name: 'CascadeFilter', setup: () => () => null }),
}));

const apiSalesOrderPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiSalesOrderCreate = vi.fn(async (..._a: any[]) => 1);
const apiSalesOrderGet = vi.fn(async (..._a: any[]): Promise<any> => ({ id: 1, items: [] }));
const apiSalesOrderDelete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/sales/order', () => ({
  apiSalesOrderPage: (...a: any[]) => apiSalesOrderPage(...a),
  apiSalesOrderCreate: (...a: any[]) => apiSalesOrderCreate(...a),
  apiSalesOrderGet: (...a: any[]) => apiSalesOrderGet(...a),
  apiSalesOrderDelete: (...a: any[]) => apiSalesOrderDelete(...a),
  apiSalesOrderUpdate: vi.fn(),
  apiOrderableProductsPage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
}));

import SalesPage from '@/views/sales/order/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(SalesPage, { global: { directives: { perm } } });
// OrderableProductVO 行（来自 apiOrderableProductsPage），retailPrice 即默认单价
const stock = (over: Record<string, any>) => ({
  supplierProductId: 1, productName: 'P', productCode: 'C', supplierName: 'S', quantity: 10, retailPrice: 20, ...over,
});

describe('销售下单页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 sales:order:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['sales:order:list'] });
    expect(mountPage().find('[data-test="sales-create"]').exists()).toBe(false);
  });

  it('加入商品：默认单价=供应商产品零售价，且可改', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    await vm.setQty(stock({ supplierProductId: 1, quantity: 10 }), 2);
    await flushPromises();
    expect(vm.selectedRows[0].unitPrice).toBe(20);
    vm.setUnitPrice(vm.selectedRows[0], 18.5);
    expect(vm.selectedRows[0].unitPrice).toBe(18.5);
    expect(vm.totalAmount).toBe(37); // 18.5 * 2
  });

  it('客户信息不全：拦截，不调用 create', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    await vm.setQty(stock({ supplierProductId: 1, quantity: 10 }), 2);
    await flushPromises();
    // 不填客户
    await vm.submit();
    await flushPromises();
    expect(apiSalesOrderCreate).not.toHaveBeenCalled();
  });

  it('允许缺货下单：数量超过库存仍可提交，数量 < 1 不可提交', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    vm.customer.name = 'Tom';
    vm.customer.phone = '0240000000';
    vm.customer.address = 'Accra';
    const row = stock({ supplierProductId: 1, quantity: 3 });
    await vm.setQty(row, 5); // 5 > 库存 3：缺货可订
    await flushPromises();
    expect(vm.canSubmit).toBe(true);

    await vm.setQty(row, 0.5); // 0 < qty < 1：仍在购物车但数量非法
    expect(vm.canSubmit).toBe(false);
  });

  it('提交载荷：客户三项 + items{supplierProductId,qty,unitPrice}', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    vm.customer.name = 'Tom';
    vm.customer.phone = '0240000000';
    vm.customer.address = 'Accra';
    await vm.setQty(stock({ supplierProductId: 1, quantity: 10 }), 2);
    await flushPromises();
    await vm.submit();
    await flushPromises();
    expect(apiSalesOrderCreate).toHaveBeenCalledTimes(1);
    const payload = apiSalesOrderCreate.mock.calls[0][0];
    expect(payload).toMatchObject({
      customerName: 'Tom', customerPhone: '0240000000', customerAddress: 'Accra',
      items: [{ supplierProductId: 1, qty: 2, unitPrice: 20 }],
    });
  });

  it('编辑/删除入口按 sales:order:update / sales:order:delete 权限渲染', async () => {
    const row = { id: 7, orderNo: 'SO7', customerName: 'A', status: 'PENDING_DISPATCH', completed: 0, items: [] };
    apiSalesOrderPage.mockResolvedValue({ records: [row], total: 1, current: 1, size: 10 } as any);
    setUser({ permissions: ['sales:order:list'] });
    let wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-test="sales-detail"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="sales-edit"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="sales-delete"]').exists()).toBe(false);

    setUser({ permissions: ['sales:order:list', 'sales:order:update', 'sales:order:delete'] });
    wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-test="sales-edit"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="sales-delete"]').exists()).toBe(true);
  });

  it('非待派送订单不显示删除入口（编辑仍可见）', async () => {
    const row = { id: 8, orderNo: 'SO8', customerName: 'B', status: 'DISPATCHING', completed: 0, items: [] };
    apiSalesOrderPage.mockResolvedValue({ records: [row], total: 1, current: 1, size: 10 } as any);
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-test="sales-edit"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="sales-delete"]').exists()).toBe(false);
  });

  it('删除：调用删除接口', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await vm.onDelete({ id: 9 });
    expect(apiSalesOrderDelete).toHaveBeenCalledWith(9);
  });
});
