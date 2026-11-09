import { useEffect, useMemo } from 'react'
import { createStateStore, JSONUIProvider, Renderer } from '@json-render/react'
import type { Spec } from '@json-render/core'
import { insightsRegistry } from '@/components/generative-ui/registry'

// Renders an AI-generated json-render spec with the insights components.
// The spec can still be streaming: its `state` grows patch by patch and is pushed
// into one store per message, so charts update in place instead of remounting.
export function GenerativeUI({ spec, loading }: { spec: Spec | null; loading?: boolean }) {
  const store = useMemo(() => createStateStore({}), [])
  useEffect(() => {
    for (const [key, value] of Object.entries(spec?.state ?? {})) {
      if (store.get(`/${key}`) !== value) store.set(`/${key}`, value)
    }
  }, [spec?.state, store])

  if (!spec?.root) return null
  return (
    <JSONUIProvider registry={insightsRegistry} store={store}>
      <Renderer spec={spec} registry={insightsRegistry} loading={loading} />
    </JSONUIProvider>
  )
}
