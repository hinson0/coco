import type { ChatMessage } from "@coco/shared";

import { buildListItems } from "../chat-list-items";

function msg(partial: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    id: partial.id,
    user_id: partial.user_id ?? "u1",
    role: partial.role ?? "assistant",
    content_type: partial.content_type ?? "text",
    content: partial.content ?? "",
    transaction_id: partial.transaction_id ?? null,
    audio_uri: partial.audio_uri,
    duration_seconds: partial.duration_seconds,
    created_at: partial.created_at ?? new Date().toISOString(),
  } as ChatMessage;
}

describe("buildListItems 接棒判定", () => {
  it("streamingText 与最前 3 条 assistant text 内容一致时，不渲染 streaming", () => {
    const now = new Date().toISOString();
    const messages: ChatMessage[] = [
      msg({
        id: "bill",
        role: "assistant",
        content_type: "bill_card",
        content: "{}",
        created_at: now,
      }),
      msg({
        id: "text",
        role: "assistant",
        content_type: "text",
        content: "好的,咖啡 25 元已经记下",
        created_at: now,
      }),
    ];

    const items = buildListItems(messages, false, "好的,咖啡 25 元已经记下");

    expect(items.find((i) => i.type === "streaming")).toBeUndefined();
    expect(items.filter((i) => i.type === "message")).toHaveLength(2);
  });

  it("streamingText 还未落库时，streaming item 在列表首位（视觉最下）", () => {
    const items = buildListItems(
      [
        msg({
          id: "user",
          role: "user",
          content_type: "text",
          content: "买咖啡 25 元",
        }),
      ],
      true,
      "好的,咖啡 25 元已",
    );

    expect(items[0]).toMatchObject({
      type: "streaming",
      id: "streaming-bubble",
      text: "好的,咖啡 25 元已",
    });
  });

  it("内容只在 messages 末尾匹配（第 4 条以外）时仍然渲染 streaming — 只检查最近 3 条", () => {
    const padding = Array.from({ length: 3 }, (_, i) =>
      msg({
        id: `pad-${i}`,
        role: "assistant",
        content_type: "text",
        content: `pad-${i}`,
      }),
    );
    const messages: ChatMessage[] = [
      ...padding,
      msg({
        id: "old-match",
        role: "assistant",
        content_type: "text",
        content: "精确匹配的旧消息",
      }),
    ];

    const items = buildListItems(messages, false, "精确匹配的旧消息");

    expect(items.find((i) => i.type === "streaming")).toBeDefined();
  });

  it("streamingActive=false 且 isLoading=true 时渲染 typing 占位", () => {
    const items = buildListItems([], true, null);
    expect(items[0]).toMatchObject({ type: "typing" });
  });

  it("streamingActive=true 时不再渲染 typing，即使 isLoading=true", () => {
    const items = buildListItems([], true, "正在记录...");
    expect(items.find((i) => i.type === "typing")).toBeUndefined();
    expect(items[0]).toMatchObject({ type: "streaming" });
  });

  it("user 消息或非 text 类型的 assistant 消息内容不触发接棒", () => {
    const messages: ChatMessage[] = [
      msg({
        id: "user",
        role: "user",
        content_type: "text",
        content: "好的,咖啡 25 元已经记下",
      }),
      msg({
        id: "bill",
        role: "assistant",
        content_type: "bill_card",
        content: "好的,咖啡 25 元已经记下",
      }),
    ];

    const items = buildListItems(messages, false, "好的,咖啡 25 元已经记下");
    expect(items.find((i) => i.type === "streaming")).toBeDefined();
  });
});
