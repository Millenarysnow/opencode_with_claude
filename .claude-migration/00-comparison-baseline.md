# opencode × Claude Code v2.1.88 对比基线 (Phase 0)

> 本文档是工具链/prompt 融合项目的第一阶段产出,建立所有关键文件的对比档案。
> 所有 Claude Code 源来自 `E:\Others\claude-code-source-code` (反编译 npm tarball)。
> 所有 opencode 源位于 `packages/opencode/src/`,基于 `claude` 分支。

## 1. 工具列表对比

### opencode 现有工具 (15 个,`packages/opencode/src/tool/`)

| opencode 工具 | 实现文件 | prompt 文件 | 字节 |
|---|---|---|---|
| shell | shell.ts (20.2KB) | shell/prompt.ts | - |
| read | read.ts (11.3KB) | read.txt | 1.1KB |
| write | write.ts (3.9KB) | write.txt | 631B |
| edit | edit.ts (23.4KB) | edit.txt | 1.3KB |
| glob | glob.ts (3.7KB) | glob.txt | 551B |
| grep | grep.ts (5.5KB) | grep.txt | 697B |
| todowrite | todo.ts (1.9KB) | todowrite.txt | 8.8KB |
| task | task.ts (6.6KB) | task.txt | 3.7KB |
| skill | skill.ts (2.6KB) | skill.txt | 404B |
| webfetch | webfetch.ts (7.2KB) | webfetch.txt | 763B |
| websearch | websearch.ts (2.6KB) | websearch.txt | 990B |
| question | question.ts (1.5KB) | question.txt | 667B |
| plan_exit | plan.ts (3KB) | plan-exit.txt | 592B |
| plan_enter | plan.ts (同上) | plan-enter.txt | 627B |
| lsp | lsp.ts (4.4KB) | lsp.txt | 1.3KB |
| apply_patch | apply_patch.ts (10.9KB) | apply_patch.txt | 1.1KB |
| invalid | invalid.ts (0.5KB) | - | - |
| mcp-exa | mcp-exa.ts (2.2KB) | - | - |

### Claude Code 工具 (43 个,`src/tools/`)

| Claude Code 工具 | prompt 文件 | 字节 | 对应 opencode | 缺失/差距 |
|---|---|---|---|---|
| **BashTool** | prompt.ts | **21KB** | shell | ⚠️ opencode 简短得多 |
| **FileReadTool** | prompt.ts | 2.8KB | read | 🟡 opencode 缺 PDF/Jupyter/image 说明 |
| **FileEditTool** | prompt.ts | 1.9KB | edit | 🟢 字节接近但细节有差 |
| **FileWriteTool** | prompt.ts | 1KB | write | 🟢 字节接近 |
| **GlobTool** | prompt.ts | 0.4KB | glob | 🟢 接近 |
| **GrepTool** | prompt.ts | 1.1KB | grep | 🟡 opencode 缺多模式说明 |
| **AgentTool** | prompt.ts | **16.6KB** | task | ⚠️ **相差巨大** |
| **TodoWriteTool** | prompt.ts | **9.5KB** | todowrite | 🟢 **opencode 实际 8.8KB 已接近,缺 activeForm** |
| **SkillTool** | prompt.ts | 8.3KB | skill | ⚠️ **相差巨大 (opencode 404B)** |
| **AskUserQuestionTool** | prompt.ts | 2.9KB | question | 🟡 opencode 缺 Preview feature |
| **WebFetchTool** | prompt.ts | 1.4KB | webfetch | 🟢 接近 |
| **WebSearchTool** | prompt.ts | 1.5KB | websearch | 🟡 opencode 缺 Sources 强制要求 |
| **ExitPlanModeTool (V2)** | prompt.ts | 2.1KB | plan_exit | 🟢 接近 |
| **EnterPlanModeTool** | prompt.ts | 7.7KB | plan_enter | ⚠️ opencode 相差较大 |
| **NotebookEditTool** | prompt.ts | 0.6KB | — | 🔴 **缺失工具** |
| LSPTool | — | — | lsp | 🟢 opencode 独有 |
| TaskStopTool | — | — | — | 👻 Claude 特有 |
| TaskCreateTool / GetTool / UpdateTool / ListTool | — | — | — | 👻 Claude 实验性 TodoV2 |
| McpAuthTool / ListMcpResourcesTool / ReadMcpResourceTool / MCPTool | — | — | mcp-exa (概念不同) | 👻 Claude MCP 生态 |
| BriefTool / RemoteTriggerTool / ScheduleCronTool / SleepTool | — | — | — | 👻 Claude 实验性 (私用不需要) |
| REPLTool / TungstenTool / OverflowTestTool | — | — | — | 👻 内部/实验性 (私用不需要) |
| ConfigTool | — | — | — | 👻 Ant-only |
| PowerShellTool / SendMessageTool / ScheduleCronTool | — | — | — | 👻 跨团队协作 (私用不需要) |
| EnterWorktreeTool / ExitWorktreeTool | — | — | — | 🟡 可选,opencode 已有 worktree 支持 |
| SyntheticOutputTool / VerifyPlanExecutionTool | — | — | — | 👻 内部 |
| ReadMcpResourceTool / ListMcpResourcesTool | — | — | — | 👻 MCP 资源(可选) |

