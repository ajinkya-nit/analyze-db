
/**
 * Generate a structural summary from persisted schema metadata.
 */
export function buildSchemaSummary(schemaMetadata) {
  const tables = schemaMetadata.filter(
    (object) => object.object_type === 'table'
  );

  const views = schemaMetadata.filter(
    (object) => object.object_type === 'view'
  );

  const dataTypeDistribution = {};

  let totalColumns = 0;
  let totalIndexes = 0;
  let totalPrimaryKeyColumns = 0;
  let totalForeignKeyColumns = 0;
  let totalViewDependencies = 0;
  let totalEstimatedRows = 0;
  let totalDataLengthBytes = 0;
  let totalIndexLengthBytes = 0;

  let tablesWithRowEstimates = 0;

  const tablesWithoutPrimaryKeys = [];
  const tablesWithoutForeignKeys = [];

  for (const object of tables) {
    const metadata = object.metadata ?? {};
    const details = metadata.tableDetails ?? {};

    const columns = metadata.columns ?? [];
    const indexes = metadata.indexes ?? [];
    const primaryKeys = metadata.primaryKeys ?? [];
    const foreignKeys = metadata.foreignKeys ?? [];

    totalColumns += columns.length;
    totalIndexes += indexes.length;
    totalPrimaryKeyColumns += primaryKeys.length;
    totalForeignKeyColumns += foreignKeys.length;

    if (primaryKeys.length === 0) {
      tablesWithoutPrimaryKeys.push(object.object_name);
    }

    if (foreignKeys.length === 0) {
      tablesWithoutForeignKeys.push(object.object_name);
    }

    if (details.estimatedRows !== null &&
        details.estimatedRows !== undefined) {
      totalEstimatedRows += details.estimatedRows;
      tablesWithRowEstimates++;
    }

    totalDataLengthBytes += details.dataLengthBytes ?? 0;
    totalIndexLengthBytes += details.indexLengthBytes ?? 0;

    for (const column of columns) {
      const dataType = column.dataType ?? 'unknown';

      dataTypeDistribution[dataType] =
        (dataTypeDistribution[dataType] ?? 0) + 1;
    }
  }

  for (const view of views) {
    totalColumns += view.metadata?.columns?.length ?? 0;

    totalViewDependencies +=
      view.metadata?.viewDependencies?.length ?? 0;

    for (const column of view.metadata?.columns ?? []) {
      const dataType = column.dataType ?? 'unknown';

      dataTypeDistribution[dataType] =
        (dataTypeDistribution[dataType] ?? 0) + 1;
    }
  }

  const relationshipKeys = new Set();

  for (const object of tables) {
    for (const foreignKey of object.metadata?.foreignKeys ?? []) {
      relationshipKeys.add(
        JSON.stringify([
          object.schema_name,
          object.object_name,
          foreignKey.constraintName,
          foreignKey.referencedSchema,
          foreignKey.referencedTable,
        ])
      );
    }
  }

  const insights = [];

  if (tablesWithoutPrimaryKeys.length > 0) {
    insights.push({
      type: 'tables_without_primary_keys',
      severity: 'warning',
      count: tablesWithoutPrimaryKeys.length,
      tables: tablesWithoutPrimaryKeys,
      message: 'Some tables do not have a declared primary key.',
    });
  }

  if (tablesWithoutForeignKeys.length > 0) {
    insights.push({
      type: 'tables_without_foreign_keys',
      severity: 'info',
      count: tablesWithoutForeignKeys.length,
      tables: tablesWithoutForeignKeys,
      message: 'Some tables do not declare foreign-key relationships.',
    });
  }

  return {
    objectCount: schemaMetadata.length,
    tableCount: tables.length,
    viewCount: views.length,
    columnCount: totalColumns,
    indexCount: totalIndexes,
    primaryKeyColumnCount: totalPrimaryKeyColumns,
    foreignKeyColumnCount: totalForeignKeyColumns,
    relationshipCount: relationshipKeys.size,
    viewDependencyCount: totalViewDependencies,

    storage: {
      estimatedRows: totalEstimatedRows,
      tablesWithRowEstimates,
      dataLengthBytes: totalDataLengthBytes,
      indexLengthBytes: totalIndexLengthBytes,
      totalAllocatedDataAndIndexBytes:
        totalDataLengthBytes + totalIndexLengthBytes,
    },

    dataTypeDistribution,
    insights,
  };
}
