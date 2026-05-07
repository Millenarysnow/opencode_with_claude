import path from "path"
import { Schema } from "effect"
import { Effect, Option } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Ripgrep } from "../file/ripgrep"
import { assertExternalDirectoryEffect } from "./external-directory"
import DESCRIPTION from "./grep.txt"
import * as Tool from "./tool"

const MAX_LINE_LENGTH = 2000

/**
 * Output mode mirroring Claude's GrepTool:
 *   - "content": lines with matches (optionally with -A/-B/-C context)
 *   - "files_with_matches": one path per file that has any match (default)
 *   - "count": one path with match count per file
 */
export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "The regex pattern to search for in file contents" }),
  path: Schema.optional(Schema.String).annotate({
    description: "File or directory to search in (rg PATH). Defaults to current working directory.",
  }),
  include: Schema.optional(Schema.String).annotate({
    description: 'Glob pattern filter (e.g. "*.js", "*.{ts,tsx}") — matches file paths before searching.',
  }),
  type: Schema.optional(Schema.String).annotate({
    description:
      'File type filter by language (rg --type), e.g. "js", "py", "rust", "go". More efficient than glob for standard types.',
  }),
  output_mode: Schema.optional(
    Schema.Union([Schema.Literal("content"), Schema.Literal("files_with_matches"), Schema.Literal("count")]),
  ).annotate({
    description:
      'Output mode: "content" shows matching lines (with -A/-B/-C). "files_with_matches" shows only file paths (default). "count" shows match counts.',
  }),
  "-i": Schema.optional(Schema.Boolean).annotate({
    description: "Case insensitive search (rg -i).",
  }),
  "-n": Schema.optional(Schema.Boolean).annotate({
    description: 'Show line numbers (rg -n). Requires output_mode: "content". Default on.',
  }),
  "-A": Schema.optional(Schema.Number).annotate({
    description: 'Lines of context AFTER each match (rg -A). Requires output_mode: "content".',
  }),
  "-B": Schema.optional(Schema.Number).annotate({
    description: 'Lines of context BEFORE each match (rg -B). Requires output_mode: "content".',
  }),
  "-C": Schema.optional(Schema.Number).annotate({
    description: 'Lines of context around each match (rg -C). Requires output_mode: "content".',
  }),
  multiline: Schema.optional(Schema.Boolean).annotate({
    description:
      "Enable multiline mode: patterns can span lines, `.` matches newlines (rg -U --multiline-dotall). Use for matching struct/function bodies.",
  }),
  head_limit: Schema.optional(Schema.Number).annotate({
    description:
      "Limit output to first N results (files_with_matches/count: files; content: lines). Matches are pre-sorted by mtime desc.",
  }),
})

interface Params {
  pattern: string
  path?: string
  include?: string
  type?: string
  output_mode?: "content" | "files_with_matches" | "count"
  "-i"?: boolean
  "-n"?: boolean
  "-A"?: number
  "-B"?: number
  "-C"?: number
  multiline?: boolean
  head_limit?: number
}

