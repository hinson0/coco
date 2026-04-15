import type * as SQLite from "expo-sqlite";
import type { Category, ChatMessage } from "@coco/shared";

/** 聊天页首次加载条数（hooks / prefetch / 分页起点 共享此值） */
export const CHAT_INITIAL_LIMIT = 30;

export async function fetchChatMessages(
  db: SQLite.SQLiteDatabase,
  userId: string,
  limit: number,
): Promise<readonly ChatMessage[]> {
  return db.getAllAsync<ChatMessage>(
    "SELECT * FROM chat_messages WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?",
    userId,
    limit,
  );
}

export async function fetchCategories(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<readonly Category[]> {
  const rows = await db.getAllAsync<Category>(
    "SELECT * FROM categories WHERE deleted_at IS NULL AND (user_id = ? OR (user_id IS NULL AND is_default = 1)) ORDER BY type, name",
    userId,
  );
  return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
}
