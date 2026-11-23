
import {
  estimateColumnSelectivity,
} from './column-selectivity.service.js';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function quoteIdentifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``;
}

function getSchemaObject(schemaMetadata, tableAnalysis) {
  return schemaMetadata.find((item) =>
    item.object_type === 'table' &&
    item.object_name.toLowerCase() ===
      tableAnalysis.tableName.toLowerCase() &&
    (
      !tableAnalysis.schemaName ||
      item.schema_name.toLowerCase() ===
        tableAnalysis.schemaName.toLowerCase()
    )
  ) ?? null;
}

function getColumnMetadata(table, columnName) {
  return (table.metadata?.columns ?? []).find(
    (column) =>
      column.columnName.toLowerCase() === columnName.toLowerCase()
  ) ?? null;
}

function getColumnStatistics(table, columnName) {
  return (table.metadata?.columnStatistics ?? []).find(
    (statistics) =>
      statistics.columnName.toLowerCase() === columnName.toLowerCase()
  ) ?? null;
}

function getPredicateColumns(tableAnalysis, type) {
  return (tableAnalysis.predicates ?? [])
    .filter((predicate) => predicate.type === type)
    .map((predicate) => predicate.columnName);
}

function getJoinColumns(tableAnalysis) {
  return (tableAnalysis.joins ?? [])
    .map((item) => item.columnName);
}

function getOrderColumns(tableAnalysis) {
  return (tableAnalysis.ordering ?? [])
    .map((item) => item.columnName);
}

function getVisibleBtreeIndexes(table) {
  return (table.metadata?.indexes ?? []).filter(
    (index) =>
      index.isVisible !== false &&
      String(index.indexType ?? '').toUpperCase() === 'BTREE'
  );
}

function getIndexColumnNames(index) {
  return (index.columns ?? [])
    .slice()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((part) => part.columnName)
    .filter(Boolean);
}

function inspectIndexCoverage(table, candidateColumns) {
  const indexes = getVisibleBtreeIndexes(table);

  let fullCoverage = null;
  let partialCoverage = null;

  for (const index of indexes) {
    const indexColumns = getIndexColumnNames(index);

    if (indexColumns.length === 0) continue;

    // A prefix index is not treated as full coverage for this purpose.
    const hasPrefixPart = (index.columns ?? []).some(
      (part) => part.prefixLength !== null &&
        part.prefixLength !== undefined
    );

    if (hasPrefixPart) continue;

    const matchesCandidatePrefix = candidateColumns.every(
      (column, position) =>
        indexColumns[position]?.toLowerCase() === column.toLowerCase()
    );

    if (
      matchesCandidatePrefix &&
      indexColumns.length >= candidateColumns.length
    ) {
      fullCoverage = index;
      break;
    }

    const matchesExistingPrefix = indexColumns.every(
      (column, position) =>
        candidateColumns[position]?.toLowerCase() === column.toLowerCase()
    );

    if (
      matchesExistingPrefix &&
      indexColumns.length < candidateColumns.length
    ) {
      partialCoverage ??= index;
    }
  }

  if (fullCoverage) {
    return {
      status: 'fully_covered',
      indexName: fullCoverage.indexName,
    };
  }

  if (partialCoverage) {
    return {
      status: 'partially_covered',
      indexName: partialCoverage.indexName,
    };
  }

  return {
    status: 'not_covered',
    indexName: null,
  };
}

function getPredicateForColumn(tableAnalysis, columnName) {
  return (tableAnalysis.predicates ?? []).find(
    (predicate) =>
      predicate.columnName.toLowerCase() === columnName.toLowerCase()
  ) ?? null;
}

function buildCandidateColumnDetails(
  table,
  tableAnalysis,
  columns,
  estimatedRows
) {
  return columns.map((columnName) => {
    const predicate = getPredicateForColumn(
      tableAnalysis,
      columnName
    );

    const columnMetadata = getColumnMetadata(table, columnName);
    const columnStatistics = getColumnStatistics(table, columnName);

    const selectivity = predicate
      ? estimateColumnSelectivity({
          predicate,
          column: columnMetadata,
          columnStatistics,
          estimatedTableRows: estimatedRows,
        })
      : null;

    const isJoinColumn = getJoinColumns(tableAnalysis)
      .some((item) => item.toLowerCase() === columnName.toLowerCase());

    const isOrderColumn = getOrderColumns(tableAnalysis)
      .some((item) => item.toLowerCase() === columnName.toLowerCase());

    return {
      columnName,
      predicateType: predicate?.type ?? (
        isJoinColumn ? 'join' :
        isOrderColumn ? 'ordering' :
        'other'
      ),
      operator: predicate?.operator ?? null,
      selectivity,
      isJoinColumn,
      isOrderColumn,
    };
  });
}

