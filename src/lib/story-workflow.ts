import { kanbanColumns, stages, type KanbanColumnId, type Role, type UserStory } from '@/lib/domain'

export function stageForColumn(column: KanbanColumnId) {
  return stages.find((stage) => stage.column === column)
}

export function nextColumn(column: KanbanColumnId): KanbanColumnId {
  const index = kanbanColumns.findIndex((item) => item.id === column)
  return kanbanColumns[Math.min(index + 1, kanbanColumns.length - 1)].id
}

export type StoryStatus = 'needs-input' | 'agent-working' | 'to-review' | 'changes-requested' | 'sent-to-ai'

// Story status within its current stage.
export function storyStatus(story: UserStory): StoryStatus {
  const stage = stageForColumn(story.column)
  if (!stage) return 'sent-to-ai'
  const output = story.stages[stage.id]
  if (!output) return awaitingAnswers(story) ? 'needs-input' : 'agent-working'
  return output.review?.decision === 'rejected' ? 'changes-requested' : 'to-review'
}

// The current stage agent waits for answers to its questions before writing.
export function awaitingAnswers(story: UserStory) {
  const clarification = story.clarification
  return Boolean(clarification && !clarification.answers && clarification.stage === stageForColumn(story.column)?.id)
}

// The current stage document is ready and this role is allowed to approve it.
export function canReview(story: UserStory, role: Role) {
  return storyStatus(story) === 'to-review' && Boolean(stageForColumn(story.column)?.approvers.includes(role))
}
