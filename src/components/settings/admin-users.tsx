import { SectionHeader, UserAvatar } from '@/components/projects/project-parts'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useMe, useUpdateUser, useUsers } from '@/api/hooks'
import type { AppUser } from '@/lib/domain'
import { cn } from '@/lib/utils'

export function AdminUsers() {
  const { data: me } = useMe()
  const { data: users = [], isLoading, isError } = useUsers(Boolean(me?.isAdmin))
  const updateUser = useUpdateUser()

  function update(id: string, changes: Pick<Partial<AppUser>, 'isAdmin' | 'isActive'>) {
    updateUser.trigger({ id, ...changes })
  }

  return (
    <section className="space-y-4">
      <SectionHeader title="App users" count={users.length}>
        Manage accounts and administrator access across the application. Project roles are managed in each project's Members tab.
      </SectionHeader>
      {isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}
      {isError && <p role="alert" className="text-sm text-destructive">Could not load users.</p>}
      {updateUser.isError && <p role="alert" className="text-sm text-destructive">Could not update this account. Please try again.</p>}
      {!isLoading && !isError && users.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
      <ul className="divide-y rounded-xl border">
        {users.map((user) => {
          const isMe = user.id === me?.id
          return (
            <li
              key={user.id}
              className={cn('flex flex-wrap items-center gap-3 p-4 transition-opacity', !user.isActive && 'opacity-60')}
            >
              <UserAvatar name={user.name} className={cn(user.isAdmin && 'bg-primary text-primary-foreground')} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {user.name}
                  {isMe && <span className="font-normal text-muted-foreground"> · you</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-6">
                <SwitchField
                  id={`${user.id}-admin`}
                  label="Admin"
                  checked={user.isAdmin}
                  disabled={isMe || updateUser.isLoading}
                  onCheckedChange={(checked) => update(user.id, { isAdmin: checked })}
                />
                <SwitchField
                  id={`${user.id}-active`}
                  label="Active"
                  checked={user.isActive}
                  disabled={isMe || updateUser.isLoading}
                  onCheckedChange={(checked) => update(user.id, { isActive: checked })}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">You can't remove your own admin rights or deactivate yourself.</p>
      <p className="text-xs text-muted-foreground">Deactivating an account blocks sign-ins and preserves its project memberships.</p>
    </section>
  )
}

type SwitchFieldProps = {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

function SwitchField({ id, label, checked, disabled, onCheckedChange }: SwitchFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  )
}
