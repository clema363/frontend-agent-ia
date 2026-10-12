import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import App from '../src/App'
import { ThemeProvider } from '../src/lib/theme'
import { createAppStore } from '../src/lib/store'
import { atlasApi } from '../src/api/rtk-api'

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) })
})

it('boots the complete application with Redux and displays the dashboard', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const store = createAppStore()
  try {
    await act(async () => {
      root.render(<StrictMode><Provider store={store}><ThemeProvider><MemoryRouter><App /></MemoryRouter></ThemeProvider></Provider></StrictMode>)
    })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    expect(container.querySelector('h1')?.textContent).toBe('Dashboard')
    expect(container.textContent).toContain('Waiting for you')
    expect(container.textContent).toContain('Duplicate prevention')
    expect(container.textContent).toContain('Signed in: Admin (demo)')
  } finally {
    await act(async () => root.unmount())
    store.dispatch(atlasApi.util.resetApiState())
    container.remove()
    vi.unstubAllGlobals()
  }
})