export const GrepTool = Tool.define(
  "grep",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const rg = yield* Ripgrep.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Params, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const mode = params.output_mode ?? "content"
          const empty = {
            title: params.pattern,
            metadata: { matches: 0, truncated: false, mode },
            output: "No files found",
          }
          if (!params.pattern) {
            throw new Error("pattern is required")
          }

          yield* ctx.ask({
            permission: "grep",
            patterns: [params.pattern],
            always: ["*"],
            metadata: {
              pattern: params.pattern,
              path: params.path,
              include: params.include,
              type: params.type,
              output_mode: mode,
            },
          })

          const ins = yield* InstanceState.context
          const search = AppFileSystem.resolve(
            path.isAbsolute(params.path ?? ins.directory)
              ? (params.path ?? ins.directory)
              : path.join(ins.directory, params.path ?? "."),
          )
          const info = yield* fs.stat(search).pipe(Effect.catch(() => Effect.succeed(undefined)))
          const cwd = info?.type === "Directory" ? search : path.dirname(search)
          const file = info?.type === "Directory" ? undefined : [path.relative(cwd, search)]
          yield* assertExternalDirectoryEffect(ctx, search, {
            kind: info?.type === "Directory" ? "directory" : "file",
          })

          // Resolve context lines: -C overrides both -A and -B if set.
          let contextBefore = params["-B"]
          let contextAfter = params["-A"]
          if (params["-C"] !== undefined) {
            contextBefore = params["-C"]
            contextAfter = params["-C"]
          }
          // Context only meaningful in content mode.
          if (mode !== "content") {
            contextBefore = undefined
            contextAfter = undefined
          }

          const result = yield* rg.search({
            cwd,
            pattern: params.pattern,
            glob: params.include ? [params.include] : undefined,
            type: params.type,
            file,
            caseInsensitive: params["-i"],
            multiline: params.multiline,
            contextBefore,
            contextAfter,
            signal: ctx.abort,
          })
          if (result.items.length === 0) return empty

          const rows = result.items.map((item) => ({
            path: AppFileSystem.resolve(
              path.isAbsolute(item.path.text) ? item.path.text : path.join(cwd, item.path.text),
            ),
            line: item.line_number,
            text: item.lines.text,
          }))
          const times = new Map(
            (yield* Effect.forEach(
              [...new Set(rows.map((row) => row.path))],
              Effect.fnUntraced(function* (file) {
                const info = yield* fs.stat(file).pipe(Effect.catch(() => Effect.succeed(undefined)))
                if (!info || info.type === "Directory") return undefined
                return [
                  file,
                  info.mtime.pipe(
                    Option.map((time) => time.getTime()),
                    Option.getOrElse(() => 0),
                  ) ?? 0,
                ] as const
              }),
              { concurrency: 16 },
            )).filter((entry): entry is readonly [string, number] => Boolean(entry)),
          )
          const matches = rows.flatMap((row) => {
            const mtime = times.get(row.path)
            if (mtime === undefined) return []
            return [{ ...row, mtime }]
          })

          // Sort matches: newest file first, then by line number within file.
          matches.sort((a, b) => (b.mtime - a.mtime) || (a.line - b.line))

          // ---- files_with_matches mode ----
          if (mode === "files_with_matches") {
            const seen = new Set<string>()
            const files: string[] = []
            for (const m of matches) {
              if (seen.has(m.path)) continue
              seen.add(m.path)
              files.push(m.path)
            }
            const limit = params.head_limit ?? 100
            const truncated = files.length > limit
            const final = truncated ? files.slice(0, limit) : files
            const total = files.length
            const output: string[] = [
              `Found ${total} file${total === 1 ? "" : "s"}${truncated ? ` (showing first ${limit})` : ""}`,
              ...final,
            ]
            if (truncated) {
              output.push("")
              output.push(
                `(Results truncated: showing ${limit} of ${total} files. Use head_limit or refine pattern/include.)`,
              )
            }
            if (result.partial) {
              output.push("")
              output.push("(Some paths were inaccessible and skipped)")
            }
            return {
              title: params.pattern,
              metadata: { matches: matches.length, files: total, truncated, mode },
              output: output.join("\n"),
            }
          }

          // ---- count mode ----
          if (mode === "count") {
            const counts = new Map<string, number>()
            for (const m of matches) counts.set(m.path, (counts.get(m.path) ?? 0) + 1)
            const entries = [...counts.entries()]
            // Preserve mtime-desc ordering from matches
            const order = new Map<string, number>()
            let idx = 0
            for (const m of matches) if (!order.has(m.path)) order.set(m.path, idx++)
            entries.sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))

            const limit = params.head_limit ?? 100
            const truncated = entries.length > limit
            const final = truncated ? entries.slice(0, limit) : entries
            const totalFiles = entries.length
            const totalMatches = matches.length
            const output: string[] = [
              `Found ${totalMatches} match${totalMatches === 1 ? "" : "es"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}${truncated ? ` (showing first ${limit})` : ""}`,
              ...final.map(([file, count]) => `${count}\t${file}`),
            ]
            if (truncated) {
              output.push("")
              output.push(`(Results truncated: showing ${limit} of ${totalFiles} files.)`)
            }
            if (result.partial) {
              output.push("")
              output.push("(Some paths were inaccessible and skipped)")
            }
            return {
              title: params.pattern,
              metadata: { matches: totalMatches, files: totalFiles, truncated, mode },
              output: output.join("\n"),
            }
          }

          // ---- content mode ----
          // When context is requested, rely on entries (match+context order preserved).
          const showLineNumbers = params["-n"] !== false
          const wantContext =
            (contextBefore !== undefined && contextBefore > 0) ||
            (contextAfter !== undefined && contextAfter > 0)

          const limit = params.head_limit ?? 100

          if (wantContext && result.entries && result.entries.length > 0) {
            // Build per-file list from entries preserving original order.
            // Group consecutive entries by path. rg emits match+context interleaved.
            interface Row {
              path: string
              line: number
              text: string
              kind: "match" | "context"
            }
            const all: Row[] = result.entries.map((e) => ({
              path: AppFileSystem.resolve(
                path.isAbsolute(e.data.path.text) ? e.data.path.text : path.join(cwd, e.data.path.text),
              ),
              line: e.data.line_number,
              text: e.data.lines.text,
              kind: e.kind,
            }))
            // Sort files by mtime desc (stable within file preserves rg ordering).
            const fileOrder = new Map<string, number>()
            for (const m of matches) if (!fileOrder.has(m.path)) fileOrder.set(m.path, fileOrder.size)
            const byFile = new Map<string, Row[]>()
            for (const r of all) {
              const arr = byFile.get(r.path) ?? []
              arr.push(r)
              byFile.set(r.path, arr)
            }
            const filesSorted = [...byFile.keys()].sort(
              (a, b) => (fileOrder.get(a) ?? Infinity) - (fileOrder.get(b) ?? Infinity),
            )
            const output: string[] = []
            let emitted = 0
            let truncated = false
            outer: for (const file of filesSorted) {
              if (output.length > 0) output.push("")
              output.push(`${file}:`)
              const rows = byFile.get(file) ?? []
              let lastLine = -1
              for (const r of rows) {
                if (emitted >= limit) {
                  truncated = true
                  break outer
                }
                // Insert separator between non-contiguous blocks.
                if (lastLine !== -1 && r.line > lastLine + 1) output.push("--")
                const sep = r.kind === "match" ? ":" : "-"
                const text =
                  r.text.length > MAX_LINE_LENGTH ? r.text.substring(0, MAX_LINE_LENGTH) + "..." : r.text
                const trimmed = text.replace(/\r?\n$/, "")
                if (showLineNumbers) output.push(`  ${r.line}${sep}${trimmed}`)
                else output.push(`  ${trimmed}`)
                lastLine = r.line
                emitted++
              }
            }
            const totalMatches = matches.length
            output.unshift(
              `Found ${totalMatches} match${totalMatches === 1 ? "" : "es"}${truncated ? ` (truncated at ${limit} lines)` : ""}`,
            )
            if (truncated) {
              output.push("")
              output.push(`(Output truncated at ${limit} lines. Use head_limit or narrow the search.)`)
            }
            if (result.partial) {
              output.push("")
              output.push("(Some paths were inaccessible and skipped)")
            }
            return {
              title: params.pattern,
              metadata: { matches: totalMatches, truncated, mode },
              output: output.join("\n"),
            }
          }

          // content mode without context (original behaviour).
          const truncated = matches.length > limit
          const final = truncated ? matches.slice(0, limit) : matches
          if (final.length === 0) return empty

          const total = matches.length
          const output = [`Found ${total} match${total === 1 ? "" : "es"}${truncated ? ` (showing first ${limit})` : ""}`]

          let current = ""
          for (const match of final) {
            if (current !== match.path) {
              if (current !== "") output.push("")
              current = match.path
              output.push(`${match.path}:`)
            }
            const text =
              match.text.length > MAX_LINE_LENGTH ? match.text.substring(0, MAX_LINE_LENGTH) + "..." : match.text
            const trimmed = text.replace(/\r?\n$/, "")
            if (showLineNumbers) output.push(`  Line ${match.line}: ${trimmed}`)
            else output.push(`  ${trimmed}`)
          }

          if (truncated) {
            output.push("")
            output.push(
              `(Results truncated: showing ${limit} of ${total} matches (${total - limit} hidden). Consider using a more specific path or pattern.)`,
            )
          }

          if (result.partial) {
            output.push("")
            output.push("(Some paths were inaccessible and skipped)")
          }

          return {
            title: params.pattern,
            metadata: {
              matches: total,
              truncated,
              mode,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
