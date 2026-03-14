const ALLOWED_TABLES = ["transactions", "categories"];
const FORBIDDEN_KEYWORDS = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "EXEC"];
const FORBIDDEN_FUNCTIONS = ["pg_read_file", "pg_read_binary_file", "pg_ls_dir", "dblink", "lo_import", "lo_export", "copy", "pg_sleep"];

export function validateSql(sql: string): boolean {
  const normalized = sql.trim().replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();
  if (!upper.startsWith("SELECT")) return false;
  if (normalized.includes(";")) return false;
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(normalized)) return false;
  }
  for (const fn of FORBIDDEN_FUNCTIONS) {
    const regex = new RegExp(`\\b${fn}\\b`, "i");
    if (regex.test(normalized)) return false;
  }
  const tableRefs = normalized.match(/(?:FROM|JOIN)\s+(\w+)/gi) ?? [];
  for (const ref of tableRefs) {
    const tableName = ref.replace(/^(?:FROM|JOIN)\s+/i, "").toLowerCase();
    if (!ALLOWED_TABLES.includes(tableName)) return false;
  }
  return true;
}
