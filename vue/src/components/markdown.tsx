import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { defineComponent, type VNodeChild } from "vue";
const markdown = new MarkdownIt({ html: false, linkify: true });
export const Markdown = defineComponent(
  (props: { className?: string; children?: VNodeChild }, { slots }) =>
    () => {
      const children = slots.default?.() ?? [];
      const text = children
        .map((child) =>
          typeof child.children === "string" ? child.children : "",
        )
        .join("");
      return (
        <div
          class={cn(
            "space-y-3 text-sm leading-relaxed",
            "[&_h2]:text-base [&_h2]:font-semibold [&_h3]:pt-2 [&_h3]:text-sm [&_h3]:font-semibold",
            "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
            "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
            props.className,
          )}
          innerHTML={DOMPurify.sanitize(markdown.render(text))}
        />
      );
    },
  { props: ["className"] },
);
