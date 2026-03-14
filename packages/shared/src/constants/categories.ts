import type { TransactionType } from "../types/category";

export interface DefaultCategory {
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "餐饮", icon: "🍔", type: "expense" },
  { name: "交通", icon: "🚗", type: "expense" },
  { name: "购物", icon: "🛒", type: "expense" },
  { name: "娱乐", icon: "🎮", type: "expense" },
  { name: "居住", icon: "🏠", type: "expense" },
  { name: "医疗", icon: "💊", type: "expense" },
  { name: "教育", icon: "📚", type: "expense" },
  { name: "通讯", icon: "📱", type: "expense" },
  { name: "工资", icon: "💰", type: "income" },
  { name: "理财", icon: "📈", type: "income" },
  { name: "其他收入", icon: "💵", type: "income" },
  { name: "其他支出", icon: "📦", type: "expense" },
] as const;
