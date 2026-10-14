import { defineStore } from "pinia";
import { onScopeDispose, reactive, watch } from "vue";
import type { KanbanColumnId } from "./domain";
export type ThemeMode = "light" | "dark" | "system";
export type Theme = {
  mode: ThemeMode;
  kanbanColumns: Partial<Record<KanbanColumnId, string>>;
};
export const kanbanPresets = [
  "#64748b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
];
const storageKey = "atlas-theme";
function loadTheme(): Theme {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return {
      mode: ["light", "dark", "system"].includes(saved.mode)
        ? saved.mode
        : "system",
      kanbanColumns: saved.kanbanColumns ?? {},
    };
  } catch {
    return { mode: "system", kanbanColumns: {} };
  }
}
export const useTheme = defineStore("theme", () => {
  const theme = reactive(loadTheme());
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () =>
    document.documentElement.classList.toggle(
      "dark",
      theme.mode === "dark" || (theme.mode === "system" && media.matches),
    );
  watch(
    theme,
    () => {
      apply();
      localStorage.setItem(storageKey, JSON.stringify(theme));
    },
    { deep: true, immediate: true },
  );
  media.addEventListener("change", apply);
  onScopeDispose(() => media.removeEventListener("change", apply));
  const setTheme = (changes: Partial<Theme>) => Object.assign(theme, changes);
  return { theme, setTheme };
});
export function kanbanColumnStyle(color: string | undefined) {
  return color
    ? { backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)` }
    : undefined;
}
