# opencode × Claude Code 融合执行计划

> 本文档是落地执行手册,按阶段细分每个文件的改动计划和验收标准。
> 前置:阅读 `00-comparison-baseline.md` 了解基线差距。

## 指导原则

1. **私用导向**:不需要关心权限、版权、合规
2. **保留 opencode 基础**:Effect 架构、Copilot SDK、TUI 全部不动
3. **最小侵入**:能只改 `.txt` 就不改 `.ts`
4. **工具命名**:对齐 opencode 小写下划线(如 `edit`、`todowrite`),不用 Claude 的 `FileEditTool` 大驼峰
5. **Effect 编码风格**:不引入 try/catch,保持 Effect.gen
6. **逐阶段 commit**:每个阶段一个独立 commit,易回滚

---

## Phase 1 (P0) - 工具 Prompt 大重构

### 目标
所有 14 个工具的 `.txt` prompt 文件对齐 Claude Code 的精华,立刻带来 60% 体感提升。

### 具体改动清单

#### 1.1 edit.txt (1.3KB → 2KB)
**改动**:
- 明确 "line number + colon + space" 前缀格式(当前已有,但 Claude 的更详尽)
- 增加 "smallest old_string that's clearly unique"建议
- 强化 "never include line number prefix in oldString"
- 改为 opencode 命名(`Read` 保留大驼峰因为是工具显示名)

#### 1.2 read.txt (1.1KB → 2.8KB)
**必须补**:
- PDF 支持说明("can read PDF files .pdf")
- Jupyter notebook 支持("can read Jupyter notebooks .ipynb")
- image 说明("read images (PNG, JPG, etc). Contents presented visually as multimodal LLM")
- 空文件 system reminder 警告
- 明确 cat -n 格式输出
- "tool can only read files, not directories" + 用 bash ls 提示(opencode 用 read 可读目录,需保留)

#### 1.3 write.txt (631B → 1KB)
**补**:
- "Prefer the Edit tool for modifying existing files — it only sends the diff"(当前缺)

#### 1.4 grep.txt (697B → 1.5KB)
**补**:
- output_mode 说明("content", "files_with_matches", "count") —— opencode 当前无此参数,但 prompt 可以提示
- multiline matching 说明
- "Uses ripgrep (not grep) - literal braces need escaping" 细节

#### 1.5 glob.txt (551B → 接近原样,微调)
**补**:
- "speculatively perform multiple searches as a batch"

#### 1.6 task.txt (3.7KB → 10KB+)
**核心重写**,对齐 Claude Code AgentTool prompt 的精华:
- "Launch a new agent to handle complex, multi-step tasks autonomously"
- **Writing the prompt** 段(最关键!):"Brief the agent like a smart colleague who just walked into the room"
- "Never delegate understanding. Don't write 'based on your findings, fix the bug'"
- parallel launch 强指令
- 对应 agent 的 when-to-use/when-NOT-to-use

#### 1.7 skill.txt (404B → 5KB)
**核心重写**:
- 指引"Skills provide specialized capabilities and domain knowledge"
- 说明 slash command 形式 (`/commit` 等价 skill)
- **BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task**(Claude 的核心纪律)

#### 1.8 todowrite.txt (8.8KB → 9.5KB)
**补**:
- **activeForm 字段说明(双形式 content + activeForm)**
- 严格 "Exactly ONE task must be in_progress at any time (not less, not more)"
- 移除 cancelled 状态说明(如果保留 opencode 的 cancelled 就不改)

#### 1.9 webfetch.txt (763B → 1.4KB)
**补**:
- "When a URL redirects to a different host, the tool will inform you"
- "For GitHub URLs, prefer using the gh CLI via Bash instead"
- 15-minute cache 说明

#### 1.10 websearch.txt (990B,保留,小改)
**补**:
- **"CRITICAL REQUIREMENT - you MUST include a 'Sources:' section at the end"**(Claude 强要求)

#### 1.11 question.txt (667B → 2.9KB)
**必须补**:
- **Preview feature** 说明(让 UI 可以双栏显示)
- "Users will always be able to select 'Other' to provide custom text input"
- multiSelect 说明
- plan mode 特别说明("Do NOT use this tool to ask 'Is my plan ready?'")

