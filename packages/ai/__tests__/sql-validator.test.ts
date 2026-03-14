import { describe, it, expect } from "vitest";
import { validateSql } from "../src/sql-validator";

describe("validateSql", () => {
  it("should allow simple SELECT", () => {
    expect(validateSql("SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL")).toBe(true);
  });
  it("should allow SELECT with JOIN on categories", () => {
    expect(validateSql("SELECT t.amount, c.name FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.deleted_at IS NULL")).toBe(true);
  });
  it("should reject DROP", () => { expect(validateSql("DROP TABLE transactions")).toBe(false); });
  it("should reject INSERT", () => { expect(validateSql("INSERT INTO transactions (amount) VALUES (100)")).toBe(false); });
  it("should reject UPDATE", () => { expect(validateSql("UPDATE transactions SET amount = 0")).toBe(false); });
  it("should reject DELETE", () => { expect(validateSql("DELETE FROM transactions")).toBe(false); });
  it("should reject queries on non-whitelisted tables", () => { expect(validateSql("SELECT * FROM nl_query_logs")).toBe(false); });
  it("should reject queries on budgets table", () => { expect(validateSql("SELECT * FROM budgets")).toBe(false); });
  it("should reject pg_read_file", () => { expect(validateSql("SELECT pg_read_file('/etc/passwd')")).toBe(false); });
  it("should reject dblink", () => { expect(validateSql("SELECT dblink('host=evil', 'SELECT 1')")).toBe(false); });
  it("should reject multiple statements", () => { expect(validateSql("SELECT 1; DROP TABLE transactions")).toBe(false); });
  it("should reject UNION with non-whitelisted table", () => { expect(validateSql("SELECT amount FROM transactions UNION SELECT question FROM nl_query_logs")).toBe(false); });
});
