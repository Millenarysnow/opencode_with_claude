// Bundled built-in skills that ship with opencode.
//
// Each skill is a separate `.txt` file in this directory written in the
// standard opencode SKILL.md format (frontmatter { name, description } + body).
// We import them as raw strings (the opencode build pipeline already treats
// `.txt` imports as file contents — see how tool prompts are imported) and
// register them at startup.
//
// This gives us Claude Code's "bundled skills" experience — slash commands
// like `/simplify`, `/verify`, `/commit`, `/debug`, `/skillify` are always
// available without the user having to install anything — while still using
// opencode's native SKILL.md format for per-skill instructions.
//
// To add a new bundled skill:
// 1. Create `<name>.txt` in this directory with `---` frontmatter + body
// 2. Import it here and add it to BUNDLED_SKILLS
//
// The skill name in the frontmatter MUST match the filename (without `.txt`).

import SIMPLIFY from "./simplify.txt"
import VERIFY from "./verify.txt"
import COMMIT from "./commit.txt"
import DEBUG from "./debug.txt"
import SKILLIFY from "./skillify.txt"

export type BundledSkill = {
  /** Stable identifier that becomes the slash command name. Matches the filename. */
  id: string
  /** Full SKILL.md content (frontmatter + body). Parsed at load time. */
  source: string
}

export const BUNDLED_SKILLS: BundledSkill[] = [
  { id: "simplify", source: SIMPLIFY },
  { id: "verify", source: VERIFY },
  { id: "commit", source: COMMIT },
  { id: "debug", source: DEBUG },
  { id: "skillify", source: SKILLIFY },
]
