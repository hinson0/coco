// apps/mobile/lib/db/seed.ts
import type * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";

interface SeedCategory {
  readonly name: string;
  readonly icon: string;
  readonly type: "income" | "expense";
}

const DEFAULT_CATEGORIES: readonly SeedCategory[] = [
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
];

export async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories",
  );
  if ((existing?.count ?? 0) > 0) return;

  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      "INSERT INTO categories (id, user_id, name, icon, type, is_default) VALUES (?, NULL, ?, ?, ?, 1)",
      Crypto.randomUUID(),
      cat.name,
      cat.icon,
      cat.type,
    );
  }
}
