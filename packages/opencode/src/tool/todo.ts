import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"

// Todo.Info is still a zod schema (session/todo.ts). Inline the field shape
// here rather than referencing its `.shape` — the LLM-visible JSON Schema is
// identical, and it removes the last zod dependency from this tool.
const TodoItem = Schema.Struct({
  content: Schema.String.annotate({ description: "Brief description of the task" }),
  status: Schema.String.annotate({
    description: "Current status of the task: pending, in_progress, completed, cancelled",
  }),
  priority: Schema.String.annotate({ description: "Priority level of the task: high, medium, low" }),
})

export const Parameters = Schema.Struct({
  todos: Schema.mutable(Schema.Array(TodoItem)).annotate({ description: "The updated todo list" }),
})

type Metadata = {
  todos: Todo.Info[]
  verificationNudge?: boolean
}

/**
 * Claude-fusion: verification nudge.
 *
 * Mirrors Claude Code's `verificationNudgeNeeded` flag in TodoWriteTool.ts.
 * Fires when the model closes out a non-trivial checklist without having
 * scheduled any verification. The reminder surfaces the opencode `verify`
 * subagent that the Phase 3 fusion registered; the model can invoke it via
 * `task({ description: "...", subagent_type: "verify", prompt: "..." })`.
 *
 * We do not treat `cancelled` as done — only explicit `completed`.
 */
function needsVerificationNudge(todos: readonly { status: string; content: string }[]): boolean {
  if (todos.length < 3) return false
  const allDone = todos.every((t) => t.status === "completed")
  if (!allDone) return false
  const hasVerificationStep = todos.some((t) => /\bverif/i.test(t.content) || /\btests?\b/i.test(t.content))
  return !hasVerificationStep
}

const NUDGE_TEXT =
  "\n\nNOTE: You just marked 3+ todos completed and none of them was a verification step. " +
  "Before summarising to the user, delegate a verification pass to the dedicated subagent: " +
  'call `task({ description: "verify <what>", subagent_type: "verify", prompt: "Verify that ... works end-to-end: <concrete checks>" })`. ' +
  "Listing caveats in your summary is not a substitute — only the verifier produces an evidence-backed verdict."

export const TodoWriteTool = Tool.define<typeof Parameters, Metadata, Todo.Service>(
  "todowrite",
  Effect.gen(function* () {
    const todo = yield* Todo.Service

    return {
      description: DESCRIPTION_WRITE,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "todowrite",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          yield* todo.update({
            sessionID: ctx.sessionID,
            todos: params.todos,
          })

          const nudge = needsVerificationNudge(params.todos)
          const body = JSON.stringify(params.todos, null, 2)

          return {
            title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
            output: nudge ? body + NUDGE_TEXT : body,
            metadata: {
              todos: params.todos,
              ...(nudge ? { verificationNudge: true } : {}),
            },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)

// Exported for unit tests.
export const __test = { needsVerificationNudge, NUDGE_TEXT }