#### 1.12 lsp.txt (1.3KB,保留)
opencode 独有,Claude 无对应。保留现有内容。

#### 1.13 apply_patch.txt (1.1KB,保留)
opencode 独有格式。保留现有内容。

#### 1.14 plan-enter.txt / plan-exit.txt (合并改造)
**对齐 Claude EnterPlanModeTool + ExitPlanModeV2Tool 的精华**:
- plan-enter.txt: 加入 "Prefer using EnterPlanMode for implementation tasks unless they're simple" 和完整的 when-to-use 列表(6 个场景)
- plan-exit.txt: 加入 "ExitPlanMode inherently requests user approval of your plan"

#### 1.15 shell 特殊处理
opencode 的 shell.ts 用的是 `shell/prompt.ts` 动态拼接(含 BashArity 等),需另行处理,先不动。Phase 2 处理。

### 验收标准
- [ ] 所有 14 个 `.txt` 文件已更新
- [ ] `bun typecheck` 通过
- [ ] 手动 smoke test:跑一个使用 Copilot 的简单编辑任务

### Commit 粒度
- **Commit 1**: `tool/read.txt`, `tool/write.txt`, `tool/edit.txt`(文件工具)
- **Commit 2**: `tool/grep.txt`, `tool/glob.txt`(搜索)
- **Commit 3**: `tool/task.txt`, `tool/skill.txt`(agent/skill)
- **Commit 4**: `tool/todowrite.txt`(todo)
- **Commit 5**: `tool/webfetch.txt`, `tool/websearch.txt`, `tool/question.txt`(其它)
- **Commit 6**: `tool/plan-enter.txt`, `tool/plan-exit.txt`(plan mode)

---

## Phase 2 (P0) - 系统 Prompt 增强

### 2.1 修复 copilot-gpt-5 路由 bug 🔥 紧急

**问题**:
`session/system.ts` 中,"copilot-gpt-5.txt" 根本没被使用!Copilot 的 gpt-5 会匹配 `model.api.id.includes("gpt")` 落入 `PROMPT_GPT`。

**修复**:
```ts
// session/system.ts 添加
export function provider(model: Provider.Model) {
  const id = model.api.id.toLowerCase()
  
  // Copilot 专属(最先匹配,因 providerID 明确)
  if (model.providerID === "github-copilot") {
    if (id.includes("gpt-5") || id.includes("gpt-4")) return [PROMPT_COPILOT_GPT5]
    if (id.includes("claude")) return [PROMPT_ANTHROPIC]  // Copilot 下的 claude
    return [PROMPT_COPILOT_GPT5]  // 兜底用 copilot 版
  }
  
  if (id.includes("gpt-4") || id.includes("o1") || id.includes("o3")) return [PROMPT_BEAST]
  if (id.includes("gpt")) {
    if (id.includes("codex")) return [PROMPT_CODEX]
    return [PROMPT_GPT]
  }
  if (id.includes("gemini-")) return [PROMPT_GEMINI]
  if (id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (id.includes("trinity")) return [PROMPT_TRINITY]
  if (id.includes("kimi")) return [PROMPT_KIMI]
  return [PROMPT_DEFAULT]
}
```

### 2.2 重写 copilot-gpt-5.txt 为融合版

**目标**:融合 Claude 的纪律 + 保留 Copilot/GPT 的指令遵循风格

**结构**:
1. **Intro** (保留 copilot 的"You are an expert AI programming assistant / opencode")
2. **Core principles (注入 Claude 精华)**:
   - 提前声明:"Output text to communicate; tools for actions"
   - 禁 URL 编造
   - 破坏性操作警告
3. **Tone and style** (混合):
   - Claude 的简洁要求("Your responses should be short and concise")
   - GPT 的"Keep your answers short and impersonal"
4. **Doing tasks** (注入 Claude 精华):
   - 不过度工程
   - 不写无意义注释
   - 完成前自我验证
   - 报告如实("Report outcomes faithfully")
5. **Using your tools** (关键):
   - **强制优先 dedicated tools over Bash**
   - **并行工具调用**
