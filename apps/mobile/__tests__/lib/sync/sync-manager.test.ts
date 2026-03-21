// apps/mobile/__tests__/lib/sync/sync-manager.test.ts
import * as SQLite from "expo-sqlite";
import {
  initQueue,
  enqueue,
  getPending,
  getCount,
  markSyncing,
} from "@/lib/queue/operation-queue";
import { createSyncManager } from "@/lib/sync/sync-manager";

let db: SQLite.SQLiteDatabase;

const makeConfig = (
  overrides: Partial<{
    apiFetch: jest.Mock;
    invalidateQueries: jest.Mock;
    isOnline: () => boolean;
  }> = {}
) => ({
  db,
  apiFetch: jest.fn().mockResolvedValue({ success: true, data: { id: "server-id-1" } }),
  invalidateQueries: jest.fn().mockResolvedValue(undefined),
  isOnline: () => true,
  ...overrides,
});

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync(":memory:");
  await initQueue(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe("SyncManager — basic sync", () => {
  it("processes a pending create_transaction and removes it from the queue", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 100, category_id: "cat_1", note: "coffee" },
    });

    const config = makeConfig();
    const manager = createSyncManager(config);
    await manager.sync();

    expect(config.apiFetch).toHaveBeenCalledTimes(1);
    expect(config.apiFetch).toHaveBeenCalledWith(
      "/api/record/manual",
      expect.objectContaining({ method: "POST" })
    );
    expect(await getCount(db)).toBe(0);
  });

  it("calls invalidateQueries after sync completes", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 50 },
    });

    const config = makeConfig();
    const manager = createSyncManager(config);
    await manager.sync();

    expect(config.invalidateQueries).toHaveBeenCalledWith([
      "transactions",
      "chat-messages",
    ]);
  });

  it("processes a pending update_transaction via PATCH", async () => {
    await enqueue(db, {
      type: "update_transaction",
      payload: { id: "tx-abc", amount: 200 },
    });

    const config = makeConfig();
    const manager = createSyncManager(config);
    await manager.sync();

    expect(config.apiFetch).toHaveBeenCalledWith(
      "/api/transactions/tx-abc",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(await getCount(db)).toBe(0);
  });

  it("processes a pending delete_transaction via DELETE", async () => {
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "tx-xyz" },
    });

    const config = makeConfig();
    const manager = createSyncManager(config);
    await manager.sync();

    expect(config.apiFetch).toHaveBeenCalledWith(
      "/api/transactions/tx-xyz",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(await getCount(db)).toBe(0);
  });
});

describe("SyncManager — offline guard", () => {
  it("skips sync when isOnline returns false", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 100 },
    });

    const config = makeConfig({ isOnline: () => false });
    const manager = createSyncManager(config);
    await manager.sync();

    expect(config.apiFetch).not.toHaveBeenCalled();
    expect(await getCount(db)).toBe(1);
  });
});

describe("SyncManager — concurrency guard", () => {
  it("does not run concurrent syncs (isSyncing flag)", async () => {
    // Enqueue one operation
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });

    // Track how many concurrent calls are in-flight at once
    let inFlight = 0;
    let maxInFlight = 0;

    const config = makeConfig({
      apiFetch: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // Yield to let any concurrent sync attempt start
        await new Promise((r) => setImmediate(r));
        inFlight -= 1;
        return { success: true, data: { id: "srv-1" } };
      }),
    });

    const manager = createSyncManager(config);

    // Fire two syncs simultaneously
    await Promise.all([manager.sync(), manager.sync()]);

    // Only one should have actually run the fetch at a time
    expect(maxInFlight).toBe(1);
    // Queue is empty after sync
    expect(await getCount(db)).toBe(0);
  });
});

describe("SyncManager — dependency skipping", () => {
  it("skips an operation whose depends_on is still in the queue", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 50 },
    });

    // Manually mark create as syncing so it's no longer in getPending,
    // but still exists in the queue — then add a dependent delete
    await markSyncing(db, createId);

    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_abc" },
      dependsOn: createId,
    });

    const config = makeConfig();
    const manager = createSyncManager(config);
    await manager.sync();

    // apiFetch should NOT be called because the delete's dependency still exists
    expect(config.apiFetch).not.toHaveBeenCalled();
    // The delete op is still pending in the queue
    const pending = await getPending(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe("delete_transaction");
  });
});

describe("SyncManager — dependency chain (create then delete)", () => {
  it("processes create first, updates dependent delete payload, then processes delete", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 75, temp_id: "temp_999" },
    });

    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_999" },
      dependsOn: createId,
    });

    // First sync call: processes create, removes it; delete dep is now gone
    const apiFetch = jest
      .fn()
      // First call: create → returns server ID
      .mockResolvedValueOnce({ success: true, data: { id: "real-id-42" } })
      // Second call: delete → success (no body needed)
      .mockResolvedValueOnce(undefined);

    const config = makeConfig({ apiFetch });
    const manager = createSyncManager(config);

    // First sync pass: create is processed and removed; delete dep resolves
    await manager.sync();

    // Both ops processed within the same sync pass (create removed → dep gone → delete runs)
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/record/manual",
      expect.objectContaining({ method: "POST" })
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/transactions/temp_999",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(await getCount(db)).toBe(0);
  });
});

describe("SyncManager — network error handling", () => {
  it("marks operation pending and stops processing on network error", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    await enqueue(db, { type: "create_transaction", payload: { amount: 20 } });

    const apiFetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const config = makeConfig({ apiFetch });
    const manager = createSyncManager(config);
    await manager.sync();

    // Only first op attempted; second never touched
    expect(apiFetch).toHaveBeenCalledTimes(1);
    // Both ops still in queue (first reset to pending, second untouched)
    expect(await getCount(db)).toBe(2);
  });
});

describe("SyncManager — business error retry and failure cascade", () => {
  it("increments retries on business error (< MAX_RETRIES)", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });

    const apiFetch = jest
      .fn()
      .mockRejectedValue(new Error("Validation failed"));

    const config = makeConfig({ apiFetch });
    const manager = createSyncManager(config);

    // First attempt: retries becomes 1
    await manager.sync();
    let pending = await getPending(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].retries).toBe(1);

    // Second attempt: retries becomes 2
    await manager.sync();
    pending = await getPending(db);
    expect(pending[0].retries).toBe(2);
  });

  it("marks failed and cascades to dependents after MAX_RETRIES", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10 },
    });
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_dep" },
      dependsOn: createId,
    });

    // Simulate an op that already has 2 retries so next attempt hits MAX (3)
    // We do this by running sync twice to get retries=2, then a third time
    const apiFetch = jest.fn().mockRejectedValue(new Error("Server error"));
    const config = makeConfig({ apiFetch });
    const manager = createSyncManager(config);

    await manager.sync(); // retries → 1
    await manager.sync(); // retries → 2
    await manager.sync(); // retries → 3 → markFailed + cascade

    // No more pending ops (failed status is not returned by getPending)
    const pending = await getPending(db);
    expect(pending).toHaveLength(0);
    // Total count includes failed ops
    expect(await getCount(db)).toBe(2); // create=failed, delete=failed (cascade)
  });
});
