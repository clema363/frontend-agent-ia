import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "@/components/layout/AppLayout.vue";
export const routes = [
  {
    path: "/login",
    component: () =>
      import("@/pages/login-page").then((module) => module.LoginPage),
  },
  {
    path: "/",
    component: AppLayout,
    children: [
      {
        path: "",
        component: () =>
          import("@/pages/dashboard-page").then(
            (module) => module.DashboardPage,
          ),
      },
      {
        path: "projects",
        component: () =>
          import("@/pages/projects-page").then((module) => module.ProjectsPage),
      },
      {
        path: "projects/:projectId/:tab?",
        component: () =>
          import("@/pages/project-page").then((module) => module.ProjectPage),
      },
      {
        path: "kanban",
        component: () =>
          import("@/pages/kanban-page").then((module) => module.KanbanPage),
      },
      {
        path: "kanban/:storyId",
        component: () =>
          import("@/pages/story-page").then((module) => module.StoryPage),
      },
      {
        path: "journal",
        component: () =>
          import("@/pages/journal-page").then((module) => module.JournalPage),
      },
      {
        path: "settings",
        component: () =>
          import("@/pages/settings-page").then((module) => module.SettingsPage),
      },
      {
        path: "profile",
        component: () =>
          import("@/pages/profile-page").then((module) => module.ProfilePage),
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    component: () =>
      import("@/pages/not-found-page").then((module) => module.NotFoundPage),
  },
];
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
