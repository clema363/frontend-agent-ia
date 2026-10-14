import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "@/lib/router";
import { ChevronRight, type LucideIcon } from "@lucide/vue";
import {
  Teleport,
  defineComponent,
  onMounted,
  ref,
  type VNodeChild,
} from "vue";
type Props = {
  title: string;
  icon: LucideIcon;
  parent?: { label: string; to: string };
  actions?: VNodeChild;
};
export const PageHeader = defineComponent(
  (props: Props) => {
    const mounted = ref(false);
    onMounted(() => {
      mounted.value = true;
    });
    return () =>
      mounted.value ? (
        <Teleport to="#page-header">
          <header class="flex h-12 items-center gap-2 border-b bg-background px-3">
            <SidebarTrigger class="text-muted-foreground" />
            <Separator orientation="vertical" class="mx-1 h-4 self-center" />
            <nav
              aria-label="Breadcrumb"
              class="flex min-w-0 items-center gap-1.5 text-sm"
            >
              <props.icon
                class="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {props.parent && (
                <>
                  <Link
                    to={props.parent.to}
                    class="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {props.parent.label}
                  </Link>
                  <ChevronRight
                    class="size-3.5 shrink-0 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                </>
              )}
              <h1 class="truncate font-medium">{props.title}</h1>
            </nav>
            {props.actions && (
              <div class="ml-auto flex items-center gap-2">{props.actions}</div>
            )}
          </header>
        </Teleport>
      ) : null;
  },
  { props: ["title", "icon", "parent", "actions"] },
);
