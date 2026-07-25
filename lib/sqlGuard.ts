const TABLE_COLUMNS: Record<string, Set<string>> = {
  cases: new Set(["case_id", "fir_no", "district", "station", "date_reported", "crime_type", "status", "narrative"]),
  persons: new Set(["person_id", "name", "age", "gender", "address_area"]),
  case_persons: new Set(["id", "case_id", "person_id", "role"]),
  locations: new Set(["location_id", "case_id", "lat", "lon", "area_name"]),
  network_edges: new Set(["edge_id", "person_a", "person_b", "shared_case_id", "weight"]),
};

const forbidden = /\b(DROP|DELETE|UPDATE|INSERT|REPLACE|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|TRIGGER)\b|;--|\/\*/i;
const functions = new Set([
  "count", "sum", "avg", "min", "max", "round", "date", "datetime", "strftime",
  "coalesce", "lower", "upper", "cast", "julianday", "abs", "length",
]);
const keywords = new Set([
  "select", "from", "where", "join", "left", "inner", "outer", "on", "as", "and", "or", "not",
  "in", "is", "null", "like", "between", "group", "by", "order", "asc", "desc", "limit", "offset",
  "distinct", "having", "case", "when", "then", "else", "end", "with", "recursive", "union", "all",
  "current_date", "now", "integer", "real", "text",
]);

export function guardSql(input: string): string {
  let sql = input.trim();
  if (!/^SELECT\b/i.test(sql) && !/^WITH\b/i.test(sql)) throw new Error("Only SELECT queries are allowed.");
  if (forbidden.test(sql)) throw new Error("The query contains a forbidden operation.");
  const semicolons = (sql.match(/;/g) || []).length;
  if (semicolons > 1 || (semicolons === 1 && !sql.endsWith(";"))) throw new Error("Multiple statements are not allowed.");
  sql = sql.replace(/;$/, "").trim();

  const referencedTables = [...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][\w]*)/gi)].map((match) => match[1].toLowerCase());
  if (!referencedTables.length || referencedTables.some((table) => !TABLE_COLUMNS[table])) {
    throw new Error("The query references a table outside the approved schema.");
  }

  const allowedColumns = new Set(referencedTables.flatMap((table) => [...TABLE_COLUMNS[table]]));
  const aliases = new Set(
    [...sql.matchAll(/\b(?:FROM|JOIN)\s+[a-z_][\w]*\s+(?:AS\s+)?([a-z_][\w]*)/gi)]
      .map((match) => match[1].toLowerCase())
      .filter((value) => !keywords.has(value)),
  );
  for (const match of sql.matchAll(/\b([a-z_][\w]*)\.([a-z_][\w]*)\b/gi)) {
    const qualifier = match[1].toLowerCase();
    const column = match[2].toLowerCase();
    if (![...referencedTables, ...aliases].includes(qualifier) || !allowedColumns.has(column)) {
      throw new Error("The query references a column outside the approved schema.");
    }
  }

  // Validate bare identifiers conservatively while allowing aliases, literals and SQL syntax.
  const scrubbed = sql
    .replace(/'([^']|'')*'/g, " ")
    .replace(/"([^"]|"")*"/g, " ")
    .replace(/\b\d+(?:\.\d+)?\b/g, " ");
  const identifiers = scrubbed.match(/\b[a-z_][\w]*\b/gi) || [];
  const known = new Set([...Object.keys(TABLE_COLUMNS), ...allowedColumns, ...aliases, ...keywords, ...functions]);
  for (let index = 0; index < identifiers.length; index += 1) {
    const token = identifiers[index].toLowerCase();
    const previous = identifiers[index - 1]?.toLowerCase();
    if (known.has(token) || previous === "as") continue;
    // CTE and output aliases are safe identifiers because SQLite resolves them within this SELECT.
    const aliasPattern = new RegExp(`\\bAS\\s+${token}\\b|\\bWITH\\s+${token}\\s+AS`, "i");
    if (!aliasPattern.test(scrubbed)) throw new Error(`Unknown SQL identifier: ${token}`);
  }

  if (!/\bLIMIT\s+\d+\b/i.test(sql)) sql += " LIMIT 50";
  return sql;
}
