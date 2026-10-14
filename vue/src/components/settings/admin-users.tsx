import { useMe, useUpdateUser, useUsers } from "@/api/hooks";
import { SectionHeader, UserAvatar } from "@/components/projects/project-parts";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AppUser } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { defineComponent } from "vue";
export const AdminUsers = defineComponent(
  (__props: Record<string, never>) => {
    const meState0 = useMe();
    const usersState1 = useUsers(() => Boolean(meState0.data?.isAdmin));
    const updateUserState2 = useUpdateUser();
    return () => {
      const { data: me } = meState0;
      const { data: users = [], isLoading, isError } = usersState1;
      const updateUser = updateUserState2;
      function update(
        id: string,
        changes: Pick<Partial<AppUser>, "isAdmin" | "isActive">,
      ) {
        updateUser.trigger({ id, ...changes });
      }
      return (
        <section class="space-y-4">
          <SectionHeader title="App users" count={users.length}>
            Manage accounts and administrator access across the application.
            Project roles are managed in each project's Members tab.
          </SectionHeader>
          {isLoading && (
            <p class="text-sm text-muted-foreground">Loading users…</p>
          )}
          {isError && (
            <p role="alert" class="text-sm text-destructive">
              Could not load users.
            </p>
          )}
          {updateUser.isError && (
            <p role="alert" class="text-sm text-destructive">
              Could not update this account. Please try again.
            </p>
          )}
          {!isLoading && !isError && users.length === 0 && (
            <p class="text-sm text-muted-foreground">No users yet.</p>
          )}
          <ul class="divide-y rounded-xl border">
            {users.map((user) => {
              const isMe = user.id === me?.id;
              return (
                <li
                  key={user.id}
                  class={cn(
                    "flex flex-wrap items-center gap-3 p-4 transition-opacity",
                    !user.isActive && "opacity-60",
                  )}
                >
                  <UserAvatar
                    name={user.name}
                    className={cn(
                      user.isAdmin && "bg-primary text-primary-foreground",
                    )}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">
                      {user.name}
                      {isMe && (
                        <span class="font-normal text-muted-foreground">
                          {" "}
                          · you
                        </span>
                      )}
                    </p>
                    <p class="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <div class="flex items-center gap-6">
                    <SwitchField
                      id={`${user.id}-admin`}
                      label="Admin"
                      checked={user.isAdmin}
                      disabled={isMe || updateUser.isLoading}
                      onCheckedChange={(checked) =>
                        update(user.id, { isAdmin: checked })
                      }
                    />
                    <SwitchField
                      id={`${user.id}-active`}
                      label="Active"
                      checked={user.isActive}
                      disabled={isMe || updateUser.isLoading}
                      onCheckedChange={(checked) =>
                        update(user.id, { isActive: checked })
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p class="mt-3 text-xs text-muted-foreground">
            You can't remove your own admin rights or deactivate yourself.
          </p>
          <p class="text-xs text-muted-foreground">
            Deactivating an account blocks sign-ins and preserves its project
            memberships.
          </p>
        </section>
      );
    };
  },
  { name: "AdminUsers", props: [], inheritAttrs: false },
);
type SwitchFieldProps = {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};
const SwitchField = defineComponent(
  (__props: SwitchFieldProps) => {
    return () => {
      const { id, label, checked, disabled, onCheckedChange } = __props;
      return (
        <div class="flex items-center gap-2">
          <Switch
            id={id}
            modelValue={checked}
            disabled={disabled}
            onUpdate:modelValue={onCheckedChange}
          />
          <Label for={id} class="font-normal">
            {label}
          </Label>
        </div>
      );
    };
  },
  {
    name: "SwitchField",
    props: ["id", "label", "checked", "disabled", "onCheckedChange"],
    inheritAttrs: false,
  },
);
