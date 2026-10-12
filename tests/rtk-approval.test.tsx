import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApproveStoryDialog } from '../src/components/kanban/approve-story-dialog'

let root: Root
let container: HTMLDivElement
const approve = vi.fn()

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  approve.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function button(parent: ParentNode, label: string) {
  const found = [...parent.querySelectorAll('button')].find((node) => node.textContent === label)
  if (!found) throw new Error(`Missing button: ${label}`)
  return found
}

it('only approves after confirmation, and cancel leaves the story untouched', async () => {
  await act(async () => root.render(<ApproveStoryDialog storyKey="US-42" stageLabel="Refinement" isPlan={false} disabled={false} pending={false} onApprove={approve} />))
  await act(async () => button(container, 'Approve').click())
  expect(approve).not.toHaveBeenCalled()
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.textContent).toContain('US-42')
  expect(dialog.textContent).toContain('next step')
  await act(async () => button(dialog, 'Cancel').click())
  expect(approve).not.toHaveBeenCalled()
  await act(async () => button(container, 'Approve').click())
  await act(async () => button(document.querySelector('[role="dialog"]')!, 'Approve').click())
  expect(approve).toHaveBeenCalledTimes(1)
})

it('explains sending to the coding agent before approving a plan', async () => {
  await act(async () => root.render(<ApproveStoryDialog storyKey="US-42" stageLabel="Plan" isPlan disabled={false} pending={false} onApprove={approve} />))
  await act(async () => button(container, 'Approve & send to AI').click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('send the approved plan to the coding agent')
  expect(approve).not.toHaveBeenCalled()
})

it('blocks approval when a request is already pending or validation is unavailable', async () => {
  await act(async () => root.render(<ApproveStoryDialog storyKey="US-42" stageLabel="Plan" isPlan disabled={false} pending onApprove={approve} />))
  expect(button(container, 'Approving…').disabled).toBe(true)
  await act(async () => button(container, 'Approving…').click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(approve).not.toHaveBeenCalled()
  await act(async () => root.render(<ApproveStoryDialog storyKey="US-42" stageLabel="Plan" isPlan disabled pending={false} onApprove={approve} />))
  expect(button(container, 'Approve & send to AI').disabled).toBe(true)
})
