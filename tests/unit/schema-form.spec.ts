import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SchemaForm from '@/components/SchemaForm.vue';
import type { FormField } from '@/components/SchemaForm.vue';

const schema: FormField[] = [
  { field: 'name', label: '名称', component: 'input', rules: [{ required: true, message: '必填' }] },
  { field: 'sort', label: '排序', component: 'number' },
];

describe('SchemaForm', () => {
  it('getValues() 返回当前表单值（含初始值）', () => {
    const wrapper = mount(SchemaForm, { props: { schema, initial: { name: 'A', sort: 3 } } });
    expect((wrapper.vm as any).getValues()).toEqual({ name: 'A', sort: 3 });
  });

  it('必填项为空时 validate() 返回 false，填写后返回 true', async () => {
    const wrapper = mount(SchemaForm, { props: { schema, initial: { name: '', sort: 1 } } });
    expect(await (wrapper.vm as any).validate()).toBe(false);

    await wrapper.setProps({ initial: { name: 'ok', sort: 1 } });
    await flushPromises();
    expect(await (wrapper.vm as any).validate()).toBe(true);
  });

  it('date 组件渲染 a-date-picker 并以 YYYY-MM-DD 字符串读写', () => {
    const wrapper = mount(SchemaForm, {
      props: {
        schema: [{ field: 'd', label: '日期', component: 'date' } as FormField],
        initial: { d: '2026-07-09' },
      },
    });
    expect(wrapper.findComponent({ name: 'ADatePicker' }).exists()).toBe(true);
    expect((wrapper.vm as any).getValues()).toEqual({ d: '2026-07-09' });
  });
});
