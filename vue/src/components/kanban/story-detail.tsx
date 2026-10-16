import { useJournal, useSettings } from "@/api/hooks";
import { ApproveStoryDialog } from "@/components/kanban/approve-story-dialog";
import {
  AgentAvatar,
  CodingAgentPanel,
} from "@/components/kanban/coding-agent";
import { IssueTypeIcon, PriorityIcon } from "@/components/kanban/issue-meta";
import { Markdown } from "@/components/markdown";
import { UserAvatar } from "@/components/projects/project-parts";
import { SourceList } from "@/components/source-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { diffLines } from "@/lib/diff";
import {
  stages,
  type Role,
  type StageId,
  type StageOutput,
  type UserStory,
} from "@/lib/domain";
import { stageForColumn } from "@/lib/story-workflow";
import { cn, timeAgo } from "@/lib/utils";
import {
  Bot,
  CircleCheck,
  ExternalLink,
  Loader,
  MessageSquareText,
  Pencil,
  Send,
} from "@lucide/vue";
import { defineComponent, ref, type Ref } from "vue";
// One tab per stage, plus the coding agent tab once the plan has been sent.
type Tab = StageId | "agent";
export type StoryActions = {
  // decide and messages always target the story's current stage.
  onApprove: (storyId: string) => void;
  // A comment returns the current stage document for revision (rejection in backend terms).
  onComment: (storyId: string, comment: string) => void;
  onEdit: (storyId: string, stageId: StageId, markdown: string) => void;
  onChat: (storyId: string, message: string) => void;
};
type StoryDetailProps = StoryActions & {
  story: UserStory;
  role: Role;
  approving?: boolean;
};
export const StoryDetail = defineComponent(
  (__props: StoryDetailProps) => {
    const { story } = __props;
    const currentStage = stageForColumn(story.column);
    const settingsState0 = useSettings();

    const sentToAi = story.column === "sent-to-ai";
    const tab = ref<Tab>(sentToAi ? "agent" : (currentStage?.id ?? "plan"));
    const setTab = (next: Tab | ((current: Tab) => Tab)) => {
      tab.value =
        typeof next === "function"
          ? (next as (current: typeof tab.value) => typeof tab.value)(tab.value)
          : next;
    };

    const editing = ref(false);
    const setEditing = (
      next:
        | typeof editing.value
        | ((current: typeof editing.value) => typeof editing.value),
    ) => {
      editing.value =
        typeof next === "function"
          ? (next as (current: typeof editing.value) => typeof editing.value)(
              editing.value,
            )
          : next;
    };
    const draft = ref("");
    const setDraft = (
      next:
        | typeof draft.value
        | ((current: typeof draft.value) => typeof draft.value),
    ) => {
      draft.value =
        typeof next === "function"
          ? (next as (current: typeof draft.value) => typeof draft.value)(
              draft.value,
            )
          : next;
    };
    const chatInputRef = ref<HTMLTextAreaElement | null>(null);
    const showChanges = ref(false);
    const setShowChanges = (
      next:
        | typeof showChanges.value
        | ((current: typeof showChanges.value) => typeof showChanges.value),
    ) => {
      showChanges.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof showChanges.value,
              ) => typeof showChanges.value
            )(showChanges.value)
          : next;
    };

    return () => {
      const { story, role, approving = false, ...actions } = __props;
      const currentStage = stageForColumn(story.column);
      const jiraUrl = settingsState0.data?.jiraUrl;
      const sentToAi = story.column === "sent-to-ai";
      const stageTab: StageId = tab.value === "agent" ? "plan" : tab.value;
      const stage = stages.find((item) => item.id === stageTab) ?? stages[0];
      const output = tab.value === "agent" ? undefined : story.stages[stageTab];
      const isCurrent = currentStage?.id === tab.value;
      const canValidate = stage.approvers.includes(role);
      const previousOutput =
        tab.value === "refinement" ? story.stages.authoring : undefined;
      function changeTab(value: Tab) {
        setTab(value);
        setEditing(false);
        setShowChanges(false);
      }
      function startEditing() {
        setDraft(output?.markdown ?? "");
        setEditing(true);
      }
      function saveEdit() {
        actions.onEdit(story.id, stageTab, draft.value);
        setEditing(false);
      }
      return (
        <div class="flex min-h-0 flex-col">
          <div class="flex flex-col gap-2 pb-6">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <IssueTypeIcon type={story.type} />
              <span>{story.type}</span>
              <span class="font-mono">{story.key}</span>
              <PriorityIcon priority={story.priority} />
              <div class="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`${jiraUrl}/browse/${story.key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink data-icon="inline-start" />
                    Open in Jira
                  </a>
                </Button>
              </div>
            </div>
            <h2 class="mt-3 text-3xl leading-snug font-semibold tracking-tight">
              {story.title}
            </h2>

            <Tabs
              modelValue={tab.value}
              onUpdate:modelValue={(value) => changeTab(value as Tab)}
              class="pt-2"
            >
              <TabsList class="w-full">
                {stages.map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    <StageStatusIcon
                      output={story.stages[item.id]}
                      isCurrent={currentStage?.id === item.id}
                    />
                    {item.label}
                  </TabsTrigger>
                ))}
                {sentToAi && (
                  <TabsTrigger value="agent">
                    <AgentAvatar className="size-4 [&_svg]:size-2.5" />
                    Coding agent
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>

          <div class="min-h-0 flex-1 space-y-6 pb-8">
            {tab.value === "authoring" && <RawInput story={story} />}

            {tab.value === "agent" ? (
              <CodingAgentPanel run={story.codingAgent} />
            ) : !output ? (
              <AgentWorking agent={stage.agent} isCurrent={isCurrent} />
            ) : (
              <>
                <section class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Bot class="size-3.5" aria-hidden="true" />
                      {stage.agent}
                      {output.editedBy && (
                        <span>· edited by {output.editedBy}</span>
                      )}
                    </h3>
                    {previousOutput && !editing.value && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setShowChanges((value) => !value)}
                      >
                        {showChanges.value ? "Show document" : "Show changes"}
                      </Button>
                    )}
                  </div>

                  {editing.value ? (
                    <div class="space-y-2">
                      <Textarea
                        modelValue={draft.value}
                        onInput={(event) =>
                          setDraft((event.target as HTMLInputElement).value)
                        }
                        class="min-h-80 font-mono text-xs"
                        aria-label="Document in Markdown"
                      />
                      <div class="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(false)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : showChanges.value && previousOutput ? (
                    <StoryDiff
                      before={previousOutput.markdown}
                      after={output.markdown}
                    />
                  ) : (
                    <div class="py-4">
                      <Markdown>{output.markdown}</Markdown>
                    </div>
                  )}
                </section>

                {output.sources.length > 0 && (
                  <section class="flex items-start gap-2 text-xs text-muted-foreground">
                    <span class="pt-0.5">Sources</span>
                    <SourceList sources={output.sources} />
                  </section>
                )}

                <Comments
                  story={story}
                  stageId={stageTab}
                  canComment={isCurrent && !editing.value}
                  onComment={(text) => actions.onComment(story.id, text)}
                />

                {output.chat.length > 0 && <ChatThread output={output} />}
              </>
            )}
          </div>

          {output && (
            <footer class="space-y-3 border-t bg-background py-5">
              <ReviewBar
                key={stageTab}
                storyKey={story.key}
                stageLabel={stage.label}
                approving={approving}
                output={output}
                isCurrent={isCurrent}
                canValidate={canValidate}
                approvers={stage.approvers}
                isPlan={tab.value === "plan"}
                editing={editing.value}
                onApprove={() => actions.onApprove(story.id)}
                onEdit={startEditing}
              />
              {isCurrent && (
                <ChatInput
                  inputRef={chatInputRef}
                  agent={stage.agent}
                  onSend={(text) => actions.onChat(story.id, text)}
                />
              )}
            </footer>
          )}
        </div>
      );
    };
  },
  {
    name: "StoryDetail",
    props: [
      "onApprove",
      "onComment",
      "onEdit",
      "onChat",
      "story",
      "role",
      "approving",
    ],
    inheritAttrs: false,
  },
);
const StageStatusIcon = defineComponent(
  (__props: { output?: StageOutput; isCurrent: boolean }) => {
    return () => {
      const { output, isCurrent } = __props;
      if (output?.review?.decision === "approved") {
        return (
          <CircleCheck
            class="text-green-600 dark:text-green-400"
            aria-label="Approved"
          />
        );
      }
      if (output?.review?.decision === "rejected") {
        return (
          <MessageSquareText
            class="text-amber-600 dark:text-amber-400"
            aria-label="Changes requested"
          />
        );
      }
      if (isCurrent) {
        return (
          <span
            class="size-2 rounded-full bg-primary"
            aria-label="Current step"
          />
        );
      }
      return null;
    };
  },
  {
    name: "StageStatusIcon",
    props: ["output", "isCurrent"],
    inheritAttrs: false,
  },
);
const RawInput = defineComponent(
  (__props: { story: UserStory }) => {
    return () => {
      const { story } = __props;
      return (
        <section class="space-y-2 rounded-lg bg-muted/50 p-3">
          <h3 class="text-xs font-medium text-muted-foreground">Raw input</h3>
          <p class="whitespace-pre-line">{story.raw}</p>
          {story.contextLinks.length > 0 && (
            <ul class="space-y-1 text-xs">
              {story.contextLinks.map((link) => (
                <li key={link}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    class="break-all text-primary underline"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    };
  },
  { name: "RawInput", props: ["story"], inheritAttrs: false },
);
const AgentWorking = defineComponent(
  (__props: { agent: string; isCurrent: boolean }) => {
    return () => {
      const { agent, isCurrent } = __props;
      return (
        <p class="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
          {isCurrent ? (
            <>
              <Loader class="size-4 animate-spin" aria-hidden="true" />
              {agent} is working on this step…
            </>
          ) : (
            "The story has not reached this step yet."
          )}
        </p>
      );
    };
  },
  { name: "AgentWorking", props: ["agent", "isCurrent"], inheritAttrs: false },
);
type ReviewBarProps = {
  storyKey: string;
  stageLabel: string;
  approving: boolean;
  output: StageOutput;
  isCurrent: boolean;
  canValidate: boolean;
  approvers: Role[];
  isPlan: boolean;
  editing: boolean;
  onApprove: () => void;
  onEdit: () => void;
};
const ReviewBar = defineComponent(
  (__props: ReviewBarProps) => {
    return () => {
      const {
        storyKey,
        stageLabel,
        approving,
        output,
        isCurrent,
        canValidate,
        approvers,
        isPlan,
        editing,
        onApprove,
        onEdit,
      } = __props;
      const review = output.review;
      if (!isCurrent) {
        return (
          <p class="text-xs text-muted-foreground">
            {review
              ? `${review.decision === "approved" ? "Approved" : "Changes requested"} by ${review.by}`
              : "Not validated"}
          </p>
        );
      }
      return (
        <div class="flex flex-wrap items-center gap-2">
          <p class="mr-auto text-xs text-muted-foreground">
            {review?.decision === "rejected" ? (
              <span class="text-amber-700 dark:text-amber-400">
                Changes requested by {review.by}: update the document or ask the
                agent.
              </span>
            ) : canValidate ? (
              `Validation by ${approvers.join(" or ")}`
            ) : (
              `Only ${approvers.join(" or ")} can validate this step.`
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={!canValidate || editing || approving}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <ApproveStoryDialog
            storyKey={storyKey}
            stageLabel={stageLabel}
            isPlan={isPlan}
            disabled={!canValidate || editing}
            pending={approving}
            onApprove={onApprove}
          />
        </div>
      );
    };
  },
  {
    name: "ReviewBar",
    props: [
      "storyKey",
      "stageLabel",
      "approving",
      "output",
      "isCurrent",
      "canValidate",
      "approvers",
      "isPlan",
      "editing",
      "onApprove",
      "onEdit",
    ],
    inheritAttrs: false,
  },
);
// Human comments on a stage document, read from the story's journal.
// Commenting returns the document for revision, either manually or through the agent chat.
type CommentsProps = {
  story: UserStory;
  stageId: StageId;
  canComment: boolean;
  onComment: (text: string) => void;
};
const Comments = defineComponent(
  (__props: CommentsProps) => {
    const { story } = __props;
    const journalState1 = useJournal(() => story.id);
    return () => {
      const { story, stageId, canComment, onComment } = __props;
      const { data: journal = [] } = journalState1;
      const comments = journal
        .filter(
          (entry) =>
            entry.usId === story.id && entry.stage === stageId && entry.detail,
        )
        .filter(
          (entry) => entry.action === "refused" || entry.action === "rejected",
        )
        .sort((a, b) => a.at.localeCompare(b.at));
      if (!comments.length && !canComment) return null;
      return (
        <section class="space-y-3">
          <h3 class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquareText class="size-3.5" aria-hidden="true" />
            Comments
            {comments.length > 0 && (
              <span class="tabular-nums">{comments.length}</span>
            )}
          </h3>
          {comments.length > 0 && (
            <ul class="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} class="flex gap-3">
                  <UserAvatar
                    name={comment.actor}
                    className="size-7 text-[10px]"
                  />
                  <div class="min-w-0 flex-1 rounded-lg border px-3 py-2">
                    <p class="flex items-baseline gap-2 text-xs">
                      <span class="font-medium">{comment.actor}</span>
                      <time datetime={comment.at} class="text-muted-foreground">
                        {timeAgo(comment.at)}
                      </time>
                    </p>
                    <p class="mt-1 whitespace-pre-line">{comment.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canComment && <CommentInput onSend={onComment} />}
        </section>
      );
    };
  },
  {
    name: "Comments",
    props: ["story", "stageId", "canComment", "onComment"],
    inheritAttrs: false,
  },
);
const CommentInput = defineComponent(
  (__props: { onSend: (text: string) => void }) => {
    const text = ref("");
    const setText = (
      next:
        typeof text.value | ((current: typeof text.value) => typeof text.value),
    ) => {
      text.value =
        typeof next === "function"
          ? (next as (current: typeof text.value) => typeof text.value)(
              text.value,
            )
          : next;
    };
    return () => {
      const { onSend } = __props;
      function send() {
        const value = text.value.trim();
        if (!value) return;
        onSend(value);
        setText("");
      }
      return (
        <form
          class="rounded-lg border focus-within:ring-2 focus-within:ring-ring/50"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <Textarea
            modelValue={text.value}
            onInput={(event) =>
              setText((event.target as HTMLInputElement).value)
            }
            onKeydown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Leave a comment: what should change in this document?"
            class="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
            aria-label="Comment"
          />
          <div class="flex items-center justify-between gap-2 px-3 pb-2">
            <p class="text-xs text-muted-foreground">
              Sends the document back for changes.
            </p>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!text.value.trim()}
            >
              Comment
            </Button>
          </div>
        </form>
      );
    };
  },
  { name: "CommentInput", props: ["onSend"], inheritAttrs: false },
);
const ChatThread = defineComponent(
  (__props: { output: StageOutput }) => {
    return () => {
      const { output } = __props;
      return (
        <section class="space-y-2">
          <h3 class="text-xs font-medium text-muted-foreground">
            Discussion with the agent
          </h3>
          <ul class="space-y-2">
            {output.chat.map((message) => (
              <li
                key={message.id}
                class={cn(
                  "max-w-[85%] rounded-lg px-3 py-2",
                  message.author === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                <p class="mb-0.5 text-xs opacity-70">
                  {message.author === "user" ? message.role : "Agent"}
                </p>
                {message.text}
              </li>
            ))}
          </ul>
        </section>
      );
    };
  },
  { name: "ChatThread", props: ["output"], inheritAttrs: false },
);
type ChatInputProps = {
  inputRef: Ref<HTMLTextAreaElement | null>;
  agent: string;
  onSend: (text: string) => void;
};
const ChatInput = defineComponent(
  (__props: ChatInputProps) => {
    const text = ref("");
    const setText = (
      next:
        typeof text.value | ((current: typeof text.value) => typeof text.value),
    ) => {
      text.value =
        typeof next === "function"
          ? (next as (current: typeof text.value) => typeof text.value)(
              text.value,
            )
          : next;
    };
    return () => {
      const { inputRef, agent, onSend } = __props;
      function send() {
        const value = text.value.trim();
        if (!value) return;
        onSend(value);
        setText("");
      }
      return (
        <form
          class="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <Textarea
            ref={inputRef}
            modelValue={text.value}
            onInput={(event) =>
              setText((event.target as HTMLInputElement).value)
            }
            onKeydown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={`Ask the ${agent} to change something…`}
            class="max-h-40 min-h-10"
            aria-label={`Message to the ${agent}`}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.value.trim()}
            aria-label="Send message"
          >
            <Send />
          </Button>
        </form>
      );
    };
  },
  {
    name: "ChatInput",
    props: ["inputRef", "agent", "onSend"],
    inheritAttrs: false,
  },
);
const StoryDiff = defineComponent(
  (__props: { before: string; after: string }) => {
    return () => {
      const { before, after } = __props;
      const lines = diffLines(before, after);
      return (
        <div class="overflow-hidden rounded-lg border font-mono text-xs">
          {lines.map((line, index) => (
            <div
              key={index}
              class={cn(
                "flex gap-2 px-3 py-0.5 whitespace-pre-wrap",
                line.type === "added" &&
                  "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200",
                line.type === "removed" &&
                  "bg-red-50 text-red-900 line-through decoration-red-400/60 dark:bg-red-950/40 dark:text-red-200",
              )}
            >
              <span
                class="w-3 shrink-0 select-none opacity-60"
                aria-hidden="true"
              >
                {line.type === "added"
                  ? "+"
                  : line.type === "removed"
                    ? "−"
                    : ""}
              </span>
              <span class="min-w-0">{line.text || " "}</span>
            </div>
          ))}
        </div>
      );
    };
  },
  { name: "StoryDiff", props: ["before", "after"], inheritAttrs: false },
);
