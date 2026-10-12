import { useState, type FormEvent } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import { SectionHeader, UserAvatar } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { useMe, useMemberMutations, useMembers, useUsers } from '@/api/hooks'
import { roles, type AppUser, type Project, type ProjectMember, type Role } from '@/lib/domain'

const NO_USER = 'none'

export function ProjectMembers({ project }: { project: Project }) {
  const { data: members = [] } = useMembers(project.id, true)
  const { data: me } = useMe()
  // GET /users is restricted to admins; without it, invitations use email only.
  const { data: appUsers = [] } = useUsers(Boolean(me?.isAdmin))
  const mutations = useMemberMutations(project.id)

  function toggleRole(member: ProjectMember, role: Role) {
    mutations.update.trigger({ userId: member.userId, roles: toggleInList(member.roles, role) })
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="Members" count={members.length}>
        Their project roles decide who can validate each step of a user story.
      </SectionHeader>

      <ul className="divide-y rounded-lg border text-sm">
        {members.map((member) => {
          const isMe = member.userId === me?.id
          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-56 flex-1 items-center gap-3">
                <UserAvatar name={member.name} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {member.name}
                    {isMe && <span className="font-normal text-muted-foreground"> · you</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <RolePicker
                value={member.roles}
                onToggle={(role) => toggleRole(member, role)}
                label={`Roles of ${member.name}`}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isMe}
                aria-label={`Remove ${member.name}`}
                title="Remove from the project"
                onClick={() => mutations.remove.trigger(member.userId)}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <UserMinus />
              </Button>
            </li>
          )
        })}
      </ul>

      <InviteForm
        users={appUsers}
        memberIds={members.map((member) => member.userId)}
        onInvite={(member) => mutations.invite.trigger(member)}
      />
    </div>
  )
}

type InviteFormProps = {
  users: AppUser[]
  memberIds: string[]
  onInvite: (invitation: { email: string; roles: Role[] }) => void
}

function InviteForm({ users, memberIds, onInvite }: InviteFormProps) {
  const candidates = users.filter((user) => !memberIds.includes(user.id))
  const [userId, setUserId] = useState(NO_USER)
  const [email, setEmail] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([])
  
  const target = email.trim() || (userId !== NO_USER ? userId : '')
  const canInvite = target !== '' && selectedRoles.length > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canInvite) return
    // The backend creates an account if the email address is unknown.
    const invitedEmail = email.trim() || users.find((user) => user.id === userId)?.email
    if (invitedEmail) onInvite({ email: invitedEmail, roles: selectedRoles })
    setUserId(NO_USER)
    setEmail('')
    setSelectedRoles([])
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
        Invite a user
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>User</Label>
          <Select
            items={[
              { value: NO_USER, label: candidates.length ? 'Choose a user' : 'Everyone is already a member' },
              ...candidates.map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })),
            ]}
            value={userId}
            onValueChange={(value) => {
              setUserId(value ?? NO_USER)
              setEmail('')
            }}
            disabled={candidates.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} <span className="text-muted-foreground">({user.email})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Or an email not in the list</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (event.target.value) setUserId(NO_USER)
            }}
            placeholder="colleague@company.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Roles</Label>
        <RolePicker
          value={selectedRoles}
          onToggle={(role) => setSelectedRoles((list) => toggleInList(list, role))}
          label="Roles of the invited user"
          allowEmpty
        />
      </div>

      <Button type="submit" disabled={!canInvite}>
        <UserPlus data-icon="inline-start" />
        Invite
      </Button>

    </form>
  )
}

type RolePickerProps = {
  value: Role[]
  onToggle: (role: Role) => void
  label: string
  // A member must keep at least one role; only invitations start with an empty selection.
  allowEmpty?: boolean
}

function RolePicker({ value, onToggle, label, allowEmpty = false }: RolePickerProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {roles.map((role) => {
        const pressed = value.includes(role)
        return (
          <Toggle
            key={role}
            variant="outline"
            size="sm"
            pressed={pressed}
            disabled={pressed && !allowEmpty && value.length === 1}
            onPressedChange={() => onToggle(role)}
            className="rounded-full px-3 transition-all active:scale-95 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/85 disabled:opacity-100"
          >
            {role}
          </Toggle>
        )
      })}
    </div>
  )
}

function toggleInList<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}
