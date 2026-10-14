import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "@lucide/vue";
import { defineComponent, type VNodeChild } from "vue";
// Shared elements for the project page and its dialogs.
// Dialogs: fixed header and scrollable body.
export const projectDialogClassName =
  "flex max-h-[min(90vh,56rem)] flex-col gap-0 p-0";
type ProjectDialogHeaderProps = {
  icon: LucideIcon;
  title: string;
  project?: string;
  children?: VNodeChild;
};
export const ProjectDialogHeader = defineComponent(
  (__props: ProjectDialogHeaderProps, { slots }) => {
    return () => {
      const {
        icon: Icon,
        title,
        project,
        children,
      } = { ...__props, children: slots.default?.() };
      return (
        <DialogHeader class="gap-1.5 border-b p-5 pr-12">
          <div class="flex items-center gap-3">
            <span class="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Icon class="size-4.5" aria-hidden="true" />
            </span>
            <div class="space-y-1">
              <DialogTitle class="text-lg font-semibold">{title}</DialogTitle>
              {project && (
                <p class="font-mono text-xs text-muted-foreground">{project}</p>
              )}
            </div>
          </div>
          {children && (
            <DialogDescription class="pt-2">{children}</DialogDescription>
          )}
        </DialogHeader>
      );
    };
  },
  {
    name: "ProjectDialogHeader",
    props: ["icon", "title", "project"],
    inheritAttrs: false,
  },
);
export const ProjectDialogBody = defineComponent(
  (
    __props: {
      className?: string;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { className, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <div class={cn("min-h-0 flex-1 overflow-y-auto p-5", className)}>
          {children}
        </div>
      );
    };
  },
  { name: "ProjectDialogBody", props: ["className"], inheritAttrs: false },
);
export const UserAvatar = defineComponent(
  (__props: { name: string; className?: string }) => {
    return () => {
      const { name, className } = __props;
      const initials = name
        .replace(/\(.*?\)/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join("");
      return (
        <span
          aria-hidden="true"
          class={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
            className,
          )}
        >
          {initials}
        </span>
      );
    };
  },
  { name: "UserAvatar", props: ["name", "className"], inheritAttrs: false },
);
type SectionHeaderProps = {
  title: string;
  count?: number;
  actions?: VNodeChild;
  children?: VNodeChild;
};
export const SectionHeader = defineComponent(
  (__props: SectionHeaderProps, { slots }) => {
    return () => {
      const { title, count, actions, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <div class="flex items-end justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-sm font-medium">
              {title}
              {count !== undefined && (
                <span class="ml-2 font-normal text-muted-foreground tabular-nums">
                  {count}
                </span>
              )}
            </h2>
            {children && (
              <p class="text-sm text-muted-foreground">{children}</p>
            )}
          </div>
          {actions}
        </div>
      );
    };
  },
  {
    name: "SectionHeader",
    props: ["title", "count", "actions"],
    inheritAttrs: false,
  },
);
export const RoleBadges = defineComponent(
  (__props: { roles: string[] }) => {
    return () => {
      const { roles } = __props;
      if (roles.length === 0)
        return <span class="text-xs text-muted-foreground">—</span>;
      return (
        <span class="flex flex-wrap gap-1">
          {roles.map((role) => (
            <span
              key={role}
              class="rounded border px-1.5 py-px text-[11px] leading-4 text-muted-foreground"
            >
              {role}
            </span>
          ))}
        </span>
      );
    };
  },
  { name: "RoleBadges", props: ["roles"], inheritAttrs: false },
);
