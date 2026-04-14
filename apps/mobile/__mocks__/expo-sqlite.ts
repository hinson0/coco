/**
 * Jest manual mock for expo-sqlite.
 * Uses better-sqlite3 (a real SQLite engine) so SQL logic is fully exercised.
 * Wraps the synchronous better-sqlite3 API in the async interface that
 * expo-sqlite exposes.
 */
import BetterSQLite3 from "better-sqlite3";

export type SQLiteDatabase = InstanceType<typeof MockSQLiteDatabase>;

class MockSQLiteDatabase {
  private readonly db: BetterSQLite3.Database;

  constructor(name: string) {
    // ":memory:" is supported natively by better-sqlite3
    this.db = new BetterSQLite3(name);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    const stmt = this.db.prepare(sql);
    stmt.run(...(params as unknown[]));
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...(params as unknown[])) as T | undefined;
    return row ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params as unknown[])) as T[];
  }

  async withExclusiveTransactionAsync<T>(
    fn: (txn: MockSQLiteDatabase) => Promise<T>,
  ): Promise<T> {
    this.db.exec("BEGIN EXCLUSIVE");
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  return new MockSQLiteDatabase(name);
}
