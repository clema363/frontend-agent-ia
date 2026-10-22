import { BookOpen, Ellipsis, PencilLine, PlusCircle, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { SectionHeader } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import type { Project } from '@/lib/domain'
import { useSkills } from '@/lib/skills'

// Skills are listed here; creating and editing one happens on its own page (skill-page.tsx).
export function ProjectSkills({ project }: { project: Project }) {
  const { skills, update, remove } = useSkills(project.id)
  const navigate = useNavigate()
  const skillsUrl = `/projects/${project.id}/skills`
  const enabledCount = skills.filter((skill) => skill.enabled).length

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Skills"
        count={skills.length ? enabledCount : undefined}
        actions={
          <Button size="sm" nativeButton={false} render={<Link to={`${skillsUrl}/new`} />}>
            <PlusCircle data-icon="inline-start" />
            New skill
          </Button>
        }
      >
        Reusable instructions the agents load when they work on this project's user stories.
      </SectionHeader>

      {skills.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
            <WandSparkles className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No skills yet</p>
            <p className="text-sm text-muted-foreground">Teach the agents your conventions once, reuse them on every story.</p>
          </div>
          <Button size="sm" nativeButton={false} render={<Link to={`${skillsUrl}/new`} />}>
            <PlusCircle data-icon="inline-start" />
            Create a skill
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {skills.map((skill) => (
            <li key={skill.id} className="relative flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                {skill.source === 'ai' ? (
                  <Sparkles className="size-3.5 text-muted-foreground" aria-label="Drafted with AI" />
                ) : (
                  <BookOpen className="size-3.5 text-muted-foreground" aria-label="Written manually" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                {/* The link covers the whole row; the switch and menu sit above it. */}
                <Link to={`${skillsUrl}/${skill.id}`} className="block truncate font-mono text-[13px] font-medium after:absolute after:inset-0">
                  {skill.name}
                </Link>
                <p className="line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
              </div>
              <div className="relative flex shrink-0 items-center gap-1">
                <Switch
                  checked={skill.enabled}
                  aria-label={`Enable ${skill.name}`}
                  onCheckedChange={(enabled) => update(skill.id, { enabled })}
                  className="mr-2"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${skill.name}`} />}>
                    <Ellipsis />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => navigate(`${skillsUrl}/${skill.id}`)}>
                      <PencilLine />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => remove(skill.id)}>
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
