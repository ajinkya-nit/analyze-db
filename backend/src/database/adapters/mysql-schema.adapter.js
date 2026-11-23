
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

/**
 * Discover tables and views with their structural properties.
 */
export async function discoverSchemaObjects(connection, databaseName) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    databaseName.trim().length === 0
  ) {
    throw new TypeError('A valid database name is required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       TABLE_NAME,
       TABLE_TYPE,
       ENGINE,
       TABLE_COMMENT,
       TABLE_ROWS,
       DATA_LENGTH,
       INDEX_LENGTH,
       DATA_FREE,
       AUTO_INCREMENT,
       CREATE_TIME,
       UPDATE_TIME,
       TABLE_COLLATION,
       CREATE_OPTIONS
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
    tableComment: row.TABLE_COMMENT ?? null,
    estimatedRows:
      row.TABLE_TYPE === 'BASE TABLE'
        ? row.TABLE_ROWS === null ? null : Number(row.TABLE_ROWS)
        : null,
    dataLengthBytes:
      row.DATA_LENGTH === null ? null : Number(row.DATA_LENGTH),
    indexLengthBytes:
      row.INDEX_LENGTH === null ? null : Number(row.INDEX_LENGTH),
    dataFreeBytes:
      row.DATA_FREE === null ? null : Number(row.DATA_FREE),
    autoIncrement:
      row.AUTO_INCREMENT === null ? null : Number(row.AUTO_INCREMENT),
    createdAt: row.CREATE_TIME ?? null,
    updatedAt: row.UPDATE_TIME ?? null,
    collation: row.TABLE_COLLATION ?? null,
    createOptions: row.CREATE_OPTIONS ?? null,
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

/**
 * Discover primary-key columns for a specific table.
 *
 * @param {object} connection - Active mysql2 promise connection.
 * @param {string} databaseName - Customer database name.
 * @param {string} tableName - Table name.
 * @returns {Promise<object[]>} Primary-key metadata.
 */
export async function discoverPrimaryKeys(
  connection,
  databaseName,
  tableName
) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    databaseName.trim().length === 0 ||
    typeof tableName !== 'string' ||
    tableName.trim().length === 0
  ) {
    throw new TypeError('Valid database and table names are required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       COLUMN_NAME,
       ORDINAL_POSITION
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [databaseName.trim(), tableName.trim()]
  );

  return rows.map((row) => ({
    columnName: row.COLUMN_NAME,
    position: row.ORDINAL_POSITION,
  }));
}



/**
 * Discover foreign-key relationships for a specific table.
 *
 * @param {object} connection - Active mysql2 promise connection.
 * @param {string} databaseName - Customer database name.
 * @param {string} tableName - Table name.
 * @returns {Promise<object[]>} Foreign-key metadata.
 */
export async function discoverForeignKeys(
  connection,
  databaseName,
  tableName
) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    databaseName.trim().length === 0 ||
    typeof tableName !== 'string' ||
    tableName.trim().length === 0
  ) {
    throw new TypeError('Valid database and table names are required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       kcu.CONSTRAINT_NAME,
       kcu.COLUMN_NAME,
       kcu.ORDINAL_POSITION,
       kcu.REFERENCED_TABLE_SCHEMA,
       kcu.REFERENCED_TABLE_NAME,
       kcu.REFERENCED_COLUMN_NAME,
       rc.UPDATE_RULE,
       rc.DELETE_RULE
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
     LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
       ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
       AND rc.TABLE_NAME = kcu.TABLE_NAME
     WHERE kcu.TABLE_SCHEMA = ?
       AND kcu.TABLE_NAME = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY
       kcu.CONSTRAINT_NAME,
       kcu.ORDINAL_POSITION`,
    [databaseName.trim(), tableName.trim()]
  );

  return rows.map((row) => ({
    constraintName: row.CONSTRAINT_NAME,
    columnName: row.COLUMN_NAME,
    position: row.ORDINAL_POSITION,
    referencedSchema: row.REFERENCED_TABLE_SCHEMA,
    referencedTable: row.REFERENCED_TABLE_NAME,
    referencedColumn: row.REFERENCED_COLUMN_NAME,
    updateRule: row.UPDATE_RULE,
    deleteRule: row.DELETE_RULE,
  }));
}



/**
 * Discover all indexes belonging to a specific table.
 *
 * Supports:
 * - Primary and unique indexes
 * - Composite indexes
 * - Prefix indexes
 * - ASC / DESC index columns
 * - Functional indexes (MySQL 8+)
 *
 * @param {object} connection - Active mysql2 promise connection.
 * @param {string} databaseName - Customer database name.
 * @param {string} tableName - Table name.
 * @returns {Promise<object[]>} Discovered index metadata.
 */
export async function discoverTableIndexes(
  connection,
  databaseName,
  tableName
) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    databaseName.trim().length === 0 ||
    typeof tableName !== 'string' ||
    tableName.trim().length === 0
  ) {
    throw new TypeError('Valid database and table names are required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       INDEX_NAME,
       NON_UNIQUE,
       SEQ_IN_INDEX,
       COLUMN_NAME,
       COLLATION,
       SUB_PART,
       INDEX_TYPE,
       COMMENT,
       INDEX_COMMENT,
       IS_VISIBLE,
       EXPRESSION
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [databaseName.trim(), tableName.trim()]
  );

  const indexes = new Map();

  for (const row of rows) {
    if (!indexes.has(row.INDEX_NAME)) {
      indexes.set(row.INDEX_NAME, {
        indexName: row.INDEX_NAME,
        isUnique: Number(row.NON_UNIQUE) === 0,
        isPrimary: row.INDEX_NAME === 'PRIMARY',
        indexType: row.INDEX_TYPE,
        isVisible: row.IS_VISIBLE === 'YES',
        comment: row.COMMENT || null,
        indexComment: row.INDEX_COMMENT || null,
        columns: [],
      });
    }

    indexes.get(row.INDEX_NAME).columns.push({
      columnName: row.COLUMN_NAME ?? null,
      expression: row.EXPRESSION ?? null,
      position: row.SEQ_IN_INDEX,
      sortDirection:
        row.COLLATION === 'A'
          ? 'ASC'
          : row.COLLATION === 'D'
            ? 'DESC'
            : null,
      prefixLength: row.SUB_PART ?? null,
    });
  }

  return Array.from(indexes.values());
}



/**
 * Discover a MySQL view's definition and properties.
 *
 * VIEW_DEFINITION can be null when the connected user lacks
 * sufficient privileges to see the definition.
 */
export async function discoverViewDetails(
  connection,
  databaseName,
  viewName
) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    !databaseName.trim() ||
    typeof viewName !== 'string' ||
    !viewName.trim()
  ) {
    throw new TypeError('Valid database and view names are required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       VIEW_DEFINITION,
       CHECK_OPTION,
       IS_UPDATABLE,
       SECURITY_TYPE,
       CHARACTER_SET_CLIENT,
       COLLATION_CONNECTION
     FROM INFORMATION_SCHEMA.VIEWS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?`,
    [databaseName.trim(), viewName.trim()]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    definition: row.VIEW_DEFINITION ?? null,
    checkOption: row.CHECK_OPTION ?? null,
    isUpdatable: row.IS_UPDATABLE === 'YES',
    securityType: row.SECURITY_TYPE ?? null,
    characterSetClient: row.CHARACTER_SET_CLIENT ?? null,
    collationConnection: row.COLLATION_CONNECTION ?? null,
  };
}

/**
 * Discover the tables and views referenced by a view.
 *
 * These dependencies are distinct from declared foreign keys.
 */
export async function discoverViewDependencies(
  connection,
  databaseName,
  viewName
) {
  if (!connection) {
    throw new TypeError('A MySQL connection is required.');
  }

  if (
    typeof databaseName !== 'string' ||
    !databaseName.trim() ||
    typeof viewName !== 'string' ||
    !viewName.trim()
  ) {
    throw new TypeError('Valid database and view names are required.');
  }

  const [rows] = await connection.execute(
    `SELECT
       VIEW_SCHEMA,
       VIEW_NAME,
       TABLE_SCHEMA,
       TABLE_NAME
     FROM INFORMATION_SCHEMA.VIEW_TABLE_USAGE
     WHERE VIEW_SCHEMA = ?
       AND VIEW_NAME = ?
     ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    [databaseName.trim(), viewName.trim()]
  );

  return rows.map((row) => ({
    referencedSchema: row.TABLE_SCHEMA,
    referencedObject: row.TABLE_NAME,
    referencedObjectType: null,
  }));
}
