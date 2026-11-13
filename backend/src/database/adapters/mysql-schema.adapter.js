
/**
 * MySQL Schema Adapter
 *
 * Responsible for reading schema information from a MySQL database.
 * This adapter does not manage credentials or store metadata.
 */

/**
 * Discover all tables and views in the specified MySQL database.
 *
 * @param {object} connection - Active mysql2 promise connection.
 * @param {string} databaseName - Customer database name.
 * @returns {Promise<object[]>} Discovered tables and views.
 */
export async function discoverSchemaObjects(connection, databaseName) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    databaseName.trim().length === 0
  ){
    throw new TypeError('A valid database name is required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       TABLE_NAME,
       TABLE_TYPE,
       ENGINE
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
     ORDER BY TABLE_NAME`,
    [databaseName.trim()]
  );

  return rows.map((row) => ({
    schemaName: databaseName,
    objectName: row.TABLE_NAME,
    objectType: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
    engine: row.ENGINE ?? null,
  }));
}
