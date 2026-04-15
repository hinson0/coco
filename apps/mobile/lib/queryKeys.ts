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
  pendingNotifications: "pending-notifications",
} as const;
