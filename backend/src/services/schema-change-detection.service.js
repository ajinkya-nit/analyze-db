
/**
 * Stable JSON serialization for structural comparisons.
 */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();

    return `{${keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`
    ).join(',')}}`;
  }

  return JSON.stringify(value);
}

function compareCollection(
  beforeItems,
  afterItems,
  getKey,
  getStructuralValue = (item) => item
) {
  const beforeMap = new Map(
    beforeItems.map((item) => [getKey(item), item])
  );

  const afterMap = new Map(
    afterItems.map((item) => [getKey(item), item])
  );

  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, after] of afterMap) {
    if (!beforeMap.has(key)) {
      added.push(after);
      continue;
    }

    const before = beforeMap.get(key);

    if (
      stableStringify(getStructuralValue(before)) !==
      stableStringify(getStructuralValue(after))
    ) {
      modified.push({
        key,
        before,
        after,
      });
    }
  }

  for (const [key, before] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push(before);
    }
  }

  return { added, removed, modified };
}

/**
 * Remove optimizer statistics before comparing snapshots structurally. These
 * values are intentionally persisted for query intelligence but refresh as
 * data changes, without any table-definition change.
 */
function toStructuralSchemaObject(object) {
  if (!object.metadata) {
    return object;
  }

  const {
    columnStatistics: _columnStatistics,
    indexes = [],
    ...metadata
  } = object.metadata;

  return {
    ...object,
    metadata: {
      ...metadata,
      indexes: indexes.map(toStructuralIndex),
    },
  };
}

function toStructuralIndex(index) {
  return {
    ...index,
    columns: (index.columns ?? []).map((column) => {
      const { cardinality: _cardinality, ...structuralColumn } = column;
      return structuralColumn;
    }),
  };
}


function compareProperties(before = {}, after = {}) {
  const toItems = (value) =>
    Object.entries(value ?? {}).map(([property, propertyValue]) => ({
      property,
      value: propertyValue,
    }));

  const changes = compareCollection(
    toItems(before),
    toItems(after),
    (item) => item.property
  );

  return {
    added: changes.added,
    removed: changes.removed,
    modified: changes.modified.map((change) => ({
      property: change.key,
      before: change.before.value,
      after: change.after.value,
    })),
  };
}



function compareObjectDetails(beforeObject, afterObject) {
  const beforeMetadata = beforeObject.metadata ?? {};
  const afterMetadata = afterObject.metadata ?? {};

  return {
    columns: compareCollection(
      beforeMetadata.columns ?? [],
      afterMetadata.columns ?? [],
      (item) => item.columnName
    ),

    primaryKeys: compareCollection(
      beforeMetadata.primaryKeys ?? [],
      afterMetadata.primaryKeys ?? [],
      (item) => `${item.position}:${item.columnName}`
    ),

    foreignKeys: compareCollection(
      beforeMetadata.foreignKeys ?? [],
      afterMetadata.foreignKeys ?? [],
      (item) => `${item.constraintName}:${item.position}:${item.columnName}`
    ),

    indexes: compareCollection(
      beforeMetadata.indexes ?? [],
      afterMetadata.indexes ?? [],
      (item) => item.indexName,
      toStructuralIndex
    ),

    tableProperties: compareProperties(
      beforeMetadata.tableDetails,
      afterMetadata.tableDetails
    ),

    viewProperties: compareProperties(
      beforeMetadata.viewDetails,
      afterMetadata.viewDetails
    ),

    viewDependencies: compareCollection(
      beforeMetadata.viewDependencies ?? [],
      afterMetadata.viewDependencies ?? [],
      (item) =>
        `${item.referencedSchema}.${item.referencedObject}`
    ),
  };
}

/**
 * Compare two complete schema snapshots.
 */
export function detectSchemaChanges(
  previousSnapshot,
  currentSnapshot
) {
  const beforeObjects = previousSnapshot.schema_metadata ?? [];
  const afterObjects = currentSnapshot.schema_metadata ?? [];

  const objectChanges = compareCollection(
    beforeObjects,
    afterObjects,
    (item) =>
      `${item.schema_name}.${item.object_name}`,
    toStructuralSchemaObject
  );

  const addedObjects = objectChanges.added.map((item) => ({
    schemaName: item.schema_name,
    objectName: item.object_name,
    objectType: item.object_type,
  }));

  const removedObjects = objectChanges.removed.map((item) => ({
    schemaName: item.schema_name,
    objectName: item.object_name,
    objectType: item.object_type,
  }));

  const modifiedObjects = objectChanges.modified.map((change) => ({
    schemaName: change.after.schema_name,
    objectName: change.after.object_name,
    objectTypeChanged:
      change.before.object_type !== change.after.object_type,
    changes: compareObjectDetails(
      change.before,
      change.after
    ),
  }));


  const counts = {
    addedObjects: addedObjects.length,
    removedObjects: removedObjects.length,
    modifiedObjects: modifiedObjects.length,

    addedColumns: 0,
    removedColumns: 0,
    modifiedColumns: 0,

    addedPrimaryKeys: 0,
    removedPrimaryKeys: 0,
    modifiedPrimaryKeys: 0,

    addedForeignKeys: 0,
    removedForeignKeys: 0,
    modifiedForeignKeys: 0,

    addedIndexes: 0,
    removedIndexes: 0,
    modifiedIndexes: 0,

    addedTableProperties: 0,
    removedTableProperties: 0,
    modifiedTableProperties: 0,

    addedViewProperties: 0,
    removedViewProperties: 0,
    modifiedViewProperties: 0,

    addedViewDependencies: 0,
    removedViewDependencies: 0,
    modifiedViewDependencies: 0,
  };

  const countKeys = {
    columns: 'Columns',
    primaryKeys: 'PrimaryKeys',
    foreignKeys: 'ForeignKeys',
    indexes: 'Indexes',
    tableProperties: 'TableProperties',
    viewProperties: 'ViewProperties',
    viewDependencies: 'ViewDependencies',
  };

  for (const object of modifiedObjects) {
    for (const [section, changes] of Object.entries(object.changes)) {
      const suffix = countKeys[section];

      counts[`added${suffix}`] += changes.added.length;
      counts[`removed${suffix}`] += changes.removed.length;
      counts[`modified${suffix}`] += changes.modified.length;
    }
  }


  const totalChanges = Object.values(counts).reduce(
    (total, count) => total + count,
    0
  );

  return {
    previousSnapshot: {
      id: previousSnapshot.id,
      snapshotNumber: Number(previousSnapshot.snapshot_number),
      createdAt: previousSnapshot.created_at,
    },

    currentSnapshot: {
      id: currentSnapshot.id,
      snapshotNumber: Number(currentSnapshot.snapshot_number),
      createdAt: currentSnapshot.created_at,
    },

    hasChanges: totalChanges > 0,
    totalChanges,
    counts,

    objects: {
      added: addedObjects,
      removed: removedObjects,
      modified: modifiedObjects,
    },
  };
}
