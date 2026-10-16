import { useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type PromptInputProps = {
  placeholder: string
  label: string
  // While the agent answers, the send button becomes a stop button.
  busy?: boolean
  disabled?: boolean
  onSubmit: (text: string) => void
  onStop?: () => void
  className?: string
}

// ChatGPT-like composer: Enter sends, Shift+Enter adds a line, the field grows with its content.
export function PromptInput({ placeholder, label, busy = false, disabled = false, onSubmit, onStop, className }: PromptInputProps) {
  const [text, setText] = useState('')

  function send() {
    const value = text.trim()
    if (!value || busy || disabled) return
    onSubmit(value)
    setText('')
  }

  return (
    <form
      className={cn('flex items-end gap-2 rounded-3xl border bg-background p-2 pl-4 shadow-lg transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30', className)}
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send()
          }
        }}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        className="max-h-48 min-h-9 resize-none rounded-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent"
        aria-label={label}
      />
      {busy && onStop ? (
        <Button type="button" size="icon" className="shrink-0 rounded-full" onClick={onStop} aria-label="Stop the agent">
          <Square className="fill-current" />
        </Button>
      ) : (
        <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={!text.trim() || busy || disabled} aria-label="Send message">
          <ArrowUp />
        </Button>
      )}
    </form>
  )
}
