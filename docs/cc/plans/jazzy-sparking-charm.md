# Fix: ASR 语音记账分类显示"未知"

## Context

GLM 返回的 transaction 有 `category: "餐饮"`（名称字符串），但 ChatBubble 通过 `category_id`（UUID）匹配本地分类。由于缺少名称→ID 的映射步骤，分类匹配失败，显示"未知"。

## 修改文件

`apps/mobile/hooks/useChat.ts` — `sendAsr` 函数，第 205-212 行

## 实现

在 `resp.data?.type === "bill"` 分支里，存储 bill_card 之前，按分类名称查找本地分类并设置 `category_id`：

```ts
if (resp.data?.type === "bill") {
  const tx = resp.data.transaction;
  // 按名称查找本地分类，映射为 category_id
  const categoriesData = qc.getQueryData<readonly Category[]>(["categories"]);
  const otherName = tx.type === "income" ? "其他收入" : "其他支出";
  const category = categoriesData?.find(
    (c) => c.name === tx.category && c.type === tx.type
  ) ?? categoriesData?.find((c) => c.name === otherName);
  if (category) {
    tx.category_id = category.id;
  }
  // ... 存储 bill_card
}
```

复用 `sendText` 里已有的相同模式（第 30-37 行）。

## 验证

语音说"咖啡25元"，bill_card 应显示"餐饮"分类而非"未知"。
