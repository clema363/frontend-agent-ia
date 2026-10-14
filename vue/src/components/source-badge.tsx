import { Badge } from "@/components/ui/badge";
import type { Source, SourceTool } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { defineComponent } from "vue";
const toolStyles: Record<SourceTool, string> = {
  Jira: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Confluence: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  GitLab:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};
type SourceBadgeProps = {
  tool: SourceTool;
  label?: string;
};
export const SourceBadge = defineComponent(
  (__props: SourceBadgeProps) => {
    return () => {
      const { tool, label } = __props;
      return (
        <Badge
          variant="secondary"
          class={cn(toolStyles[tool], "max-w-full")}
          title={label ? `${tool} · ${label}` : tool}
        >
          <span class="font-semibold">{tool}</span>
          {label && (
            <span class="truncate font-normal opacity-80">{label}</span>
          )}
        </Badge>
      );
    };
  },
  { name: "SourceBadge", props: ["tool", "label"], inheritAttrs: false },
);
export const SourceList = defineComponent(
  (__props: { sources: Source[] }) => {
    return () => {
      const { sources } = __props;
      if (sources.length === 0) return null;
      return (
        <div class="flex flex-wrap gap-1.5">
          {sources.map((source) => (
            <SourceBadge
              key={`${source.tool}-${source.label}`}
              tool={source.tool}
              label={source.label}
            />
          ))}
        </div>
      );
    };
  },
  { name: "SourceList", props: ["sources"], inheritAttrs: false },
);
