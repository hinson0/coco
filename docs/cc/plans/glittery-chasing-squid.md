# README 更新计划

## Context

根据最近合并的 PR（#33 ~ #50），项目新增了多个重要功能，包括多设备同步、
自动记账、广告收益系统、GitHub Actions CI/CD 等。当前 README 未反映这些变更，
需要更新以准确描述项目当前状态。

## 需要更新的 PR 摘要

| PR | 功能 | 影响范围 |
|----|------|---------|
| #35 | 多设备同步（每 30s 自动 push + 手动 pull） | 功能亮点、离线架构 |
| #39 | 自动记账（微信/支付宝通知解析）+ 品牌 CoCo + 使用帮助页 | 功能亮点 |
| #34 | 广告收益系统（AdMob 激励视频/开屏广告 + 权益系统） | 功能亮点、技术栈 |
| #38 | GitHub Actions CI/CD（ESLint/TSC/Jest + ruff/pyright/pytest） | 工程化、技术栈 |
| #42 | 未登录强制重定向 | 架构细节（无需 README） |
| #43 | justfile 端口自动递增 | 快速启动说明 |
| #47 | sync push 分表日志明细 | 无需 README 更新 |

## 更新策略

### 1. 功能亮点（新增 3 项）

在现有 8 项功能后追加：

```markdown
- 🔔 **自动记账** — 监听微信/支付宝支付通知，自动解析记账（标注 [自动记] 来源标签）
- 🔄 **多设备同步** — 本地数据每 30 秒自动同步云端，换机可一键 pull 还原
- 🎁 **广告权益系统** — 观看激励视频解锁高级功能（语音记账、小票识别、CSV 导出）
```

### 2. 技术栈（补充 3 行）

| 层级 | 技术 |
|------|------|
| 广告 | Google AdMob（激励视频 + 开屏广告）|
| CI/CD | GitHub Actions（前端 ESLint/TSC/Jest + 后端 ruff/pyright/pytest）|
| 代码质量 | ruff（Python lint + format）· pyright · ESLint |

### 3. Monorepo 结构（补充 2 个目录）

```
├── modules/
│   └── expo-pangle/     # 穿山甲广告原生模块（保留备用）
├── .github/
│   └── workflows/       # GitHub Actions CI 流水线
```

### 4. 离线架构（更新说明以包含同步）

当前说明「在线记账」部分不准确，需更新为：

```markdown
## 离线与同步架构

CoCo 采用本地 SQLite 持久化，离线时可查看和编辑已有数据：

1. **本地 SQLite** — 所有数据持久化到 expo-sqlite（WAL 模式），6 张表均含 `updated_at` 字段
2. **React Query** — 数据访问层，本地 CRUD 操作即时反映在界面
3. **在线记账** — 文字 / 语音 / 拍照 / 自动（通知）记账，由后端 Qwen AI 解析后写入本地
4. **自动同步** — 前台每 30 秒静默 push 到 PostgreSQL；换机后手动 pull 还原，冲突采用 LWW 策略
```

## 关键文件

- `/Users/a114514/coco/.claude/worktrees/feat-readme/README.md` — 唯一要修改的文件

## 验证

- 阅读更新后的 README，确认内容与实际代码一致
- 检查新增功能条目措辞简洁，格式与现有条目统一
