<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from "reka-ui";
import { SelectRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<
  Omit<SelectRootProps, "modelValue" | "defaultValue"> & {
    modelValue?: string;
    defaultValue?: string;
  }
>();
const emits = defineEmits<{
  "update:modelValue": [value: string];
  "update:open": [value: boolean];
}>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectRoot v-slot="slotProps" data-slot="select" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
