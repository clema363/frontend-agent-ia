import { useMe, useMemberMutations, useMembers, useUsers } from "@/api/hooks";
import { SectionHeader, UserAvatar } from "@/components/projects/project-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  roles,
  type AppUser,
  type Project,
  type ProjectMember,
  type Role,
} from "@/lib/domain";
import type { FormEvent } from "@/lib/events";
import { UserMinus, UserPlus } from "@lucide/vue";
import { defineComponent, ref } from "vue";
const NO_USER = "none";
export const ProjectMembers = defineComponent(
  (__props: { project: Project }) => {
    const { project } = __props;
    const membersState0 = useMembers(
      () => project.id,
      () => true,
    );
    const meState1 = useMe();
    const usersState2 = useUsers(() => Boolean(meState1.data?.isAdmin));
    const memberMutationsState3 = useMemberMutations(project.id);
    return () => {
      const { data: members = [] } = membersState0;
      const { data: me } = meState1;
      // GET /users is restricted to admins; without it, invitations use email only.
      const { data: appUsers = [] } = usersState2;
      const mutations = memberMutationsState3;
      function toggleRole(member: ProjectMember, role: Role) {
        mutations.update.trigger({
          userId: member.userId,
          roles: toggleInList(member.roles, role),
        });
      }
      return (
        <div class="space-y-8">
          <SectionHeader title="Members" count={members.length}>
            Their project roles decide who can validate each step of a user
            story.
          </SectionHeader>

          <ul class="divide-y rounded-lg border text-sm">
            {members.map((member) => {
              const isMe = member.userId === me?.id;
              return (
                <li
                  key={member.userId}
                  class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div class="flex min-w-56 flex-1 items-center gap-3">
                    <UserAvatar name={member.name} className="size-7" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-medium">
                        {member.name}
                        {isMe && (
                          <span class="font-normal text-muted-foreground">
                            {" "}
                            · you
                          </span>
                        )}
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <RolePicker
                    value={member.roles}
                    onRoleToggle={(role) => toggleRole(member, role)}
                    label={`Roles of ${member.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isMe}
                    aria-label={`Remove ${member.name}`}
                    title="Remove from the project"
                    onClick={() => mutations.remove.trigger(member.userId)}
                    class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <UserMinus />
                  </Button>
                </li>
              );
            })}
          </ul>

          <InviteForm
            users={appUsers}
            memberIds={members.map((member) => member.userId)}
            onInvite={(member) => mutations.invite.trigger(member)}
          />
        </div>
      );
    };
  },
  { name: "ProjectMembers", props: ["project"], inheritAttrs: false },
);
type InviteFormProps = {
  users: AppUser[];
  memberIds: string[];
  onInvite: (invitation: { email: string; roles: Role[] }) => void;
};
const InviteForm = defineComponent(
  (__props: InviteFormProps) => {
    const userId = ref(NO_USER);
    const setUserId = (
      next:
        | typeof userId.value
        | ((current: typeof userId.value) => typeof userId.value),
    ) => {
      userId.value =
        typeof next === "function"
          ? (next as (current: typeof userId.value) => typeof userId.value)(
              userId.value,
            )
          : next;
    };
    const email = ref("");
    const setEmail = (
      next:
        | typeof email.value
        | ((current: typeof email.value) => typeof email.value),
    ) => {
      email.value =
        typeof next === "function"
          ? (next as (current: typeof email.value) => typeof email.value)(
              email.value,
            )
          : next;
    };
    const selectedRoles = ref<Role[]>([]);
    const setSelectedRoles = (next: Role[] | ((current: Role[]) => Role[])) => {
      selectedRoles.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof selectedRoles.value,
              ) => typeof selectedRoles.value
            )(selectedRoles.value)
          : next;
    };
    return () => {
      const { users, memberIds, onInvite } = __props;
      const candidates = users.filter((user) => !memberIds.includes(user.id));
      const target =
        email.value.trim() || (userId.value !== NO_USER ? userId.value : "");
      const canInvite = target !== "" && selectedRoles.value.length > 0;
      function submit(event: FormEvent) {
        event.preventDefault();
        if (!canInvite) return;
        // The backend creates an account if the email address is unknown.
        const invitedEmail =
          email.value.trim() ||
          users.find((user) => user.id === userId.value)?.email;
        if (invitedEmail)
          onInvite({ email: invitedEmail, roles: selectedRoles.value });
        setUserId(NO_USER);
        setEmail("");
        setSelectedRoles([]);
      }
      return (
        <form onSubmit={submit} class="space-y-4 rounded-lg border p-4">
          <h3 class="flex items-center gap-2 text-sm font-medium">
            <UserPlus class="size-4 text-muted-foreground" aria-hidden="true" />
            Invite a user
          </h3>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label>User</Label>
              <Select
                modelValue={userId.value}
                onUpdate:modelValue={(value) => {
                  setUserId(value ?? NO_USER);
                  setEmail("");
                }}
                disabled={candidates.length === 0}
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}{" "}
                      <span class="text-muted-foreground">({user.email})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <Label for="invite-email">Or an email not in the list</Label>
              <Input
                id="invite-email"
                type="email"
                modelValue={email.value}
                onInput={(event) => {
                  setEmail((event.target as HTMLInputElement).value);
                  if ((event.target as HTMLInputElement).value)
                    setUserId(NO_USER);
                }}
                placeholder="colleague@company.com"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label>Roles</Label>
            <RolePicker
              value={selectedRoles.value}
              onRoleToggle={(role) =>
                setSelectedRoles((list) => toggleInList(list, role))
              }
              label="Roles of the invited user"
              allowEmpty
            />
          </div>

          <Button type="submit" disabled={!canInvite}>
            <UserPlus data-icon="inline-start" />
            Invite
          </Button>
        </form>
      );
    };
  },
  {
    name: "InviteForm",
    props: ["users", "memberIds", "onInvite"],
    inheritAttrs: false,
  },
);
type RolePickerProps = {
  value: Role[];
  onRoleToggle: (role: Role) => void;
  label: string;
  // A member must keep at least one role; only invitations start with an empty selection.
  allowEmpty?: boolean;
};
const RolePicker = defineComponent(
  (__props: RolePickerProps) => {
    return () => {
      const { value, onRoleToggle, label, allowEmpty = false } = __props;
      return (
        <div role="group" aria-label={label} class="flex flex-wrap gap-1.5">
          {roles.map((role) => {
            const pressed = value.includes(role);
            return (
              <Toggle
                key={role}
                variant="outline"
                size="sm"
                modelValue={pressed}
                disabled={pressed && !allowEmpty && value.length === 1}
                onUpdate:modelValue={() => onRoleToggle(role)}
                class="rounded-full px-3 transition-all active:scale-95 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/85 disabled:opacity-100"
              >
                {role}
              </Toggle>
            );
          })}
        </div>
      );
    };
  },
  {
    name: "RolePicker",
    props: ["value", "onRoleToggle", "label", "allowEmpty"],
    inheritAttrs: false,
  },
);
function toggleInList<T>(list: T[], item: T) {
  return list.includes(item)
    ? list.filter((value) => value !== item)
    : [...list, item];
}
