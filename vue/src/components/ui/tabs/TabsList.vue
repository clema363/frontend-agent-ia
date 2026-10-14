<script setup lang="ts">
import type { TabsListProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { TabsList } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<
  TabsListProps & {
    class?: HTMLAttributes["class"];
    variant?: "default" | "line";
  }
>();

const delegatedProps = reactiveOmit(props, "class", "variant");
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    :data-variant="variant ?? 'default'"
    v-bind="delegatedProps"
    :class="
      cn(
        'group/tabs-list text-muted-foreground inline-flex h-8 w-fit items-center justify-center rounded-lg p-[3px]',
        variant === 'line' ? 'gap-1 bg-transparent rounded-none' : 'bg-muted',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
