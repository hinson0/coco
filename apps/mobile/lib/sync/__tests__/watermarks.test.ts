import { openDatabaseAsync } from "expo-sqlite";
import { createTables } from "../../db/schema";
import { getWatermark, setLastPushAt, setLastPullAt } from "../watermarks";

async function makeDb() {
  const db = await openDatabaseAsync(":memory:");
  await createTables(db);
  return db;
}

describe("watermarks", () => {
  it("returns null watermarks for unknown table", async () => {
    const db = await makeDb();
    const wm = await getWatermark(db, "transactions");
    expect(wm.last_push_at).toBeNull();
    expect(wm.last_pull_at).toBeNull();
  });

  it("setLastPushAt stores and retrieves correctly", async () => {
    const db = await makeDb();
    await setLastPushAt(db, "transactions", "2026-04-09T10:00:00.000Z");
    const wm = await getWatermark(db, "transactions");
    expect(wm.last_push_at).toBe("2026-04-09T10:00:00.000Z");
    expect(wm.last_pull_at).toBeNull();
  });

  it("setLastPullAt stores and retrieves correctly", async () => {
    const db = await makeDb();
    await setLastPullAt(db, "accounts", "2026-04-09T12:00:00.000Z");
    const wm = await getWatermark(db, "accounts");
    expect(wm.last_pull_at).toBe("2026-04-09T12:00:00.000Z");
    expect(wm.last_push_at).toBeNull();
  });

  it("setLastPushAt and setLastPullAt are independent per table", async () => {
    const db = await makeDb();
    await setLastPushAt(db, "transactions", "2026-04-09T10:00:00.000Z");
    await setLastPushAt(db, "categories", "2026-04-09T11:00:00.000Z");
    const tx = await getWatermark(db, "transactions");
    const cat = await getWatermark(db, "categories");
    expect(tx.last_push_at).toBe("2026-04-09T10:00:00.000Z");
    expect(cat.last_push_at).toBe("2026-04-09T11:00:00.000Z");
  });

  it("setLastPushAt is idempotent (upsert)", async () => {
    const db = await makeDb();
    await setLastPushAt(db, "transactions", "2026-04-09T10:00:00.000Z");
    await setLastPushAt(db, "transactions", "2026-04-09T11:00:00.000Z");
    const wm = await getWatermark(db, "transactions");
    expect(wm.last_push_at).toBe("2026-04-09T11:00:00.000Z");
  });
});
