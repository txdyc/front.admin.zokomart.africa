import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

// 桩：CascadeFilter 避免触发供应商/品牌/分类网络（BasicTable 用真实组件，
// 以保留 tableRef.reload()；其 fetcher 已 mock 返回空页）
vi.mock('@/components/CascadeFilter.vue', () => ({
  default: defineComponent({ name: 'CascadeFilter', setup: () => () => null }),
}));

const apiPlanPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiPlanGet = vi.fn(async (..._a: any[]): Promise<any> => ({ id: 1, items: [] }));
const apiPlanCreate = vi.fn(async (..._a: any[]) => 1);
const apiPlanUpdate = vi.fn(async (..._a: any[]) => undefined);
const apiPlanDelete = vi.fn(async (..._a: any[]) => undefined);
const apiPlanSubmit = vi.fn(async (..._a: any[]) => undefined);
const apiPlanApprove = vi.fn(async (..._a: any[]) => undefined);
const apiPlanReject = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/purchase/plan', () => ({
  apiPlanPage: (...a: any[]) => apiPlanPage(...a),
  apiPlanGet: (...a: any[]) => apiPlanGet(...a),
  apiPlanCreate: (...a: any[]) => apiPlanCreate(...a),
  apiPlanUpdate: (...a: any[]) => apiPlanUpdate(...a),
  apiPlanDelete: (...a: any[]) => apiPlanDelete(...a),
  apiPlanSubmit: (...a: any[]) => apiPlanSubmit(...a),
  apiPlanApprove: (...a: any[]) => apiPlanApprove(...a),
  apiPlanReject: (...a: any[]) => apiPlanReject(...a),
}));
vi.mock('@/api/product/supplierProduct', () => ({
  apiSupplierProductPage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
}));
vi.mock('@/api/basedata/supplier', () => ({
  apiSupplierPage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 1000 })),
}));

import PlanPage from '@/views/purchase/plan/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(PlanPage, { global: { directives: { perm } } });
const prod = (over: Record<string, any>) => ({
  id: 1, name: 'P', productCode: 'C', supplierId: 9, minPurchaseQty: 1, wholesalePrice: 10, status: 1, ...over,
});

describe('采购计划页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 purchase:plan:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['purchase:plan:list'] });
    expect(mountPage().find('[data-test="plan-create"]').exists()).toBe(false);
  });

  it('汇总金额 = Σ 批发价×数量', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    vm.setQty(prod({ id: 1, wholesalePrice: 10, minPurchaseQty: 1 }), 5); // 50
    vm.setQty(prod({ id: 2, wholesalePrice: 20, minPurchaseQty: 1 }), 3); // 60
    await flushPromises();
    expect(vm.totalAmount).toBe(110);
    expect(vm.totalQty).toBe(8);
  });

  it('保存载荷过滤 qty=0 行', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    vm.setQty(prod({ id: 1, minPurchaseQty: 1 }), 5);
    vm.setQty(prod({ id: 2, minPurchaseQty: 1 }), 0);
    await vm.save();
    await flushPromises();
    expect(apiPlanCreate).toHaveBeenCalledTimes(1);
    const payload = apiPlanCreate.mock.calls[0][0];
    expect(payload.items).toEqual([{ supplierProductId: 1, purchaseQty: 5 }]);
  });

  it('purchaseQty<MOQ：拦截保存，不调用 create', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    vm.setQty(prod({ id: 1, minPurchaseQty: 5 }), 2); // 2 < MOQ 5
    expect(vm.canSave).toBe(false);
    await vm.save();
    await flushPromises();
    expect(apiPlanCreate).not.toHaveBeenCalled();
  });

  it('空计划：无 qty>0 行时不保存', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openCreate();
    await vm.save();
    await flushPromises();
    expect(apiPlanCreate).not.toHaveBeenCalled();
  });

  it('提交 / 删除 / 通过：分别调用对应 api(id)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    await vm.submitPlan({ id: 7 });
    await vm.deletePlan({ id: 8 });
    await vm.approve({ id: 9 });
    await flushPromises();
    expect(apiPlanSubmit).toHaveBeenCalledWith(7);
    expect(apiPlanDelete).toHaveBeenCalledWith(8);
    expect(apiPlanApprove).toHaveBeenCalledWith(9);
  });

  it('退回：空原因拦截；填原因后调用 reject(id, reason)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openReject({ id: 5 });
    await vm.doReject(); // 空原因
    expect(apiPlanReject).not.toHaveBeenCalled();
    vm.rejectReason = '缺货';
    await vm.doReject();
    await flushPromises();
    expect(apiPlanReject).toHaveBeenCalledWith(5, '缺货');
  });

  it('编辑：载入计划明细到草稿（qty 回显）', async () => {
    setUser({ isSuper: 1 });
    apiPlanGet.mockResolvedValueOnce({
      id: 3, planNo: 'PP1', status: 'REJECTED', approveRemark: '价格偏高', remark: 'r',
      items: [{ supplierProductId: 11, supplierId: 9, productName: 'X', productCode: 'CX', wholesalePrice: 8, minPurchaseQty: 2, purchaseQty: 4 }],
    });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    await vm.openEdit({ id: 3 });
    await flushPromises();
    expect(apiPlanGet).toHaveBeenCalledWith(3);
    expect(vm.getQty(11)).toBe(4);
    expect(vm.totalAmount).toBe(32);
  });
});
