# opencode Claude-fusion 开发文档

本目录记录将 opencode (当前 claude 分支) 融合 Claude Code v2.1.88 精华的迁移过程。

## 文档索引

- [**00-comparison-baseline.md**](./00-comparison-baseline.md) — 工具/agent/skill/prompt 的全量对比基线
- [**01-migration-plan.md**](./01-migration-plan.md) — 分阶段执行计划和 commit 粒度
- [**02-phase-notes/**](./02-phase-notes/) — 各阶段的实施笔记(执行中创建)

## 快速状态

| Phase | 描述 | 状态 |
|---|---|---|
| 0 | 对比基线 | ✅ 完成 |
| 1 | 工具 prompt 大重构 (14 个) | ✅ 完成 (6 commits) |
| 2 | 系统 prompt 增强 (+ copilot 路由修复) | ✅ 完成 (2 commits) |
| 3 | Agent 体系 (新增 verify) | ✅ 完成 (1 commit) |
| 4 | Skills 库 (移植 5 个) | ✅ 完成 (1 commit) |
| 5 | 工具细节精化 (grep/edit/read/shell/todo) | ✅ 完成 (5 commits) |
| 6 | TodoWrite activeForm | ✅ 完成 (1 commit) |
| 7 | 可选增强 (OutputStyles 等) | ⏭️ 跳过 — 现有 Skill 机制已覆盖 |
| 8 | 端到端验证 | 🚧 进行中 |

## 开发约定

- 每个 Phase 独立 commit,信息前缀 `claude-fusion(phaseN): ...`
- 遇到意外需要大改架构,先开 issue 讨论,不要直接改
- 保持 Effect.gen 风格,不引入 try/catch
- 保持 opencode 工具小写命名

## 运行

```bash
# 从仓库根目录
bun run dev              # 启动 opencode dev 模式
bun turbo typecheck      # 类型检查
bun run --cwd packages/opencode test   # 运行测试
```