function orderCandidateColumns(tableAnalysis) {
  const equalityColumns = getPredicateColumns(
    tableAnalysis,
    'equality'
  );

  const joinColumns = getJoinColumns(tableAnalysis);

  const rangeColumns = getPredicateColumns(
    tableAnalysis,
    'range'
  );

  const orderColumns = getOrderColumns(tableAnalysis);

  return unique([
    ...equalityColumns,
    ...joinColumns,
    ...rangeColumns,
    ...orderColumns,
  ]);
}

function makeIndexName(tableName, columns) {
  const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
  const safeColumns = columns
    .map((column) => column.replace(/[^a-zA-Z0-9_]/g, '_'))
    .join('_');

  return `idx_adb_${safeTable}_${safeColumns}`.slice(0, 60);
}

function buildAdvisorySql(table, indexName, columns) {
  const databaseName = table.schema_name;
  const tableName = table.object_name;

  return (
    `CREATE INDEX ${quoteIdentifier(indexName)} ` +
    `ON ${quoteIdentifier(databaseName)}.${quoteIdentifier(tableName)} ` +
    `(${columns.map(quoteIdentifier).join(', ')});`
  );
}

/**
 * Generate index candidates using advanced query analysis and saved metadata.
 *
 * This function does not execute DDL.
 */
export function generateIndexCandidates({
  advancedAnalysis,
  schemaMetadata,
  executionPlan,
}) {
  if (!advancedAnalysis || !Array.isArray(advancedAnalysis.tables)) {
    throw new TypeError('Advanced query analysis is required.');
  }

  if (!Array.isArray(schemaMetadata)) {
    throw new TypeError('Schema metadata must be an array.');
  }

  const candidates = [];

  for (const tableAnalysis of advancedAnalysis.tables) {
    if (!tableAnalysis.schemaFound) continue;

    const table = getSchemaObject(schemaMetadata, tableAnalysis);

    if (!table) continue;

    const candidateColumns = orderCandidateColumns(tableAnalysis);

    if (candidateColumns.length === 0) continue;

    const knownColumns = new Set(
      (table.metadata?.columns ?? []).map(
        (column) => column.columnName.toLowerCase()
      )
    );

    const validColumns = candidateColumns.filter(
      (column) => knownColumns.has(column.toLowerCase())
    );

    if (validColumns.length === 0) continue;

    const rawEstimatedRows =
  table.metadata?.tableDetails?.estimatedRows;

const estimatedRows =
  rawEstimatedRows === null || rawEstimatedRows === undefined
    ? null
    : Number.isFinite(Number(rawEstimatedRows))
      ? Number(rawEstimatedRows)
      : null;

    const columnDetails = buildCandidateColumnDetails(
      table,
      tableAnalysis,
      validColumns,
      estimatedRows
    );

    const coverage = inspectIndexCoverage(table, validColumns);

    const tableAccess = (
  executionPlan?.tableAccesses ?? []
).find((access) => {
  const accessName = access.tableName.toLowerCase();

  return (
    accessName === table.object_name.toLowerCase() ||
    accessName === tableAnalysis.alias?.toLowerCase()
  );
}) ?? null;

    const indexName = makeIndexName(
      table.object_name,
      validColumns
    );

    candidates.push({
      tableName: table.object_name,
      schemaName: table.schema_name,
      indexName,
      columns: validColumns,
      columnDetails,
      estimatedTableRows: estimatedRows,
      existingIndexCount: (
        table.metadata?.indexes ?? []
      ).length,
      existingIndexCoverage: coverage,
      optimizerEvidence: tableAccess
        ? {
            accessType: tableAccess.accessType,
            possibleKeys: tableAccess.possibleKeys ?? [],
            chosenKey: tableAccess.chosenKey ?? null,
            estimatedRows: tableAccess.estimatedRows,
            filteredPercentage: tableAccess.filteredPercentage,
          }
        : null,
      suggestedSql: buildAdvisorySql(
        table,
        indexName,
        validColumns
      ),
      advisoryOnly: true,
    });
  }

  return candidates;
}