**📌 P0 必须补齐的缺失项**:
- ✨ 无 (opencode 基础工具已全部覆盖)

**📌 P1 应补齐的缺失工具**:
- 🆕 **NotebookEdit**: 虽然对多数用户不是核心,但补齐成本很低
- 🔄 **AskUserQuestion 增强**: 已有 question 但功能单薄(缺 Preview feature、推荐选项等体感细节)

**📌 P2 可选补齐**:
- 无(其余 Claude 独有工具对私用 Copilot 用户价值不大)

## 2. Agent 系统对比

### opencode 现有 Agent (`packages/opencode/src/agent/`)

| opencode Agent | mode | 用途 | prompt 文件 | 字节 |
|---|---|---|---|---|
| build | primary | 默认编码代理 | 内联 | — |
| plan | primary | 规划代理 | 用 session/prompt.ts 中的 PROMPT_PLAN + reminder | — |
| general | subagent | 通用子代理 | 内联 description | — |
| explore | subagent | 探索代码库 | explore.txt | 0.9KB |
| compaction | primary (hidden) | 对话压缩 | compaction.txt | 0.8KB |
| title | primary (hidden) | 标题生成 | title.txt | 2.1KB |
| summary | primary (hidden) | 摘要生成 | summary.txt | 0.7KB |

### Claude Code Built-in Agents (6 个)

| Claude Agent | 类型 | 用途 | 字节 | 对应 opencode | 缺失/差距 |
|---|---|---|---|---|---|
| **general-purpose** | 内置 | 通用代理 | 2.2KB | general | 🟢 相当 |
| **Explore** | 内置 | 代码探索 | **4.7KB** | explore | 🔴 **opencode 只有 0.9KB** |
| **Plan** | 内置 | 软件架构规划 | 4.3KB | plan (session/prompt.ts PROMPT_PLAN) | 🟡 opencode 有 plan-mode reminder 但 agent prompt 未独立 |
| **verification** | 内置 | 验证代理 | **11.3KB** | — | 🔴 **缺失整个 agent** |
| **claude-code-guide** | 内置 | 指南代理 | 8.9KB | — | 🔴 **缺失**(但用 opencode 特有的) |
| **statuslineSetup** | 内置 | 状态栏配置 | 7.4KB | — | 👻 对我们用处不大 |

**📌 必须做的 Agent 改造**:
- 🆕 **新增 `verify` agent** (对齐 verificationAgent.ts): 这是 Claude 的"thoroughness counterweight"核心机制
- 🔧 **重写 `explore.txt`**:从 0.9KB → 4.7KB 对齐 Claude,含 quick/medium/thorough 策略
- 🔧 **增强 plan agent prompt**:session/prompt.ts 里的 plan-mode reminder 已经包含 5-phase workflow,但可以再强化
- 🆕 (可选) **新增 `opencode-guide` agent**:参照 claude-code-guide 设计,但替换为指向 opencode docs

## 3. Skills 系统对比

### opencode 现有 Skills 机制

- `packages/opencode/src/skill/index.ts` 9.2KB:支持从 `.claude/skills/` 和 `.agents/skills/` 以及 `{skill,skills}/**/SKILL.md` 扫描
- **无任何内置 bundled skills**(只有基础设施)

### Claude Code Bundled Skills (17 个,`src/skills/bundled/`)

