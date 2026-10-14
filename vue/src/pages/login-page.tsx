import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormEvent } from "@/lib/events";
import { Link } from "@/lib/router";
import { ArrowRight, Eye, EyeOff, Info, Loader } from "@lucide/vue";
import { defineComponent, ref } from "vue";
export const LoginPage = defineComponent(
  (__props: Record<string, never>) => {
    const showPassword = ref(false);
    const setShowPassword = (
      next:
        | typeof showPassword.value
        | ((current: typeof showPassword.value) => typeof showPassword.value),
    ) => {
      showPassword.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof showPassword.value,
              ) => typeof showPassword.value
            )(showPassword.value)
          : next;
    };
    const submitted = ref(false);
    const setSubmitted = (
      next:
        | typeof submitted.value
        | ((current: typeof submitted.value) => typeof submitted.value),
    ) => {
      submitted.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof submitted.value,
              ) => typeof submitted.value
            )(submitted.value)
          : next;
    };
    return () => {
      function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // UI preview only. Replace with the authentication flow when it is connected.
        setSubmitted(true);
      }
      return (
        <main class="flex min-h-svh flex-col items-center justify-center bg-sidebar px-5 py-12">
          <div class="flex w-full max-w-sm flex-col gap-7">
            <Link
              to="/"
              class="flex items-center justify-center gap-2.5 self-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Loader class="size-5" aria-hidden="true" />
              </span>
              <span class="text-xl font-semibold tracking-tight">Atlas</span>
            </Link>

            <Card class="[--card-spacing:--spacing(6)]">
              <CardHeader class="gap-2 text-center">
                <h1 class="text-2xl font-semibold tracking-tight">
                  Welcome back
                </h1>
                <CardDescription>
                  Sign in to your Atlas workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  class="flex flex-col gap-5"
                  onSubmit={handleSubmit}
                  onInput={() => setSubmitted(false)}
                >
                  <div class="grid gap-2">
                    <Label for="login-email">Email</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="you@company.com"
                      class="h-10"
                      required
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label for="login-password">Password</Label>
                    <div class="relative">
                      <Input
                        id="login-password"
                        name="password"
                        type={showPassword.value ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        class="h-10 pr-11"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="absolute top-1 right-1 text-muted-foreground"
                        aria-label={
                          showPassword.value ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword.value}
                        aria-controls="login-password"
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword.value ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" class="h-10 w-full">
                    Sign in
                    <ArrowRight class="size-4" aria-hidden="true" />
                  </Button>
                  {submitted.value && (
                    <Alert role="status">
                      <Info aria-hidden="true" />
                      <AlertDescription>
                        Sign-in is not connected yet. You can explore the demo
                        below.
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </CardContent>
              <CardFooter class="justify-center">
                <Link
                  to="/"
                  class="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Explore the demo
                </Link>
              </CardFooter>
            </Card>
            <p class="text-center text-xs text-muted-foreground">
              Your projects, stories and agents. One workspace.
            </p>
          </div>
        </main>
      );
    };
  },
  { name: "LoginPage", props: [], inheritAttrs: false },
);
