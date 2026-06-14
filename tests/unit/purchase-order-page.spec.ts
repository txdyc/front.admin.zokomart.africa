import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const apiOrderPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiOrderGet = vi.fn(async (..._a: any[]): Promise<any> => ({ id: 1, status: 'PENDING_PAYMENT', items: [] }));
const apiOrderMarkPayment = vi.fn(async (..._a: any[]) => undefined);
const apiOrderConfirm = vi.fn(async (..._a: any[]) => 100);
vi.mock('@/api/purchase/order', () => ({
  apiOrderPage: (...a: any[]) => apiOrderPage(...a),
  apiOrderGet: (...a: any[]) => apiOrderGet(...a),
  apiOrderMarkPayment: (...a: any[]) => apiOrderMarkPayment(...a),
  apiOrderConfirm: (...a: any[]) => apiOrderConfirm(...a),
}));

const apiActualOrderPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiActualOrderGet = vi.fn(async (..._a: any[]): Promise<any> => ({ id: 1, status: 'PENDING_INBOUND', items: [] }));
const apiActualOrderInbound = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/purchase/actualOrder', () => ({
  apiActualOrderPage: (...a: any[]) => apiActualOrderPage(...a),
  apiActualOrderGet: (...a: any[]) => apiActualOrderGet(...a),
  apiActualOrderInbound: (...a: any[]) => apiActualOrderInbound(...a),
}));
vi.mock('@/api/basedata/supplier', () => ({
  apiSupplierPage: vi.fn(async () => ({ records: [{ id: 9, name: 'SupA' }], total: 1, current: 1, size: 1000 })),
}));

import OrderPage from '@/views/purchase/order/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(OrderPage, { global: { directives: { perm } } });

describe('采购订单页（采购订单 + 实际采购单）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('批量标记付款：载荷 {itemIds, paymentStatus} 正确', async () => {
    setUser({ isSuper: 1 });
    apiOrderGet.mockResolvedValueOnce({
      id: 7, status: 'PENDING_PAYMENT',
      items: [{ id: 11, paymentStatus: 'UNSET' }, { id: 12, paymentStatus: 'UNSET' }],
    });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    await vm.openOrderDetail({ id: 7 });
    await flushPromises();
    vm.selectedItemIds = [11, 12];
    await vm.markPay('PAID');
    await flushPromises();
    expect(apiOrderMarkPayment).toHaveBeenCalledWith(7, { itemIds: [11, 12], paymentStatus: 'PAID' });
  });

  it('未选明细标记付款：拦截不调用', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    await vm.openOrderDetail({ id: 7 });
    await flushPromises();
    await vm.markPay('PAID');
    await flushPromises();
    expect(apiOrderMarkPayment).not.toHaveBeenCalled();
  });

  it('确认按钮：无 PAID 明细时禁用，有 PAID 时可确认', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    apiOrderGet.mockResolvedValueOnce({ id: 7, status: 'PENDING_PAYMENT', items: [{ id: 11, paymentStatus: 'UNSET' }] });
    await vm.openOrderDetail({ id: 7 });
    await flushPromises();
    expect(vm.canConfirm).toBe(false);
    apiOrderGet.mockResolvedValueOnce({ id: 7, status: 'PENDING_PAYMENT', items: [{ id: 11, paymentStatus: 'PAID' }] });
    await vm.openOrderDetail({ id: 7 });
    await flushPromises();
    expect(vm.canConfirm).toBe(true);
    await vm.confirmOrder();
    await flushPromises();
    expect(apiOrderConfirm).toHaveBeenCalledWith(7);
  });

  it('实际采购单整单入库：调用 inbound(id) 不带 itemIds', async () => {
    setUser({ isSuper: 1 });
    apiActualOrderGet.mockResolvedValueOnce({ id: 50, status: 'PENDING_INBOUND', items: [{ id: 1, inboundStatus: 'PENDING' }] });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    await vm.openActualDetail({ id: 50 });
    await flushPromises();
    expect(vm.canInbound).toBe(true);
    await vm.inbound();
    await flushPromises();
    expect(apiActualOrderInbound).toHaveBeenCalledWith(50);
  });

  it('已入库的实际采购单不可再入库', async () => {
    setUser({ isSuper: 1 });
    apiActualOrderGet.mockResolvedValueOnce({ id: 50, status: 'INBOUND_DONE', items: [] });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    await vm.openActualDetail({ id: 50 });
    await flushPromises();
    expect(vm.canInbound).toBe(false);
  });
});
