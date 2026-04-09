import { openDatabaseAsync } from "expo-sqlite";
import { createTables } from "../../db/schema";
import { push } from "../sync-service";
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
      `INSERT INTO categories (id, name, icon, type, updated_at) VALUES ('cat1', '餐饮', '🍔', 'expense', '2026-04-09T12:00:00.000Z')`
    );
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, updated_at)
       VALUES ('tx1', 'u1', 'cat1', 100.0, 'expense', '午饭', '2026-04-09T12:00:00.000Z', 'manual', '2026-04-09T12:00:00.000Z', '2026-04-09T12:00:00.000Z')`
    );

    await push(db, "u1");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/sync/push",
      expect.objectContaining({ method: "POST" })
    );
    const callBody = JSON.parse((mockApiFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.transactions).toHaveLength(1);
    expect(callBody.transactions[0].id).toBe("tx1");
  });

  it("updates last_push_at watermark after success", async () => {
    const db = await makeDb();

    await push(db, "u1");

    const wm = await getWatermark(db, "transactions");
    expect(wm.last_push_at).not.toBeNull();
  });

  it("does not send records older than last_push_at", async () => {
    const db = await makeDb();
    await db.runAsync(
      `INSERT INTO sync_watermarks (table_name, last_push_at) VALUES ('transactions', '2026-04-09T13:00:00.000Z')`
    );
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type, updated_at) VALUES ('cat1', '餐饮', '🍔', 'expense', '2026-04-09T10:00:00.000Z')`
    );
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, updated_at)
       VALUES ('tx-old', 'u1', 'cat1', 50.0, 'expense', '', '2026-04-09T10:00:00.000Z', 'manual', '2026-04-09T10:00:00.000Z', '2026-04-09T10:00:00.000Z')`
    );

    await push(db, "u1");

    const callBody = JSON.parse((mockApiFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.transactions).toHaveLength(0);
  });

  it("sends empty arrays when no data exists", async () => {
    const db = await makeDb();

    await push(db, "u1");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse((mockApiFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.transactions).toHaveLength(0);
    expect(callBody.categories).toHaveLength(0);
  });
});
