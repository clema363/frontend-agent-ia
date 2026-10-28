import type { FormEvent } from 'react'
import { ArrowRight, Bot, CornerDownLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire'
import type { AgentAnswers, AgentQuestion } from '@/lib/domain'

type QuestionPromptProps = {
  // Who asks, e.g. "Authoring agent".
  agent: string
  questions: AgentQuestion[]
  pending?: boolean
  onSubmit: (answers: AgentAnswers) => void
  // Lets the agent go on without any answer.
  onSkipAll: () => void
}

const itemName = (index: number) => `q${index}`

// A stage agent's questions, docked above the composer like ChatGPT's: one compact question
// at a time, built on shadcn's Questionnaire (number shortcuts, Enter, skip, free answer).
export function QuestionPrompt({ agent, questions, pending = false, onSubmit, onSkipAll }: QuestionPromptProps) {
  const items = questions.map((question, index) => ({ name: itemName(index), disabled: pending, choices: question.options.map((option) => ({ value: option.label })) }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    // Chosen labels and the typed answer share the item's name; a skipped question is empty.
    onSubmit(questions.map((_, index) => data.getAll(itemName(index)).map((value) => String(value).trim()).filter(Boolean)))
  }

  return (
    <Questionnaire
      items={items}
      defaultItem={itemName(0)}
      shortcuts="numbers"
      onSubmit={submit}
      aria-label={`${agent} questions`}
      className="animate-in fade-in slide-in-from-bottom-2 gap-3 rounded-3xl border bg-background p-3 shadow-lg duration-300 dark:bg-card"
    >
      <header className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Bot className="size-3.5 text-primary" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground">{agent}</span> needs a bit more context
        </span>
        <QuestionnaireProgress
          className="ml-auto w-auto min-w-0"
          render={(props, state) => (
            <span {...props}>
              {state.current} of {state.total}
            </span>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="rounded-full"
          onClick={onSkipAll}
          disabled={pending}
          aria-label="Skip all questions"
          title="Skip all: the agent drafts from the raw input only"
        >
          <X />
        </Button>
      </header>

      {questions.map((question, index) => (
        <QuestionnaireItem
          key={itemName(index)}
          name={itemName(index)}
          multiple={question.multiple}
          disabled={pending}
          className="animate-in fade-in slide-in-from-right-2 gap-2 duration-200"
        >
          <QuestionnaireTitle className="mb-0! px-1 text-sm">{question.question}</QuestionnaireTitle>
          <QuestionnaireChoices className="grid-cols-[minmax(0,1fr)] gap-1">
            {question.options.map((option) => (
              <QuestionnaireChoice
                key={option.label}
                value={option.label}
                className="min-h-0 items-center border-transparent bg-muted/40 py-2 hover:bg-muted data-checked:border-primary/30 data-checked:bg-primary/10 dark:bg-muted/30"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-medium">{option.label}</span>
                  {option.description && <QuestionnaireChoiceDescription className="truncate text-xs">{option.description}</QuestionnaireChoiceDescription>}
                </span>
              </QuestionnaireChoice>
            ))}
            {question.custom !== false && (
              <QuestionnaireInput aria-label="Your own answer" placeholder="Something else? Type your answer…" className="min-h-0 border-dashed bg-transparent" />
            )}
          </QuestionnaireChoices>
        </QuestionnaireItem>
      ))}

      <QuestionnaireActions className="sm:min-h-0">
        <QuestionnairePrevious variant="ghost" size="sm" />
        <QuestionnaireSkip variant="ghost" size="sm" className="text-muted-foreground" />
        <QuestionnaireNext size="sm" className="rounded-full">
          Next <ArrowRight />
        </QuestionnaireNext>
        <QuestionnaireSubmit size="sm" className="rounded-full" disabled={pending}>
          {pending ? 'Sending…' : 'Send answers'} <CornerDownLeft />
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  )
}
