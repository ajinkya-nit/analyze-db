
function getIndexParts(index) {
  return (index.columns ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
}

function getIndexSignature(index) {
  const parts = getIndexParts(index);

  return JSON.stringify({
    unique: index.isUnique === true,
    type: index.indexType ?? null,
    parts: parts.map((part) => ({
      columnName: part.columnName ?? null,
      expression: part.expression ?? null,
      sortDirection: part.sortDirection ?? null,
      prefixLength: part.prefixLength ?? null,
    })),
  });
}

function canCompareAsBtree(index) {
  return (index.indexType ?? '').toUpperCase() === 'BTREE';
}

function hasFullColumnParts(index) {
  const parts = getIndexParts(index);

  return parts.length > 0 && parts.every(
    (part) =>
      typeof part.columnName === 'string' &&
      part.columnName.length > 0 &&
      !part.expression &&
      part.prefixLength == null
  );
}

function isLeftPrefix(shorterIndex, longerIndex) {
  const shorter = getIndexParts(shorterIndex);
  const longer = getIndexParts(longerIndex);

  if (
    shorter.length === 0 ||
    shorter.length >= longer.length ||
    !hasFullColumnParts(shorterIndex) ||
    !hasFullColumnParts(longerIndex)
  ) {
    return false;
  }

  return shorter.every((part, position) => {
    const longerPart = longer[position];

    return (
      part.columnName === longerPart.columnName &&
      (part.sortDirection ?? null) ===
        (longerPart.sortDirection ?? null)
    );
  });
}

function groupForeignKeys(foreignKeys) {
  const groups = new Map();

  for (const foreignKey of foreignKeys) {
    const key = JSON.stringify([
      foreignKey.constraintName,
      foreignKey.referencedSchema,
      foreignKey.referencedTable,
    ]);

    if (!groups.has(key)) {
      groups.set(key, {
        constraintName: foreignKey.constraintName,
        referencedSchema: foreignKey.referencedSchema,
        referencedTable: foreignKey.referencedTable,
        columns: [],
      });
    }

    groups.get(key).columns.push({
      columnName: foreignKey.columnName,
      position: foreignKey.position,
    });
  }

  return Array.from(groups.values()).map((foreignKey) => ({
    ...foreignKey,
    columns: foreignKey.columns.sort(
      (a, b) => a.position - b.position
    ),
  }));
}

function indexCoversForeignKey(index, foreignKey) {
  const indexParts = getIndexParts(index);

  if (indexParts.length < foreignKey.columns.length) {
    return false;
  }

  return foreignKey.columns.every((foreignKeyColumn, position) => {
    const indexPart = indexParts[position];

    return (
      indexPart.columnName === foreignKeyColumn.columnName &&
      !indexPart.expression &&
      indexPart.prefixLength == null
    );
  });
}

function analyzeTable(object) {
  const metadata = object.metadata ?? {};
  const indexes = metadata.indexes ?? [];
  const foreignKeys = groupForeignKeys(
    metadata.foreignKeys ?? []
  );

  const findings = [];

  // 1. Invisible indexes.
  for (const index of indexes) {
    if (index.isVisible === false) {
      findings.push({
        type: 'invisible_index',
        severity: 'info',
        tableName: object.object_name,
        indexName: index.indexName,
        message: 'This index is invisible to the MySQL optimizer.',
        recommendation:
          'Review whether the index is still needed before changing its visibility.',
      });
    }
  }

  // 2. Exact duplicate secondary indexes.
  const signatureGroups = new Map();

  for (const index of indexes) {
    if (index.isPrimary === true) {
      continue;
    }

    const signature = getIndexSignature(index);

    if (!signatureGroups.has(signature)) {
      signatureGroups.set(signature, []);
    }

    signatureGroups.get(signature).push(index);
  }

  for (const group of signatureGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const retainedIndex = group[0];

    for (const duplicate of group.slice(1)) {
      findings.push({
        type: 'duplicate_index',
        severity: 'warning',
        tableName: object.object_name,
        indexName: duplicate.indexName,
        relatedIndexName: retainedIndex.indexName,
        message:
          `Index "${duplicate.indexName}" duplicates "${retainedIndex.indexName}".`,
        recommendation:
          'Review the duplicate index and its dependencies before considering removal.',
      });
    }
  }

  // 3. Redundant left-prefix indexes.
  for (const candidate of indexes) {
    if (
      candidate.isPrimary === true ||
      candidate.isUnique === true ||
      !canCompareAsBtree(candidate)
    ) {
      continue;
    }

    const coveringIndexes = indexes.filter((other) => (
      other.indexName !== candidate.indexName &&
      canCompareAsBtree(other) &&
      isLeftPrefix(candidate, other)
    ));

    if (coveringIndexes.length === 0) {
      continue;
    }

    coveringIndexes.sort(
      (a, b) =>
        getIndexParts(a).length - getIndexParts(b).length
    );

    findings.push({
      type: 'redundant_index',
      severity: 'warning',
      tableName: object.object_name,
      indexName: candidate.indexName,
      relatedIndexName: coveringIndexes[0].indexName,
      message:
        `Index "${candidate.indexName}" is a left-prefix of "${coveringIndexes[0].indexName}".`,
      recommendation:
        'Review query plans and index usage before considering removal.',
    });
  }

  // 4. Foreign-key index coverage.
  for (const foreignKey of foreignKeys) {
    const visibleCoveringIndexes = indexes.filter(
      (index) =>
        index.isVisible !== false &&
        canCompareAsBtree(index) &&
        indexCoversForeignKey(index, foreignKey)
    );

    const invisibleCoveringIndexes = indexes.filter(
      (index) =>
        index.isVisible === false &&
        canCompareAsBtree(index) &&
        indexCoversForeignKey(index, foreignKey)
    );

    if (visibleCoveringIndexes.length > 0) {
      continue;
    }

    if (invisibleCoveringIndexes.length > 0) {
      findings.push({
        type: 'foreign_key_covered_only_by_invisible_index',
        severity: 'warning',
        tableName: object.object_name,
        constraintName: foreignKey.constraintName,
        columns: foreignKey.columns.map(
          (column) => column.columnName
        ),
        relatedIndexNames: invisibleCoveringIndexes.map(
          (index) => index.indexName
        ),
        message:
          'Foreign-key columns are covered only by invisible indexes.',
        recommendation:
          'Review index visibility and execution plans for queries using this relationship.',
      });

      continue;
    }

    findings.push({
      type: 'foreign_key_without_visible_index',
      severity: 'warning',
      tableName: object.object_name,
      constraintName: foreignKey.constraintName,
      columns: foreignKey.columns.map(
        (column) => column.columnName
      ),
      referencedTable:
        `${foreignKey.referencedSchema}.${foreignKey.referencedTable}`,
      message:
        'No visible index with the foreign-key columns as its leading columns was found.',
      recommendation:
        'Evaluate a composite index beginning with the foreign-key columns.',
    });
  }

  return {
    schemaName: object.schema_name,
    tableName: object.object_name,
    indexCount: indexes.length,
    foreignKeyCount: foreignKeys.length,
    findings,
  };
}

/**
 * Analyze persisted MySQL index metadata.
 */
export function analyzeSchemaIndexes(schemaMetadata) {
  const tables = schemaMetadata.filter(
    (object) => object.object_type === 'table'
  );

  const tableResults = tables.map(analyzeTable);

  const findings = tableResults.flatMap(
    (table) => table.findings
  );

  const counts = {
    duplicateIndexes: 0,
    redundantIndexes: 0,
    invisibleIndexes: 0,
    foreignKeysWithoutVisibleIndex: 0,
    foreignKeysCoveredOnlyByInvisibleIndex: 0,
  };

  for (const finding of findings) {
    switch (finding.type) {
      case 'duplicate_index':
        counts.duplicateIndexes++;
        break;
      case 'redundant_index':
        counts.redundantIndexes++;
        break;
      case 'invisible_index':
        counts.invisibleIndexes++;
        break;
      case 'foreign_key_without_visible_index':
        counts.foreignKeysWithoutVisibleIndex++;
        break;
      case 'foreign_key_covered_only_by_invisible_index':
        counts.foreignKeysCoveredOnlyByInvisibleIndex++;
        break;
      default:
        break;
    }
  }

  return {
    tableCount: tables.length,
    indexCount: tableResults.reduce(
      (total, table) => total + table.indexCount,
      0
    ),
    findingCount: findings.length,
    counts,
    findings,
    tables: tableResults,
    limitations: [
      'Index usage and query workload are not analyzed.',
      'Storage engine and optimizer behavior can affect index usefulness.',
      'Redundancy findings require execution-plan and workload review before index removal.',
      'Foreign-key coverage is evaluated using leading index columns.',
    ],
  };
}
