// Types échangés avec l'API et constantes du parcours (colonnes, étapes, rôles).

export type Role = 'PO' | 'BA' | 'Architect' | 'DEV' | 'QA'

export type Project = {
  id: string
  key: string
  name: string
  jiraProjectKey?: string
  confluenceSpaceKey?: string
  gitlabProjectPath?: string
  memberCount: number
  // Rôles (« hats ») de l'utilisateur connecté sur ce projet.
  myRoles: Role[]
  userStories: number
  completed: number
}

// Corps de PATCH /projects/{project_id} : null détache la source.
export type ProjectSources = {
  jiraConnectionId?: string | null
  jiraProjectKey?: string | null
  confluenceConnectionId?: string | null
  confluenceSpaceKey?: string | null
  gitlabConnectionId?: string | null
  gitlabProjectPath?: string | null
}

export type KanbanColumnId = 'to-author' | 'to-refine' | 'to-specify' | 'review-for-dev' | 'sent-to-ai'

export type StageId = 'authoring' | 'refinement' | 'specification' | 'plan'

export type IssueType = 'Story' | 'Epic' | 'Bug' | 'Task' | 'Spike'

export type Priority = 'Low' | 'Medium' | 'High'

export type SourceTool = 'Jira' | 'Confluence' | 'GitLab'

export type Source = {
  tool: SourceTool
  label: string
}

export type ChatMessage = {
  id: string
  author: 'user' | 'agent'
  role?: Role
  text: string
}

export type StageReview = {
  decision: 'approved' | 'rejected'
  by: Role
}

// Document Markdown produit par l'agent d'une étape, que l'humain valide, modifie ou commente.
export type StageOutput = {
  markdown: string
  sources: Source[]
  editedBy?: Role
  review?: StageReview
  chat: ChatMessage[]
}

export type CodingAgentStatus = 'queued' | 'working' | 'needs-input' | 'pr-opened' | 'merged' | 'failed'

// Étape publiée par l'IA de développement pendant sa session, comme les « agent activities » de Linear.
export type CodingAgentActivity = {
  id: string
  at: string
  kind: 'thought' | 'action' | 'question' | 'response' | 'error'
  text: string
  file?: string
}

export type CodingAgentRun = {
  agent: string
  status: CodingAgentStatus
  startedAt: string
  branch?: string
  pullRequest?: {
    number: number
    url: string
    additions: number
    deletions: number
    ci: 'pending' | 'passed' | 'failed'
  }
  activities: CodingAgentActivity[]
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
}

export type UserStory = {
  id: string
  key: string
  type: IssueType
  title: string
  priority: Priority
  projectId: string
  column: KanbanColumnId
  parentKey?: string
  // Besoin brut saisi à la création, avant tout travail d'agent.
  raw: string
  contextLinks: string[]
  // Une étape absente signifie que l'agent n'a pas encore produit son document.
  stages: Partial<Record<StageId, StageOutput>>
  // Valeurs des champs Jira saisies sur la US (PUT /us/{us_id}/fields).
  fields?: Record<string, unknown>
  // Session de l'IA de développement, une fois le plan validé et envoyé.
  codingAgent?: CodingAgentRun
  myRoles?: Role[]
}

// Corps de POST /us. Sans force, le backend répond 409 si le besoin ressemble à une US existante.
export type NewStoryRequest = {
  need: string
  project: string
  priority: Priority
  force?: boolean
  issueTypeId?: string
  issueTypeName?: string
}

export type AppUser = {
  id: string
  name: string
  email: string
  isAdmin: boolean
  isActive: boolean
}

// Utilisateur connecté : son rôle métier (PATCH /auth/me) s'applique immédiatement aux validations.
export type Me = AppUser & {
  role: Role
  preferences?: Record<string, unknown>
}

export type ProjectMember = {
  userId: string
  name: string
  email: string
  roles: Role[]
}

export type JiraField = {
  id: string
  label: string
  // Champ toujours envoyé à Jira : il ne peut pas être décoché.
  lockedHint?: string
}

export type JiraFieldGroup = {
  title: string
  fields: JiraField[]
}

