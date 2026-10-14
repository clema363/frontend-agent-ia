import { useMe, useProjects, useUpdateMe } from "@/api/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadges, UserAvatar } from "@/components/projects/project-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roles, type Role } from "@/lib/domain";
import { Link } from "@/lib/router";
import { ArrowUpRight, FolderOpen, Settings, Shield, User } from "@lucide/vue";
import { defineComponent } from "vue";
const roleNames: Record<Role, string> = {
  PO: "Product Owner",
  BA: "Business Analyst",
  Architect: "Architect",
  DEV: "Developer",
  QA: "Quality Assurance",
};
const roleOptions = roles.map((value) => ({ value, label: roleNames[value] }));
export const ProfilePage = defineComponent(
  (__props: Record<string, never>) => {
    const meState0 = useMe();
    const projectsState1 = useProjects();
    const updateMeState2 = useUpdateMe();
    return () => {
      const me = meState0;
      const projects = projectsState1;
      const updateMe = updateMeState2;
      const memberships =
        projects.data?.filter((project) => project.myRoles.length > 0) ?? [];
      return (
        <>
          <PageHeader title="Profile" icon={User} />
          <div class="mx-auto w-full max-w-3xl space-y-8">
            {me.isLoading && (
              <p role="status" class="text-sm text-muted-foreground">
                Loading your profile…
              </p>
            )}
            {me.isError && (
              <div class="space-y-3">
                <p role="alert" class="text-sm text-destructive">
                  Could not load your profile.
                </p>
                <Button variant="outline" onClick={() => me.refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {me.data && (
              <>
                <div class="flex items-center gap-4 border-b pb-6">
                  <UserAvatar name={me.data.name} className="size-16 text-xl" />
                  <div class="min-w-0 space-y-1">
                    <h2 class="truncate text-xl font-semibold tracking-tight">
                      {me.data.name}
                    </h2>
                    <p class="break-all text-sm text-muted-foreground">
                      {me.data.email}
                    </p>
                    <div class="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                      {me.data.isAdmin && (
                        <span class="flex items-center gap-1">
                          <Shield class="size-3" aria-hidden="true" />
                          Administrator<span aria-hidden="true">·</span>
                        </span>
                      )}
                      <span>
                        {me.data.isActive
                          ? "Active account"
                          : "Inactive account"}
                      </span>
                    </div>
                  </div>
                </div>

                <section class="space-y-4" aria-labelledby="account-heading">
                  <div class="space-y-1">
                    <h2 id="account-heading" class="text-sm font-medium">
                      Account details
                    </h2>
                    <p class="text-sm text-muted-foreground">
                      Your identity and role in the workspace.
                    </p>
                  </div>
                  <div class="rounded-lg border bg-card">
                    <dl class="divide-y">
                      <div class="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                        <dt class="text-sm text-muted-foreground">Name</dt>
                        <dd class="break-words text-sm">{me.data.name}</dd>
                      </div>
                      <div class="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                        <dt class="text-sm text-muted-foreground">
                          Email address
                        </dt>
                        <dd class="break-all text-sm">{me.data.email}</dd>
                      </div>
                    </dl>
                    <div class="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div class="space-y-1">
                        <Label for="profile-role">Workspace role</Label>
                        <p
                          id="profile-role-help"
                          class="text-xs text-muted-foreground"
                        >
                          Used for your Kanban view and story approvals.
                        </p>
                      </div>
                      <Select
                        modelValue={me.data.role}
                        disabled={updateMe.isLoading}
                        onUpdate:modelValue={(value) => {
                          if (value && value !== me.data?.role)
                            updateMe.trigger({ role: value as Role });
                        }}
                      >
                        <SelectTrigger
                          id="profile-role"
                          aria-describedby="profile-role-help"
                          class="w-full sm:w-48"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {updateMe.isLoading && (
                      <p
                        role="status"
                        class="px-4 pb-4 text-xs text-muted-foreground"
                      >
                        Saving your role…
                      </p>
                    )}
                    {updateMe.isSuccess && (
                      <p
                        role="status"
                        class="px-4 pb-4 text-xs text-muted-foreground"
                      >
                        Your role has been updated.
                      </p>
                    )}
                    {updateMe.isError && (
                      <p
                        role="alert"
                        class="px-4 pb-4 text-xs text-destructive"
                      >
                        Could not update your role. Please try again.
                      </p>
                    )}
                  </div>
                </section>

                <section
                  class="space-y-4"
                  aria-labelledby="profile-projects-heading"
                >
                  <div class="space-y-1">
                    <h2
                      id="profile-projects-heading"
                      class="text-sm font-medium"
                    >
                      Your projects
                    </h2>
                    <p class="text-sm text-muted-foreground">
                      Projects you belong to and your roles in each one.
                    </p>
                  </div>
                  {projects.isLoading ? (
                    <p role="status" class="text-sm text-muted-foreground">
                      Loading your projects…
                    </p>
                  ) : projects.isError ? (
                    <div class="space-y-3">
                      <p role="alert" class="text-sm text-destructive">
                        Could not load your projects.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => projects.refetch()}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : memberships.length === 0 ? (
                    <p class="rounded-lg border p-4 text-sm text-muted-foreground">
                      You haven't joined a project yet.
                    </p>
                  ) : (
                    <div class="flex flex-col gap-[2px] rounded-lg border p-[2px]">
                      {memberships.map((project) => (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}`}
                          class="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-interaction-hover active:bg-interaction-selected focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <FolderOpen
                            class="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <div class="min-w-0 flex-1 space-y-1">
                            <p class="truncate text-sm font-medium">
                              {project.name}
                            </p>
                            <p class="font-mono text-xs text-muted-foreground">
                              {project.key}
                            </p>
                          </div>
                          <RoleBadges roles={project.myRoles} />
                          <ArrowUpRight
                            class="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                <div class="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p class="text-sm text-muted-foreground">
                    Personalize your theme and manage tool connections.
                  </p>
                  <Button variant="outline" asChild>
                    <Link to="/settings">
                      <Settings aria-hidden="true" />
                      Open settings
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      );
    };
  },
  { name: "ProfilePage", props: [], inheritAttrs: false },
);
