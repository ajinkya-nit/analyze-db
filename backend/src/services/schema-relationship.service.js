
/**
 * Build foreign-key and view-dependency graphs.
 */
export function buildSchemaRelationshipGraph(schemaMetadata) {
  const nodes = schemaMetadata.map((object) => ({
    id: `${object.schema_name}.${object.object_name}`,
    schemaName: object.schema_name,
    tableName: object.object_name,
    objectType: object.object_type,
    columnCount: object.metadata?.columns?.length ?? 0,
  }));

  const foreignKeyGroups = new Map();
  const dependencyGroups = new Map();

  for (const object of schemaMetadata) {
    const sourceId =
      `${object.schema_name}.${object.object_name}`;

    if (object.object_type === 'table') {
      for (const foreignKey of object.metadata?.foreignKeys ?? []) {
        const groupKey = JSON.stringify([
          object.schema_name,
          object.object_name,
          foreignKey.constraintName,
          foreignKey.referencedSchema,
          foreignKey.referencedTable,
        ]);

        if (!foreignKeyGroups.has(groupKey)) {
          foreignKeyGroups.set(groupKey, {
            source: sourceId,
            target:
              `${foreignKey.referencedSchema}.${foreignKey.referencedTable}`,
            constraintName: foreignKey.constraintName,
            columns: [],
            updateRule: foreignKey.updateRule,
            deleteRule: foreignKey.deleteRule,
          });
        }

        foreignKeyGroups.get(groupKey).columns.push({
          sourceColumn: foreignKey.columnName,
          targetColumn: foreignKey.referencedColumn,
          position: foreignKey.position,
        });
      }
    }

    if (object.object_type === 'view') {
      for (const dependency of object.metadata?.viewDependencies ?? []) {
        const targetId =
          `${dependency.referencedSchema}.${dependency.referencedObject}`;

        const groupKey = JSON.stringify([sourceId, targetId]);

        if (!dependencyGroups.has(groupKey)) {
          dependencyGroups.set(groupKey, {
            source: sourceId,
            target: targetId,
            relationshipType: 'view_dependency',
          });
        }
      }
    }
  }

  const foreignKeyEdges = Array.from(foreignKeyGroups.values());

  for (const edge of foreignKeyEdges) {
    edge.columns.sort((a, b) => a.position - b.position);
  }

  const viewDependencyEdges =
    Array.from(dependencyGroups.values());

  const connectedNodeIds = new Set();

  for (const edge of foreignKeyEdges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  for (const edge of viewDependencyEdges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const isolatedNodes = nodes
    .filter((node) => !connectedNodeIds.has(node.id))
    .map((node) => node.id);

  return {
    nodes,

    edges: foreignKeyEdges,

    viewDependencyEdges,

    statistics: {
      nodeCount: nodes.length,
      relationshipCount: foreignKeyEdges.length,
      viewDependencyCount: viewDependencyEdges.length,
      isolatedNodeCount: isolatedNodes.length,
      isolatedNodes,
    },
  };
}
