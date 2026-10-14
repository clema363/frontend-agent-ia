import type { HTMLAttributes } from "vue";
declare module "vue" {
  interface ComponentCustomProps extends Omit<
    HTMLAttributes,
    "onSelect" | "onToggle"
  > {
    disabled?: boolean;
    type?: string;
    placeholder?: string;
    required?: boolean;
    name?: string;
    autoComplete?: string;
    min?: string | number;
    max?: string | number;
  }
}
export {};