// GET /projects/{project_id}/jira/field-config : sélection enregistrée + catalogue pour l'afficher.
export type FieldConfig = {
  enabledFields: string[]
  // Correspondance priorités cockpit → priorités du projet Jira.
  priorityMapping: Record<string, string>
  jiraPriorities: string[]
  catalogue: JiraFieldGroup[]
}

export type ContextMapKind = 'overview' | 'codebase' | 'jira' | 'confluence'

export type ContextMap = {
  kind: ContextMapKind
  label: string
  content: string
  validated: boolean
  // Rôles autorisés à valider cette carte.
  validatorRoles: Role[]
}

export type Connection = {
  id: string
  siteUrl: string
  displayName?: string
}

export type NewConnection = {
  siteUrl: string
  pat: string
  displayName?: string
}

export type JiraProject = {
  key: string
  name: string
}

export type ConfluencePage = {
  id: string
  title: string
  spaceKey: string
}

export type IssueTypeOption = {
  id: string
  name: string
}

export type SuggestKind = 'users' | 'groups' | 'versions' | 'components' | 'sprints' | 'issues'

export type ConfluenceSpace = {
  key: string
  name: string
}

export type GitlabProject = {
  id: number
  path: string
}

// URLs par défaut des outils.
export type Settings = {
  jiraUrl: string
  confluenceUrl: string
  gitlabUrl: string
}

export type Health = {
  status: string
  llmModel: string
  llmConfigured: boolean
}

// Indicateurs de prévention des doublons.
export type Stats = {
  flaggedNeeds: number
  createdDespiteWarnings: number
  totalUs: number
}

// Une ligne du journal : action d'une personne, ou passage d'un agent avec sa consommation.
export type JournalEntry = {
  id: string
  usId: string
  at: string
  actor: string
  actorType?: 'user' | 'agent'
  action: string
  stage?: StageId
  detail?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
}

export const journalActionLabels: Record<string, string> = {
  created: 'created',
  generated: 'generated a document for',
  edited: 'edited',
  approved: 'approved',
  refused: 'requested changes on',
  rejected: 'requested changes on',
  message: 'commented on',
  'pushed-to-jira': 'pushed to Jira',
}

export const roles: Role[] = ['PO', 'BA', 'Architect', 'DEV', 'QA']

export const issueTypes: IssueType[] = ['Story', 'Epic', 'Bug', 'Task', 'Spike']

export const priorities: Priority[] = ['Low', 'Medium', 'High']

// Colonnes neutres : chaque étape n'a qu'une couleur, portée par son icône d'état (voir ColumnIcon).
export const kanbanColumns: {
  id: KanbanColumnId
  title: string
  agent: string
  color: string
}[] = [
  { id: 'to-author', title: 'To author', agent: 'Authoring agent', color: 'oklch(0.62 0.01 260)' },
  { id: 'to-refine', title: 'To refine', agent: 'Refinement agent', color: 'oklch(0.75 0.16 70)' },
  { id: 'to-specify', title: 'To specify', agent: 'Spec agent', color: 'var(--primary)' },
  { id: 'review-for-dev', title: 'Review for dev', agent: 'Review agent', color: 'oklch(0.58 0.2 293)' },
  { id: 'sent-to-ai', title: 'Sent to AI', agent: 'Coding agent', color: 'oklch(0.63 0.16 150)' },
]

// Étapes du parcours : colonne associée, agent, et rôles autorisés à valider le document.
export const stages: {
  id: StageId
  label: string
  column: KanbanColumnId
  agent: string
  approvers: Role[]
}[] = [
  { id: 'authoring', label: 'Creation', column: 'to-author', agent: 'Authoring agent', approvers: ['PO', 'BA'] },
  { id: 'refinement', label: 'Refinement', column: 'to-refine', agent: 'Refinement agent', approvers: ['PO', 'BA'] },
  { id: 'specification', label: 'Spec', column: 'to-specify', agent: 'Spec agent', approvers: ['Architect', 'DEV'] },
  { id: 'plan', label: 'Plan', column: 'review-for-dev', agent: 'Review agent', approvers: ['DEV'] },
]

// Niveaux de priorité du cockpit, à faire correspondre aux priorités du projet Jira.
export const cockpitPriorities = ['Critical', 'High', 'Medium', 'Low'] as const
