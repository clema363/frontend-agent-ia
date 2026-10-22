import type { CSSProperties } from 'react'
import { MultiFileDiff } from '@pierre/diffs/react'
import { useEditorAppearance } from '@/hooks/use-editor-appearance'

export default function CodeDiff({
  path,
  before,
  after,
}: {
  path: string
  before: string
  after: string
}) {
  const appearance = useEditorAppearance()
  return (
    <div aria-label={`Changes in ${path}`} className="h-full overflow-auto">
      <MultiFileDiff
        oldFile={{ name: path, contents: before }}
        newFile={{ name: path, contents: after }}
        options={{
          theme: { light: 'pierre-light', dark: 'pierre-dark' },
          themeType: appearance,
          preferredHighlighter: 'shiki-wasm',
          diffStyle: 'unified',
          disableFileHeader: true,
          overflow: 'scroll',
        }}
        style={
          {
            '--diffs-font-size': '13px',
            '--diffs-line-height': '24px',
          } as CSSProperties
        }
      />
    </div>
  )
}
