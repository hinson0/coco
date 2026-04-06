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
