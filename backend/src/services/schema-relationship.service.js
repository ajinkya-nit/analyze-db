
/**
 * Build a relationship graph from persisted schema metadata.
 *
 * Foreign keys are grouped by constraint so composite foreign keys
 * are represented as one relationship with multiple column mappings.
 */
export function buildSchemaRelationshipGraph(schemaMetadata) {
  const nodes = schemaMetadata.map((object) => ({
    id: `${object.schema_name}.${object.object_name}`,
    schemaName: object.schema_name,
    tableName: object.object_name,
    objectType: object.object_type,
    columnCount: object.metadata?.columns?.length ?? 0,
  }));

  const relationshipGroups = new Map();

  for (const object of schemaMetadata) {
    if (object.object_type !== 'table') {
      continue;
    }

    const foreignKeys = object.metadata?.foreignKeys ?? [];

    for (const foreignKey of foreignKeys) {
      const groupKey = JSON.stringify([
        object.schema_name,
        object.object_name,
        foreignKey.constraintName,
        foreignKey.referencedSchema,
        foreignKey.referencedTable,
      ]);

      if (!relationshipGroups.has(groupKey)) {
        relationshipGroups.set(groupKey, {
          source: `${object.schema_name}.${object.object_name}`,
          target: `${foreignKey.referencedSchema}.${foreignKey.referencedTable}`,
          constraintName: foreignKey.constraintName,
          columns: [],
          updateRule: foreignKey.updateRule,
          deleteRule: foreignKey.deleteRule,
        });
      }

      relationshipGroups.get(groupKey).columns.push({
        sourceColumn: foreignKey.columnName,
        targetColumn: foreignKey.referencedColumn,
        position: foreignKey.position,
      });
    }
  }

  const edges = Array.from(relationshipGroups.values());

  for (const edge of edges) {
    edge.columns.sort((a, b) => a.position - b.position);
  }

  const connectedNodeIds = new Set();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const isolatedNodes = nodes
    .filter((node) => !connectedNodeIds.has(node.id))
    .map((node) => node.id);

  return {
    nodes,
    edges,
    statistics: {
      nodeCount: nodes.length,
      relationshipCount: edges.length,
      isolatedNodeCount: isolatedNodes.length,
      isolatedNodes,
    },
  };
}
