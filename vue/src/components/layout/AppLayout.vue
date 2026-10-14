<script setup lang="ts">
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar from "./AppSidebar.vue";
import { useTheme } from "@/lib/theme";
useTheme();
</script>
<template>
  <TooltipProvider>
    <SidebarProvider class="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset
        class="min-h-0 min-w-0 overflow-hidden md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-none"
      >
        <div id="page-header" class="relative z-10 shrink-0 bg-background" />
        <div
          class="min-h-0 flex-1 overflow-auto overscroll-contain px-6 pt-6 pb-10"
        >
          <RouterView v-slot="{ Component, route }"
            ><component :is="Component" :key="route.path"
          /></RouterView>
        </div>
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>
</template>
