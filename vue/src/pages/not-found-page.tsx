import { buttonVariants } from "@/components/ui/button-variants";
import { Link } from "@/lib/router";
import { defineComponent } from "vue";
export const NotFoundPage = defineComponent(
  (__props: Record<string, never>) => {
    return () => {
      return (
        <main class="flex min-h-svh flex-col items-center justify-center px-6 text-center">
          <p class="text-sm font-medium text-muted-foreground">Error 404</p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p class="mt-4 text-muted-foreground">
            This page does not exist or has been moved.
          </p>
          <Link to="/" class={buttonVariants({ className: "mt-8" })}>
            Back to home
          </Link>
        </main>
      );
    };
  },
  { name: "NotFoundPage", props: [], inheritAttrs: false },
);
