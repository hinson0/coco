# 流式记账对话：话术升级 + 卡片入场修复

## Context

刚上线的 SSE 流式记账对话（`/chat/stream`、`/record-ocr/stream`）在真机上呈现两个交互问题：

1. **话术文案太短且气质模糊**。当前 `narrate_record_stream` 的 system prompt 只允许 12-25 字，输出类似"好,咖啡这一笔我帮你记下"。产品上想塑造一个「精算师助理」的专业人格，文字需要 30-100 字、严谨且对数字敏感。

2. **卡片出现有明显闪烁**。当前 `useChat.ts` 的 bill 事件处理在 `addMessage(text)` 后立即 `setStreamingText("")`，导致 `StreamingBubble` 瞬间消失；而真实消息要等 `finally` 里的 `invalidateQueries` 异步 refetch 完成才出现，中间有几十毫秒空白帧。与此同时 `RecordCard` 没有入场动画，生硬地"砰"一下出现。

本次改动的目标：(a) 让流式话术更像一位精算师顾问；(b) 流式文字气泡平滑过渡到真实消息（零闪烁）；(c) 新的 `RecordCard` 用 FadeInDown 250ms 自然下滑淡入。

---

## 实施步骤

### 1. 后端：升级精算师语气 prompt

**文件**：`apps/backend/services/silicon.py`

- `narrate_record_stream`（现第 244 行附近）：system prompt 改为精算师人格 + 30-100 字 + 结尾留白。
- `narrate_ocr_stream`（现第 255 行附近）：同步升级为精算师观察小票的口吻。
- `narrate_chat_stream`（现第 266 行附近）：**保持不变**（闲聊不匹配精算师人格）。

示例新 prompt（record 分支）：

```
你是 CoCo 的精算师助手，语气严谨专业、对数字敏感，像一位温和又靠谱的
高级财务顾问。用户刚说了一笔消费或收入，请用一段简短的中文口吻做确认
与专业观察：可以复述金额所属类别、点出该类消费的节律或合理性、或给出
一句克制的理性提示。绝不说教、不加表情、不列要点。30 到 100 字之间，
结尾用逗号或省略号留白，为后续账单卡片让路。
示例：「收到，这笔咖啡 25 元我已入账到日常餐饮——小额高频的品类，
建议留意月度累计，单笔虽小但值得持续观察...」。
```

示例新 prompt（ocr 分支）：

```
你是 CoCo 的精算师助手，正在复核一张小票。请用严谨但温和的中文，做一段
观察性陈述：点出商户类型、消费时段或品类特征，像一位高级财务顾问在审阅
凭证。不要罗列所有金额、不要逐项解析、不加表情。30 到 100 字之间，
结尾留白以便续接账单卡片。
示例：「嗯，这是一张傍晚便利店的小票，品项偏零食饮品——属于日常小额
支出，我先按餐饮类入账...」。
```

### 2. 前端：零闪烁的内容匹配接棒

**文件**：`apps/mobile/hooks/useChat.ts`

删除 bill 事件分支中的两行：

```ts
accumulatedRef.current = "";
setStreamingText("");
```

**保留** `addMessage(text)` 和 `addMessage(bill_card)`，其后**新增一次** `qc.invalidateQueries({ queryKey: [QK.chatMessages] })` —— 让真实消息尽早进入 `messages` 数组。`finally` 块保持不变（`setStreamingText(null)` 在流结束时收尾）。

这一步的目的：在 `StreamingBubble` 消失之前，真实 text 消息已经就位在 `messages` 里；接棒判定交给 `buildListItems`。

---

**文件**：`apps/mobile/app/index.tsx`

修改 `buildListItems`（第 65-103 行），在插入 streaming item 前比对 `messages` 前几条是否已经包含相同内容的 assistant text 消息：

```ts
function buildListItems(
  messages: readonly ChatMessage[],
  isLoading: boolean,
  streamingText: string | null,
): ListItem[] {
  const items: ListItem[] = [];

  const streamingActive =
    streamingText !== null && streamingText.length > 0;

  // bill 事件写入 text 后，text 可能被 bill_card 挤到 messages[1]，
  // 所以在最前 3 条里查找即可，可靠且开销极小。
  const alreadyCommitted =
    streamingActive &&
    messages
      .slice(0, 3)
      .some(
        (m) =>
          m.role === "assistant" &&
          m.content_type === "text" &&
          m.content === streamingText,
      );

  if (streamingActive && !alreadyCommitted) {
    items.push({
      type: "streaming",
      id: "streaming-bubble",
      text: streamingText as string,
    });
  } else if (isLoading && !streamingActive) {
    items.push({ type: "typing", id: "typing-indicator" });
  }

  // 后续日期 separator 与消息循环不变
  ...
}
```

接棒时序：
1. bill 事件到达 → `addMessage(text)` → `addMessage(bill_card)` → 手动 `invalidateQueries(chatMessages)`
2. React Query refetch → `messages[0] = bill_card`、`messages[1] = text`
3. `buildListItems` 下一帧执行时发现 `alreadyCommitted = true` → 不再 push streaming → StreamingBubble 在真实消息"同时可见"的那一帧被替换，视觉无断裂

