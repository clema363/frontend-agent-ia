import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { EditProvider, File } from '@pierre/diffs/react'
import {
  Editor,
  type EditorFactory,
  type EditorOptions,
} from '@pierre/diffs/edit'
import { useEditorAppearance } from '@/hooks/use-editor-appearance'

const createEditor: EditorFactory<undefined, undefined> = (
  type,
  options,
  stateKey,
) => new Editor(type, options, stateKey)

export default function CodeEditor({
  path,
  value,
  stateKey,
  onChange,
  onCursor,
}: {
  path: string
  value: string
  stateKey: string
  onChange: (value: string) => void
  onCursor: (line: number, column: number) => void
}) {
  const appearance = useEditorAppearance()
  // Pierre owns the live document. Feeding each keystroke back into `file`
  // would replace the edit session. External resets remount this component.
  const [file] = useState(() => ({ name: path, contents: value }))
  const editorRef = useRef<Editor<'file', undefined, undefined> | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const editorOptions = useMemo<EditorOptions<'file', undefined, undefined>>(
    () => ({
      onAttach(editor) {
        editorRef.current = editor
        surfaceRef.current
          ?.querySelector('diffs-container')
          ?.shadowRoot?.querySelector('[role="textbox"]')
          ?.setAttribute('aria-label', `Edit ${path}`)
      },
    }),
    [path],
  )

  function reportCursor() {
    const selection = editorRef.current?.getViewState().selections?.[0]
    const position =
      selection?.direction === -1 ? selection.start : selection?.end
    if (position) onCursor(position.line + 1, position.character + 1)
  }

  return (
    <EditProvider createEditor={createEditor}>
      <div
        ref={surfaceRef}
        aria-label={`Editor for ${path}`}
        className="h-full min-h-0 overflow-auto"
        onKeyUp={reportCursor}
        onPointerUp={reportCursor}
      >
        <File
          file={file}
          edit
          editStateKey={stateKey}
          editorOptions={editorOptions}
          options={{
            theme: { light: 'pierre-light', dark: 'pierre-dark' },
            themeType: appearance,
            preferredHighlighter: 'shiki-wasm',
            disableFileHeader: true,
            overflow: 'scroll',
          }}
          style={
            {
              '--diffs-font-size': '13px',
              '--diffs-line-height': '24px',
              '--diffs-font-family':
                'ui-monospace, SFMono-Regular, Menlo, monospace',
            } as CSSProperties
          }
          onEditChange={(event) => {
            onChange(event.file.contents)
            reportCursor()
          }}
          onEditComplete={() => 'accept'}
        />
      </div>
    </EditProvider>
  )
}