| Claude Skill | 字节 | 类型 | 对开发流畅度的价值 | 移植优先级 |
|---|---|---|---|---|
| **simplify** | 4.4KB | 代码审查 | ⭐⭐⭐⭐⭐ 三 agent 并行代码质量/可重用性/效率审查 | 🔥 P1 |
| **skillify** | 9.5KB | 元技能 | ⭐⭐⭐⭐ 捕获当前会话为可复用 skill | 🔥 P1 (改写为 opencode 版本) |
| **debug** | 4.2KB | 调试 | ⭐⭐⭐⭐ 调试会话日志 | 🔥 P1 |
| **verify** | 0.9KB (+ verifyContent 0.4KB) | 验证 | ⭐⭐⭐⭐⭐ 验证改动确实生效 | 🔥 P1 |
| **batch** | 7.1KB | 批量任务 | ⭐⭐⭐⭐ 用 5-30 个 worktree agent 并行执行大规模重构 | 🟡 P2 |
| **loop** | 4.6KB | 循环调度 | ⭐⭐⭐ AGENT_TRIGGERS 依赖 | 🟡 P2 |
| **remember** | 4.2KB | 记忆管理 | ⭐⭐⭐ 需要 memdir 基础设施 | 🟢 P3 |
| **stuck** | 4.2KB | 诊断 | ⭐⭐ ANT_ONLY,对我们无用 | ❌ 跳过 |
| **loremIpsum** | 4.6KB | 占位符 | ⭐⭐ 低频 | 🟢 P3 |
| **keybindings** | 10.5KB | 快捷键说明 | ⭐⭐ 文档类 | ❌ 跳过(opencode 不同) |
| **updateConfig** | 17.5KB | 配置更新 | ⭐⭐⭐ 结构好但和 opencode config 差别大 | 🟡 P2 (改写) |
| **scheduleRemoteAgents** | 19KB | 远程代理 | ⭐⭐ AGENT_TRIGGERS_REMOTE 依赖 | ❌ 跳过 |
| **claudeApi** | 6.4KB | Claude API 调用 | ⭐ | ❌ 跳过 |
| **claudeApiContent** | 4.3KB | (同上) | ⭐ | ❌ 跳过 |
| **claudeInChrome** | 1.8KB | Chrome 集成 | ⭐ | ❌ 跳过 |
| **verifyContent** | 0.4KB | verify 辅助 | ⭐⭐⭐⭐ | 🔥 P1 (随 verify 带上) |

**📌 移植计划**:

**P1 (必做,4 个 + 辅助)**:
1. `simplify` - 代码清理,几乎直接复制
2. `verify` + `verifyContent` - 适度简化,去掉 ant-only 限制
3. `debug` - 改写为 opencode 版本(日志路径不同)
4. `skillify` - 改写为 opencode 版本(frontmatter 略有不同)

**P2 (可选)**:
- `batch` - 大规模重构,需要依赖 opencode 的 worktree 能力
- `updateConfig` - 如果需要

## 4. 系统 Prompt (Provider) 对比

### opencode 现有 (`packages/opencode/src/session/prompt/`)

| 文件 | 字节 | 用途(session/system.ts 路由) |
|---|---|---|
| anthropic.txt | 8.1KB | claude-* 模型 |
| default.txt | 8.6KB | 兜底 |
| beast.txt | 11KB | gpt-4/o1/o3 |
| codex.txt | 7.3KB | gpt-*-codex |
| copilot-gpt-5.txt | 14KB | copilot gpt-5 (❌当前逻辑是通过 ID 匹配,不走 copilot-gpt-5.txt!需要改) |
| gpt.txt | 9.2KB | 其它 gpt |
| gemini.txt | 15.2KB | gemini-* |
| kimi.txt | 8.6KB | kimi |
| trinity.txt | 7.7KB | trinity |
| plan.txt | 1.5KB | plan-mode 额外指令 |
| plan-reminder-anthropic.txt | 4KB | plan-mode reminder (anthropic) |
| build-switch.txt | 238B | 从 plan 切换到 build 时的提示 |
| max-steps.txt | 765B | 步数限制提示 |

**⚠️ 发现的问题**: `session/system.ts` 的 provider 函数目前逻辑:
```ts
if (model.api.id.includes("gpt-4") || model.api.id.includes("o1") || model.api.id.includes("o3"))
  return [PROMPT_BEAST]
if (model.api.id.includes("gpt")) {
  if (model.api.id.includes("codex")) return [PROMPT_CODEX]
  return [PROMPT_GPT]
}
```

→ **GitHub Copilot GPT-5 模型会匹配 `gpt`,落入 `PROMPT_GPT` (9.2KB)**,而不是 `copilot-gpt-5.txt` (14KB)。这是**必须修复的关键路由 bug**!

### Claude Code 系统 Prompt (`src/constants/prompts.ts` 54KB)

采用**模块化组装**模式,不是按 provider 分 prompt 而是:
```
getSystemPrompt(tools, model) → [
  getSimpleIntroSection(),
  getSimpleSystemSection(),    // system 指令:hooks、permission、tool 用法
  getSimpleDoingTasksSection(),  // code style、security
  getActionsSection(),            // 破坏性操作警告
  getUsingYourToolsSection(),     // 强制优先使用 dedicated tools
  getSimpleToneAndStyleSection(), // 风格
  getOutputEfficiencySection(),   // 输出简洁度
  // --- DYNAMIC BOUNDARY ---
  ...resolvedDynamicSections (session_guidance, memory, env_info, output_style...)
]
```

**关键差异**:
1. Claude 的 prompt 是**装配式**,每段可插拔,有 cache boundary 标记
2. opencode 是**整块文本**,每个 provider 一个大 txt
3. Claude 的 `getEnvInfo` 包含详尽的环境注入(CWD, git, platform, OS version, shell, knowledge cutoff)
4. opencode 的 `SystemPrompt.environment` 较简:CWD/worktree/git/platform/date