### 3. 前端：RecordCard FadeInDown 入场动画

**文件**：`apps/mobile/app/index.tsx`

在顶部 import 加上：

```ts
import Animated, { FadeInDown } from "react-native-reanimated";
```

用 `useRef` 跟踪已渲染过的 bill_card id，只对**新增的**卡片应用 entering 动画——避免初次加载/分页加载时历史卡片一起"抖"：

```ts
const seenBillCardIds = useRef<Set<string>>(new Set());

// 在第一次 messages 加载完成后，将现有 bill_card id 全部预标记为"已见"
const firstLoadMarked = useRef(false);
useEffect(() => {
  if (firstLoadMarked.current || messages.length === 0) return;
  messages.forEach((m) => {
    if (m.content_type === "bill_card") {
      seenBillCardIds.current.add(m.id);
    }
  });
  firstLoadMarked.current = true;
}, [messages]);
```

修改 `renderItem`（第 288 行 `renderItem` 内 message 分支）：

```ts
if (item.type === "message") {
  const msg = item.data;
  const isNewBillCard =
    msg.content_type === "bill_card" &&
    !seenBillCardIds.current.has(msg.id);
  if (isNewBillCard) seenBillCardIds.current.add(msg.id);

  const bubbleNode = (
    <View style={styles.bubbleWrapper}>
      <ChatBubble
        message={msg}
        categories={categoriesRef.current}
        onDelete={handleDelete}
        onEditRecord={
          msg.content_type === "bill_card" ? handleEditRecord : undefined
        }
        isPlaying={playingId === msg.id}
        onPlay={
          msg.content_type === "audio" && msg.audio_uri
            ? handlePlayAudio
            : undefined
        }
        onResendOcr={
          msg.content_type === "image" &&
          msg.content.startsWith("file://") &&
          failedOcrIds.has(msg.id)
            ? handleResendOcr
            : undefined
        }
      />
    </View>
  );

  return isNewBillCard ? (
    <Animated.View entering={FadeInDown.duration(250)}>
      {bubbleNode}
    </Animated.View>
  ) : (
    bubbleNode
  );
}
```

**注意**：`<FlatList inverted>` 反转的是布局坐标系，但 Reanimated 的 layout animation `entering` 是相对组件自身坐标计算的；在 inverted 下 `FadeInDown` 视觉上仍是"从下方向上滑入 + 淡入"，符合预期。若实机发现方向反了（表现为从上方下滑），改为 `FadeInUp.duration(250)`。

---

## 涉及文件清单

| 文件 | 改动 | 行数估计 |
| --- | --- | --- |
| `apps/backend/services/silicon.py` | 替换 `narrate_record_stream` / `narrate_ocr_stream` 两个 system prompt | ±25 行 |
| `apps/mobile/hooks/useChat.ts` | 删除 bill 分支两行、bill 分支尾部新增一次 invalidate | ±6 行 |
| `apps/mobile/app/index.tsx` | `buildListItems` 加内容比对 + 入场动画 useRef / useEffect / renderItem 包裹 | ±30 行 |

**无需改动** `ChatBubble.tsx` / `RecordCard.tsx` / `StreamingBubble.tsx` / `sse.ts` / schema。

---

## 可复用的现有工具

- Reanimated 的 `FadeInDown` layout animation — 第一次在项目引入，但配套 hooks/types 都已随 `react-native-reanimated@4.2.1` 存在，无需新增依赖。
- `useLocalChatMessages`（`apps/mobile/hooks/useLocalChatMessages.ts`）— 已有 React Query 订阅，无需改动；其 SQL 排序 `ORDER BY created_at DESC` 已在 `apps/mobile/lib/db/queries.ts:13` 确认。
- `qc.invalidateQueries` — `useChat.ts` 内已多处使用，照搬即可。

---

## 验证方式

### 后端

```bash
# 需要登录态 token，从 iOS 模拟器获取
curl -N -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" \
  -d '{"text":"买咖啡25元"}' \
  http://localhost:<PORT>/chat/stream
```

观察：
- `data: {"type":"chunk",...}` 累计文本应在 30-100 字
- 用词专业（"入账"、"台账"、"小额高频"、"月度累计"等）
- 最后 `data: {"type":"bill",...}` 返回 transaction
- `data: [DONE]`

### 前端实机

1. 真机或模拟器打开对话页，输入"买咖啡25元"并发送。
2. 预期时序：
   - 用户气泡立即出现 → TypingIndicator 三点（首个 chunk 到达前） → 话术文字流式逐字显示 → `RecordCard` 从下方淡入滑上 250ms → 话术气泡保持在卡片上方，无闪烁、无空白帧
3. 用语音 + OCR 各走一次相同流程，验证三入口行为一致。
4. 杀进程重进对话页，所有历史 `RecordCard` 应**无动画**直接显示（首屏不抖动）。
5. 断网后发送文字，验证错误路径下 "连接异常..." 消息仍正常追加，不影响历史 bill_card 稳定性。

### CI

```bash
cd /Users/a114514/coco/.claude/worktrees/feat-ai
just cicd-be     # ruff + 49 pytest
just cicd-fe     # eslint + prettier + typecheck + 177 jest
```
