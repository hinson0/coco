// apps/mobile/lib/db/index.ts
import * as SQLite from "expo-sqlite";
import { createTables } from "./schema";
import { seedCategories } from "./seed";

const DB_NAME = "coco.db";

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await createTables(db);
  await seedCategories(db);
  return db;
}

export async function migrateNullUserData(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  await db.runAsync("UPDATE transactions SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync("UPDATE chat_messages SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync("UPDATE accounts SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync("UPDATE budgets SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync(
    "UPDATE categories SET user_id = ? WHERE user_id IS NULL AND is_default = 0",
    userId,
  );
}
