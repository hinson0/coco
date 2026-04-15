# Implementation Report: AI 聊天页进入性能优化

## Summary

完成 Phase 1-3 的全部改动：SQLite 复合部分索引 + React Query 预取 + 消除双重 reverse()。
Phase 4（懒加载语音）标记为 deferred（需先确认 useVoiceRecorder 对 mount 的实际影响）。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small | Small |
| Files Changed | 2 (Phase 1) → 6 (Phase 2+3) | 6 |
| Tests | 2 new | 2 new (159 total, all pass) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| P1-1 | 添加复合部分索引 (schema.ts) | ✅ Complete | |
| P1-2 | 添加迁移测试 (schema-migration.test.ts) | ✅ Complete | |
| P2-1 | 创建 lib/db/queries.ts 纯函数 | ✅ Complete | |
| P2-2 | useLocalChatMessages 使用纯函数 | ✅ Complete | |
| P2-3 | useLocalCategories 使用纯函数 | ✅ Complete | |
| P2-4 | BottomTabBar onPressIn 预取 | ✅ Complete | |
| P3-1 | 修正 buildListItems（适配 DESC 输入） | ✅ Complete | |
| P4   | useVoiceRecorder 懒初始化 | ⏸ Deferred | 需确认实际 mount 阻塞时间 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Lint | ✅ Pass | 无报错 |
| Unit Tests | ✅ Pass | 159 tests / 18 suites |
| Build | — | 需 Expo dev 环境验证 |

## Files Changed

| File | Action | 说明 |
|---|---|---|
| `apps/mobile/lib/db/schema.ts` | UPDATED | 添加 idx_chat_messages_user_active 部分索引 |
| `apps/mobile/lib/db/__tests__/schema-migration.test.ts` | UPDATED | 新增 2 个索引验证测试 |
| `apps/mobile/lib/db/queries.ts` | CREATED | fetchChatMessages / fetchCategories 纯函数 |
| `apps/mobile/hooks/useLocalChatMessages.ts` | UPDATED | queryFn 改用 queries.ts，删除 .reverse() |
| `apps/mobile/hooks/useLocalCategories.ts` | UPDATED | queryFn 改用 queries.ts |
| `apps/mobile/components/shared/BottomTabBar.tsx` | UPDATED | AIButton 添加 onPressIn 预取 |
| `apps/mobile/app/index.tsx` | UPDATED | buildListItems 适配 DESC 输入，无 reverse |

## Deviations from Plan

**Phase 3 separator ID 策略变更**：原计划用 `msg.id` 作为 separator key，改为用日期标签字符串
（`sep-${prevLabel}`）。原因：DESC 迭代时日期切换的时机不在第一条消息，用 label 更语义化且唯一。

## Notes

- `buildListItems` 的数据流从 `ASC→reverse→DESC` 简化为直接 `DESC`
- `BottomTabBar` 中 `prefetchQuery` 幂等：data 已缓存时（staleTime: Infinity）零开销
- Phase 4 建议在有 Instruments 数据后决定是否实施
