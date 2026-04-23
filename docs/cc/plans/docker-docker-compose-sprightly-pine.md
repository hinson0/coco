# Plan: Docker 数据持久化防丢方案

## Context

用户通过 `docker compose down && docker compose up` 重启服务后发现数据消失（手机 App + 后端数据库均为空）。

### 根本原因分析

架构概述：
- **移动端 SQLite**（主数据源）←→ **后端 PostgreSQL**（sync 备份）
- 每 30s push 增量到后端，每次 App 启动触发一次全量 pull + LWW 合并

**最可能的原因**（两种独立事件同时发生）：
1. **后端 volume 被清除**：很可能执行了 `docker compose down -v`（`-v` 删除 named volumes），或在新服务器上首次部署但没有已有数据
2. **移动端 SQLite 被清除**：App 重装、测试设备或手机应用数据清除

目前的 `docker-compose.yml` 配置**本身是正确的**（named volume `postgres_data` 会在 `down` 时保留），无需修改。

### 确认诊断命令

在服务器上执行以下命令确认 volume 状态：
```bash
# 查看 volume 是否存在
docker volume ls | grep coco

# 查看 PostgreSQL 内容
docker compose exec db psql -U coco -c "SELECT count(*) FROM transactions;"
docker compose exec db psql -U coco -c "\dt"
```

---

## 修复方案

在 `justfile` 中新增 PostgreSQL 备份/恢复 recipes，确保每次重启前有数据快照。

### 新增 justfile recipes

**文件**: `justfile`（根目录）

新增以下 4 个 recipe，追加在现有内容末尾：

```just
# ── Docker 运维 ───────────────────────────────

# 备份 PostgreSQL 到 backups/ 目录（需 docker compose 已启动）
db-backup:
    #!/usr/bin/env bash
    mkdir -p backups
    TS=$(date +%Y%m%d_%H%M%S)
    FILE="backups/coco_${TS}.sql"
    docker compose exec -T db pg_dump -U coco coco > "$FILE"
    echo "✅ 备份完成: $FILE ($(du -sh "$FILE" | cut -f1))"

# 从最新备份恢复（危险！会覆盖当前数据库）
db-restore:
    #!/usr/bin/env bash
    LATEST=$(ls -t backups/coco_*.sql 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
        echo "❌ backups/ 下没有找到备份文件"
        exit 1
    fi
    echo "⚠️  将从 $LATEST 恢复，当前数据会被覆盖"
    read -r -p "确认继续？(yes/N): " confirm
    if [ "$confirm" != "yes" ]; then echo "已取消"; exit 0; fi
    docker compose exec -T db psql -U coco -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    docker compose exec -T db psql -U coco coco < "$LATEST"
    echo "✅ 恢复完成"

# 安全重启：先备份再 down + up（推荐替代直接 docker compose down && up）
safe-restart:
    just db-backup
    docker compose down
    docker compose up -d
    echo "✅ 安全重启完成（备份已保存到 backups/）"

# 查看所有备份文件
db-backups:
    @ls -lh backups/coco_*.sql 2>/dev/null || echo "暂无备份"
```

### 新增 `.gitignore` 条目

**文件**: `.gitignore`

追加：
```
# PostgreSQL 备份
backups/
```

---

## 关键文件

- `justfile`（根目录）— 新增 4 个 recipe
- `.gitignore`（根目录）— 排除 `backups/`
- `docker-compose.yml`（根目录）— **不修改**，配置已正确

---

## 数据恢复建议（当前丢失数据）

如果已经丢失数据，可尝试以下顺序：
1. 检查是否有旧 volume：`docker volume ls`
2. 检查其他设备 App 是否有本地 SQLite 数据（数据在设备上不会因服务器重启消失）
3. 如有其他设备有数据：打开 App → 等待下次 push（30s 内自动触发）→ 数据会推到服务器

---

## 验证步骤

1. 安装 `just`（如未安装：`brew install just`）
2. 确保 docker compose 已启动
3. `just db-backup` — 确认生成备份文件
4. `ls backups/` — 检查 SQL 文件
5. `just safe-restart` — 安全重启服务
6. 重启后确认数据完整：
   ```bash
   docker compose exec db psql -U coco -c "SELECT count(*) FROM transactions;"
   ```
