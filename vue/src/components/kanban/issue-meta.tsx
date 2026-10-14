import {
  kanbanColumns,
  type IssueType,
  type KanbanColumnId,
  type Priority,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Bug,
  Equal,
  FlaskConical,
  SquareCheck,
  Zap,
  type LucideIcon,
} from "@lucide/vue";
import { defineComponent } from "vue";
const typeStyles: Record<
  IssueType,
  {
    icon: LucideIcon;
    className: string;
  }
> = {
  Story: { icon: Bookmark, className: "text-green-600 dark:text-green-400" },
  Epic: { icon: Zap, className: "text-violet-600 dark:text-violet-400" },
  Bug: { icon: Bug, className: "text-red-600 dark:text-red-400" },
  Task: { icon: SquareCheck, className: "text-blue-600 dark:text-blue-400" },
  Spike: {
    icon: FlaskConical,
    className: "text-amber-600 dark:text-amber-400",
  },
};
const priorityStyles: Record<
  Priority,
  {
    icon: LucideIcon;
    className: string;
  }
> = {
  High: { icon: ArrowUp, className: "text-red-600 dark:text-red-400" },
  Medium: { icon: Equal, className: "text-amber-600 dark:text-amber-400" },
  Low: { icon: ArrowDown, className: "text-blue-600 dark:text-blue-400" },
};
export const IssueTypeIcon = defineComponent(
  (__props: { type: IssueType; className?: string }) => {
    return () => {
      const { type, className } = __props;
      const { icon: Icon, className: color } = typeStyles[type];
      return (
        <Icon
          class={cn("size-3.5 shrink-0", color, className)}
          aria-label={type}
        />
      );
    };
  },
  { name: "IssueTypeIcon", props: ["type", "className"], inheritAttrs: false },
);
export const PriorityIcon = defineComponent(
  (__props: { priority: Priority; className?: string }) => {
    return () => {
      const { priority, className } = __props;
      const { icon: Icon, className: color } = priorityStyles[priority];
      return (
        <Icon
          class={cn("size-3.5 shrink-0", color, className)}
          aria-label={`${priority} priority`}
        />
      );
    };
  },
  {
    name: "PriorityIcon",
    props: ["priority", "className"],
    inheritAttrs: false,
  },
);
export const ColumnIcon = defineComponent(
  (__props: { column: KanbanColumnId; className?: string }) => {
    return () => {
      const { column, className } = __props;
      const index = kanbanColumns.findIndex((item) => item.id === column);
      const { color, title } = kanbanColumns[index];
      const share = index / (kanbanColumns.length - 1);
      const last = index === kanbanColumns.length - 1;
      // Draw the filled portion as a thick arc: the inner circle has radius 2 and circumference 4π.
      const circumference = 4 * Math.PI;
      return (
        <svg
          viewBox="0 0 14 14"
          class={cn("size-3.5 shrink-0", className)}
          style={{ color }}
          role="img"
          aria-label={title}
        >
          <circle
            cx="7"
            cy="7"
            r="6"
            fill={last ? "currentColor" : "none"}
            stroke="currentColor"
            stroke-width="1.5"
          />
          {last ? (
            <path
              d="M4.5 7.2 6.2 8.8 9.5 5.4"
              fill="none"
              stroke="var(--background)"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          ) : (
            share > 0 && (
              <circle
                cx="7"
                cy="7"
                r="2"
                fill="none"
                stroke="currentColor"
                stroke-width="4"
                stroke-dasharray={`${circumference * share} ${circumference}`}
                transform="rotate(-90 7 7)"
              />
            )
          )}
        </svg>
      );
    };
  },
  { name: "ColumnIcon", props: ["column", "className"], inheritAttrs: false },
);
