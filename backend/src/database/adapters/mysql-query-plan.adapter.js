const QUERY_TIMEOUT_MS = 7_000;
const MAX_EXECUTION_TIME_MS = 5_000;

/**
 * Obtain a JSON execution plan without executing the SELECT query.
 * The caller must validate SQL before passing it here.
 */
export async function explainSelectQuery(connection, sql) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (typeof sql !== 'string' || !sql.trim()) {
    throw new TypeError('A valid SELECT query is required.');
  }

  await connection.query(
    `SET SESSION max_execution_time = ${MAX_EXECUTION_TIME_MS}`
  );

  const [rows] = await connection.query({
    sql: `EXPLAIN FORMAT=JSON ${sql}`,
    timeout: QUERY_TIMEOUT_MS,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('MySQL returned an empty execution plan.');
  }

  const rawPlan = Object.values(rows[0])[0];

  if (typeof rawPlan === 'string') {
    return JSON.parse(rawPlan);
  }

  if (rawPlan && typeof rawPlan === 'object') {
    return rawPlan;
  }

  throw new Error('MySQL returned an invalid execution plan.');
}