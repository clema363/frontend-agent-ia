import type { VNodeChild } from "vue";
import { computed, defineComponent, onMounted, reactive } from "vue";
import {
  RouterLink,
  useRoute,
  useRouter,
  type RouteLocationRaw,
} from "vue-router";

type LinkProps = {
  to: RouteLocationRaw;
  end?: boolean;
  className?: string | ((state: { isActive: boolean }) => string);
  class?: string | ((state: { isActive: boolean }) => string);
  children?: VNodeChild;
};
export const Link = defineComponent(
  (props: LinkProps, { slots, attrs }) =>
    () => (
      <RouterLink
        to={props.to}
        {...attrs}
        class={
          typeof (props.class ?? props.className) === "string"
            ? (props.class ?? props.className)
            : undefined
        }
      >
        {slots.default?.()}
      </RouterLink>
    ),
  { props: ["to", "class", "className", "end"], inheritAttrs: false },
);
export const NavLink = defineComponent(
  (props: LinkProps, { slots, attrs }) =>
    () => (
      <RouterLink
        to={props.to}
        custom
        v-slots={{
          default: ({
            href,
            navigate,
            isActive,
            isExactActive,
          }: {
            href: string;
            navigate: (event: MouseEvent) => void;
            isActive: boolean;
            isExactActive: boolean;
          }) => {
            const active = props.end ? isExactActive : isActive;
            const style = props.class ?? props.className;
            return (
              <a
                {...attrs}
                href={href}
                onClick={navigate}
                aria-current={active ? "page" : undefined}
                class={
                  typeof style === "function"
                    ? style({ isActive: active })
                    : style
                }
              >
                {slots.default?.()}
              </a>
            );
          },
        }}
      />
    ),
  { props: ["to", "class", "className", "end"], inheritAttrs: false },
);
export function useNavigate() {
  const router = useRouter();
  return (
    to: string,
    options?: { replace?: boolean; state?: Record<string, string> },
  ) =>
    options?.replace
      ? router.replace({ path: to, state: options.state })
      : router.push({ path: to, state: options?.state });
}
export function useParams() {
  const route = useRoute();
  return reactive(
    computed(() =>
      Object.fromEntries(
        Object.entries(route.params).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value,
        ]),
      ),
    ).value,
  );
}
export function useLocation() {
  const route = useRoute();
  return reactive({
    pathname: computed(() => route.path),
    search: computed(() =>
      route.fullPath.includes("?")
        ? route.fullPath.slice(route.fullPath.indexOf("?"))
        : "",
    ),
    state: computed(() => window.history.state),
  });
}
type SearchInput = URLSearchParams | Record<string, string>;
export function useSearchParams(): readonly [
  URLSearchParams,
  (
    next: SearchInput | ((current: URLSearchParams) => SearchInput),
    options?: { replace?: boolean },
  ) => void,
] {
  const route = useRoute();
  const router = useRouter();
  const params = computed(
    () =>
      new URLSearchParams(route.fullPath.split("?")[1]?.split("#")[0] ?? ""),
  );
  const set = (
    next: SearchInput | ((current: URLSearchParams) => SearchInput),
    options?: { replace?: boolean },
  ) => {
    const values =
      typeof next === "function"
        ? next(new URLSearchParams(params.value))
        : next;
    const query = Object.fromEntries(new URLSearchParams(values));
    void router[options?.replace ? "replace" : "push"]({
      path: route.path,
      query,
    });
  };
  // Getter keeps the URL synchronized when a page is reused by Vue Router.
  return {
    get 0() {
      return params.value;
    },
    1: set,
    *[Symbol.iterator]() {
      yield params.value;
      yield set;
    },
  } as unknown as readonly [URLSearchParams, typeof set];
}
export const Navigate = defineComponent(
  (props: {
    to: string;
    replace?: boolean;
    state?: Record<string, string>;
  }) => {
    const navigate = useNavigate();
    onMounted(() =>
      navigate(props.to, { replace: props.replace, state: props.state }),
    );
    return () => null;
  },
  { props: ["to", "replace", "state"] },
);