6. **Task Management** (保留 copilot 的 todo 强调)
7. **Proactiveness + 破坏性操作警告**(Claude getActionsSection)
8. **Code References** (保留 `file_path:line_number`)
9. **GPT agentic 特性**(保留 copilot 的原有):
   - "You MUST iterate and keep going until the problem is solved"
   - "NEVER end your turn without having truly solved the problem"
   - "take your time"
10. (可选)**outputFormatting** (保留 copilot 的 markdown 格式说明)

### 2.3 增强 default.txt 和 anthropic.txt

- `default.txt`: 注入 Claude 的 "Actions" section 和强化的工具选择原则
- `anthropic.txt`: 已经最接近 Claude,补几段缺失的(Professional objectivity 已有)

### 2.4 系统 Prompt 环境注入增强

修改 `session/system.ts` 的 `environment()`,加:
- 知识截止日期(按模型决定,可以硬编码)
- shell 信息
- OS version
- 可选:git 分支名、当前 worktree 状态

### 验收标准
- [ ] `model.providerID === "github-copilot"` 时正确走 `copilot-gpt-5.txt`
- [ ] `default.txt` 注入 Actions + Tool preference
- [ ] `anthropic.txt` 小补

---

## Phase 3 (P1) - Agent 体系扩充

### 3.1 新增 verify agent (必做)

**文件**:
- 新增:`packages/opencode/src/agent/prompt/verify.txt` (完整移植 verificationAgent.ts 11.3KB)
- 修改:`packages/opencode/src/agent/agent.ts` 添加 verify agent 定义

**关键**:
- `mode: "subagent"`, `color: "red"`
- 禁用 edit/write/notebook_edit 工具
- 在 task.txt 中加指引"for non-trivial changes, use verify agent"

### 3.2 重写 explore.txt (必做)

从 0.9KB → 4.7KB,对齐 Claude。强调:
- READ-ONLY mode 禁止文件修改
- parallel tool calls 最大化性能
- quick/medium/thorough 三级 thoroughness

### 3.3 (可选) 新增 opencode-guide agent

参照 claudeCodeGuideAgent.ts,但指向 opencode 文档而非 Claude docs。暂缓到 P2。

### 3.4 强化 general agent

`agent/agent.ts` 里的 general agent 描述可以注入 Claude 的 generalPurposeAgent prompt(短而高质)。

### 验收标准
- [ ] verify agent 可通过 task tool 调用
- [ ] explore agent 跑探索任务比之前更顺畅
- [ ] 所有 agent 在 `bun typecheck` 通过

---

## Phase 4 (P1) - Skills 库扩充

### 4.1 创建 bundled 目录结构

**新建**:
```
packages/opencode/src/skill/
├── index.ts (现有,需扩展注册 bundled)
├── discovery.ts (现有)
└── bundled/
    ├── index.ts (入口,注册所有 bundled skills)
    ├── simplify.md (移植 simplify)
    ├── verify.md (简化版 verificationAgent 作 skill)
    ├── debug.md (改写为 opencode 版本)
    └── skillify.md (改写为 opencode 版本)
```

**注意**:opencode 的 skill 发现机制是扫描 `{skill,skills}/**/SKILL.md`,所以 bundled skills 应该:
- 要么打包为可扫描的 SKILL.md 文件(在特殊目录)
- 要么在 skill/index.ts 里硬编码注册

推荐:**硬编码注册**,因为构建更简单,不依赖文件系统扫描。

### 4.2 修改 skill/index.ts 支持 bundled skills

在 `add()` 之外新增 `addBuiltin()` 函数,在启动时注入。

### 4.3 逐个移植 skills

**P1 必移植 (4 个)**:
1. **simplify** - 代码清理,几乎原文复制(把 `${AGENT_TOOL_NAME}` 替换为 `task`)
2. **verify** - 简化版,去掉 ant-only 限制
3. **debug** - 改写(opencode 日志路径不同,逻辑相似)
4. **skillify** - 改写(指向 opencode 的 `.opencode/` 目录)

**P2 可选移植 (1 个)**:
5. **batch** - 依赖 worktree 能力,opencode 已支持

### 验收标准
- [ ] `/simplify` 可以在 opencode 触发
- [ ] `/verify` 能在关键改动后跑完整验证
- [ ] `/debug` 能打开调试日志
- [ ] bundled skills 在 SkillTool 列出

