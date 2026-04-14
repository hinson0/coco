import { openDatabaseAsync } from "expo-sqlite";
import { createTables } from "../../db/schema";
import { push, pull } from "../sync-service";
import { getWatermark } from "../watermarks";
import { apiFetch } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function makeDb() {
  const db = await openDatabaseAsync(":memory:");
  await createTables(db);
  return db;
}

describe("push()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({ ok: true });
  });

  it("sends transaction data to /sync/push", async () => {
    const db = await makeDb();
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type, updated_at) VALUES ('cat1', '餐饮', '🍔', 'expense', '2026-04-09T12:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, updated_at)
       VALUES ('tx1', 'u1', 'cat1', 100.0, 'expense', '午饭', '2026-04-09T12:00:00.000Z', 'manual', '2026-04-09T12:00:00.000Z', '2026-04-09T12:00:00.000Z')`,
    );

    await push(db, "u1");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sync/push",
      expect.objectContaining({ method: "POST" }),
    );
    const callBody = JSON.parse(
      (mockApiFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.transactions).toHaveLength(1);
    expect(callBody.transactions[0].id).toBe("tx1");
  });

  it("updates last_push_at watermark after success", async () => {
    const db = await makeDb();
    // 需要有数据才会触发 push（空 payload 会跳过）
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type, updated_at) VALUES ('cat1', '餐饮', '🍔', 'expense', '2026-04-09T12:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, updated_at)
       VALUES ('tx1', 'u1', 'cat1', 100.0, 'expense', '午饭', '2026-04-09T12:00:00.000Z', 'manual', '2026-04-09T12:00:00.000Z', '2026-04-09T12:00:00.000Z')`,
    );

    await push(db, "u1");

    const wm = await getWatermark(db, "transactions");
    expect(wm.last_push_at).not.toBeNull();
  });

  it("does not send records older than last_push_at", async () => {
    const db = await makeDb();
    // 设置所有表的水位线在记录之后
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('transactions', '2026-04-09T13:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('categories', '2026-04-09T13:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('accounts', '2026-04-09T13:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('budgets', '2026-04-09T13:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('chat_messages', '2026-04-09T13:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('user_profiles', '2026-04-09T13:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type, updated_at) VALUES ('cat1', '餐饮', '🍔', 'expense', '2026-04-09T10:00:00.000Z')`,
    );
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, updated_at)
       VALUES ('tx-old', 'u1', 'cat1', 50.0, 'expense', '', '2026-04-09T10:00:00.000Z', 'manual', '2026-04-09T10:00:00.000Z', '2026-04-09T10:00:00.000Z')`,
    );

    await push(db, "u1");

    // 所有记录都在水位线之前 → 空 payload → 跳过网络请求
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("skips network request when no data exists", async () => {
    const db = await makeDb();

    await push(db, "u1");

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe("pull()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const emptyPayload = {
    user_profiles: [],
    categories: [],
    accounts: [],
    budgets: [],
    transactions: [],
    chat_messages: [],
  };

  it("upserts remote transaction into empty local db", async () => {
    const db = await makeDb();
    // 先插入 category（transactions 的 FK 依赖）
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type, updated_at) VALUES ('cat1', '餐饮', '🍔', 'expense', '2026-04-09T10:00:00.000Z')`,
    );
    mockApiFetch.mockResolvedValueOnce({
      ...emptyPayload,
      transactions: [
        {
          id: "tx1",
          user_id: "u1",
          category_id: "cat1",
          amount: 100,
          type: "expense",
          note: "午饭",
          occurred_at: "2026-04-09T12:00:00.000Z",
          source: "manual",
          raw_input: null,
          receipt_url: null,
          ai_confidence: null,
          created_at: "2026-04-09T12:00:00.000Z",
          updated_at: "2026-04-09T12:00:00.000Z",
          deleted_at: null,
          account_id: null,
        },
      ],
    });

    await pull(db, "u1");

    const tx = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM transactions WHERE id = 'tx1'",
    );
    expect(tx).not.toBeNull();
  });

  it("LWW: remote record newer than local => remote wins", async () => {
    const db = await makeDb();
    await db.runAsync(
      `INSERT INTO categories (id, user_id, name, icon, type, is_default, updated_at)
       VALUES ('cat1', 'u1', '老名字', '🍔', 'expense', 0, '2026-04-09T08:00:00.000Z')`,
    );
    mockApiFetch.mockResolvedValueOnce({
      ...emptyPayload,
      categories: [
        {
          id: "cat1",
          user_id: "u1",
          name: "新名字",
          icon: "🍕",
          type: "expense",
          is_default: 0,
          deleted_at: null,
          updated_at: "2026-04-09T10:00:00.000Z",
        },
      ],
    });

    await pull(db, "u1");

    const cat = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM categories WHERE id = 'cat1'",
    );
    expect(cat?.name).toBe("新名字");
  });

  it("LWW: local record newer than remote => local wins", async () => {
    const db = await makeDb();
    await db.runAsync(
      `INSERT INTO categories (id, user_id, name, icon, type, is_default, updated_at)
       VALUES ('cat1', 'u1', '本地名字', '🍔', 'expense', 0, '2026-04-09T12:00:00.000Z')`,
    );
    mockApiFetch.mockResolvedValueOnce({
      ...emptyPayload,
      categories: [
        {
          id: "cat1",
          user_id: "u1",
          name: "远端名字",
          icon: "🍕",
          type: "expense",
          is_default: 0,
          deleted_at: null,
          updated_at: "2026-04-09T08:00:00.000Z",
        },
      ],
    });

    await pull(db, "u1");

    const cat = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM categories WHERE id = 'cat1'",
    );
    expect(cat?.name).toBe("本地名字");
  });

  it("updates last_pull_at watermark after success", async () => {
    const db = await makeDb();
    mockApiFetch.mockResolvedValueOnce(emptyPayload);

    await pull(db, "u1");

    const wm = await getWatermark(db, "transactions");
    expect(wm.last_pull_at).not.toBeNull();
  });
});
