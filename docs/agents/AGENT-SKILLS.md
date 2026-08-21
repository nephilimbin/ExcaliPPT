# Agent Skills 配置

本仓库工程技能（issue tracker、triage、domain docs）的配置。供 `to-issues` / `to-prd` / `triage` / `diagnose` 等技能读取。

## Issue Tracker: Local Markdown

无 git 远程，**不使用** GitHub / GitLab Issues。Issues 与 PRD 存为本地 markdown：

- PRD：`.scratch/<feature-slug>/PRD.md`
- Issues：`.scratch/<feature-slug>/issues/NN-<slug>.md`（从 `01` 编号）
- Triage 状态：每个 issue 文件顶部 `Status:` 行
- 约定详见 `.claude/skills/setup-matt-pocock-skills/issue-tracker-local.md`

## Triage Labels

`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`

详见 `.claude/skills/setup-matt-pocock-skills/triage-labels.md`。

## Domain Docs

- 领域术语：`CONTEXT.md`（根目录）
- 架构决策：`docs/adr/`（根目录）
