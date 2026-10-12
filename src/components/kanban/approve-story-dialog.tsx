import { useRef, useState } from 'react'
import { Loader, Send, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type ApproveStoryDialogProps = {
  storyKey: string
  stageLabel: string
  isPlan: boolean
  disabled: boolean
  pending: boolean
  onApprove: () => void
}

export function ApproveStoryDialog({ storyKey, stageLabel, isPlan, disabled, pending, onApprove }: ApproveStoryDialogProps) {
  const [open, setOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirming = useRef(false)
  const label = isPlan ? 'Approve & send to AI' : 'Approve'

  function confirm() {
    if (disabled || pending || confirming.current) return
    confirming.current = true
    setOpen(false)
    onApprove()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (value) confirming.current = false
      setOpen(value)
    }}>
      <DialogTrigger render={<Button size="sm" disabled={disabled || pending} />}>
        {pending ? <Loader className="animate-spin" aria-hidden="true" /> : isPlan ? <Send aria-hidden="true" /> : <ThumbsUp aria-hidden="true" />}
        {pending ? 'Approving…' : label}
      </DialogTrigger>
      <DialogContent initialFocus={cancelRef}>
        <DialogHeader>
          <DialogTitle>{isPlan ? 'Approve and send to AI?' : 'Approve this document?'}</DialogTitle>
          <DialogDescription>
            Are you sure you want to approve the {stageLabel.toLowerCase()} document for {storyKey}?
            {isPlan
              ? ' This will send the approved plan to the coding agent.'
              : ' This will move the story to the next step.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button ref={cancelRef} variant="outline" />}>Cancel</DialogClose>
          <Button disabled={disabled || pending} onClick={confirm}>{label}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
