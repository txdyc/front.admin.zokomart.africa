<script lang="ts">
import type { Rule } from 'ant-design-vue/es/form';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface FormField {
  field: string;
  label: string;
  component: 'input' | 'password' | 'textarea' | 'number' | 'select' | 'switch';
  rules?: Rule[];
  options?: SelectOption[];
  placeholder?: string;
  /** 透传给底层 antd 组件的额外属性 */
  props?: Record<string, any>;
}
</script>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FormInstance } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    schema: FormField[];
    initial?: Record<string, any>;
    layout?: 'horizontal' | 'vertical';
  }>(),
  { initial: () => ({}), layout: 'vertical' },
);

const formRef = ref<FormInstance>();
const model = reactive<Record<string, any>>({ ...props.initial });

// 编辑态重新打开弹窗时用新的初始值重置表单
watch(
  () => props.initial,
  (val) => {
    Object.keys(model).forEach((k) => delete model[k]);
    Object.assign(model, val ?? {});
    formRef.value?.clearValidate();
  },
  { deep: true },
);

async function validate(): Promise<boolean> {
  try {
    await formRef.value?.validate();
    return true;
  } catch {
    return false;
  }
}

function getValues(): Record<string, any> {
  return { ...model };
}

defineExpose({ validate, getValues });
</script>

<template>
  <a-form ref="formRef" :model="model" :layout="layout">
    <a-form-item
      v-for="f in schema"
      :key="f.field"
      :label="f.label"
      :name="f.field"
      :rules="f.rules"
    >
      <a-input
        v-if="f.component === 'input'"
        v-model:value="model[f.field]"
        :placeholder="f.placeholder"
        allow-clear
        v-bind="f.props"
      />
      <a-input-password
        v-else-if="f.component === 'password'"
        v-model:value="model[f.field]"
        :placeholder="f.placeholder"
        v-bind="f.props"
      />
      <a-textarea
        v-else-if="f.component === 'textarea'"
        v-model:value="model[f.field]"
        :placeholder="f.placeholder"
        :rows="3"
        v-bind="f.props"
      />
      <a-input-number
        v-else-if="f.component === 'number'"
        v-model:value="model[f.field]"
        class="w-full"
        v-bind="f.props"
      />
      <a-select
        v-else-if="f.component === 'select'"
        v-model:value="model[f.field]"
        :options="f.options"
        :placeholder="f.placeholder"
        allow-clear
        v-bind="f.props"
      />
      <a-switch
        v-else-if="f.component === 'switch'"
        v-model:checked="model[f.field]"
        :checked-value="1"
        :un-checked-value="0"
        v-bind="f.props"
      />
    </a-form-item>
  </a-form>
</template>
