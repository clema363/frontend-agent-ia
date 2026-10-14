import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import { router } from "./router";
import { queryClient } from "./api/query-client";
import { useTheme } from "./lib/theme";
import "./index.css";
const pinia = createPinia();
const app = createApp(App)
  .use(pinia)
  .use(VueQueryPlugin, { queryClient })
  .use(router);
useTheme(pinia);
app.mount("#app");
