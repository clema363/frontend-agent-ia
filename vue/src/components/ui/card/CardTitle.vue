<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <h3
    data-slot="card-title"
    :class="
      cn(
        `font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm`,
        props.class,
      )
    "
  >
    <slot />
  </h3>
</template>
