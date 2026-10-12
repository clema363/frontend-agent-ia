import { kanbanColumns, stages, type KanbanColumnId, type Role, type UserStory } from '@/lib/domain'

export function stageForColumn(column: KanbanColumnId) {
  return stages.find((stage) => stage.column === column)
}

export function nextColumn(column: KanbanColumnId): KanbanColumnId {
  const index = kanbanColumns.findIndex((item) => item.id === column)
  return kanbanColumns[Math.min(index + 1, kanbanColumns.length - 1)].id
}

export type StoryStatus = 'agent-working' | 'to-review' | 'changes-requested' | 'sent-to-ai'

// Où en est une US dans son étape courante.
export function storyStatus(story: UserStory): StoryStatus {
  const stage = stageForColumn(story.column)
  if (!stage) return 'sent-to-ai'
  const output = story.stages[stage.id]
  if (!output) return 'agent-working'
  return output.review?.decision === 'rejected' ? 'changes-requested' : 'to-review'
}

// Le document de l'étape courante est prêt et ce rôle fait partie de ceux qui le valident.
export function canReview(story: UserStory, role: Role) {
  return storyStatus(story) === 'to-review' && Boolean(stageForColumn(story.column)?.approvers.includes(role))
}
