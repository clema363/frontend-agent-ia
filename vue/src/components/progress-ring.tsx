import { cn } from "@/lib/utils";
import { defineComponent } from "vue";
type ProgressRingProps = {
  value: number;
  size?: number;
  className?: string;
};
export const ProgressRing = defineComponent(
  (__props: ProgressRingProps) => {
    return () => {
      const { value, size = 16, className } = __props;
      const stroke = 2;
      const radius = (size - stroke) / 2;
      const circumference = 2 * Math.PI * radius;
      const clamped = Math.min(Math.max(value, 0), 100);
      return (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          class={cn("-rotate-90 shrink-0", className)}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke-width={stroke}
            class="stroke-muted-foreground/25"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke-width={stroke}
            stroke-linecap="round"
            stroke-dasharray={circumference}
            stroke-dashoffset={circumference * (1 - clamped / 100)}
            class={cn(
              "transition-[stroke-dashoffset] duration-500",
              clamped === 100 ? "stroke-green-600" : "stroke-primary",
            )}
          />
        </svg>
      );
    };
  },
  {
    name: "ProgressRing",
    props: ["value", "size", "className"],
    inheritAttrs: false,
  },
);
