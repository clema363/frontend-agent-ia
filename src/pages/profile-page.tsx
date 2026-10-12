import { ArrowUpRight, FolderOpen, Settings, Shield, User } from 'lucide-react'
import { Link } from 'react-router'
import { useMe, useProjects, useUpdateMe } from '@/api/hooks'
import { PageHeader } from '@/components/layout/page-header'
import { RoleBadges, UserAvatar } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { roles, type Role } from '@/lib/domain'

const roleNames: Record<Role, string> = {
  PO: 'Product Owner',
  BA: 'Business Analyst',
  Architect: 'Architect',
  DEV: 'Developer',
  QA: 'Quality Assurance',
}
const roleOptions = roles.map((value) => ({ value, label: roleNames[value] }))

export function ProfilePage() {
  const me = useMe()
  const projects = useProjects()
  const updateMe = useUpdateMe()
  const memberships = projects.data?.filter((project) => project.myRoles.length > 0) ?? []

  return (
    <>
      <PageHeader title="Profile" icon={User} />
      <div className="mx-auto w-full max-w-3xl space-y-8">
        {me.isPending && <p role="status" className="text-sm text-muted-foreground">Loading your profile…</p>}
        {me.isError && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">Could not load your profile.</p>
            <Button variant="outline" onClick={() => me.refetch()}>Try again</Button>
          </div>
        )}
        {me.data && (
          <>
            <div className="flex items-center gap-4 border-b pb-6">
              <UserAvatar name={me.data.name} className="size-16 text-xl" />
              <div className="min-w-0 space-y-1">
                <h2 className="truncate text-xl font-semibold tracking-tight">{me.data.name}</h2>
                <p className="break-all text-sm text-muted-foreground">{me.data.email}</p>
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  {me.data.isAdmin && <span className="flex items-center gap-1"><Shield className="size-3" aria-hidden="true" />Administrator<span aria-hidden="true">·</span></span>}
                  <span>{me.data.isActive ? 'Active account' : 'Inactive account'}</span>
                </div>
              </div>
            </div>

            <section className="space-y-4" aria-labelledby="account-heading">
              <div className="space-y-1">
                <h2 id="account-heading" className="text-sm font-medium">Account details</h2>
                <p className="text-sm text-muted-foreground">Your identity and role in the workspace.</p>
              </div>
              <div className="rounded-lg border bg-card">
                <dl className="divide-y">
                  <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                    <dt className="text-sm text-muted-foreground">Name</dt>
                    <dd className="break-words text-sm">{me.data.name}</dd>
                  </div>
                  <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                    <dt className="text-sm text-muted-foreground">Email address</dt>
                    <dd className="break-all text-sm">{me.data.email}</dd>
                  </div>
                </dl>
                <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="profile-role">Workspace role</Label>
                    <p id="profile-role-help" className="text-xs text-muted-foreground">Used for your Kanban view and story approvals.</p>
                  </div>
                  <Select items={roleOptions} value={me.data.role} disabled={updateMe.isPending} onValueChange={(value) => {
                    if (value && value !== me.data?.role) updateMe.mutate({ role: value as Role })
                  }}>
                    <SelectTrigger id="profile-role" aria-describedby="profile-role-help" className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {updateMe.isPending && <p role="status" className="px-4 pb-4 text-xs text-muted-foreground">Saving your role…</p>}
                {updateMe.isSuccess && <p role="status" className="px-4 pb-4 text-xs text-muted-foreground">Your role has been updated.</p>}
                {updateMe.isError && <p role="alert" className="px-4 pb-4 text-xs text-destructive">Could not update your role. Please try again.</p>}
              </div>
            </section>

            <section className="space-y-4" aria-labelledby="profile-projects-heading">
              <div className="space-y-1">
                <h2 id="profile-projects-heading" className="text-sm font-medium">Your projects</h2>
                <p className="text-sm text-muted-foreground">Projects you belong to and your roles in each one.</p>
              </div>
              {projects.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading your projects…</p> : projects.isError ? (
                <div className="space-y-3">
                  <p role="alert" className="text-sm text-destructive">Could not load your projects.</p>
                  <Button variant="outline" size="sm" onClick={() => projects.refetch()}>Try again</Button>
                </div>
              ) : memberships.length === 0 ? (
                <p className="rounded-lg border p-4 text-sm text-muted-foreground">You haven't joined a project yet.</p>
              ) : (
                <div className="flex flex-col gap-[2px] rounded-lg border p-[2px]">
                  {memberships.map((project) => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-interaction-hover active:bg-interaction-selected focus-visible:outline-2 focus-visible:outline-ring">
                      <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">{project.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{project.key}</p>
                      </div>
                      <RoleBadges roles={project.myRoles} />
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Personalize your theme and manage tool connections.</p>
              <Button variant="outline" render={<Link to="/settings" />}><Settings aria-hidden="true" />Open settings</Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
