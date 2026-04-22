import type { ChatMessage } from "@coco/shared";

export type ListItem =
  | { type: "message"; data: ChatMessage }
  | { type: "separator"; id: string; label: string }
  | { type: "typing"; id: string }
  | { type: "streaming"; id: string; text: string };

export function toDateLabel(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (target.getTime() === today.getTime()) return "今天";
  if (target.getTime() === yesterday.getTime()) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function buildListItems(
  messages: readonly ChatMessage[],
  isLoading: boolean,
  streamingText: string | null,
): ListItem[] {
  const items: ListItem[] = [];

  const streamingActive = streamingText !== null && streamingText.length > 0;

  // 假设 messages 按 created_at DESC 排序（见 db/queries.ts）。刚由 SSE
  // 落库的 text 消息会出现在最前几条之一（bill 路径下前面还会挤进一条
  // bill_card），所以在最近 3 条里查找即可。一旦发现 content 与
  // streamingText 完全一致的 assistant text,说明流式气泡可以直接被真实
  // 气泡「接棒」,此时不再渲染 StreamingBubble,避免 streaming 先消失再
  // 由真实消息补齐的闪烁。
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

  let prevLabel = "";

  for (const msg of messages) {
    const label = toDateLabel(msg.created_at);
    // inverted FlatList 中 push 在消息之后 = 视觉上方（日期标签在该组上方）
    if (prevLabel !== "" && label !== prevLabel) {
      items.push({
        type: "separator",
        id: `sep-${prevLabel}`,
        label: prevLabel,
      });
    }
    items.push({ type: "message", data: msg });
    prevLabel = label;
  }

  if (prevLabel !== "") {
    items.push({ type: "separator", id: `sep-${prevLabel}`, label: prevLabel });
  }

  return items;
}

export function itemKey(item: ListItem): string {
  if (item.type === "message") return item.data.id;
  if (item.type === "separator") return item.id;
  return item.id;
}
