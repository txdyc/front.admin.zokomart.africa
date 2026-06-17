import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CustomerPage from '@/views/customer/index.vue';

vi.mock('@/api/customer', () => ({
  apiCustomerPage: vi.fn().mockResolvedValue({ records: [], total: 0, current: 1, size: 10 }),
}));

const stubs = {
  'a-card': true, 'a-form': true, 'a-form-item': true, 'a-input': true,
  'a-button': true, 'a-space': true, BasicTable: true,
};

describe('CustomerPage', () => {
  it('search copies keyword into query, reset clears it', () => {
    const wrapper = mount(CustomerPage, { global: { stubs } });
    wrapper.vm.searchForm.keyword = 'Ama';
    wrapper.vm.onSearch();
    expect(wrapper.vm.query.keyword).toBe('Ama');
    wrapper.vm.onReset();
    expect(wrapper.vm.query.keyword).toBeUndefined();
  });
});
