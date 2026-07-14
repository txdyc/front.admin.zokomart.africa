import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const apiSalesOrderPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiSalesOrderGet = vi.fn(async (..._a: any[]): Promise<any> => ({ id: 1, status: 'PENDING_DISPATCH', items: [] }));
vi.mock('@/api/sales/order', () => ({
  apiSalesOrderPage: (...a: any[]) => apiSalesOrderPage(...a),
  apiSalesOrderGet: (...a: any[]) => apiSalesOrderGet(...a),
}));

const apiLogisticsDispatch = vi.fn(async (..._a: any[]) => undefined);
const apiLogisticsUpdateStatus = vi.fn(async (..._a: any[]) => undefined);
const apiLogisticsReject = vi.fn(async (..._a: any[]) => undefined);
const apiLogisticsComplete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/sales/logistics', () => ({
  apiLogisticsDispatch: (...a: any[]) => apiLogisticsDispatch(...a),
  apiLogisticsUpdateStatus: (...a: any[]) => apiLogisticsUpdateStatus(...a),
  apiLogisticsReject: (...a: any[]) => apiLogisticsReject(...a),
  apiLogisticsComplete: (...a: any[]) => apiLogisticsComplete(...a),
}));
vi.mock('@/api/basedata/logisticsProvider', () => ({
  apiLogisticsProviderPage: vi.fn(async () => ({ records: [{ id: 5, name: 'DHL' }], total: 1, current: 1, size: 1000 })),
}));

import TrackPage from '@/views/logistics/track/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(TrackPage, { global: { directives: { perm } } });
async function openWith(vm: any, order: any) {
  apiSalesOrderGet.mockResolvedValueOnce(order);
  await vm.openDetail({ id: order.id });
  await flushPromises();
}

describe('物流跟踪页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('PENDING_DISPATCH：仅可派送，无可转状态/完成', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 1, status: 'PENDING_DISPATCH', items: [] });
    expect(vm.canDispatch).toBe(true);
    expect(vm.statusTargets).toEqual([]);
    expect(vm.canComplete).toBe(false);
    expect(vm.canReject).toBe(false);
  });

  it('DISPATCHING：可转 SIGNED/SIGNED_PAID/UNREACHABLE/REJECTED，不可派送/完成', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 2, status: 'DISPATCHING', items: [] });
    expect(vm.canDispatch).toBe(false);
    expect(vm.statusTargets).toEqual(['SIGNED', 'SIGNED_PAID', 'UNREACHABLE', 'REJECTED']);
    expect(vm.canComplete).toBe(false);
  });

  it('SIGNED：可拒收、可完成，可转 SIGNED_PAID/UNREACHABLE/REJECTED', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 3, status: 'SIGNED', items: [{ id: 9, qty: 3 }] });
    expect(vm.canReject).toBe(true);
    expect(vm.canComplete).toBe(true);
    expect(vm.statusTargets).toEqual(['SIGNED_PAID', 'UNREACHABLE', 'REJECTED']);
  });

  it('派送：载荷 {logisticsProviderId, deliveryFee}', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 4, status: 'PENDING_DISPATCH', items: [] });
    vm.openDispatch();
    vm.dispatchForm.logisticsProviderId = 5;
    vm.dispatchForm.deliveryFee = 12.5;
    await vm.doDispatch();
    await flushPromises();
    expect(apiLogisticsDispatch).toHaveBeenCalledWith(4, { logisticsProviderId: 5, deliveryFee: 12.5 });
  });

  it('未选物流商：派送拦截', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 4, status: 'PENDING_DISPATCH', items: [] });
    vm.openDispatch();
    await vm.doDispatch();
    await flushPromises();
    expect(apiLogisticsDispatch).not.toHaveBeenCalled();
  });

  it('拒收：载荷 {itemId, rejectQty}；超订购量拦截', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 5, status: 'SIGNED', items: [{ id: 9, qty: 3 }] });
    vm.openReject({ id: 9, qty: 3 });
    vm.rejectForm.rejectQty = 5; // > qty 3
    await vm.doReject();
    expect(apiLogisticsReject).not.toHaveBeenCalled();
    vm.rejectForm.rejectQty = 1;
    await vm.doReject();
    await flushPromises();
    expect(apiLogisticsReject).toHaveBeenCalledWith(5, { itemId: 9, rejectQty: 1 });
  });

  it('转状态 / 完成：调用对应 api', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    // 持久 mock：动作后 reloadDetail 仍返回同一订单(id 不变)
    apiSalesOrderGet.mockResolvedValue({ id: 6, status: 'SIGNED', items: [] });
    await vm.openDetail({ id: 6 });
    await flushPromises();
    await vm.doUpdateStatus('SIGNED_PAID', null);
    await vm.doComplete();
    await flushPromises();
    expect(apiLogisticsUpdateStatus).toHaveBeenCalledWith(6, { status: 'SIGNED_PAID', deliveryFee: null });
    expect(apiLogisticsComplete).toHaveBeenCalledWith(6);
  });

  it('派送：不填派送费 → 载荷 deliveryFee: null（NULL=未知）', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 7, status: 'PENDING_DISPATCH', items: [] });
    vm.openDispatch();
    vm.dispatchForm.logisticsProviderId = 5;
    // deliveryFee 保持 undefined（默认留空）
    await vm.doDispatch();
    await flushPromises();
    expect(apiLogisticsDispatch).toHaveBeenCalledWith(7, { logisticsProviderId: 5, deliveryFee: null });
  });

  it('SIGNED/SIGNED_PAID/REJECTED 点击打开费用确认弹窗而非直接调接口', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    await openWith(vm, { id: 8, status: 'DISPATCHING', deliveryFee: 12.5, items: [] });
    vm.onStatusClick('SIGNED');
    expect(apiLogisticsUpdateStatus).not.toHaveBeenCalled();
    expect(vm.statusModal.open).toBe(true);
    expect(vm.statusModal.target).toBe('SIGNED');
    expect(vm.statusModal.deliveryFee).toBe(12.5); // 预填已知费用
    vm.statusModal.deliveryFee = 30;
    await vm.doStatusConfirm();
    await flushPromises();
    expect(apiLogisticsUpdateStatus).toHaveBeenCalledWith(8, { status: 'SIGNED', deliveryFee: 30 });
    expect(vm.statusModal.open).toBe(false);
  });

  it('UNREACHABLE 仍为一键直发（不弹窗，deliveryFee: null）', async () => {
    setUser({ isSuper: 1 });
    const vm = mountPage().vm as any;
    apiSalesOrderGet.mockResolvedValue({ id: 9, status: 'DISPATCHING', items: [] });
    await vm.openDetail({ id: 9 });
    await flushPromises();
    vm.onStatusClick('UNREACHABLE');
    await flushPromises();
    expect(vm.statusModal.open).toBe(false);
    expect(apiLogisticsUpdateStatus).toHaveBeenCalledWith(9, { status: 'UNREACHABLE', deliveryFee: null });
  });
});
