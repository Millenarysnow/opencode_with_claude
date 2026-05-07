import { describe, expect, test } from "bun:test"
import { __test } from "../../src/tool/todo"

const { needsVerificationNudge, NUDGE_TEXT } = __test

const todo = (content: string, status: string) => ({ content, status, priority: "medium" })

describe("todowrite verification nudge (claude-fusion)", () => {
  test("fires when 3+ todos are all completed and none mention verification", () => {
    expect(
      needsVerificationNudge([
        todo("refactor routing", "completed"),
        todo("add caching layer", "completed"),
        todo("update docs", "completed"),
      ]),
    ).toBe(true)
  })

  test("suppressed when one todo explicitly mentions verification", () => {
    expect(
      needsVerificationNudge([
        todo("refactor routing", "completed"),
        todo("add caching layer", "completed"),
        todo("verify end-to-end", "completed"),
      ]),
    ).toBe(false)
  })

  test("suppressed when one todo mentions tests", () => {
    // "\btest\b" — contentful match, not just substring
    expect(
      needsVerificationNudge([
        todo("refactor routing", "completed"),
        todo("add caching layer", "completed"),
        todo("write unit tests", "completed"),
      ]),
    ).toBe(false)
  })

  test("not fired when fewer than 3 todos", () => {
    expect(
      needsVerificationNudge([todo("fix typo", "completed"), todo("tweak spacing", "completed")]),
    ).toBe(false)
  })

  test("not fired when any todo is still pending/in_progress", () => {
    expect(
      needsVerificationNudge([
        todo("refactor routing", "completed"),
        todo("add caching layer", "in_progress"),
        todo("update docs", "pending"),
      ]),
    ).toBe(false)
  })

  test("not fired when todo is cancelled (cancelled != completed)", () => {
    expect(
      needsVerificationNudge([
        todo("refactor routing", "completed"),
        todo("add caching layer", "cancelled"),
        todo("update docs", "completed"),
      ]),
    ).toBe(false)
  })

  test("matches case-insensitive 'Verify', 'VERIFICATION', etc.", () => {
    expect(
      needsVerificationNudge([
        todo("do A", "completed"),
        todo("do B", "completed"),
        todo("VERIFICATION: run typecheck", "completed"),
      ]),
    ).toBe(false)
    expect(
      needsVerificationNudge([
        todo("do A", "completed"),
        todo("do B", "completed"),
        todo("Verify migration applied", "completed"),
      ]),
    ).toBe(false)
  })

  test("NUDGE_TEXT references the verify subagent", () => {
    expect(NUDGE_TEXT).toContain("subagent_type")
    expect(NUDGE_TEXT).toContain('"verify"')
    expect(NUDGE_TEXT).toContain("task(")
  })
})

describe("todowrite activeForm (claude-fusion)", () => {
  // These tests assert the parameters schema accepts activeForm and that the
  // field survives round-trip into the Todo.Info type. The full tool.execute
  // path is covered indirectly via the session-level integration tests.
  test("Parameters schema accepts activeForm", async () => {
    const { Parameters } = await import("../../src/tool/todo")
    const { Schema } = await import("effect")
    const decoded = Schema.decodeUnknownSync(Parameters)({
      todos: [
        {
          content: "Run the test suite",
          activeForm: "Running the test suite",
          status: "in_progress",
          priority: "high",
        },
      ],
    })
    expect(decoded.todos[0]).toMatchObject({
      content: "Run the test suite",
      activeForm: "Running the test suite",
    })
  })

  test("Parameters schema accepts todos WITHOUT activeForm (back-compat)", async () => {
    const { Parameters } = await import("../../src/tool/todo")
    const { Schema } = await import("effect")
    const decoded = Schema.decodeUnknownSync(Parameters)({
      todos: [
        {
          content: "Legacy task",
          status: "pending",
          priority: "medium",
        },
      ],
    })
    expect(decoded.todos[0].content).toBe("Legacy task")
    expect(decoded.todos[0].activeForm).toBeUndefined()
  })

  test("Todo.Info schema also accepts activeForm", async () => {
    const { Todo } = await import("../../src/session/todo")
    const { Schema } = await import("effect")
    const decoded = Schema.decodeUnknownSync(Todo.Info)({
      content: "Building",
      activeForm: "Building",
      status: "in_progress",
      priority: "high",
    })
    expect(decoded.activeForm).toBe("Building")
  })
})
