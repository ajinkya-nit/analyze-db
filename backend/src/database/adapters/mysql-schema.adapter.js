
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



/**
 * Discover columns belonging to a specific table or view.
 *
 * @param {object} connection - Active mysql2 promise connection.
 * @param {string} databaseName - Customer database name.
 * @param {string} tableName - Table or view name.
 * @returns {Promise<object[]>} Discovered column metadata.
 */
export async function discoverTableColumns(
  connection,
  databaseName,
  tableName
) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    databaseName.trim().length === 0
  ) {
    throw new TypeError('A valid database name is required.');
  }

  if (
    typeof tableName !== 'string' ||
    tableName.trim().length === 0
  ) {
    throw new TypeError('A valid table name is required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       COLUMN_NAME,
       DATA_TYPE,
       COLUMN_TYPE,
       IS_NULLABLE,
       COLUMN_DEFAULT,
       COLUMN_KEY,
       EXTRA,
       ORDINAL_POSITION
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [databaseName.trim(), tableName.trim()]
  );

  return rows.map((row) => ({
    columnName: row.COLUMN_NAME,
    dataType: row.DATA_TYPE,
    columnType: row.COLUMN_TYPE,
    isNullable: row.IS_NULLABLE === 'YES',
    defaultValue: row.COLUMN_DEFAULT,
    isPrimaryKey: row.COLUMN_KEY === 'PRI',
    isAutoIncrement: row.EXTRA
      .toLowerCase()
      .includes('auto_increment'),
    position: row.ORDINAL_POSITION,
  }));
}

