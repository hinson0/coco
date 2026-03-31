# 修复 AI 页进入延迟

## Context

用户从账单/统计等 Tab 切回 AI 聊天页时，有"很明显"的延迟。

**根本原因（两层）：**

1. **Stack 路由重新 mount**：AI 聊天页（`app/index.tsx`）是 Stack 路由，每次按 AI 按钮都调用 `router.push('/')` 推入新实例，每次进入都要完整执行组件 mount + 所有 hook 初始化（`useAudioRecorder`、7 个查询 hook 等），叠加 300ms 滑入动画，感知延迟明显。

2. **React Query `staleTime: 0`（默认）**：即使缓存中有数据，mount 时也立即视为过期，触发后台重新查询 SQLite，引发额外渲染和内容闪烁。

**为什么 `staleTime: Infinity` 安全：** 所有数据变更（增删改）都通过 mutation 的 `onSuccess` 显式调用 `invalidateQueries`，缓存由代码主动失效，而不依赖时间过期。

---

## 方案

### 第一步：全局 `staleTime: Infinity`（核心修复）

**文件：** `app/_layout.tsx`

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});
```

**效果：**
- 第二次及以后进入 AI 页，所有查询（chat-messages、categories、transactions 等）立即从缓存返回，**零重新查询**
- 消除 mount 期间的后台 re-fetch，减少 JS 线程竞争，动画更流畅
- 覆盖全应用所有本地 SQLite 查询 hook

### 第二步：`useLocalChatMessages` 移除冗余的 `staleTime` 覆盖（无需操作）

`useLocalChatMessages` 已有 `placeholderData: keepPreviousData`，配合全局 `staleTime: Infinity` 后，queryKey 切换时也会保留旧数据，不需要其他改动。

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `app/_layout.tsx` | QueryClient 添加 `defaultOptions.queries.staleTime: Infinity` |

---

## 注意事项

- 不影响 mutation 流程：增删改 → `invalidateQueries` → 下次访问重新查询，数据始终正确
- `enabled: !!db` 守卫不受影响：db 未初始化时查询仍被禁用
- 更根本的长期优化（将 AI 页改为持久 Tab）留待后续，当前方案是最小改动

---

## 验证

1. 进入 AI 页（首次），正常显示消息
2. 切换到账单页，再点 AI 按钮 → 消息应**立即显示**，无加载闪烁
3. 发送一条消息 → 新消息正常出现（验证 invalidateQueries 仍有效）
4. 删除一条消息 → 消息正常消失（验证 mutation 触发的缓存刷新有效）
