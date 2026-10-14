<script setup lang="ts">
import { useRoute } from "vue-router";
import { useMe } from "@/api/hooks";
import {
  FolderOpen,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  SquareKanban,
  User,
  Loader,
} from "@lucide/vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
const route = useRoute();
const me = useMe();
const navItems = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Projects", to: "/projects", icon: FolderOpen },
  { title: "Kanban", to: "/kanban", icon: SquareKanban },
  { title: "Journal", to: "/journal", icon: ScrollText },
  { title: "Settings", to: "/settings", icon: Settings },
];
</script>
<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader
      ><SidebarMenu
        ><SidebarMenuItem
          ><SidebarMenuButton size="lg" as-child>
            <RouterLink to="/"
              ><div
                class="flex aspect-square size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
              >
                <Loader class="size-4" />
              </div>
              <span class="text-sm font-semibold">Atlas</span></RouterLink
            >
          </SidebarMenuButton></SidebarMenuItem
        ></SidebarMenu
      ></SidebarHeader
    >
    <SidebarContent
      ><SidebarGroup
        ><SidebarGroupContent
          ><SidebarMenu>
            <SidebarMenuItem v-for="item in navItems" :key="item.to"
              ><SidebarMenuButton
                :is-active="
                  item.to === '/'
                    ? route.path === '/'
                    : route.path.startsWith(item.to)
                "
                :tooltip="item.title"
                as-child
              >
                <RouterLink :to="item.to"
                  ><component :is="item.icon" /><span>{{
                    item.title
                  }}</span></RouterLink
                >
              </SidebarMenuButton></SidebarMenuItem
            >
          </SidebarMenu></SidebarGroupContent
        ></SidebarGroup
      ></SidebarContent
    >
    <SidebarSeparator />
    <SidebarFooter
      ><SidebarMenu>
        <SidebarMenuItem
          ><SidebarMenuButton
            tooltip="Profile"
            :is-active="route.path === '/profile'"
            as-child
            ><RouterLink to="/profile"
              ><User /><span>Profile</span></RouterLink
            ></SidebarMenuButton
          ></SidebarMenuItem
        >
        <SidebarMenuItem
          ><SidebarMenuButton tooltip="Sign out" as-child
            ><RouterLink to="/login"
              ><LogOut /><span>Sign out</span></RouterLink
            ></SidebarMenuButton
          ></SidebarMenuItem
        >
      </SidebarMenu>
      <p
        class="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
      >
        {{
          me.data
            ? `Signed in: ${me.data.name} · ${me.data.isAdmin ? "ADMIN" : me.data.role}`
            : "Loading account…"
        }}
      </p></SidebarFooter
    >
  </Sidebar>
</template>
