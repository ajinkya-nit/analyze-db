
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

function compareCollection(beforeItems, afterItems, getKey) {
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

    if (stableStringify(before) !== stableStringify(after)) {
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
      (item) => item.indexName
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
      `${item.schema_name}.${item.object_name}`
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
  };

  for (const object of modifiedObjects) {
    for (const [section, changes] of Object.entries(object.changes)) {
      const prefix = {
        columns: 'Column',
        primaryKeys: 'PrimaryKey',
        foreignKeys: 'ForeignKey',
        indexes: 'Index',
      }[section];

      counts[`added${prefix}s`] += changes.added.length;
      counts[`removed${prefix}s`] += changes.removed.length;
      counts[`modified${prefix}s`] += changes.modified.length;
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
