import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader, Send, ThumbsUp } from "@lucide/vue";
import { defineComponent, ref } from "vue";
type ApproveStoryDialogProps = {
  storyKey: string;
  stageLabel: string;
  isPlan: boolean;
  disabled: boolean;
  pending: boolean;
  onApprove: () => void;
};
export const ApproveStoryDialog = defineComponent(
  (__props: ApproveStoryDialogProps) => {
    const open = ref(false);
    const setOpen = (
      next:
        typeof open.value | ((current: typeof open.value) => typeof open.value),
    ) => {
      open.value =
        typeof next === "function"
          ? (next as (current: typeof open.value) => typeof open.value)(
              open.value,
            )
          : next;
    };

    const cancelRef = ref<HTMLButtonElement | null>(null);
    const confirming = ref(false);
    return () => {
      const { storyKey, stageLabel, isPlan, disabled, pending, onApprove } =
        __props;
      const label = isPlan ? "Approve & send to AI" : "Approve";
      function confirm() {
        if (disabled || pending || confirming.value) return;
        confirming.value = true;
        setOpen(false);
        onApprove();
      }
      return (
        <Dialog
          open={open.value}
          onUpdate:open={(value) => {
            if (value) confirming.value = false;
            setOpen(value);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" disabled={disabled || pending}>
              {pending ? (
                <Loader class="animate-spin" aria-hidden="true" />
              ) : isPlan ? (
                <Send aria-hidden="true" />
              ) : (
                <ThumbsUp aria-hidden="true" />
              )}
              {pending ? "Approving…" : label}
            </Button>
          </DialogTrigger>
          <DialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              const element = cancelRef.value;
              (
                (element as unknown as { $el?: HTMLButtonElement })?.$el ??
                element
              )?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {isPlan ? "Approve and send to AI?" : "Approve this document?"}
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to approve the {stageLabel.toLowerCase()}{" "}
                document for {storyKey}?
                {isPlan
                  ? " This will send the approved plan to the coding agent."
                  : " This will move the story to the next step."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button ref={cancelRef} variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={disabled || pending} onClick={confirm}>
                {label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };
  },
  {
    name: "ApproveStoryDialog",
    props: [
      "storyKey",
      "stageLabel",
      "isPlan",
      "disabled",
      "pending",
      "onApprove",
    ],
    inheritAttrs: false,
  },
);
