import { Route, Routes } from 'react-router'
import { AppLayout, ScrollableContent } from '@/components/layout/app-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { JournalPage } from '@/pages/journal-page'
import { KanbanPage } from '@/pages/kanban-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { ProjectPage } from '@/pages/project-page'
import { ProjectsPage } from '@/pages/projects-page'
import { StoryPage } from '@/pages/story-page'
import { SettingsPage } from '@/pages/settings-page'
import { LoginPage } from '@/pages/login-page'
import { ProfilePage } from '@/pages/profile-page'
import { EditorPage } from '@/pages/editor-page'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route element={<ScrollableContent />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/:tab?" element={<ProjectPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/kanban/:storyId" element={<StoryPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/editor" element={<EditorPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