---

## Phase 5 (P2) - 工具细节精化

### 5.1 read 工具行号格式
- 当前:`<line>: <content>` (如 `1: foo`)
- Claude 用的是 `cat -n` 格式(1 前面有空格)
- **不改**(opencode 现有格式已经在 prompt 里明确说明,只要 prompt 明确即可)

### 5.2 edit 工具唯一性校验
- Claude:"smallest old_string that's clearly unique"
- 确认 opencode 的 edit.ts 已经 enforce old_string 唯一性(grep 查)

### 5.3 shell 工具 background 任务
- opencode 有 `run_in_background` 的概念吗?查 shell.ts 和 shell/prompt.ts

### 5.4 grep 多模式支持
- opencode 的 grep.ts 是否支持 `-A/-B/-C` 上下文?

---

## Phase 6 (P2) - TodoWrite activeForm

### 6.1 Schema 扩展

`packages/opencode/src/tool/todo.ts`:
```ts
const TodoItem = Schema.Struct({
  content: Schema.String.annotate({ description: "Brief description (imperative)" }),
  activeForm: Schema.optional(Schema.String).annotate({ 
    description: "Present continuous form shown during execution" 
  }),
  status: Schema.String.annotate(...),
  priority: Schema.String.annotate(...),
})
```

### 6.2 Session Todo storage

`packages/opencode/src/session/todo.ts` 需要相应更新存储 schema。

### 6.3 Prompt 更新
在 todowrite.txt 强化双形式说明。

---

## Phase 7 (P3) - 可选增强

### 7.1 System reminders 机制
opencode 的 session/prompt.ts 已有 `insertReminders` 机制,可以借鉴 Claude 的 `<system-reminder>` 标签扩展。

### 7.2 输出风格 (OutputStyles)
Claude 有完整的 OutputStyle 机制(`constants/outputStyles.ts`)。opencode 如果需要,可以作为 config 项加入。

### 7.3 Progressive Harness 精选
Claude 有 12 个"Progressive Harness"机制(`constants/prompts.ts` 里的各种 section 装配)。选择性移植:
- `getActionsSection` 破坏性操作警告(P0 已做)
- `getSessionSpecificGuidanceSection`(P1 考虑)
- `getOutputEfficiencySection`(P2 已做)

---

## Phase 8 - 端到端验证

### 8.1 典型任务 smoke test
用 Copilot GPT-5 跑:
1. "给这个仓库添加一个 foo 功能,含测试"
2. "探索这个 codebase 的 auth 流程"
3. "修复 xxx bug,可能需要看多个文件"
4. "对我最近的改动做代码审查"

### 8.2 对比 Claude Code 原生
在同样的任务下跑 Claude Code 原生,对比:
- 计划的详尽度
- 工具调用效率(并行度)
- 文件操作准确度
- 最终输出简洁度
- 用户体验流畅度

### 8.3 反馈循环
根据差异,回头微调 prompt。

---

## 执行时间估算

| 阶段 | 预估工时 | 独立性 |
|---|---|---|
| Phase 1 - 工具 prompt | 2-3h | 🟢 高 |
| Phase 2 - 系统 prompt | 1-2h | 🟢 高 |
| Phase 3 - Agent 扩充 | 1-2h | 🟡 依赖 Phase 1 |
| Phase 4 - Skills 库 | 2-3h | 🟡 依赖 Phase 1 |
| Phase 5 - 工具细节 | 1-2h | 🟢 高 |
| Phase 6 - TodoWrite | 1h | 🟡 涉及 schema |
| Phase 7 - 可选 | 2-3h | 🟢 高 |
| Phase 8 - 验证 | 1h | 🔴 依赖全部 |
| **合计** | **11-17h** | — |

---

## 风险与回滚

### 风险
1. **Prompt 变更可能导致模型行为意外变化**(如更频繁调用工具导致超预算)
2. **Schema 变更(activeForm)可能影响持久化 todos**
3. **Agent 新增可能影响 permission 规则**

### 回滚策略
- 每个 Phase 一个 commit,git revert 即可
- Phase 1(纯 txt)风险最低,可以先做完全部
- Phase 6(schema)最有风险,做完后需要 smoke test 持久化
