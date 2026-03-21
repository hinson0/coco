// apps/mobile/__tests__/lib/queue/operation-queue.test.ts
import * as SQLite from "expo-sqlite";
import {
  initQueue,
  enqueue,
  getPending,
  remove,
  getCount,
  markSyncing,
  markPending,
  markFailed,
  incrementRetry,
  resetSyncingToPending,
  markFailedByDependency,
} from "@/lib/queue/operation-queue";

let db: SQLite.SQLiteDatabase;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync(":memory:");
  await initQueue(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe("operation-queue", () => {
  it("should initialize the table without error", async () => {
    const count = await getCount(db);
    expect(count).toBe(0);
  });

  it("should enqueue a create_transaction operation", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 25, category_id: "cat_1", note: "午饭" },
    });
    const pending = await getPending(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe("create_transaction");
    expect(JSON.parse(pending[0].payload).amount).toBe(25);
    expect(pending[0].status).toBe("pending");
  });

  it("should return pending ops in created_at order", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10, note: "first" },
    });
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 20, note: "second" },
    });
    const pending = await getPending(db);
    expect(JSON.parse(pending[0].payload).note).toBe("first");
    expect(JSON.parse(pending[1].payload).note).toBe("second");
  });

  it("should remove an operation by id", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 25 },
    });
    const [op] = await getPending(db);
    await remove(db, op.id);
    expect(await getCount(db)).toBe(0);
  });
});

describe("status transitions", () => {
  it("should mark operation as syncing", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    const [op] = await getPending(db);
    await markSyncing(db, op.id);
    const pending = await getPending(db);
    expect(pending).toHaveLength(0);
  });

  it("should mark syncing back to pending", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    const [op] = await getPending(db);
    await markSyncing(db, op.id);
    await markPending(db, op.id);
    expect(await getPending(db)).toHaveLength(1);
  });

  it("should reset all syncing to pending on startup", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    await enqueue(db, { type: "create_transaction", payload: { amount: 20 } });
    const ops = await getPending(db);
    await markSyncing(db, ops[0].id);
    await markSyncing(db, ops[1].id);
    await resetSyncingToPending(db);
    expect(await getPending(db)).toHaveLength(2);
  });
});

describe("depends_on", () => {
  it("should enqueue with dependency", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10 },
    });
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_123" },
      dependsOn: createId,
    });
    const pending = await getPending(db);
    expect(pending[1].depends_on).toBe(createId);
  });

  it("should cascade failure to dependents", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10 },
    });
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_123" },
      dependsOn: createId,
    });
    await markFailed(db, createId, "server error");
    await markFailedByDependency(db, createId);

    const pending = await getPending(db);
    expect(pending).toHaveLength(0);
  });
});