## 5. Todo 系统对比

| 维度 | opencode | Claude Code |
|---|---|---|
| **字段** | content, status, priority | content, status, **activeForm** |
| **状态值** | pending, in_progress, completed, **cancelled** | pending, in_progress, completed |
| **in_progress 约束** | 软约束(prompt 写了 ideally) | **严格 1 个** |
| **activeForm 示例** | 无 | "Running tests" (实时展示用) |
| **prompt 字节** | 8.8KB | 9.5KB |

**📌 改进点**:
- 增加 `activeForm` 字段(保持向后兼容)
- prompt 对齐 Claude 的"严格 in_progress=1"表述
- 考虑保留 cancelled 状态(opencode 独有,UX 更好)

## 6. 完整迁移计划清单

详见 `.claude-migration/01-migration-plan.md`。

---

## 附录 A:Claude Code 系统 Prompt 核心段落精华

最有价值需要注入到 opencode 系统 prompt 的内容(按优先级):

### A.1 "Using your tools" section (P0 必须注入)
```
Do NOT use the Bash to run commands when a relevant dedicated tool is provided:
- To read files use Read instead of cat, head, tail, or sed
- To edit files use Edit instead of sed or awk
- To create files use Write instead of cat with heredoc or echo redirection
- To search for files use Glob instead of find or ls
- To search the content of files, use Grep instead of grep or rg
- Reserve using the Bash exclusively for system commands...

You can call multiple tools in a single response. If you intend to call multiple tools and there are no dependencies between them, make all independent tool calls in parallel.
```

### A.2 "Actions" section (P0 必须注入)
```
Carefully consider the reversibility and blast radius of actions.
- Destructive operations: deleting files/branches, rm -rf, overwriting uncommitted changes
- Hard-to-reverse: force-pushing, git reset --hard, amending published commits
- Actions visible to others: pushing code, creating PRs, sending messages
- Authorization stands for the scope specified, not beyond
```

### A.3 "Doing tasks" section (P0 必须注入)
```
- Don't add features, refactor code, or make "improvements" beyond what was asked.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen.
- Don't create helpers, utilities, or abstractions for one-time operations.
- Default to writing no comments. Only add one when the WHY is non-obvious.
- Don't explain WHAT the code does - well-named identifiers already do that.
- Before reporting a task complete, verify it actually works: run the test, execute the script, check the output.
- If you notice the user's request is based on a misconception, or spot a bug adjacent to what they asked about, say so.
- Report outcomes faithfully: if tests fail, say so with the relevant output.
```

### A.4 "Output efficiency" section (P1 注入)
```
IMPORTANT: Go straight to the point. Try the simplest approach first without going in circles.
Keep your text output brief and direct. Lead with the answer or action, not the reasoning.
Focus text output on:
- Decisions that need the user's input
- High-level status updates at natural milestones
- Errors or blockers that change the plan
If you can say it in one sentence, don't use three.
```

### A.5 Agent Tool "Writing the prompt" (P1 注入)
```
Brief the agent like a smart colleague who just walked into the room - it hasn't seen this conversation.
- Explain what you're trying to accomplish and why.
- Describe what you've already learned or ruled out.
- Give enough context about the surrounding problem.
Never delegate understanding. Don't write "based on your findings, fix the bug" - 
Write prompts that prove you understood: include file paths, line numbers, what specifically to change.
```

## 附录 B:变更影响范围矩阵

| 文件 | 变更类型 | 风险 | 测试难度 |
|---|---|---|---|
| `tool/*.txt` (14 个) | 文本替换 | 极低 | 低(运行时加载) |
| `session/prompt/*.txt` (8 个) | 文本替换 | 极低 | 低 |
| `session/system.ts` | 逻辑修改:provider 路由 | 🟡 中(影响所有请求) | 中 |
| `session/prompt.ts` | plan-reminder 微调 | 🟡 中 | 中 |
| `agent/agent.ts` | 新增 verify agent 定义 | 🟡 中(影响 agent 注册) | 中 |
| `agent/prompt/*.txt` | 文本替换/新增 | 极低 | 低 |
| `skill/bundled/*.ts` (新建目录) | 新建文件 | 🟢 低(新机制) | 中(需要注册逻辑) |
| `skill/index.ts` | 新增 bundled 注册 | 🟡 中 | 中 |
| `tool/todo.ts` | 加 activeForm 字段 | 🟡 中(schema 变化) | 中 |
| `tool/question.ts` | 增加 Preview feature | 🟡 中 | 中 |

---

**Phase 0 完成** ✅  
下一步进入 Phase 1:批量更新所有工具 prompt 文件。
