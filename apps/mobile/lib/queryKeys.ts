import type { QueryClient } from "@tanstack/react-query";

/** React Query 查询键基础字符串，所有 queryKey / invalidateQueries / getQueryData 统一引用 */
export const QK = {
  chatMessages: "chat-messages",
  categories: "categories",
  transactions: "transactions",
  accounts: "accounts",
  accountBalance: "account-balance",
  totalAssets: "total-assets",
  budgets: "budgets",
  profile: "profile",
  recentCategory: "recent-category",
} as const;

// 本地 SQLite 被 migration / sync pull 批量改写后，需要失效的所有查询键。
// staleTime: Infinity 下，React Query 感知不到绕过它直接写 DB 的操作，必须手动 invalidate。
// 派生键（accountBalance / totalAssets）也必须刷新，因为它们从 accounts / transactions 计算。
const SYNCED_QUERY_KEYS: readonly string[] = [
  QK.chatMessages,
  QK.transactions,
  QK.accounts,
  QK.accountBalance,
  QK.totalAssets,
  QK.budgets,
  QK.categories,
  QK.profile,
];

export function invalidateSyncedQueries(qc: QueryClient): void {
  for (const key of SYNCED_QUERY_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
