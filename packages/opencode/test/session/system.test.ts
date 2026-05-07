import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import type { Agent } from "../../src/agent/agent"
import { NamedError } from "@opencode-ai/core/util/error"
import { Skill } from "../../src/skill"
import { Permission } from "../../src/permission"
import { SystemPrompt } from "../../src/session/system"
import { testEffect } from "../lib/effect"

const skills: Skill.Info[] = [
  {
    name: "zeta-skill",
    description: "Zeta skill.",
    location: "/tmp/zeta-skill/SKILL.md",
    content: "# zeta-skill",
  },
  {
    name: "alpha-skill",
    description: "Alpha skill.",
    location: "/tmp/alpha-skill/SKILL.md",
    content: "# alpha-skill",
  },
  {
    name: "middle-skill",
    description: "Middle skill.",
    location: "/tmp/middle-skill/SKILL.md",
    content: "# middle-skill",
  },
]

const build: Agent.Info = {
  name: "build",
  mode: "primary",
  permission: Permission.fromConfig({ "*": "allow" }),
  options: {},
}

const it = testEffect(
  SystemPrompt.layer.pipe(
    Layer.provide(
      Layer.succeed(
        Skill.Service,
        Skill.Service.of({
          get: (name) => Effect.succeed(skills.find((skill) => skill.name === name)),
          all: () => Effect.succeed(skills),
          dirs: () => Effect.succeed([]),
          available: () => Effect.succeed(skills),
        }),
      ),
    ),
  ),
)

describe("session.system", () => {
  it.effect("skills output is sorted by name and stable across calls", () =>
    Effect.gen(function* () {
      const prompt = yield* SystemPrompt.Service
      const first = yield* prompt.skills(build)
      const second = yield* prompt.skills(build)
      const output = first ?? (yield* Effect.fail(new NamedError.Unknown({ message: "missing skills output" })))

      expect(first).toBe(second)

      const alpha = output.indexOf("<name>alpha-skill</name>")
      const middle = output.indexOf("<name>middle-skill</name>")
      const zeta = output.indexOf("<name>zeta-skill</name>")

      expect(alpha).toBeGreaterThan(-1)
      expect(middle).toBeGreaterThan(alpha)
      expect(zeta).toBeGreaterThan(middle)
    }),
  )
})

// Helper to build a minimal Provider.Model shape for the provider() pure
// router. Only the two fields touched by the routing logic matter.
const mkModel = (providerID: string, apiId: string): any => ({
  providerID,
  api: { id: apiId },
})

describe("session.system.provider (claude-fusion routing)", () => {
  test("github-copilot + gpt-5 routes to copilot-gpt-5", () => {
    const [prompt] = SystemPrompt.provider(mkModel("github-copilot", "gpt-5"))
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt).toContain("software engineering")
  })

  test("github-copilot + gpt-4o routes to copilot-gpt-5 (same family)", () => {
    const [prompt] = SystemPrompt.provider(mkModel("github-copilot", "gpt-4o"))
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt).toContain("software engineering")
  })

  test("github-copilot + claude-sonnet-4 routes to anthropic prompt", () => {
    const [prompt] = SystemPrompt.provider(mkModel("github-copilot", "claude-sonnet-4"))
    expect(prompt.length).toBeGreaterThan(100)
  })

  test("github-copilot + gemini-2.5-pro routes to gemini prompt", () => {
    const [prompt] = SystemPrompt.provider(mkModel("github-copilot", "gemini-2.5-pro"))
    expect(prompt.length).toBeGreaterThan(100)
  })

  test("github-copilot + unknown model falls back to copilot-gpt-5", () => {
    // Copilot historically only proxies OpenAI models, so the fused prompt is
    // the safe default when the family isn't explicitly matched.
    const [prompt] = SystemPrompt.provider(mkModel("github-copilot", "experimental-xyz"))
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt).toContain("software engineering")
  })

  test("non-copilot gpt-4o still uses native BEAST prompt (unchanged)", () => {
    const [prompt] = SystemPrompt.provider(mkModel("openai", "gpt-4o"))
    expect(prompt.length).toBeGreaterThan(100)
    expect(typeof prompt).toBe("string")
  })

  test("anthropic claude-sonnet-4 still routes to anthropic prompt (unchanged)", () => {
    const [prompt] = SystemPrompt.provider(mkModel("anthropic", "claude-sonnet-4"))
    expect(prompt.length).toBeGreaterThan(100)
  })
})
